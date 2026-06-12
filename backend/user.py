from flask import Blueprint, request, jsonify  # Flask 相關模組
from supabase import create_client  # 從 supabase 套件取出 create_client 函式
import httpx  # 用來發送 HTTP 請求，直接呼叫 Supabase admin API
import os  # 讀取環境變數
from dotenv import load_dotenv  # 讀取 .env 檔案裡的環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

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
        'id, custom_id, email, is_verified, coins, nickname, nickname_change_count, nickname_last_reset, is_admin, created_at, level, xp, xp_max, wins, losses, total_answered, avg_accuracy, total_score'
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
        'total_score': user_data.get('total_score', 0)                  # 累計積分，預設 0
    }), 200  # 200 成功

# 修改暱稱 API
# 路徑：POST /user/nickname
# 傳入：{ user_id, new_nickname }
@user_bp.route('/nickname', methods=['POST'])  # 定義 POST /nickname 路由
def update_nickname():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')            # 取出 user_id 欄位
    new_nickname = data.get('new_nickname')  # 取出 new_nickname 欄位

    # 防呆：兩個欄位都必填
    if not user_id or not new_nickname:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：暱稱長度 2-20 字
    if len(new_nickname) < 2 or len(new_nickname) > 20:
        return jsonify({'error': '暱稱長度需在 2-20 字之間'}), 400  # 400 客戶端錯誤：暱稱長度不符

    # 查詢玩家資料，取得目前的金幣、修改次數、上次重置時間
    user_response = supabase.table('users').select(
        'coins, nickname_change_count, nickname_last_reset'  # 只需要這三個欄位
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
        current_count = 0             # 重置次數為 0
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
        'nickname': new_nickname,                    # 新暱稱
        'nickname_change_count': current_count + 1,  # 修改次數加 1
        'nickname_last_reset': reset_time            # 重置時間
    }

    # 如果需要花金幣，扣除金幣
    if need_coins:
        update_data['coins'] = user_data['coins'] - NICKNAME_CHANGE_COST  # 扣除 500 金幣

    # 更新資料庫
    supabase.table('users').update(update_data).eq('id', user_id).execute()

    return jsonify({
        'message': '暱稱更新成功',
        'cost_coins': NICKNAME_CHANGE_COST if need_coins else 0,                                           # 花了多少金幣
        'remaining_free': max(0, FREE_NICKNAME_CHANGE_LIMIT - (current_count + 1)),                        # 剩餘免費次數
        'remaining_coins': user_data['coins'] - NICKNAME_CHANGE_COST if need_coins else user_data['coins']  # 剩餘金幣
    }), 200  # 200 成功

# 扣除金幣 API
# 路徑：POST /user/spend-coins
# 傳入：{ user_id, amount }
@user_bp.route('/spend-coins', methods=['POST'])  # 定義 POST /spend-coins 路由
def spend_coins():
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
    user_response = supabase.table('users').select('coins').eq('id', user_id).execute()
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

# 更新玩家對戰後統計資料 API
# 路徑：POST /user/update-stats
# 傳入：{ user_id, won, score, correct, total, opp_correct }
@user_bp.route('/update-stats', methods=['POST'])
def update_stats():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出 user_id 欄位
    won = data.get('won') is True  # 取出勝負
    score = int(data.get('score', 0))  # 本場得分
    correct = int(data.get('correct', 0))  # 本場答對題數
    total = int(data.get('total', 0))  # 本場答題數
    opp_correct = int(data.get('opp_correct', 0))  # 對手答對題數

    # 防呆：必要欄位都必填
    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    # 查詢玩家目前資料
    user_response = supabase.table('users').select(
        'coins, xp, xp_max, level, wins, losses, total_answered, avg_accuracy, total_score'
    ).eq('id', user_id).execute()

    if not user_response.data:
        return jsonify({'error': '找不到使用者'}), 400

    user_data = user_response.data[0]
    coins = int(user_data.get('coins', 0) or 0)
    xp = int(user_data.get('xp', 0) or 0)
    xp_max = int(user_data.get('xp_max', 1000) or 1000)
    level = int(user_data.get('level', 1) or 1)
    wins = int(user_data.get('wins', 0) or 0)
    losses = int(user_data.get('losses', 0) or 0)
    total_answered = int(user_data.get('total_answered', 0) or 0)
    avg_accuracy = float(user_data.get('avg_accuracy', 0) or 0)
    total_score = int(user_data.get('total_score', 0) or 0)

    if won:
        coin_delta = 100 + 20 * correct
        xp_gain = 20 + 5 * correct
        wins += 1
    else:
        coin_delta = -(50 + 20 * opp_correct)
        xp_gain = 3 * correct
        losses += 1

    coins = max(0, coins + coin_delta)
    xp += xp_gain
    leveled_up = False
    while xp >= xp_max:
        xp -= xp_max
        level += 1
        xp_max += 500
        leveled_up = True

    new_total_answered = total_answered + total
    if new_total_answered > 0:
        accuracy = round((avg_accuracy * total_answered + (100.0 * correct)) / new_total_answered, 2)
    else:
        accuracy = 0
    total_score += score

    update_data = {
        'coins': coins,
        'xp': xp,
        'xp_max': xp_max,
        'level': level,
        'wins': wins,
        'losses': losses,
        'total_answered': new_total_answered,
        'avg_accuracy': accuracy,
        'total_score': total_score
    }
    supabase.table('users').update(update_data).eq('id', user_id).execute()

    return jsonify({
        'message': '更新成功',
        'coins': coins,
        'xp': xp,
        'xp_max': xp_max,
        'level': level,
        'wins': wins,
        'losses': losses,
        'total_answered': new_total_answered,
        'avg_accuracy': accuracy,
        'total_score': total_score,
        'coin_delta': coin_delta,
        'xp_gain': xp_gain,
        'leveled_up': leveled_up
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

    # 查詢玩家的 email，用來驗證密碼
    user_response = supabase.table('users').select('email').eq('id', user_id).execute()

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

    # 刪除 users 資料表的資料
    supabase.table('users').delete().eq('id', user_id).execute()

    # 刪除 Supabase Auth 的帳號
    admin_delete_user(user_id)

    return jsonify({'message': '帳號已刪除'}), 200  # 200 成功