from flask import Blueprint, request, jsonify
# Blueprint：將此檔案的路由獨立成一個藍圖，在 index.py 以 url_prefix='/user' 掛載
# request：讀取 HTTP 請求的 body（get_json）與 query string（args），例如 user_id、item_type 等參數
# jsonify：將 Python dict 序列化成 JSON 格式的 HTTP 回應物件，並自動設定 Content-Type: application/json
from supabase import create_client  # 建立 Supabase 客戶端實例，提供 .table()、.auth、.storage 等操作介面
import httpx  # 同步 HTTP 客戶端，用於直接呼叫 Supabase Admin REST API 執行刪除帳號等管理員操作
import os  # Python 標準庫，用於讀取環境變數（os.environ.get）與組合檔案路徑（os.path）
import base64  # Python 標準庫，將前端傳來的 base64 字串解碼為二進位圖片資料，再上傳到 Supabase Storage
from dotenv import load_dotenv  # python-dotenv 套件，將 .env 檔案裡的 KEY=VALUE 載入到 os.environ，方便本地開發不需手動設定環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)  # 載入同目錄下的 .env 設定，已有值時不覆蓋

user_bp = Blueprint('user', __name__)  # 使用者功能路由群組，在 index.py 掛載後路由前綴為 /user

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
# 輕量金幣查詢 API
# 路徑：GET /user/coins/<user_id>
@user_bp.route('/coins/<user_id>', methods=['GET'])  # 定義 GET /coins/<user_id> 路由
def get_coins(user_id):  # 快速查詢指定玩家的金幣數量，不回傳完整 profile
    res = supabase.table('users').select('coins').eq('id', user_id).execute()  # 查詢 users 表中指定 id 的金幣欄位
    if not res.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家
    return jsonify({'coins': res.data[0]['coins']}), 200  # 回傳玩家目前金幣數量

def _get_daily_claimed_at(user_id):
    """單獨查詢 daily_claimed_at，欄位不存在時回傳 None。"""
    try:  # 嘗試查詢 daily_claimed_at，欄位不存在時靜默回傳 None
        res = supabase.table('users').select('daily_claimed_at').eq('id', user_id).execute()  # 查詢 users 表中指定玩家的每日禮包領取時間
        if res.data:  # 判斷是否有查到資料
            return res.data[0].get('daily_claimed_at')  # 回傳每日禮包最後領取時間
    except Exception:  # daily_claimed_at 欄位尚未建立時靜默忽略
        pass  # 欄位不存在時靜默忽略，避免整體查詢崩潰
    return None  # 查無資料或欄位不存在時回傳 None


def _get_owned_skills(user_id):
    """單獨查詢 owned_skills，欄位不存在時回傳空陣列避免讓整個 profile 查詢失敗。"""
    try:  # 嘗試查詢 owned_skills，欄位不存在時靜默回傳空陣列
        res = supabase.table('users').select('owned_skills').eq('id', user_id).execute()  # 查詢 users 表中指定玩家的已擁有技能清單
        if res.data:  # 判斷是否有查到資料
            return res.data[0].get('owned_skills') or []  # 回傳技能清單，若為 null 則改為空陣列
    except Exception:  # owned_skills 欄位尚未建立時靜默忽略
        pass  # 欄位不存在時靜默忽略，避免整體 profile 查詢失敗
    return []  # 查無資料或欄位不存在時回傳空陣列


def _get_rename_cards(user_id):
    """單獨查詢 rename_cards，欄位不存在時回傳 0。"""
    try:  # 嘗試查詢 rename_cards，欄位不存在時靜默回傳 0
        res = supabase.table('users').select('rename_cards').eq('id', user_id).execute()  # 查詢 users 表中指定玩家的改名卡數量
        if res.data:  # 判斷是否有查到資料
            return int(res.data[0].get('rename_cards') or 0)  # 回傳改名卡數量，若為 null 則改為 0
    except Exception:  # rename_cards 欄位尚未建立時靜默忽略
        pass  # 欄位不存在時靜默忽略
    return 0  # 查無資料或欄位不存在時回傳 0


# 路徑：GET /user/profile/<user_id>
# 傳入：URL 參數 user_id
@user_bp.route('/profile/<user_id>', methods=['GET'])  # 定義 GET /profile/<user_id> 路由
def get_profile(user_id):  # 查詢並回傳玩家的完整個人資料，含金幣、等級、道具庫存、統計等
    # 查詢玩家資料
    user_response = supabase.table('users').select(
        'id, custom_id, email, is_verified, coins, nickname, nickname_change_count, nickname_last_reset, is_admin, created_at, level, xp, xp_max, wins, losses, total_answered, avg_accuracy, total_score, owned_frames, owned_tags, owned_effects, active_effect, topic_stats, welcome_claimed, pending_levelup_coins, avatar_url, equipped_emoji'
    ).eq('id', user_id).execute()  # 條件：找這個 id 的玩家

    # 找不到玩家
    if not user_response.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 計算本月剩餘免費修改暱稱次數
    from datetime import datetime, timezone  # 載入日期時間模組
    last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])  # 上次重置時間，轉成日期物件
    now = datetime.now(timezone.utc)  # 現在時間（UTC）

    # 判斷是否過了一個自然月：年份不同，或月份不同
    is_new_month = now.year > last_reset.year or now.month > last_reset.month  # 判斷自上次重置至今是否跨越了一個自然月

    # 如果過了一個月，剩餘次數重置為 3，否則用目前的次數計算
    remaining_free = FREE_NICKNAME_CHANGE_LIMIT if is_new_month else max(0, FREE_NICKNAME_CHANGE_LIMIT - user_data['nickname_change_count'])  # 計算本月剩餘免費改名次數：新月份重置為 3，否則以累計次數扣減

    return jsonify({
        'id': user_data['id'],                        # 玩家唯一 ID
        'custom_id': user_data['custom_id'],          # 玩家自訂 ID
        'email': user_data['email'],                  # 玩家 email
        'is_verified': user_data['is_verified'],      # 是否已驗證
        'coins': user_data['coins'],                  # 金幣數量
        'nickname': user_data['nickname'],            # 遊戲暱稱
        'nickname_remaining_free': remaining_free,    # 本月剩餘免費修改暱稱次數
        'is_admin': user_data['is_admin'],            # 是否為管理員
        'created_at': user_data['created_at'],        # 帳號建立時間
        'level': user_data.get('level', 1),                          # 玩家等級，預設 lv1
        'xp': user_data.get('xp', 0),                                  # 當前經驗值，預設 0
        'xp_max': user_data.get('xp_max', 1000),                        # 升級所需 XP，預設 1000
        'wins': user_data.get('wins', 0),                               # 勝場數，預設 0
        'losses': user_data.get('losses', 0),                           # 敗場數，預設 0
        'total_answered': user_data.get('total_answered', 0),           # 累計答題數，預設 0
        'avg_accuracy': user_data.get('avg_accuracy', 0),               # 平均準確率，預設 0
        'total_score': user_data.get('total_score', 0),                  # 累計積分，預設 0
        'owned_frames': user_data.get('owned_frames') or ['frame-none'],   # 已擁有的頭像框
        'owned_tags': user_data.get('owned_tags') or ['tag-rookie'],       # 已擁有的稱號
        'owned_effects': user_data.get('owned_effects') or [],             # 已擁有的特效
        'owned_skills': _get_owned_skills(user_id),                          # 已擁有的對戰技能
        'active_effect': user_data.get('active_effect'),                   # 目前裝備的特效
        'topic_stats': user_data.get('topic_stats') or {},                 # 主題統計
        'avatar_url': user_data.get('avatar_url') or '',                   # 自訂頭像 URL
        'equipped_emoji': user_data.get('equipped_emoji') or '🧠',        # 目前裝備的 emoji 頭貼
        'welcome_claimed': user_data.get('welcome_claimed') or False,      # 是否已領取新手禮包
        'daily_claimed_at': _get_daily_claimed_at(user_id),               # 上次領取每日禮包時間
        'pending_levelup_coins': int(user_data.get('pending_levelup_coins') or 0),  # 待領取的升等獎勵
        'rename_cards': _get_rename_cards(user_id),                        # 改名卡數量
    }), 200  # 200 成功

# 修改暱稱 API
# 路徑：POST /user/nickname
# 傳入：{ user_id, new_nickname }
@user_bp.route('/nickname', methods=['POST'])  # 定義 POST /nickname 路由
def update_nickname():  # 處理改名請求：免費次數 → 改名卡 → 金幣，兩者皆無則回傳錯誤
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')            # 取出 user_id 欄位
    new_nickname = data.get('new_nickname')  # 取出 new_nickname 欄位
    use_card = data.get('use_card', False)   # 是否使用改名卡流程

    # 防呆：兩個欄位都必填
    if not user_id or not new_nickname:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：暱稱長度 2-20 字
    if len(new_nickname) < 2 or len(new_nickname) > 20:
        return jsonify({'error': '暱稱長度需在 2-20 字之間'}), 400  # 400 客戶端錯誤：暱稱長度不符

    # 防呆：暱稱不能與他人重複
    existing_nick = supabase.table('users').select('id').eq('nickname', new_nickname).neq('id', user_id).execute()  # 查詢是否有其他玩家已使用此暱稱（排除自己）
    if existing_nick.data:  # 判斷是否有其他玩家使用相同暱稱
        return jsonify({'error': '暱稱已被使用，請換一個'}), 400  # 回傳 400 錯誤：暱稱重複

    # 查詢玩家資料，取得目前的金幣、修改次數、上次重置時間
    user_response = supabase.table('users').select(
        'coins, nickname_change_count, nickname_last_reset'  # 只需要這三個欄位
    ).eq('id', user_id).execute()  # 條件：找這個玩家

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 改名卡流程：免費次數用完自動用改名卡，否則扣 500 金幣
    if use_card:  # 判斷是否走「改名卡流程」（前端明確指定使用此流程）
        from datetime import datetime, timezone  # 載入日期時間模組
        last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])  # 上次重置時間，轉成日期物件
        now = datetime.now(timezone.utc)  # 現在時間（UTC）
        is_new_month = now.year > last_reset.year or now.month > last_reset.month  # 判斷是否已過一個自然月
        current_count = 0 if is_new_month else int(user_data.get('nickname_change_count') or 0)  # 若已過一個月則重置計數為 0，否則沿用當前次數
        reset_time = now.isoformat() if is_new_month else user_data['nickname_last_reset']  # 若已過一個月則更新重置時間為現在，否則沿用舊時間

        if current_count >= FREE_NICKNAME_CHANGE_LIMIT:  # 判斷本月免費次數是否已用完
            # 免費次數用完，嘗試用改名卡
            rename_cards = _get_rename_cards(user_id)  # 查詢玩家目前擁有的改名卡數量
            if rename_cards > 0:  # 判斷玩家是否有改名卡
                supabase.table('users').update({
                    'nickname': new_nickname,
                    'rename_cards': rename_cards - 1,
                    'nickname_change_count': current_count + 1,
                    'nickname_last_reset': reset_time
                }).eq('id', user_id).execute()  # 更新暱稱、扣除一張改名卡、累計修改次數、更新重置時間
                return jsonify({
                    'message': '暱稱更新成功',
                    'used_rename_card': True,
                    'rename_cards': rename_cards - 1,
                    'remaining_free': 0
                }), 200  # 回傳更新成功，並標示使用了改名卡及剩餘改名卡數
            # 沒有改名卡，不自動扣金幣，回傳錯誤
            return jsonify({'error': '本月免費次數已用完，且沒有改名卡，請至商店購買'}), 400  # 回傳 400 錯誤：無改名卡且免費次數已用完

        # 免費次數未用完，直接改名
        remaining_free = max(0, FREE_NICKNAME_CHANGE_LIMIT - (current_count + 1))  # 計算本次修改後剩餘的免費次數
        supabase.table('users').update({
            'nickname': new_nickname,
            'nickname_change_count': current_count + 1,
            'nickname_last_reset': reset_time
        }).eq('id', user_id).execute()  # 更新暱稱、累計修改次數、更新重置時間
        return jsonify({
            'message': '暱稱更新成功',
            'used_rename_card': False,
            'remaining_free': remaining_free,
            'remaining_coins': user_data['coins']
        }), 200  # 回傳更新成功，標示未使用改名卡及剩餘免費次數

    # 一般流程：前 3 次免費，超過扣 500
    from datetime import datetime, timezone  # 載入日期時間模組
    last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])  # 上次重置時間
    now = datetime.now(timezone.utc)  # 現在時間（UTC）

    # 判斷是否過了一個自然月：年份不同，或月份不同
    is_new_month = now.year > last_reset.year or now.month > last_reset.month  # 判斷自上次重置至今是否跨越了一個自然月

    current_count = user_data['nickname_change_count']  # 目前的修改次數
    reset_time = user_data['nickname_last_reset']       # 上次重置時間

    # 如果過了一個自然月，重置修改次數
    if is_new_month:  # 判斷是否已過一個自然月，需要重置免費次數
        current_count = 0             # 重置次數為 0
        reset_time = now.isoformat()  # 更新重置時間為現在

    # 判斷是否需要花金幣，超過免費次數就需要花金幣
    need_coins = current_count >= FREE_NICKNAME_CHANGE_LIMIT  # 判斷本月修改次數是否已達免費上限（需要扣金幣）

    # 如果需要花金幣，檢查金幣是否足夠
    if need_coins:  # 判斷是否需要花金幣
        if user_data['coins'] < NICKNAME_CHANGE_COST:  # 判斷玩家金幣是否少於 500（不足以修改暱稱）
            return jsonify({
                'error': f'金幣不足，修改暱稱需要 {NICKNAME_CHANGE_COST} 金幣，目前只有 {user_data["coins"]} 金幣'
            }), 400  # 400 客戶端錯誤：金幣不足

    # 準備要更新的資料
    update_data = {
        'nickname': new_nickname,                    # 新暱稱
        'nickname_change_count': current_count + 1,  # 修改次數加 1
        'nickname_last_reset': reset_time            # 重置時間
    }

    # 如果需要花金幣，扣除金幣
    if need_coins:  # 判斷是否需要從金幣扣款
        update_data['coins'] = user_data['coins'] - NICKNAME_CHANGE_COST  # 扣除 500 金幣

    # 更新資料庫
    supabase.table('users').update(update_data).eq('id', user_id).execute()  # 將新暱稱與相關計數一次性更新到 users 表

    return jsonify({
        'message': '暱稱更新成功',
        'cost_coins': NICKNAME_CHANGE_COST if need_coins else 0,                                           # 花了多少金幣
        'remaining_free': max(0, FREE_NICKNAME_CHANGE_LIMIT - (current_count + 1)),                        # 剩餘免費次數
        'remaining_coins': user_data['coins'] - NICKNAME_CHANGE_COST if need_coins else user_data['coins']  # 剩餘金幣
    }), 200  # 200 成功

# 新手禮包 API
# 路徑：POST /user/welcome-gift
# 傳入：{ user_id }
@user_bp.route('/welcome-gift', methods=['POST'])  # 定義 POST /welcome-gift 路由
def claim_welcome_gift():  # 處理新手禮包領取，每個帳號只能領一次，成功後入帳 500 金幣
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

    res = supabase.table('users').select('coins, welcome_claimed').eq('id', user_id).execute()  # 查詢玩家的金幣與新手禮包領取狀態
    if not res.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

    if res.data[0].get('welcome_claimed'):  # 判斷玩家是否已經領取過新手禮包
        return jsonify({'error': '已領取過新手禮包'}), 400  # 回傳 400 錯誤：不可重複領取

    new_coins = res.data[0]['coins'] + 500  # 計算加上 500 新手禮包金幣後的總金幣
    supabase.table('users').update({'coins': new_coins, 'welcome_claimed': True}).eq('id', user_id).execute()  # 更新玩家金幣並標記已領取新手禮包
    return jsonify({'coins': new_coins}), 200  # 回傳領取後的金幣總數

# 每日禮包領取 API
# 路徑：POST /user/daily-gift
# 傳入：{ user_id }
@user_bp.route('/daily-gift', methods=['POST'])  # 定義 POST /daily-gift 路由
def claim_daily_gift():  # 處理每日禮包領取，同一天只能領一次，成功後入帳 300 金幣
    from datetime import datetime, timezone, date  # 載入日期時間模組
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

    try:  # 嘗試一併查詢 daily_claimed_at，欄位不存在時降級只查金幣
        res = supabase.table('users').select('coins, daily_claimed_at').eq('id', user_id).execute()  # 查詢玩家的金幣與每日禮包上次領取時間
    except Exception:  # daily_claimed_at 欄位尚未建立，降級只查金幣
        res = supabase.table('users').select('coins').eq('id', user_id).execute()  # daily_claimed_at 欄位不存在時退回只查金幣
    if not res.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

    last = res.data[0].get('daily_claimed_at')  # 取得上次領取每日禮包的時間字串
    today = date.today().isoformat()  # e.g. "2026-06-21"

    if last and last[:10] == today:  # 判斷今天是否已領取：比對日期前 10 碼（YYYY-MM-DD）
        return jsonify({'error': '今天已領取過每日禮包'}), 400  # 回傳 400 錯誤：今天已領取

    now_iso = datetime.now(timezone.utc).isoformat()  # 取得現在 UTC 時間的 ISO 字串
    reward = 300  # 每日禮包固定獎勵 300 金幣
    new_coins = res.data[0]['coins'] + reward  # 計算加上獎勵後的總金幣
    update_data = {'coins': new_coins}  # 準備要更新的資料（先放金幣）
    try:  # 嘗試同時更新金幣與領取時間，欄位不存在時降級只更新金幣
        update_data['daily_claimed_at'] = now_iso  # 將領取時間加入更新資料
        supabase.table('users').update(update_data).eq('id', user_id).execute()  # 更新玩家金幣與每日禮包領取時間
    except Exception:  # daily_claimed_at 欄位尚未建立，降級只更新金幣
        supabase.table('users').update({'coins': new_coins}).eq('id', user_id).execute()  # daily_claimed_at 欄位不存在時退回只更新金幣

    return jsonify({'coins': new_coins, 'reward': reward}), 200  # 回傳領取後的金幣與獎勵數量


# 升等禮包領取 API
# 路徑：POST /user/levelup-gift
@user_bp.route('/levelup-gift', methods=['POST'])  # 定義 POST /levelup-gift 路由
def claim_levelup_gift():  # 處理升等禮包領取，消耗 pending_levelup_coins 轉入玩家金幣
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

    res = supabase.table('users').select('coins, pending_levelup_coins').eq('id', user_id).execute()  # 查詢玩家的金幣與待領取升等獎勵金幣
    if not res.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

    pending = int(res.data[0].get('pending_levelup_coins') or 0)  # 取得待領取升等獎勵金幣，若為 null 則為 0
    if pending <= 0:  # 判斷是否有待領取的獎勵
        return jsonify({'error': '沒有待領取的升等獎勵'}), 400  # 回傳 400 錯誤：沒有可領取的獎勵

    new_coins = res.data[0]['coins'] + pending  # 計算加上升等獎勵後的總金幣
    supabase.table('users').update({'coins': new_coins, 'pending_levelup_coins': 0}).eq('id', user_id).execute()  # 更新玩家金幣並清空待領取升等獎勵
    return jsonify({'coins': new_coins}), 200  # 回傳領取後的金幣總數

# 扣除金幣 API
# 路徑：POST /user/spend-coins
# 傳入：{ user_id, amount }
@user_bp.route('/spend-coins', methods=['POST'])  # 定義 POST /spend-coins 路由
def spend_coins():  # 處理直接扣除金幣的請求，驗證金額格式與餘額是否足夠
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    amount = data.get('amount')    # 取出 amount 欄位（要扣多少金幣）

    # 防呆：兩個欄位都必填
    if not user_id or amount is None:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：金額必須是正整數
    if not isinstance(amount, int) or amount <= 0:
        return jsonify({'error': '金額必須是正整數'}), 400  # 400 客戶端錯誤：金額格式錯誤

    # 查詢玩家目前的金幣
    user_response = supabase.table('users').select('coins').eq('id', user_id).execute()  # 查詢 users 表中指定玩家的金幣
    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    current_coins = user_response.data[0]['coins']  # 取得目前金幣數量

    # 防呆：金幣不足
    if current_coins < amount:
        return jsonify({'error': f'金幣不足，還差 {amount - current_coins} 金幣'}), 400  # 400 客戶端錯誤：金幣不足

    # 扣除金幣
    new_coins = current_coins - amount  # 計算扣除後的金幣數量
    supabase.table('users').update({'coins': new_coins}).eq('id', user_id).execute()  # 更新資料庫

    return jsonify({
        'message': '扣除成功',
        'spent': amount,        # 扣了多少金幣
        'remaining': new_coins  # 剩餘金幣
    }), 200  # 200 成功

# 購買道具 API
# 路徑：POST /user/buy-item
# 傳入：{ user_id, item_type, item_id, price }
@user_bp.route('/buy-item', methods=['POST'])  # 定義 POST /buy-item 路由
def buy_item():  # 處理購買道具請求：扣金幣 → 加入對應 owned 陣列（技能可重複）
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')      # 取出 user_id 欄位
    item_type = data.get('item_type')  # 取出道具類型（frames、tags、effects）
    item_id = data.get('item_id')      # 取出道具 ID（例如 frame-gold）
    price = data.get('price')          # 取出道具價格

    # 防呆：所有欄位都必填
    if not user_id or not item_type or not item_id or price is None:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：道具類型只能是這五種
    if item_type not in ['frames', 'tags', 'effects', 'skills', 'items']:  # 判斷道具類型是否為允許的五種之一（頭像框/稱號/特效/技能/道具）
        return jsonify({'error': '無效的道具類型'}), 400  # 回傳 400 錯誤：不合法的道具類型

    # 改名卡：用整數欄位追蹤數量
    if item_type == 'items' and item_id == 'item-rename':  # 判斷是否購買改名卡（特殊道具，用整數欄位而非陣列追蹤）
        try:  # 嘗試查詢玩家金幣與改名卡數量，欄位不存在時回傳 500
            res = supabase.table('users').select('coins, rename_cards').eq('id', user_id).execute()  # 查詢玩家的金幣與目前改名卡數量
            if not res.data:  # 判斷是否查無此玩家
                return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家
            current_coins = res.data[0]['coins']  # 取得目前金幣數量
            current_cards = int(res.data[0].get('rename_cards') or 0)  # 取得目前改名卡數量，若為 null 則為 0
            if current_coins < price:  # 判斷金幣是否足夠購買改名卡
                return jsonify({'error': f'金幣不足，還差 {price - current_coins} 金幣'}), 400  # 回傳 400 錯誤：金幣不足
            new_coins = current_coins - price  # 計算扣除改名卡售價後的金幣
            new_cards = current_cards + 1  # 計算增加一張改名卡後的總數
            supabase.table('users').update({'coins': new_coins, 'rename_cards': new_cards}).eq('id', user_id).execute()  # 更新玩家金幣並增加一張改名卡
            return jsonify({'message': '購買成功', 'remaining_coins': new_coins, 'rename_cards': new_cards}), 200  # 回傳購買成功與剩餘金幣及改名卡數量
        except Exception:  # rename_cards 欄位尚未建立或查詢失敗
            return jsonify({'error': '購買失敗，請確認 rename_cards 欄位已建立'}), 500  # 回傳 500 錯誤：資料庫欄位尚未建立

    # 查詢玩家目前的金幣和已擁有的道具
    try:  # 嘗試查詢玩家金幣與對應道具清單，欄位不存在時回傳 500
        user_response = supabase.table('users').select(
            f'coins, owned_{item_type}'  # 只查需要的欄位
        ).eq('id', user_id).execute()  # 查詢玩家的金幣與對應道具類型的擁有清單
    except Exception:  # owned_{item_type} 欄位尚未建立或欄位名稱錯誤
        return jsonify({'error': f'欄位 owned_{item_type} 尚未建立，請先在資料庫新增此欄位'}), 500  # 回傳 500 錯誤：對應道具欄位不存在

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆玩家資料
    current_coins = user_data['coins']  # 取得玩家目前金幣數量
    owned_items = user_data[f'owned_{item_type}'] or []  # 取得玩家已擁有的該類型道具清單，若為 null 則為空陣列

    # 技能是消耗品，可以重複購買；其他道具只能擁有一個
    if item_type != 'skills' and item_id in owned_items:  # 判斷非技能類道具是否已擁有（技能可重複購買堆疊）
        return jsonify({'error': '已擁有此道具'}), 400  # 回傳 400 錯誤：不可重複購買同一道具

    if current_coins < price:  # 判斷金幣是否足夠購買
        return jsonify({'error': f'金幣不足，還差 {price - current_coins} 金幣'}), 400  # 回傳 400 錯誤：金幣不足

    new_coins = current_coins - price  # 計算扣除道具售價後的金幣
    new_owned = owned_items + [item_id]  # 將新購買的道具 ID 加入擁有清單

    supabase.table('users').update({
        'coins': new_coins,
        f'owned_{item_type}': new_owned
    }).eq('id', user_id).execute()  # 更新玩家金幣並將新道具加入對應類型的擁有清單

    return jsonify({
        'message': '購買成功',
        'remaining_coins': new_coins,
        'owned': new_owned
    }), 200  # 回傳購買成功、剩餘金幣與更新後的道具清單


# 使用技能 API（消耗品，扣一個）
# 路徑：POST /user/use-skill
# 傳入：{ user_id, skill_id }
@user_bp.route('/use-skill', methods=['POST'])
def use_skill():  # 處理使用技能請求，從 owned_skills 陣列移除一個符合的技能 ID
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id  = data.get('user_id')  # 取出 user_id 欄位
    skill_id = data.get('skill_id')  # 取出 skill_id 欄位（要使用的技能 ID）

    if not user_id or not skill_id:  # 判斷兩個必要欄位是否都已填寫
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳 400 錯誤：欄位未填寫

    res = supabase.table('users').select('owned_skills').eq('id', user_id).execute()  # 查詢玩家目前擁有的技能清單
    if not res.data:  # 判斷是否查無此玩家
        return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

    owned = res.data[0].get('owned_skills') or []  # 取得技能清單，若為 null 則為空陣列
    if skill_id not in owned:  # 判斷玩家是否擁有此技能
        return jsonify({'error': '沒有此技能'}), 400  # 回傳 400 錯誤：玩家沒有此技能

    owned.remove(skill_id)  # 移除一個（list.remove 只移除第一個符合的）
    supabase.table('users').update({'owned_skills': owned}).eq('id', user_id).execute()  # 更新玩家技能清單（扣除一個已使用的技能）

    return jsonify({'remaining': owned.count(skill_id)}), 200  # 回傳此技能在清單中剩餘的數量


# 更新玩家對戰後統計資料 API
# 路徑：POST /user/update-stats
# 傳入：{ user_id, won, score, correct, total, opp_correct }
@user_bp.route('/update-stats', methods=['POST'])
def update_stats():  # 處理對戰結束的統計更新：勝敗場、XP、金幣、等級、題目分類統計
    try:  # 包覆整個處理流程，捕捉任何未預期的伺服器錯誤並回傳 500
        data = request.get_json()  # 取得前端傳來的 JSON 資料
        if not data:  # 判斷是否無法解析前端傳來的 JSON
            print("[update_stats] 錯誤：無法解析 JSON")
            return jsonify({'error': '無效的 JSON 數據'}), 400  # 回傳 400 錯誤：JSON 解析失敗
        
        user_id = data.get('user_id')  # 取出 user_id 欄位
        won = data.get('won') is True  # 取出勝負
        score = int(data.get('score', 0))  # 本場得分
        correct = int(data.get('correct', 0))  # 本場答對題數
        total = int(data.get('total', 0))  # 本場答題數
        opp_correct = int(data.get('opp_correct', 0))  # 對手答對題數

        # 防呆：必要欄位都必填
        if not user_id:  # 判斷 user_id 是否缺少
            print("[update_stats] 錯誤：缺少 user_id")
            return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

        print(f"[update_stats] 開始處理: user_id={user_id}, won={won}, correct={correct}, total={total}")

        # 查詢玩家目前資料
        user_response = supabase.table('users').select(
            'coins, xp, xp_max, level, wins, losses, total_answered, avg_accuracy, total_score, topic_stats, pending_levelup_coins'
        ).eq('id', user_id).execute()  # 查詢玩家的金幣、XP、等級、勝敗場、答題統計及待領升等金幣

        if not user_response.data:  # 判斷是否查無此玩家
            print(f"[update_stats] 錯誤：找不到 user_id={user_id} 的使用者")
            return jsonify({'error': '找不到使用者'}), 400  # 回傳 400 錯誤：找不到玩家

        user_data = user_response.data[0]  # 取得第一筆玩家資料
        coins = int(user_data.get('coins', 0) or 0)  # 取得目前金幣，防止 null 造成計算錯誤
        xp = int(user_data.get('xp', 0) or 0)  # 取得目前經驗值，防止 null 造成計算錯誤
        xp_max = int(user_data.get('xp_max', 1000) or 1000)  # 取得升級所需 XP，預設 1000
        level = int(user_data.get('level', 1) or 1)  # 取得目前等級，預設 lv1
        wins = int(user_data.get('wins', 0) or 0)  # 取得勝場數，防止 null 造成計算錯誤
        losses = int(user_data.get('losses', 0) or 0)  # 取得敗場數，防止 null 造成計算錯誤
        total_answered = int(user_data.get('total_answered', 0) or 0)  # 取得累計答題數，防止 null 造成計算錯誤
        avg_accuracy = float(user_data.get('avg_accuracy', 0) or 0)  # 取得平均準確率，防止 null 造成計算錯誤
        total_score = int(user_data.get('total_score', 0) or 0)  # 取得累計積分，防止 null 造成計算錯誤

        mode = str(data.get('mode') or '').lower()  # 取得對戰模式並轉小寫（bot / queue / create_room / join_room）

        # 初始化 xp_gain 為 0（備用值）
        xp_gain = 0  # 本場 XP 獎勵初始值為 0
        coin_delta = 0  # 本場金幣變化量初始值為 0

        # 判斷是否為房號配對模式（不計錢但計 XP）
        is_room_match = mode in ['create_room', 'join_room']  # 判斷是否為房號建立或加入模式（此模式不計算金幣獎懲）

        print(f"[update_stats] mode={mode}, won={won}, correct={correct}, total={total}, is_room_match={is_room_match}")

        if won:  # 判斷本場是否勝利
            # 房號配對不給錢，其他模式按原邏輯計算
            if is_room_match:
                coin_delta = 0  # 房號配對不計金幣
            else:
                coin_delta = 0 if mode == 'bot' else 100 + 20 * correct  # 勝利金幣：bot 模式不加錢；其他模式基礎 100 + 每答對 1 題額外 20 金幣
            xp_gain = int(20 + (3 * correct if mode == 'bot' else 5 * correct))  # 勝利 XP：基礎 20 + bot 模式每答對 3 XP / 其他模式每答對 5 XP
            wins += 1  # 勝場數加 1
        else:
            # 房號配對不計錢，其他模式按原邏輯計算
            if is_room_match:
                coin_delta = 0  # 房號配對不計金幣
            else:
                coin_delta = 0 if mode == 'bot' else -(50 + 20 * opp_correct)  # 失敗金幣：bot 模式不扣錢；對戰模式扣 50 + 對手每答對 1 題額外扣 20 金幣
            # 失敗時：至少給予基礎 XP，鼓勵繼續遊戲
            if mode == 'bot':
                xp_gain = int(max(3, correct))  # bot 失敗最少 3 XP
            else:
                xp_gain = int(max(5, 3 * correct))  # queue/room 失敗最少 5 XP，每答對 1 題額外給 3 XP
            losses += 1  # 敗場數加 1

        coins = max(0, coins + coin_delta)  # 套用金幣變化量，並確保金幣不會低於 0
        xp += xp_gain  # 累加本場獲得的 XP
        leveled_up = False  # 升等旗標，初始為 false
        level_up_coins = 0  # 本次升等應給的金幣總計（基礎 + 里程碑），初始為 0
        level_up_base = 0  # 升等基礎金幣（每升一等給 100），初始為 0
        level_up_milestone = 0  # 升等里程碑金幣（每達 10 的倍數等級額外給 400），初始為 0
        while xp >= xp_max:  # 判斷 XP 是否達到升等門檻，可能連升多等
            xp -= xp_max  # 扣除升等所需 XP，保留溢出的 XP 繼續計算
            level += 1  # 等級加 1
            xp_max += 500  # 每升一等，下一等級所需 XP 增加 500
            leveled_up = True  # 標記有升等發生
            level_up_base += 100  # 每升一等累計 100 金幣基礎獎勵
            if level % 10 == 0:  # 判斷是否達到 10 的倍數等級里程碑（lv10、lv20...）
                level_up_milestone += 400  # 里程碑額外累計 400 金幣獎勵
        level_up_coins = level_up_base + level_up_milestone  # 計算本次升等的總金幣獎勵（基礎 + 里程碑）
        existing_pending = int(user_data.get('pending_levelup_coins') or 0)  # 取得資料庫中原本已有的待領取升等金幣，防止 null

        print(f"[update_stats] 結算結果: coin_delta={coin_delta}, xp_gain={xp_gain}, 新 coins={coins}, 新 xp={xp}, 升等待領={level_up_coins}")

        new_total_answered = total_answered + total  # 計算累計答題總數（舊的加上本場）
        if new_total_answered > 0:  # 判斷是否有答過題，避免除以零
            accuracy = round((avg_accuracy * total_answered + (100.0 * correct)) / new_total_answered, 2)  # 以加權平均重新計算整體準確率：(舊準確率×舊答題數 + 本場答對率) / 新總答題數
        else:
            accuracy = 0  # 從未答過題時準確率設為 0
        total_score += score  # 將本場得分累加到總積分

        # 處理題目分類統計
        incoming_topic_stats = data.get('topic_stats', {})  # 取得本場各分類的答題統計
        if not isinstance(incoming_topic_stats, dict):  # 判斷傳入的 topic_stats 是否為合法的字典格式
            incoming_topic_stats = {}  # 格式不正確時改用空字典，防止後續合併出錯

        existing_topic_stats = user_data.get('topic_stats') or {}  # 取得資料庫中已有的分類統計，若為 null 則為空字典
        if not isinstance(existing_topic_stats, dict):  # 判斷資料庫中的 topic_stats 是否為合法的字典格式
            existing_topic_stats = {}  # 格式不正確時改用空字典

        merged_topic_stats = dict(existing_topic_stats)  # 複製舊的分類統計作為合併起點，避免直接修改原始資料

        # 合併新的題目統計
        for category, stats in incoming_topic_stats.items():  # 遍歷本場各分類的統計資料
            if category not in merged_topic_stats:  # 判斷此分類是否為新出現的分類
                merged_topic_stats[category] = {'correct': 0, 'wrong': 0}  # 新分類初始化答對與答錯計數為 0
            if isinstance(stats, dict):  # 判斷該分類的統計值是否為合法字典格式
                merged_topic_stats[category]['correct'] = merged_topic_stats[category].get('correct', 0) + stats.get('correct', 0)  # 累加該分類的答對題數
                merged_topic_stats[category]['wrong'] = merged_topic_stats[category].get('wrong', 0) + stats.get('wrong', 0)  # 累加該分類的答錯題數

        print(f"[update_stats] 更新前的 merged_topic_stats: {merged_topic_stats}")

        update_data = {
            'coins': coins,  # 更新後的金幣總數
            'xp': xp,  # 更新後的 XP（升等後為溢出值）
            'xp_max': xp_max,  # 下一等級所需 XP（每升等增加 500）
            'level': level,  # 更新後的等級
            'wins': wins,  # 更新後的勝場數
            'losses': losses,  # 更新後的敗場數
            'total_answered': new_total_answered,  # 更新後的累計答題總數
            'avg_accuracy': accuracy,  # 更新後的整體平均準確率
            'total_score': total_score,  # 更新後的累計積分
            'topic_stats': merged_topic_stats,  # 合併後的分類答題統計（含 bot）
            'pending_levelup_coins': existing_pending + level_up_coins,  # 舊的待領金幣加上本次升等獎勵，待玩家手動領取
        }


        print(f"[update_stats] 更新 users 表: {update_data}")
        supabase.table('users').update(update_data).eq('id', user_id).execute()  # 將所有統計資料一次性更新到 users 表

        # 保存對戰記錄到 battle_records
        print(f"[update_stats] 插入 battle_records")
        supabase.table('battle_records').insert({
            'user_id': user_id,
            'score': score,
            'correct': correct,
            'total': total,
            'won': won
        }).execute()  # 在 battle_records 表新增一筆對戰紀錄

        response_data = {
            'message': '更新成功',
            'coins': int(coins),  # 更新後的金幣（整數）
            'xp': int(xp),  # 更新後的 XP（整數）
            'xp_max': int(xp_max),  # 下一等級所需 XP（整數）
            'level': int(level),  # 更新後的等級（整數）
            'wins': int(wins),  # 更新後的勝場數（整數）
            'losses': int(losses),  # 更新後的敗場數（整數）
            'total_answered': int(new_total_answered),  # 累計答題總數（整數）
            'avg_accuracy': float(accuracy),  # 整體平均準確率（浮點數）
            'total_score': int(total_score),  # 累計積分（整數）
            'coin_delta': int(coin_delta),  # 本場金幣變化量（正為獎勵、負為懲罰）
            'level_up_coins': int(level_up_coins),  # 本次升等總獎勵金幣
            'level_up_base': int(level_up_base),  # 本次升等基礎金幣（等級數 × 100）
            'level_up_milestone': int(level_up_milestone),  # 本次升等里程碑金幣（10 倍數等級 × 400）
            'xp_gain': int(xp_gain),  # 確保是整數
            'leveled_up': bool(leveled_up),  # 是否有升等（布林值）
            'topic_stats': merged_topic_stats  # 合併後的分類統計
        }
        print(f"[update_stats] 返回成功: {response_data}")
        return jsonify(response_data), 200  # 回傳所有更新後的統計資料

    except Exception as err:  # 捕捉整個 update_stats 過程中的任何例外，回傳 500 並印出堆疊
        import traceback  # 載入 traceback 模組用於列印完整錯誤堆疊
        error_msg = str(err)  # 將錯誤物件轉成字串
        traceback.print_exc()  # 在伺服器終端機印出完整的錯誤堆疊
        print(f"[update_stats] 發生錯誤: {error_msg}")
        return jsonify({'error': f'更新失敗: {error_msg}'}), 500  # 回傳 500 錯誤：伺服器端更新失敗

# 刪除帳號 API
# 路徑：DELETE /user/delete
# 傳入：{ user_id, password }，需要輸入密碼確認才能刪除
@user_bp.route('/delete', methods=['DELETE'])  # 定義 DELETE /delete 路由
def delete_account():  # 處理帳號刪除請求，需輸入密碼二次確認，成功後刪除 users 表與 Auth 帳號
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')    # 取出 user_id 欄位
    password = data.get('password')  # 取出 password 欄位

    # 防呆：兩個欄位都必填
    if not user_id or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 查詢玩家的 email，用來驗證密碼
    user_response = supabase.table('users').select('email').eq('id', user_id).execute()  # 查詢 users 表中指定玩家的 email

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 用密碼嘗試登入，驗證密碼是否正確
    try:  # 嘗試以輸入的密碼登入，藉此驗證密碼正確性後才允許刪除
        auth_response = supabase.auth.sign_in_with_password({'email': user_data['email'], 'password': password})  # 用玩家 email 和輸入的密碼向 Supabase Auth 驗證登入
        if auth_response.user is None:  # 登入失敗
            return jsonify({'error': '密碼錯誤'}), 400  # 400 客戶端錯誤：密碼不正確
    except Exception:  # Supabase Auth 拋出例外（密碼不正確或帳號異常）
        return jsonify({'error': '密碼錯誤'}), 400  # 400 客戶端錯誤：密碼不正確

    # 刪除 users 資料表的資料
    supabase.table('users').delete().eq('id', user_id).execute()  # 從 users 表刪除玩家的所有個人資料

    # 刪除 Supabase Auth 的帳號
    admin_delete_user(user_id)  # 呼叫 admin API 刪除 Supabase Auth 中的帳號（使玩家無法再登入）

    return jsonify({'message': '帳號已刪除'}), 200  # 200 成功
# 儲存已裝備的特效
# 路徑：POST /user/active-effect
# 傳入：{ user_id, effect_id }（effect_id 為 null 表示取消）
@user_bp.route('/active-effect', methods=['POST'])
def save_active_effect():  # 儲存玩家目前裝備的特效 ID，null 表示取消裝備
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    effect_id = data.get('effect_id')  # 可以是 null（取消特效）

    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

    supabase.table('users').update(
        {'active_effect': effect_id}
    ).eq('id', user_id).execute()  # 更新玩家目前裝備的特效（null 表示取消裝備）

    return jsonify({'message': '特效已更新', 'active_effect': effect_id}), 200  # 回傳更新成功與目前裝備的特效 ID

# 儲存已裝備的 emoji 頭貼
# 路徑：POST /user/equipped-emoji
# 傳入：{ user_id, emoji }
@user_bp.route('/equipped-emoji', methods=['POST'])
def save_equipped_emoji():  # 儲存玩家目前裝備的 emoji 頭貼，同步到 DB 的 equipped_emoji 欄位
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    emoji = data.get('emoji', '🧠')  # 取出 emoji，預設 🧠

    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤

    supabase.table('users').update(
        {'equipped_emoji': emoji}  # 更新玩家目前裝備的 emoji
    ).eq('id', user_id).execute()  # 條件：找這個 id 的玩家

    return jsonify({'message': 'emoji 已更新', 'equipped_emoji': emoji}), 200  # 回傳更新成功

# 排行榜 API
# 路徑：GET /user/rank
# 參數：user_id（可選，標記自己並查詢自己的排名）
# 回傳：前 3 名（積分高者優先，同分比勝場）+ 當前玩家排名
@user_bp.route('/rank', methods=['GET'])
def get_rank():  # 查詢排行榜，依積分降序（同分比勝場），最多回傳 50 筆，並附上當前玩家排名
    user_id = request.args.get('user_id')  # 當前玩家 ID

    # 查詢總玩家數
    total_response = supabase.table('users').select('id', count='exact').execute()
    total_players = total_response.count or 0

    # 查詢前 50 名玩家，確保能涵蓋前 3 名的所有並列情況
    rank_response = supabase.table('users').select(
        'id, nickname, custom_id, total_score, wins, level'
    ).order('total_score', desc=True).order('wins', desc=True).limit(50).execute()  # 查詢前 50 名玩家，依積分降序排列，同分比勝場

    players = rank_response.data or []  # 取得玩家清單，若查無結果則為空陣列

    # 計算名次（積分和勝場都相同則並列），回傳全部玩家
    result = []  # 最終排行榜結果清單
    current_rank = 1  # 目前計算到的名次，從第 1 名開始
    for i, p in enumerate(players):  # 遍歷所有玩家並計算名次
        if i > 0:  # 判斷是否不是第一位玩家（第一位固定第 1 名）
            prev = players[i - 1]  # 取得前一位玩家資料
            same = (
                (p.get('total_score', 0) or 0) == (prev.get('total_score', 0) or 0) and
                (p.get('wins', 0) or 0) == (prev.get('wins', 0) or 0)
            )  # 判斷是否與前一位玩家積分和勝場完全相同（用於並列判定）
            if not same:  # 判斷與前一位不並列時才更新名次
                current_rank = i + 1  # 名次更新為目前索引加 1（非並列時排在後面）
        result.append({
            'rank': current_rank,  # 本玩家的名次
            'id': p['id'],  # 玩家 ID
            'name': p['nickname'] or p['custom_id'],  # 優先用暱稱，若無則用自訂 ID
            'score': p.get('total_score', 0) or 0,  # 累計積分，若為 null 則為 0
            'wins': p.get('wins', 0) or 0,  # 勝場數，若為 null 則為 0
            'level': p.get('level', 1) or 1,  # 等級，若為 null 則預設 lv1
            'isYou': p['id'] == user_id  # 標記是否為當前查詢的玩家
        })

    # 查詢當前玩家的排名（積分更高 OR 積分相同但勝場更多）
    my_rank = None  # 當前玩家排名資料，預設 None（未登入或查無時不回傳）
    if user_id:  # 判斷是否有傳入 user_id（已登入玩家才查詢個人排名）
        my_response = supabase.table('users').select(
            'id, nickname, custom_id, total_score, wins, level'
        ).eq('id', user_id).execute()  # 查詢當前玩家的個人資料

        if my_response.data:  # 判斷是否有查到當前玩家資料
            me = my_response.data[0]  # 取得當前玩家資料
            my_score = me.get('total_score', 0) or 0  # 取得當前玩家積分，若為 null 則為 0
            my_wins = me.get('wins', 0) or 0  # 取得當前玩家勝場數，若為 null 則為 0

            higher_score = supabase.table('users').select(
                'id', count='exact'
            ).gt('total_score', my_score).execute()  # 計算積分高於當前玩家的人數（排在當前玩家前面的人）

            same_score_more_wins = supabase.table('users').select(
                'id', count='exact'
            ).eq('total_score', my_score).gt('wins', my_wins).execute()  # 計算積分相同但勝場更多的人數（同分但排前面的人）

            my_rank = {
                'rank': (higher_score.count or 0) + (same_score_more_wins.count or 0) + 1,  # 名次 = 積分更高的人數 + 同分勝場更多的人數 + 1
                'id': me['id'],  # 當前玩家 ID
                'name': me['nickname'] or me['custom_id'],  # 優先用暱稱，若無則用自訂 ID
                'score': my_score,  # 當前玩家積分
                'wins': my_wins,  # 當前玩家勝場數
                'level': me.get('level', 1) or 1,  # 當前玩家等級，若為 null 則預設 lv1
                'isYou': True  # 標記為當前玩家本人
            }

    return jsonify({
        'rank': result,        # 排行榜列表
        'myRank': my_rank,     # 當前玩家排名（未登入時為 null）
        'total': total_players # 全服總玩家數
    }), 200  # 回傳排行榜資料



# 查詢最近對戰記錄
# 路徑：GET /user/recent-battles
# 參數：user_id, limit（預設 10）
@user_bp.route('/recent-battles', methods=['GET'])
def get_recent_battles():  # 查詢玩家最近 N 場對戰紀錄，回傳各場得分與準確率供圖表使用
    user_id = request.args.get('user_id')  # 從 URL 參數取得 user_id
    limit = int(request.args.get('limit', 10))  # 從 URL 參數取得筆數限制，預設 10 筆
    if not user_id:  # 判斷 user_id 是否缺少
        return jsonify({'error': '缺少 user_id'}), 400  # 回傳 400 錯誤：缺少玩家 ID

    try:  # 嘗試查詢對戰紀錄，DB 連線問題或欄位異常時回傳 500
        res = supabase.table('battle_records').select(
            'score, correct, total, won, created_at'
        ).eq('user_id', user_id).order('created_at', desc=True).limit(limit).execute()  # 查詢玩家最近 N 場對戰紀錄，依時間降序（最新的在前）

        records = list(reversed(res.data or []))  # 最舊的排前面（時間軸左到右）
        scores = [r['score'] for r in records]  # 提取每場得分清單（由舊到新）
        accuracy = [round(r['correct']/r['total']*100) if r['total'] > 0 else 0 for r in records]  # 計算每場準確率百分比，若總題數為 0 則給 0
        return jsonify({'scores': scores, 'accuracy': accuracy}), 200  # 回傳各場得分與準確率清單
    except Exception as e:  # 查詢對戰紀錄失敗（DB 連線異常或欄位不存在）
        return jsonify({'error': str(e)}), 500  # 回傳 500 錯誤：查詢對戰紀錄失敗

# 全體玩家各分類平均準確率
# 路徑：GET /user/avg-topic-stats
@user_bp.route('/avg-topic-stats', methods=['GET'])
def get_avg_topic_stats():  # 計算全體玩家各分類題目的平均準確率，供管理員或統計頁面使用
    try:  # 嘗試查詢全體玩家分類統計，DB 異常時回傳 500
        res = supabase.table('users').select('topic_stats').not_.is_('topic_stats', 'null').execute()  # 查詢所有有分類統計資料的玩家（排除 topic_stats 為 null 的玩家）
        players = res.data or []  # 取得玩家清單，若查無結果則為空陣列

        totals = {}  # 用於累計全體玩家各分類的答對與總題數
        for p in players:  # 遍歷每位有分類統計的玩家
            stats = p.get('topic_stats') or {}  # 取得該玩家的分類統計，若為 null 則為空字典
            for cat, s in stats.items():  # 遍歷該玩家的每個分類統計
                if cat not in totals:  # 判斷是否第一次出現此分類
                    totals[cat] = {'correct': 0, 'total': 0}  # 新分類初始化累計值
                totals[cat]['correct'] += s.get('correct', 0)  # 累加此分類所有玩家的答對題數
                totals[cat]['total'] += s.get('correct', 0) + s.get('wrong', 0)  # 累加此分類所有玩家的總答題數

        avg = {cat: round(v['correct']/v['total']*100) if v['total'] > 0 else 0
               for cat, v in totals.items()}  # 計算各分類的全體平均準確率百分比，總題數為 0 時給 0

        return jsonify(avg), 200  # 回傳各分類的全體平均準確率
    except Exception as e:  # 查詢分類統計失敗（DB 連線異常）
        return jsonify({'error': str(e)}), 500  # 回傳 500 錯誤：查詢分類統計失敗


# 上傳自訂頭像
# 路徑：POST /user/avatar
# 傳入：{ user_id, avatar_data }（base64 WebP data URL）
@user_bp.route('/avatar', methods=['POST'])
def upload_avatar():  # 處理自訂頭像上傳：解碼 base64 → 上傳 Storage → 更新 DB avatar_url
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    avatar_data = data.get('avatar_data', '')  # 取出 base64 WebP 圖片資料，預設空字串

    if not user_id or not avatar_data:  # 判斷必要參數是否都有填寫
        return jsonify({'error': '缺少參數'}), 400  # 回傳 400 錯誤：缺少必要參數

    try:  # 嘗試解碼並上傳頭像，失敗時回傳 500
        # 去掉 data URL 前綴，取得純 base64
        if ',' in avatar_data:  # 判斷是否包含 data URL 前綴（例如 data:image/webp;base64,）
            avatar_data = avatar_data.split(',', 1)[1]  # 切割取得逗號後的純 base64 字串
        file_bytes = base64.b64decode(avatar_data)  # 將 base64 字串解碼為二進位圖片資料

        bucket = 'avatars'  # Supabase Storage 的 bucket 名稱
        path = f'{user_id}.webp'  # 儲存路徑，以玩家 ID 命名確保唯一性

        # 嘗試先刪除舊檔（upsert 有時會失敗，刪了再上傳比較保險）
        try:  # 嘗試刪除舊頭像，upsert 有時不可靠，先刪再上傳比較穩定
            supabase.storage.from_(bucket).remove([path])  # 刪除 avatars bucket 中的舊頭像檔案
        except Exception:  # 舊檔不存在時靜默忽略（第一次上傳必然失敗）
            pass  # 刪除失敗時靜默忽略（可能是第一次上傳，舊檔不存在）

        supabase.storage.from_(bucket).upload(
            path,
            file_bytes,
            file_options={'content-type': 'image/webp'}
        )  # 將新頭像圖片上傳到 Supabase Storage 的 avatars bucket

        public_url = supabase.storage.from_(bucket).get_public_url(path)  # 取得剛上傳頭像的公開存取 URL

        # 存 URL 到 users table
        supabase.table('users').update({'avatar_url': public_url}).eq('id', user_id).execute()  # 將新頭像公開 URL 儲存到 users 表的 avatar_url 欄位

        return jsonify({'avatar_url': public_url}), 200  # 回傳頭像上傳成功及新的公開 URL
    except Exception as e:  # 上傳頭像過程發生錯誤（base64 格式錯誤、Storage 連線異常等）
        return jsonify({'error': str(e)}), 500  # 回傳 500 錯誤：上傳頭像過程發生錯誤