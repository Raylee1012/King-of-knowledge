from flask import Blueprint, request, jsonify  # Blueprint 將路由拆分到不同檔案管理；request 讀取請求；jsonify 回傳 JSON
from supabase import create_client  # 從 supabase 套件取出 create_client 函式
import httpx  # 用來發送 HTTP 請求，直接呼叫 Supabase admin API
import os  # 讀取環境變數
import base64  # 解碼 base64 圖片資料
from dotenv import load_dotenv  # 讀取 .env 檔案裡的環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

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
@user_bp.route('/coins/<user_id>', methods=['GET'])
def get_coins(user_id):
    res = supabase.table('users').select('coins').eq('id', user_id).execute()
    if not res.data:
        return jsonify({'error': '找不到使用者'}), 400
    return jsonify({'coins': res.data[0]['coins']}), 200

def _get_daily_claimed_at(user_id):
    """單獨查詢 daily_claimed_at，欄位不存在時回傳 None。"""
    try:
        res = supabase.table('users').select('daily_claimed_at').eq('id', user_id).execute()
        if res.data:
            return res.data[0].get('daily_claimed_at')
    except Exception:
        pass
    return None


def _get_owned_skills(user_id):
    """單獨查詢 owned_skills，欄位不存在時回傳空陣列避免讓整個 profile 查詢失敗。"""
    try:
        res = supabase.table('users').select('owned_skills').eq('id', user_id).execute()
        if res.data:
            return res.data[0].get('owned_skills') or []
    except Exception:
        pass
    return []


def _get_rename_cards(user_id):
    """單獨查詢 rename_cards，欄位不存在時回傳 0。"""
    try:
        res = supabase.table('users').select('rename_cards').eq('id', user_id).execute()
        if res.data:
            return int(res.data[0].get('rename_cards') or 0)
    except Exception:
        pass
    return 0


# 路徑：GET /user/profile/<user_id>
# 傳入：URL 參數 user_id
@user_bp.route('/profile/<user_id>', methods=['GET'])  # 定義 GET /profile/<user_id> 路由
def get_profile(user_id):
    # 查詢玩家資料
    user_response = supabase.table('users').select(
        'id, custom_id, email, is_verified, coins, nickname, nickname_change_count, nickname_last_reset, is_admin, created_at, level, xp, xp_max, wins, losses, total_answered, avg_accuracy, total_score, owned_frames, owned_tags, owned_effects, active_effect, topic_stats, welcome_claimed, pending_levelup_coins, avatar_url'
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
        'total_score': user_data.get('total_score', 0),                  # 累計積分，預設 0
        'owned_frames': user_data.get('owned_frames') or ['frame-none'],   # 已擁有的頭像框
        'owned_tags': user_data.get('owned_tags') or ['tag-rookie'],       # 已擁有的稱號
        'owned_effects': user_data.get('owned_effects') or [],             # 已擁有的特效
        'owned_skills': _get_owned_skills(user_id),                          # 已擁有的對戰技能
        'active_effect': user_data.get('active_effect'),                   # 目前裝備的特效
        'topic_stats': user_data.get('topic_stats') or {},                 # 主題統計
        'avatar_url': user_data.get('avatar_url') or '',                   # 自訂頭像 URL
        'welcome_claimed': user_data.get('welcome_claimed') or False,      # 是否已領取新手禮包
        'daily_claimed_at': _get_daily_claimed_at(user_id),               # 上次領取每日禮包時間
        'pending_levelup_coins': int(user_data.get('pending_levelup_coins') or 0),  # 待領取的升等獎勵
        'rename_cards': _get_rename_cards(user_id),                        # 改名卡數量
    }), 200  # 200 成功

# 修改暱稱 API
# 路徑：POST /user/nickname
# 傳入：{ user_id, new_nickname }
@user_bp.route('/nickname', methods=['POST'])  # 定義 POST /nickname 路由
def update_nickname():
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
    existing_nick = supabase.table('users').select('id').eq('nickname', new_nickname).neq('id', user_id).execute()
    if existing_nick.data:
        return jsonify({'error': '暱稱已被使用，請換一個'}), 400

    # 查詢玩家資料，取得目前的金幣、修改次數、上次重置時間
    user_response = supabase.table('users').select(
        'coins, nickname_change_count, nickname_last_reset'  # 只需要這三個欄位
    ).eq('id', user_id).execute()  # 條件：找這個玩家

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    user_data = user_response.data[0]  # 取得第一筆資料

    # 改名卡流程：免費次數用完自動用改名卡，否則扣 500 金幣
    if use_card:
        from datetime import datetime, timezone
        last_reset = datetime.fromisoformat(user_data['nickname_last_reset'])
        now = datetime.now(timezone.utc)
        is_new_month = now.year > last_reset.year or now.month > last_reset.month
        current_count = 0 if is_new_month else int(user_data.get('nickname_change_count') or 0)
        reset_time = now.isoformat() if is_new_month else user_data['nickname_last_reset']

        if current_count >= FREE_NICKNAME_CHANGE_LIMIT:
            # 免費次數用完，嘗試用改名卡
            rename_cards = _get_rename_cards(user_id)
            if rename_cards > 0:
                supabase.table('users').update({
                    'nickname': new_nickname,
                    'rename_cards': rename_cards - 1,
                    'nickname_change_count': current_count + 1,
                    'nickname_last_reset': reset_time
                }).eq('id', user_id).execute()
                return jsonify({
                    'message': '暱稱更新成功',
                    'used_rename_card': True,
                    'rename_cards': rename_cards - 1,
                    'remaining_free': 0
                }), 200
            # 沒有改名卡，不自動扣金幣，回傳錯誤
            return jsonify({'error': '本月免費次數已用完，且沒有改名卡，請至商店購買'}), 400

        # 免費次數未用完，直接改名
        remaining_free = max(0, FREE_NICKNAME_CHANGE_LIMIT - (current_count + 1))
        supabase.table('users').update({
            'nickname': new_nickname,
            'nickname_change_count': current_count + 1,
            'nickname_last_reset': reset_time
        }).eq('id', user_id).execute()
        return jsonify({
            'message': '暱稱更新成功',
            'used_rename_card': False,
            'remaining_free': remaining_free,
            'remaining_coins': user_data['coins']
        }), 200

    # 一般流程：前 3 次免費，超過扣 500
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

# 新手禮包 API
# 路徑：POST /user/welcome-gift
# 傳入：{ user_id }
@user_bp.route('/welcome-gift', methods=['POST'])
def claim_welcome_gift():
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    res = supabase.table('users').select('coins, welcome_claimed').eq('id', user_id).execute()
    if not res.data:
        return jsonify({'error': '找不到使用者'}), 400

    if res.data[0].get('welcome_claimed'):
        return jsonify({'error': '已領取過新手禮包'}), 400

    new_coins = res.data[0]['coins'] + 500
    supabase.table('users').update({'coins': new_coins, 'welcome_claimed': True}).eq('id', user_id).execute()
    return jsonify({'coins': new_coins}), 200

# 每日禮包領取 API
# 路徑：POST /user/daily-gift
# 傳入：{ user_id }
@user_bp.route('/daily-gift', methods=['POST'])
def claim_daily_gift():
    from datetime import datetime, timezone, date
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    try:
        res = supabase.table('users').select('coins, daily_claimed_at').eq('id', user_id).execute()
    except Exception:
        res = supabase.table('users').select('coins').eq('id', user_id).execute()
    if not res.data:
        return jsonify({'error': '找不到使用者'}), 400

    last = res.data[0].get('daily_claimed_at')
    today = date.today().isoformat()  # e.g. "2026-06-21"

    if last and last[:10] == today:
        return jsonify({'error': '今天已領取過每日禮包'}), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    reward = 300
    new_coins = res.data[0]['coins'] + reward
    update_data = {'coins': new_coins}
    try:
        update_data['daily_claimed_at'] = now_iso
        supabase.table('users').update(update_data).eq('id', user_id).execute()
    except Exception:
        supabase.table('users').update({'coins': new_coins}).eq('id', user_id).execute()

    return jsonify({'coins': new_coins, 'reward': reward}), 200


# 升等禮包領取 API
# 路徑：POST /user/levelup-gift
@user_bp.route('/levelup-gift', methods=['POST'])
def claim_levelup_gift():
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    res = supabase.table('users').select('coins, pending_levelup_coins').eq('id', user_id).execute()
    if not res.data:
        return jsonify({'error': '找不到使用者'}), 400

    pending = int(res.data[0].get('pending_levelup_coins') or 0)
    if pending <= 0:
        return jsonify({'error': '沒有待領取的升等獎勵'}), 400

    new_coins = res.data[0]['coins'] + pending
    supabase.table('users').update({'coins': new_coins, 'pending_levelup_coins': 0}).eq('id', user_id).execute()
    return jsonify({'coins': new_coins}), 200

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

    # 防呆：道具類型只能是這五種
    if item_type not in ['frames', 'tags', 'effects', 'skills', 'items']:
        return jsonify({'error': '無效的道具類型'}), 400

    # 改名卡：用整數欄位追蹤數量
    if item_type == 'items' and item_id == 'item-rename':
        try:
            res = supabase.table('users').select('coins, rename_cards').eq('id', user_id).execute()
            if not res.data:
                return jsonify({'error': '找不到使用者'}), 400
            current_coins = res.data[0]['coins']
            current_cards = int(res.data[0].get('rename_cards') or 0)
            if current_coins < price:
                return jsonify({'error': f'金幣不足，還差 {price - current_coins} 金幣'}), 400
            new_coins = current_coins - price
            new_cards = current_cards + 1
            supabase.table('users').update({'coins': new_coins, 'rename_cards': new_cards}).eq('id', user_id).execute()
            return jsonify({'message': '購買成功', 'remaining_coins': new_coins, 'rename_cards': new_cards}), 200
        except Exception:
            return jsonify({'error': '購買失敗，請確認 rename_cards 欄位已建立'}), 500

    # 查詢玩家目前的金幣和已擁有的道具
    try:
        user_response = supabase.table('users').select(
            f'coins, owned_{item_type}'  # 只查需要的欄位
        ).eq('id', user_id).execute()
    except Exception:
        return jsonify({'error': f'欄位 owned_{item_type} 尚未建立，請先在資料庫新增此欄位'}), 500

    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400

    user_data = user_response.data[0]
    current_coins = user_data['coins']
    owned_items = user_data[f'owned_{item_type}'] or []

    # 技能是消耗品，可以重複購買；其他道具只能擁有一個
    if item_type != 'skills' and item_id in owned_items:
        return jsonify({'error': '已擁有此道具'}), 400

    if current_coins < price:
        return jsonify({'error': f'金幣不足，還差 {price - current_coins} 金幣'}), 400

    new_coins = current_coins - price
    new_owned = owned_items + [item_id]

    supabase.table('users').update({
        'coins': new_coins,
        f'owned_{item_type}': new_owned
    }).eq('id', user_id).execute()

    return jsonify({
        'message': '購買成功',
        'remaining_coins': new_coins,
        'owned': new_owned
    }), 200


# 使用技能 API（消耗品，扣一個）
# 路徑：POST /user/use-skill
# 傳入：{ user_id, skill_id }
@user_bp.route('/use-skill', methods=['POST'])
def use_skill():
    data = request.get_json()
    user_id  = data.get('user_id')
    skill_id = data.get('skill_id')

    if not user_id or not skill_id:
        return jsonify({'error': '請填寫所有欄位'}), 400

    res = supabase.table('users').select('owned_skills').eq('id', user_id).execute()
    if not res.data:
        return jsonify({'error': '找不到使用者'}), 400

    owned = res.data[0].get('owned_skills') or []
    if skill_id not in owned:
        return jsonify({'error': '沒有此技能'}), 400

    owned.remove(skill_id)  # 移除一個（list.remove 只移除第一個符合的）
    supabase.table('users').update({'owned_skills': owned}).eq('id', user_id).execute()

    return jsonify({'remaining': owned.count(skill_id)}), 200


# 更新玩家對戰後統計資料 API
# 路徑：POST /user/update-stats
# 傳入：{ user_id, won, score, correct, total, opp_correct }
@user_bp.route('/update-stats', methods=['POST'])
def update_stats():
    try:
        data = request.get_json()  # 取得前端傳來的 JSON 資料
        if not data:
            print("[update_stats] 錯誤：無法解析 JSON")
            return jsonify({'error': '無效的 JSON 數據'}), 400
        
        user_id = data.get('user_id')  # 取出 user_id 欄位
        won = data.get('won') is True  # 取出勝負
        score = int(data.get('score', 0))  # 本場得分
        correct = int(data.get('correct', 0))  # 本場答對題數
        total = int(data.get('total', 0))  # 本場答題數
        opp_correct = int(data.get('opp_correct', 0))  # 對手答對題數

        # 防呆：必要欄位都必填
        if not user_id:
            print("[update_stats] 錯誤：缺少 user_id")
            return jsonify({'error': '缺少 user_id'}), 400

        print(f"[update_stats] 開始處理: user_id={user_id}, won={won}, correct={correct}, total={total}")

        # 查詢玩家目前資料
        user_response = supabase.table('users').select(
            'coins, xp, xp_max, level, wins, losses, total_answered, avg_accuracy, total_score, topic_stats, pending_levelup_coins'
        ).eq('id', user_id).execute()

        if not user_response.data:
            print(f"[update_stats] 錯誤：找不到 user_id={user_id} 的使用者")
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

        mode = str(data.get('mode') or '').lower()
        
        # 初始化 xp_gain 為 0（備用值）
        xp_gain = 0
        coin_delta = 0

        # 判斷是否為房號配對模式（不計錢但計 XP）
        is_room_match = mode in ['create_room', 'join_room']

        print(f"[update_stats] mode={mode}, won={won}, correct={correct}, total={total}, is_room_match={is_room_match}")

        if won:
            # 房號配對不給錢，其他模式按原邏輯計算
            if is_room_match:
                coin_delta = 0  # 房號配對不計金幣
            else:
                coin_delta = 100 + 20 * correct
            xp_gain = int(20 + (3 * correct if mode == 'bot' else 5 * correct))
            wins += 1
        else:
            # 房號配對不計錢，其他模式按原邏輯計算
            if is_room_match:
                coin_delta = 0  # 房號配對不計金幣
            else:
                coin_delta = 0 if mode == 'bot' else -(50 + 20 * opp_correct)
            # 失敗時：至少給予基礎 XP，鼓勵繼續遊戲
            if mode == 'bot':
                xp_gain = int(max(3, correct))  # bot 失敗最少 3 XP
            else:
                xp_gain = int(max(5, 3 * correct))  # queue/room 失敗最少 5 XP
            losses += 1

        coins = max(0, coins + coin_delta)
        xp += xp_gain
        leveled_up = False
        level_up_coins = 0
        level_up_base = 0
        level_up_milestone = 0
        while xp >= xp_max:
            xp -= xp_max
            level += 1
            xp_max += 500
            leveled_up = True
            level_up_base += 100
            if level % 10 == 0:
                level_up_milestone += 400
        level_up_coins = level_up_base + level_up_milestone
        existing_pending = int(user_data.get('pending_levelup_coins') or 0)

        print(f"[update_stats] 結算結果: coin_delta={coin_delta}, xp_gain={xp_gain}, 新 coins={coins}, 新 xp={xp}, 升等待領={level_up_coins}")

        new_total_answered = total_answered + total
        if new_total_answered > 0:
            accuracy = round((avg_accuracy * total_answered + (100.0 * correct)) / new_total_answered, 2)
        else:
            accuracy = 0
        total_score += score

        # 處理題目分類統計
        incoming_topic_stats = data.get('topic_stats', {})
        if not isinstance(incoming_topic_stats, dict):
            incoming_topic_stats = {}
        
        existing_topic_stats = user_data.get('topic_stats') or {}
        if not isinstance(existing_topic_stats, dict):
            existing_topic_stats = {}
        
        merged_topic_stats = dict(existing_topic_stats)
        
        # 合併新的題目統計
        for category, stats in incoming_topic_stats.items():
            if category not in merged_topic_stats:
                merged_topic_stats[category] = {'correct': 0, 'wrong': 0}
            if isinstance(stats, dict):
                merged_topic_stats[category]['correct'] = merged_topic_stats[category].get('correct', 0) + stats.get('correct', 0)
                merged_topic_stats[category]['wrong'] = merged_topic_stats[category].get('wrong', 0) + stats.get('wrong', 0)

        print(f"[update_stats] 更新前的 merged_topic_stats: {merged_topic_stats}")

        update_data = {
            'coins': coins,
            'xp': xp,
            'xp_max': xp_max,
            'level': level,
            'wins': wins,
            'losses': losses,
            'total_answered': new_total_answered,
            'avg_accuracy': accuracy,
            'total_score': total_score,
            'topic_stats': merged_topic_stats,
            'pending_levelup_coins': existing_pending + level_up_coins,
        }
        
        print(f"[update_stats] 更新 users 表: {update_data}")
        supabase.table('users').update(update_data).eq('id', user_id).execute()

        # 保存對戰記錄到 battle_records
        print(f"[update_stats] 插入 battle_records")
        supabase.table('battle_records').insert({
            'user_id': user_id,
            'score': score,
            'correct': correct,
            'total': total,
            'won': won
        }).execute()

        response_data = {
            'message': '更新成功',
            'coins': int(coins),
            'xp': int(xp),
            'xp_max': int(xp_max),
            'level': int(level),
            'wins': int(wins),
            'losses': int(losses),
            'total_answered': int(new_total_answered),
            'avg_accuracy': float(accuracy),
            'total_score': int(total_score),
            'coin_delta': int(coin_delta),
            'level_up_coins': int(level_up_coins),
            'level_up_base': int(level_up_base),
            'level_up_milestone': int(level_up_milestone),
            'xp_gain': int(xp_gain),  # 確保是整數
            'leveled_up': bool(leveled_up),
            'topic_stats': merged_topic_stats
        }
        print(f"[update_stats] 返回成功: {response_data}")
        return jsonify(response_data), 200
        
    except Exception as err:
        import traceback
        error_msg = str(err)
        traceback.print_exc()
        print(f"[update_stats] 發生錯誤: {error_msg}")
        return jsonify({'error': f'更新失敗: {error_msg}'}), 500

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
# 儲存已裝備的特效
# 路徑：POST /user/active-effect
# 傳入：{ user_id, effect_id }（effect_id 為 null 表示取消）
@user_bp.route('/active-effect', methods=['POST'])
def save_active_effect():
    data = request.get_json()
    user_id = data.get('user_id')
    effect_id = data.get('effect_id')  # 可以是 null（取消特效）

    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    supabase.table('users').update(
        {'active_effect': effect_id}
    ).eq('id', user_id).execute()

    return jsonify({'message': '特效已更新', 'active_effect': effect_id}), 200

# 排行榜 API
# 路徑：GET /user/rank
# 參數：user_id（可選，標記自己並查詢自己的排名）
# 回傳：前 3 名（積分高者優先，同分比勝場）+ 當前玩家排名
@user_bp.route('/rank', methods=['GET'])
def get_rank():
    user_id = request.args.get('user_id')  # 當前玩家 ID

    # 查詢足夠多的玩家，確保能涵蓋前 3 名的所有並列情況
    rank_response = supabase.table('users').select(
        'id, nickname, custom_id, total_score, wins, level'
    ).order('total_score', desc=True).order('wins', desc=True).limit(200).execute()

    players = rank_response.data or []

    # 計算名次（積分和勝場都相同則並列），回傳全部玩家
    result = []
    current_rank = 1
    for i, p in enumerate(players):
        if i > 0:
            prev = players[i - 1]
            same = (
                (p.get('total_score', 0) or 0) == (prev.get('total_score', 0) or 0) and
                (p.get('wins', 0) or 0) == (prev.get('wins', 0) or 0)
            )
            if not same:
                current_rank = i + 1
        result.append({
            'rank': current_rank,
            'id': p['id'],
            'name': p['nickname'] or p['custom_id'],
            'score': p.get('total_score', 0) or 0,
            'wins': p.get('wins', 0) or 0,
            'level': p.get('level', 1) or 1,
            'isYou': p['id'] == user_id
        })

    # 查詢當前玩家的排名（積分更高 OR 積分相同但勝場更多）
    my_rank = None
    if user_id:
        my_response = supabase.table('users').select(
            'id, nickname, custom_id, total_score, wins, level'
        ).eq('id', user_id).execute()

        if my_response.data:
            me = my_response.data[0]
            my_score = me.get('total_score', 0) or 0
            my_wins = me.get('wins', 0) or 0

            higher_score = supabase.table('users').select(
                'id', count='exact'
            ).gt('total_score', my_score).execute()

            same_score_more_wins = supabase.table('users').select(
                'id', count='exact'
            ).eq('total_score', my_score).gt('wins', my_wins).execute()

            my_rank = {
                'rank': (higher_score.count or 0) + (same_score_more_wins.count or 0) + 1,
                'id': me['id'],
                'name': me['nickname'] or me['custom_id'],
                'score': my_score,
                'wins': my_wins,
                'level': me.get('level', 1) or 1,
                'isYou': True
            }

    return jsonify({
        'rank': result,
        'myRank': my_rank
    }), 200



# 查詢最近對戰記錄
# 路徑：GET /user/recent-battles
# 參數：user_id, limit（預設 10）
@user_bp.route('/recent-battles', methods=['GET'])
def get_recent_battles():
    user_id = request.args.get('user_id')
    limit = int(request.args.get('limit', 10))
    if not user_id:
        return jsonify({'error': '缺少 user_id'}), 400

    try:
        res = supabase.table('battle_records').select(
            'score, correct, total, won, created_at'
        ).eq('user_id', user_id).order('created_at', desc=True).limit(limit).execute()

        records = list(reversed(res.data or []))  # 最舊的排前面（時間軸左到右）
        scores = [r['score'] for r in records]
        accuracy = [round(r['correct']/r['total']*100) if r['total'] > 0 else 0 for r in records]
        return jsonify({'scores': scores, 'accuracy': accuracy}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 全體玩家各分類平均準確率
# 路徑：GET /user/avg-topic-stats
@user_bp.route('/avg-topic-stats', methods=['GET'])
def get_avg_topic_stats():
    try:
        res = supabase.table('users').select('topic_stats').not_.is_('topic_stats', 'null').execute()
        players = res.data or []

        totals = {}
        for p in players:
            stats = p.get('topic_stats') or {}
            for cat, s in stats.items():
                if cat not in totals:
                    totals[cat] = {'correct': 0, 'total': 0}
                totals[cat]['correct'] += s.get('correct', 0)
                totals[cat]['total'] += s.get('correct', 0) + s.get('wrong', 0)

        avg = {cat: round(v['correct']/v['total']*100) if v['total'] > 0 else 0
               for cat, v in totals.items()}

        return jsonify(avg), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# 上傳自訂頭像
# 路徑：POST /user/avatar
# 傳入：{ user_id, avatar_data }（base64 WebP data URL）
@user_bp.route('/avatar', methods=['POST'])
def upload_avatar():
    data = request.get_json()
    user_id = data.get('user_id')
    avatar_data = data.get('avatar_data', '')

    if not user_id or not avatar_data:
        return jsonify({'error': '缺少參數'}), 400

    try:
        # 去掉 data URL 前綴，取得純 base64
        if ',' in avatar_data:
            avatar_data = avatar_data.split(',', 1)[1]
        file_bytes = base64.b64decode(avatar_data)

        bucket = 'avatars'
        path = f'{user_id}.webp'

        # 嘗試先刪除舊檔（upsert 有時會失敗，刪了再上傳比較保險）
        try:
            supabase.storage.from_(bucket).remove([path])
        except Exception:
            pass

        supabase.storage.from_(bucket).upload(
            path,
            file_bytes,
            file_options={'content-type': 'image/webp'}
        )

        public_url = supabase.storage.from_(bucket).get_public_url(path)

        # 存 URL 到 users table
        supabase.table('users').update({'avatar_url': public_url}).eq('id', user_id).execute()

        return jsonify({'avatar_url': public_url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500