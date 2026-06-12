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
    # 查詢玩家資料，包含所有統計欄位和已擁有的道具
    user_response = supabase.table('users').select(
        'id, custom_id, email, is_verified, coins, nickname, nickname_change_count, nickname_last_reset, '
        'is_admin, wins, losses, total_answered, avg_accuracy, total_score, level, xp, xp_max, '
        'owned_frames, owned_tags, owned_effects, created_at'
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

    # 計算勝率
    total_games = user_data['wins'] + user_data['losses']  # 總場數
    win_rate = round(user_data['wins'] / total_games * 100) if total_games > 0 else 0  # 勝率百分比

    return jsonify({
        'id': user_data['id'],                          # 玩家唯一 ID
        'custom_id': user_data['custom_id'],            # 玩家自訂 ID
        'email': user_data['email'],                    # 玩家 email
        'is_verified': user_data['is_verified'],        # 是否已驗證
        'coins': user_data['coins'],                    # 金幣數量
        'nickname': user_data['nickname'],              # 遊戲暱稱
        'nickname_remaining_free': remaining_free,      # 本月剩餘免費修改暱稱次數
        'is_admin': user_data['is_admin'],              # 是否為管理員
        'wins': user_data.get('wins', 0),               # 勝場數，預設 0
        'losses': user_data.get('losses', 0),           # 敗場數，預設 0
        'win_rate': win_rate,                           # 勝率百分比
        'total_answered': user_data.get('total_answered', 0),  # 累計答題數，預設 0
        'avg_accuracy': user_data.get('avg_accuracy', 0),      # 平均準確率，預設 0
        'total_score': user_data.get('total_score', 0),        # 累計積分，預設 0
        'level': user_data.get('level', 1),             # 等級，預設 1
        'xp': user_data.get('xp', 0),                   # 目前 XP，預設 0
        'xp_max': user_data.get('xp_max', 1000),        # XP 上限，預設 1000
        'owned_frames': user_data.get('owned_frames') or ['frame-none'],   # 已擁有的頭像框
        'owned_tags': user_data.get('owned_tags') or ['tag-rookie'],       # 已擁有的稱號
        'owned_effects': user_data.get('owned_effects') or [],             # 已擁有的特效
        'created_at': user_data['created_at']           # 帳號建立時間
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

# 購買道具 API
# 路徑：POST /user/buy-item
# 傳入：{ user_id, item_type, item_id, price }
@user_bp.route('/buy-item', methods=['POST'])  # 定義 POST /buy-item 路由
def buy_item():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')      # 取出 user_id 欄位
    item_type = data.get('item_type')  # 取出道具類型（frames、tags、effects）
    item_id = data.get('item_id')      # 取出道具 ID（例如 frame-gold）
    price = data.get('price')          # 取出道具價格

    # 防呆：所有欄位都必填
    if not user_id or not item_type or not item_id or price is None:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：道具類型只能是這三種
    if item_type not in ['frames', 'tags', 'effects']:
        return jsonify({'error': '無效的道具類型'}), 400  # 400 客戶端錯誤：道具類型錯誤

    # 查詢玩家目前的金幣和已擁有的道具
    user_response = supabase.table('users').select(
        f'coins, owned_{item_type}'  # 只查需要的欄位
    ).eq('id', user_id).execute()

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料
    current_coins = user_data['coins']  # 目前金幣數量
    owned_items = user_data[f'owned_{item_type}'] or []  # 已擁有的道具列表

    # 防呆：已擁有此道具
    if item_id in owned_items:
        return jsonify({'error': '已擁有此道具'}), 400  # 400 客戶端錯誤：已擁有

    # 防呆：金幣不足
    if current_coins < price:
        return jsonify({'error': f'金幣不足，還差 {price - current_coins} 金幣'}), 400  # 400 客戶端錯誤：金幣不足

    # 扣除金幣並加入道具
    new_coins = current_coins - price    # 計算扣除後的金幣
    new_owned = owned_items + [item_id]  # 加入新道具到列表

    # 更新資料庫（一次更新金幣和道具列表）
    supabase.table('users').update({
        'coins': new_coins,                  # 更新金幣
        f'owned_{item_type}': new_owned      # 更新已擁有的道具列表
    }).eq('id', user_id).execute()

    return jsonify({
        'message': '購買成功',
        'remaining_coins': new_coins,  # 剩餘金幣
        'owned': new_owned             # 更新後的道具列表
    }), 200  # 200 成功

# 更新對戰統計 API
# 路徑：POST /user/update-stats
# 傳入：{ user_id, won, score, correct, total }
@user_bp.route('/update-stats', methods=['POST'])  # 定義 POST /update-stats 路由
def update_stats():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')         # 取出 user_id 欄位
    won = data.get('won')                 # 取出 won 欄位（是否獲勝）
    score = data.get('score', 0)          # 取出 score 欄位（本場得分）
    correct = data.get('correct', 0)      # 取出 correct 欄位（答對題數）
    total = data.get('total', 0)          # 取出 total 欄位（總題數）

    # 防呆：必填欄位
    if not user_id or won is None:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 查詢玩家目前的統計資料
    user_response = supabase.table('users').select(
        'wins, losses, total_answered, avg_accuracy, total_score, level, xp, xp_max, coins'
    ).eq('id', user_id).execute()

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    u = user_response.data[0]  # 取得第一筆資料

    # 計算新的統計數據
    new_wins = u['wins'] + (1 if won else 0)          # 勝場加 1 或不變
    new_losses = u['losses'] + (0 if won else 1)      # 敗場加 1 或不變
    new_total_answered = u['total_answered'] + total  # 累計答題數
    new_total_score = u['total_score'] + score        # 累計積分

    # 計算新的平均準確率（加權平均）
    acc = round(correct / total * 100) if total > 0 else 0  # 本場準確率
    if u['total_answered'] > 0:  # 如果有歷史答題數據
        new_avg_accuracy = round((u['avg_accuracy'] * u['total_answered'] + acc * total) / new_total_answered)
    else:
        new_avg_accuracy = acc  # 第一場直接用本場準確率

    # 計算 XP 和等級
    xp_gain = 200 if won else 80   # 勝利得 200 XP，失敗得 80 XP
    new_xp = u['xp'] + xp_gain    # 累加 XP
    new_level = u['level']         # 目前等級
    new_xp_max = u['xp_max']       # 目前 XP 上限

    # 升級判斷：XP 超過上限就升級
    while new_xp >= new_xp_max:
        new_xp -= new_xp_max               # 扣除升級所需 XP
        new_level += 1                     # 等級加 1
        new_xp_max = int(new_xp_max * 1.3) # 下一級需要更多 XP

    # 計算金幣獎勵
    coins_gain = int(score / 50) + 100 if won else int(score / 100) + 30  # 勝利得比較多金幣
    new_coins = u['coins'] + coins_gain  # 累加金幣

    # 更新資料庫
    supabase.table('users').update({
        'wins': new_wins,                      # 更新勝場
        'losses': new_losses,                  # 更新敗場
        'total_answered': new_total_answered,  # 更新累計答題數
        'avg_accuracy': new_avg_accuracy,      # 更新平均準確率
        'total_score': new_total_score,        # 更新累計積分
        'level': new_level,                    # 更新等級
        'xp': new_xp,                          # 更新 XP
        'xp_max': new_xp_max,                  # 更新 XP 上限
        'coins': new_coins                     # 更新金幣
    }).eq('id', user_id).execute()

    return jsonify({
        'message': '統計更新成功',
        'level': new_level,                    # 更新後的等級
        'xp': new_xp,                          # 更新後的 XP
        'xp_max': new_xp_max,                  # 更新後的 XP 上限
        'coins': new_coins,                    # 更新後的金幣
        'wins': new_wins,                      # 更新後的勝場
        'losses': new_losses,                  # 更新後的敗場
        'leveled_up': new_level > u['level']   # 是否升級
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