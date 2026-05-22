from flask import Blueprint, request, jsonify  # Flask 相關模組
from supabase import create_client  # 從 supabase 套件取出 create_client 函式
import httpx  # 用來發送 HTTP 請求，直接呼叫 Supabase admin API
import os  # 讀取環境變數

user_bp = Blueprint('user', __name__)  # 建立 user 藍圖，所有路由前面會加上 /user

# 建立 Supabase 連線
supabase = create_client(
    os.environ.get('SUPABASE_URL'),  # 資料庫位置，從環境變數讀取
    os.environ.get('SUPABASE_KEY')   # API 金鑰，secret key 有最高權限可繞過 RLS
)

# Supabase admin API 的共用 headers
SUPABASE_ADMIN_HEADERS = {
    'apikey': os.environ.get('SUPABASE_KEY'),                     # API 金鑰
    'Authorization': f'Bearer {os.environ.get("SUPABASE_KEY")}',  # Bearer token 驗證
    'Content-Type': 'application/json'                            # 傳送 JSON 格式
}

# 每月免費修改暱稱次數上限
FREE_NICKNAME_CHANGE_LIMIT = 3  # 每月免費 3 次
NICKNAME_CHANGE_COST = 500      # 超過免費次數每次花 500 金幣

def admin_delete_user(user_id):
    """用 httpx 直接呼叫 Supabase admin API 刪除使用者"""
    httpx.delete(
        f'{os.environ.get("SUPABASE_URL")}/auth/v1/admin/users/{user_id}',  # admin API 網址
        headers=SUPABASE_ADMIN_HEADERS  # 帶上 admin headers
    )

# 取得玩家資料 API
# 路徑：GET /user/profile/<user_id>
# 傳入：URL 參數 user_id
@user_bp.route('/profile/<user_id>', methods=['GET'])  # 定義 GET /profile/<user_id> 路由
def get_profile(user_id):
    # 查詢玩家資料
    user_response = supabase.table('users').select(
        'id, custom_id, email, is_verified, coins, avatar_url, nickname, nickname_change_count, nickname_last_reset, created_at'
    ).eq('id', user_id).execute()  # 條件：找這個 id 的玩家

    # 找不到玩家
    if not user_response.data:
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 計算本月剩餘免費修改暱稱次數
    from datetime import datetime, timezone  # 載入日期時間模組
    last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])  # 上次重置時間，轉成日期物件
    now = datetime.now(timezone.utc)  # 現在時間（UTC）

    # 判斷是否過了一個自然月：年份不同，或月份不同
    is_new_month = now.year > last_reset.year or now.month > last_reset.month

    # 如果過了一個月，剩餘次數重置為 3，否則用目前的次數計算
    remaining_free = FREE_NICKNAME_CHANGE_LIMIT if is_new_month else max(0, FREE_NICKNAME_CHANGE_LIMIT - user_data['nickname_change_count'])

    return jsonify({
        'id': user_data['id'],                        # 玩家唯一 ID
        'custom_id': user_data['custom_id'],          # 玩家自訂 ID
        'email': user_data['email'],                  # 玩家 email
        'is_verified': user_data['is_verified'],      # 是否已驗證
        'coins': user_data['coins'],                  # 金幣數量
        'avatar_url': user_data['avatar_url'],        # 頭像網址
        'nickname': user_data['nickname'],            # 遊戲暱稱
        'nickname_remaining_free': remaining_free,    # 本月剩餘免費修改暱稱次數
        'created_at': user_data['created_at']         # 帳號建立時間
    }), 200  # 200 成功

# 修改頭像 API
# 路徑：POST /user/avatar
# 傳入：multipart/form-data，包含 user_id 和 avatar（圖片檔案）或 avatar_url（網址）
@user_bp.route('/avatar', methods=['POST'])  # 定義 POST /avatar 路由
def update_avatar():
    user_id = request.form.get('user_id')        # 從 form data 取出 user_id
    url_from_body = request.form.get('avatar_url')  # 從 form data 取出 avatar_url
    file = request.files.get('avatar')           # 取得上傳的圖片檔案

    # 防呆：user_id 必填
    if not user_id:
        return jsonify({'error': '請填寫 user_id'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：圖片檔案和網址至少要有一個
    if not file and not url_from_body:
        return jsonify({'error': '請上傳圖片或填寫頭像網址'}), 400  # 400 客戶端錯誤：沒有圖片也沒有網址

    # 允許的副檔名
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.ico', '.psd', '.tga', '.xpm', '.pcx', '.ppm'}
    # 允許的 MIME 類型
    allowed_mimetypes = {'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/x-bmp', 'image/tiff', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/psd', 'image/x-photoshop', 'image/x-tga', 'image/x-xpm', 'image/x-pcx', 'application/octet-stream'}

    avatar_url = None  # 最終要存進資料庫的頭像網址

    if file:  # 如果有上傳圖片檔案，上傳到 Supabase Storage
        import os as os_module  # 載入 os 模組
        file_ext = os_module.path.splitext(file.filename)[1].lower()  # 取得副檔名並轉小寫

        # 防呆：檢查副檔名或 MIME 類型是否允許
        if file_ext not in allowed_extensions and file.mimetype not in allowed_mimetypes:
            return jsonify({'error': '只允許上傳圖片檔案'}), 400  # 400 客戶端錯誤：檔案類型不允許

        import time  # 載入時間模組
        file_name = f'{user_id}_{int(time.time() * 1000)}{file_ext}'  # 格式：玩家ID_時間戳記.副檔名
        file_data = file.read()  # 讀取圖片的二進位資料

        # 上傳圖片到 Supabase Storage 的 avatars bucket
        supabase.storage.from_('avatars').upload(
            file_name,   # 檔案名稱
            file_data,   # 圖片的二進位資料
            {'content-type': file.mimetype, 'upsert': 'true'}  # 設定檔案類型，如果已存在就覆蓋
        )

        # 取得圖片的公開網址
        avatar_url = supabase.storage.from_('avatars').get_public_url(file_name)

    else:  # 如果沒有上傳圖片，直接用前端傳來的網址
        # 防呆：驗證 avatar_url 格式，必須是 http 或 https 開頭
        if not url_from_body.startswith('http://') and not url_from_body.startswith('https://'):
            return jsonify({'error': '頭像網址格式不正確'}), 400  # 400 客戶端錯誤：網址格式錯誤
        avatar_url = url_from_body  # 使用前端傳來的網址

    # 更新資料庫裡的頭像網址
    supabase.table('users').update({'avatar_url': avatar_url}).eq('id', user_id).execute()

    return jsonify({'message': '頭像更新成功', 'avatar_url': avatar_url}), 200  # 200 成功

# 修改暱稱 API
# 路徑：POST /user/nickname
# 傳入：{ user_id, new_nickname }
@user_bp.route('/nickname', methods=['POST'])  # 定義 POST /nickname 路由
def update_nickname():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')        # 取出 user_id 欄位
    new_nickname = data.get('new_nickname')  # 取出 new_nickname 欄位

    # 防呆：兩個欄位都必填
    if not user_id or not new_nickname:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：暱稱長度 2-20 字
    if len(new_nickname) < 2 or len(new_nickname) > 20:
        return jsonify({'error': '暱稱長度需在 2-20 字之間'}), 400  # 400 客戶端錯誤：暱稱長度不符

    # 查詢玩家資料，取得目前的金幣、修改次數、上次重置時間
    user_response = supabase.table('users').select(
        'coins, nickname_change_count, nickname_last_reset'
    ).eq('id', user_id).execute()  # 條件：找這個玩家

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 判斷是否需要重置修改次數
    from datetime import datetime, timezone  # 載入日期時間模組
    last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])  # 上次重置時間
    now = datetime.now(timezone.utc)  # 現在時間（UTC）

    # 判斷是否過了一個自然月：年份不同，或月份不同
    is_new_month = now.year > last_reset.year or now.month > last_reset.month

    current_count = user_data['nickname_change_count']  # 目前的修改次數
    reset_time = user_data['nickname_last_reset']       # 上次重置時間

    # 如果過了一個自然月，重置修改次數
    if is_new_month:
        current_count = 0           # 重置次數為 0
        reset_time = now.isoformat()  # 更新重置時間為現在

    # 判斷是否需要花金幣，超過免費次數就需要花金幣
    need_coins = current_count >= FREE_NICKNAME_CHANGE_LIMIT

    # 如果需要花金幣，檢查金幣是否足夠
    if need_coins:
        if user_data['coins'] < NICKNAME_CHANGE_COST:
            return jsonify({
                'error': f'金幣不足，修改暱稱需要 {NICKNAME_CHANGE_COST} 金幣，目前只有 {user_data["coins"]} 金幣'
            }), 400  # 400 客戶端錯誤：金幣不足

    # 準備要更新的資料
    update_data = {
        'nickname': new_nickname,                      # 新暱稱
        'nickname_change_count': current_count + 1,    # 修改次數加 1
        'nickname_last_reset': reset_time              # 重置時間
    }

    # 如果需要花金幣，扣除金幣
    if need_coins:
        update_data['coins'] = user_data['coins'] - NICKNAME_CHANGE_COST  # 扣除 500 金幣

    # 更新資料庫
    supabase.table('users').update(update_data).eq('id', user_id).execute()

    return jsonify({
        'message': '暱稱更新成功',
        'cost_coins': NICKNAME_CHANGE_COST if need_coins else 0,                                          # 花了多少金幣
        'remaining_free': max(0, FREE_NICKNAME_CHANGE_LIMIT - (current_count + 1)),                       # 剩餘免費次數
        'remaining_coins': user_data['coins'] - NICKNAME_CHANGE_COST if need_coins else user_data['coins'] # 剩餘金幣
    }), 200  # 200 成功

# 刪除帳號 API
# 路徑：DELETE /user/delete
# 傳入：{ user_id, password }，需要輸入密碼確認才能刪除
@user_bp.route('/delete', methods=['DELETE'])  # 定義 DELETE /delete 路由
def delete_account():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')    # 取出 user_id 欄位
    password = data.get('password')  # 取出 password 欄位

    # 防呆：兩個欄位都必填
    if not user_id or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 查詢玩家的 email 和頭像，用來驗證密碼和刪除頭像
    user_response = supabase.table('users').select('email, avatar_url').eq('id', user_id).execute()

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 用密碼嘗試登入，驗證密碼是否正確
    try:
        auth_response = supabase.auth.sign_in_with_password({'email': user_data['email'], 'password': password})
        if auth_response.user is None:  # 登入失敗
            return jsonify({'error': '密碼錯誤'}), 400  # 400 客戶端錯誤：密碼不正確
    except Exception:
        return jsonify({'error': '密碼錯誤'}), 400  # 400 客戶端錯誤：密碼不正確

    # 如果有頭像圖片存在 Supabase Storage，刪除它
    if user_data['avatar_url'] and 'supabase.co/storage' in user_data['avatar_url']:
        file_name = user_data['avatar_url'].split('/')[-1]  # 從網址取得檔案名稱
        supabase.storage.from_('avatars').remove([file_name])  # 刪除這個檔案

    # 刪除 users 資料表的資料
    supabase.table('users').delete().eq('id', user_id).execute()

    # 刪除 Supabase Auth 的帳號
    admin_delete_user(user_id)

    return jsonify({'message': '帳號已刪除'}), 200  # 200 成功