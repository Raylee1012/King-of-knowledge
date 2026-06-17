from flask import Blueprint, request, jsonify, redirect  # Blueprint 將路由拆分到不同檔案管理；request 讀取請求；jsonify 回傳 JSON；redirect 跳轉頁面
from supabase import create_client  # 從 supabase 套件取出 create_client 函式
import httpx  # 用來發送 HTTP 請求，直接呼叫 Supabase admin API
import smtplib  # Python 內建 SMTP 寄信模組
from email.mime.text import MIMEText  # 建立 HTML 格式的 Email
from email.mime.multipart import MIMEMultipart  # 建立多部分的 Email（包含 HTML）
import os  # 讀取環境變數
import secrets  # 產生隨機 token
import time  # 取得現在時間戳記
import re  # 正規表達式，用來驗證格式
import random  # 產生隨機驗證碼
from dotenv import load_dotenv  # 讀取 .env 檔案裡的環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

auth_bp = Blueprint('auth', __name__)  # 帳號驗證路由群組，在 index.py 掛載後路由前綴為 /auth

# 建立 Supabase 連線，之後用 supabase.table() 操作資料庫
supabase = create_client(
    os.environ.get('SUPABASE_URL'),  # 資料庫位置，從環境變數讀取
    os.environ.get('SUPABASE_KEY')   # API 金鑰，secret key 有最高權限可繞過 RLS
)

# Supabase admin API 的共用 headers，用來執行需要最高權限的操作
SUPABASE_ADMIN_HEADERS = {
    'apikey': os.environ.get('SUPABASE_KEY'),                     # API 金鑰
    'Authorization': f'Bearer {os.environ.get("SUPABASE_KEY")}',  # Bearer token 驗證
    'Content-Type': 'application/json'                            # 傳送 JSON 格式
}

# 暫存驗證碼的字典，伺服器重啟後會消失
# 格式：{ 'email': { 'code': 123456, 'expire_at': 1234567890 } }
verification_codes = {}

def admin_update_user(user_id, data):
    """用 httpx 直接呼叫 Supabase admin API 更新使用者資料"""
    httpx.put(
        f'{os.environ.get("SUPABASE_URL")}/auth/v1/admin/users/{user_id}',  # admin API 網址
        headers=SUPABASE_ADMIN_HEADERS,  # 帶上 admin headers
        json=data  # 要更新的資料
    )

def admin_delete_user(user_id):
    """用 httpx 直接呼叫 Supabase admin API 刪除使用者"""
    httpx.delete(
        f'{os.environ.get("SUPABASE_URL")}/auth/v1/admin/users/{user_id}',  # admin API 網址
        headers=SUPABASE_ADMIN_HEADERS  # 帶上 admin headers
    )

def delete_unverified_account(email):
    """刪除未驗證的帳號，包含 users 資料表和 Supabase Auth"""
    # 查詢玩家的 id
    user_response = supabase.table('users').select('id').eq('email', email).execute()
    if not user_response.data:  # 找不到玩家就直接回傳
        return

    user_id = user_response.data[0]['id']  # 取得玩家的 id

    # 刪除 users 資料表的資料
    supabase.table('users').delete().eq('id', user_id).execute()

    # 刪除 Supabase Auth 的帳號
    admin_delete_user(user_id)

def send_email(to_email, subject, html_content, plain_text=None):
    """寄送 Email 的函式，使用 Gmail SMTP"""
    import uuid
    msg = MIMEMultipart('alternative')  # 建立多部分 Email 物件
    msg['Subject'] = subject  # 設定信件主旨
    msg['From'] = f'知識王 <{os.environ.get("GMAIL_USER")}>'  # 設定寄件人
    msg['To'] = to_email  # 設定收件人
    msg['Message-ID'] = f'<{uuid.uuid4()}@kingofknowledge>'  # 唯一訊息 ID，降低垃圾信機率

    # 純文字版本（垃圾信過濾器偏好有純文字版本的信件）
    text = plain_text or '請使用支援圖文格式的郵件客戶端查看此信件。'
    msg.attach(MIMEText(text, 'plain', 'utf-8'))  # 先附加純文字版本
    part = MIMEText(html_content, 'html', 'utf-8')  # 建立 HTML 格式的信件內容
    msg.attach(part)  # 把 HTML 內容附加到信件

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:  # 用 SSL 連線，port 465 是 Gmail SSL 固定連接埠
        server.login(  # 登入 Gmail
            os.environ.get('GMAIL_USER'),  # Gmail 帳號
            os.environ.get('GMAIL_PASS')   # Gmail 應用程式密碼
        )
        server.sendmail(  # 寄信
            os.environ.get('GMAIL_USER'),  # 寄件人
            to_email,                      # 收件人
            msg.as_string()                # 信件內容轉成字串
        )

def get_email_template(verify_link, code):
    """產生驗證信的 HTML 模板（星空風格）"""
    return f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a1a;font-family:'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:18px;overflow:hidden;">
          <tr>
            <td background="https://res.cloudinary.com/dbexzqi55/image/upload/v1781596121/stars_verify_ype9vy.png" bgcolor="#0a0a1a" style="padding:32px 28px;background-color:#0a0a1a;background-image:url('https://res.cloudinary.com/dbexzqi55/image/upload/v1781596121/stars_verify_ype9vy.png');background-size:cover;background-repeat:no-repeat;">
              <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid rgba(255,215,0,0.2);">
                <div style="font-size:32px;font-weight:900;letter-spacing:2px;color:#ffd700;">👑 知識王</div>
                <div style="margin-top:6px;color:#00d4ff;font-size:12px;letter-spacing:5px;font-weight:700;">KNOWLEDGE KING</div>
              </div>
              <h2 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:900;">🎉 歡迎加入知識王！</h2>
              <p style="margin:0 0 24px;color:#b0b0d0;font-size:14px;line-height:1.7;">請選擇以下其中一種方式完成帳號驗證，連結與驗證碼皆在 5 分鐘內有效。</p>
              <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
                <p style="margin:0 0 4px;color:#ffd700;font-size:11px;font-weight:700;letter-spacing:2px;">方式一</p>
                <p style="margin:0 0 16px;color:#fff;font-size:15px;font-weight:700;">點擊連結一鍵開通帳號</p>
                <div style="text-align:center;"><a href="{verify_link}" style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a0a00;font-size:15px;font-weight:900;padding:13px 34px;border-radius:10px;text-decoration:none;">✅ 點我開通帳號</a></div>
              </div>
              <div style="text-align:center;color:#7070a0;font-size:12px;margin:12px 0;">— 或者 —</div>
              <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:20px;">
                <p style="margin:0 0 4px;color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:2px;">方式二</p>
                <p style="margin:0 0 16px;color:#fff;font-size:15px;font-weight:700;">在遊戲頁面輸入驗證碼</p>
                <div style="background:#0d0d24;border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:18px;text-align:center;">
                  <span style="font-size:38px;font-weight:900;color:#00d4ff;letter-spacing:10px;font-family:monospace;">{code}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin-top:22px;">
          <p style="color:#7070a0;font-size:12px;line-height:1.8;margin:0;">此信件為系統自動發送，請勿直接回覆。<br>如果你沒有申請知識王帳號，請忽略此信件。</p>
        </div>
      </div>
    </body>
    </html>
    """

def get_reset_email_template(reset_link):
    """產生重設密碼信的 HTML 模板（星空風格）"""
    return f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a1a;font-family:'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:18px;overflow:hidden;">
          <tr>
            <td background="https://res.cloudinary.com/dbexzqi55/image/upload/v1781596121/stars_reset_penhwe.png" bgcolor="#0a0a1a" style="padding:32px 28px;background-color:#0a0a1a;background-image:url('https://res.cloudinary.com/dbexzqi55/image/upload/v1781596121/stars_reset_penhwe.png');background-size:cover;background-repeat:no-repeat;">
              <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid rgba(255,215,0,0.2);">
                <div style="font-size:32px;font-weight:900;letter-spacing:2px;color:#ffd700;">👑 知識王</div>
                <div style="margin-top:6px;color:#00d4ff;font-size:12px;letter-spacing:5px;font-weight:700;">KNOWLEDGE KING</div>
              </div>
              <h2 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:900;">🔑 重設你的密碼</h2>
              <p style="margin:0 0 24px;color:#b0b0d0;font-size:14px;line-height:1.7;">收到你的密碼重設請求，點擊下方按鈕更新密碼。連結在 5 分鐘內有效。</p>
              <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:24px;text-align:center;">
                <a href="{reset_link}" style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a0a00;font-size:15px;font-weight:900;padding:13px 34px;border-radius:10px;text-decoration:none;">🔑 點我重設密碼</a>
              </div>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin-top:22px;">
          <p style="color:#7070a0;font-size:12px;line-height:1.8;margin:0;">此信件為系統自動發送，請勿直接回覆。<br>如果你沒有申請重設密碼，請忽略此信件。</p>
        </div>
      </div>
    </body>
    </html>
    """


@auth_bp.route('/register', methods=['POST'])  # 定義 POST /register 路由
def register():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    custom_id = data.get('custom_id')  # 取出 custom_id 欄位
    nickname = data.get('nickname')    # 取出 nickname 欄位
    email = data.get('email')          # 取出 email 欄位
    password = data.get('password')    # 取出 password 欄位

    if not custom_id or not nickname or not email or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400

    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, email):
        return jsonify({'error': 'Email格式不正確'}), 400

    id_regex = r'^[a-zA-Z0-9]{4,20}$'
    if not re.match(id_regex, custom_id):
        return jsonify({'error': 'ID只能使用英文和數字，長度4-20字'}), 400

    if len(password) < 6:
        return jsonify({'error': '密碼至少需要6位數'}), 400

    try:
        auth_response = supabase.auth.sign_up({'email': email, 'password': password})
        if auth_response.user is None:
            return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400
    except Exception:
        return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400

    user_id = auth_response.user.id

    expire_at = int(time.time() * 1000) + 5 * 60 * 1000
    raw_token = secrets.token_hex(32)
    token = f'{raw_token}.{expire_at}'

    try:
        supabase.table('users').insert({
            'id': user_id,
            'custom_id': custom_id,
            'nickname': nickname,
            'email': email,
            'is_verified': False,
            'verify_token': token,
            'coins': 500
        }).execute()
    except Exception:
        admin_delete_user(user_id)
        return jsonify({'error': '帳號 ID 已存在，請換一個'}), 400

    code = random.randint(100000, 999999)
    verification_codes[email] = {
        'code': code,
        'expire_at': int(time.time() * 1000) + 5 * 60 * 1000
    }

    verify_link = f'{os.environ.get("BACKEND_URL")}/auth/verify-link?token={token}'

    try:
        send_email(
            email,
            '知識王 帳號驗證',
            get_email_template(verify_link, code),
            '歡迎加入知識王！你的驗證碼是：' + str(code) + '，請在 5 分鐘內完成驗證。'
        )
    except Exception:
        delete_unverified_account(email)
        if email in verification_codes:
            del verification_codes[email]
        return jsonify({'error': '驗證信寄送失敗'}), 400

    return jsonify({'message': '註冊成功，請查收驗證信'}), 200


@auth_bp.route('/verify', methods=['POST'])
def verify():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')

    if not email or not code:
        return jsonify({'error': '請填寫所有欄位'}), 400

    record = verification_codes.get(email)

    if not record:
        return jsonify({'error': '驗證碼不存在'}), 400

    if int(time.time() * 1000) > record['expire_at']:
        del verification_codes[email]
        delete_unverified_account(email)
        return jsonify({'error': '驗證碼已過期，請重新註冊'}), 400

    if str(record['code']) != str(code):
        return jsonify({'error': '驗證碼錯誤'}), 400

    user_response = supabase.table('users').select('id, is_verified').eq('email', email).single().execute()
    user_id = user_response.data['id']
    already_verified = user_response.data['is_verified']

    del verification_codes[email]

    if already_verified:
        return jsonify({
            'message': '帳號已驗證過',
            'already_verified': True,
            'user_id': user_id
        }), 200

    supabase.table('users').update({
        'is_verified': True
    }).eq('email', email).execute()

    admin_update_user(user_id, {'email_confirm': True})

    return jsonify({
        'message': '驗證成功，帳號已開通',
        'already_verified': False,
        'user_id': user_id
    }), 200


@auth_bp.route('/verify-link', methods=['GET'])
def verify_link():
    token = request.args.get('token')

    if not token:
        return jsonify({'error': '無效的驗證連結'}), 400

    parts = token.split('.')
    if len(parts) != 2:
        return jsonify({'error': '驗證連結無效'}), 400

    raw_token, expire_at = parts

    # 先查使用者（不論是否過期），讓後續邏輯可以判斷 is_verified
    user_response = supabase.table('users').select('id, email, is_verified').eq('verify_token', token).execute()
    user_data = user_response.data[0] if user_response.data else None

    # 已驗證過：不管連結有沒有過期，都直接導向「已驗證」頁
    if user_data and user_data['is_verified']:
        return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/already-verified')

    # 連結過期：只在帳號尚未驗證時才刪除
    if int(time.time() * 1000) > int(expire_at):
        if user_data:
            delete_unverified_account(user_data['email'])
        return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/verify-expired')

    # 找不到對應帳號
    if not user_data:
        return jsonify({'error': '驗證連結無效'}), 400

    supabase.table('users').update({
        'is_verified': True,
        'verify_token': None
    }).eq('id', user_data['id']).execute()

    admin_update_user(user_data['id'], {'email_confirm': True})

    return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/verified')  # 跳轉到後端驗證成功頁面


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('identifier')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400

    email = identifier

    if '@' not in identifier:
        user_response = supabase.table('users').select('email').eq('custom_id', identifier).execute()
        if not user_response.data:
            return jsonify({'error': '找不到使用者'}), 400
        email = user_response.data[0]['email']

    try:
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': password})
        if auth_response.user is None:
            return jsonify({'error': '帳號或密碼錯誤'}), 400
    except Exception:
        return jsonify({'error': '帳號或密碼錯誤'}), 400

    return jsonify({
        'message': '登入成功',
        'user': {
            'id': auth_response.user.id,
            'email': auth_response.user.email,
            'email_confirmed_at': str(auth_response.user.email_confirmed_at)
        }
    }), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    identifier = data.get('identifier')

    if not identifier:
        return jsonify({'error': '請填寫帳號或信箱'}), 400

    # 判斷是 custom_id 還是 email
    if '@' not in identifier:
        id_res = supabase.table('users').select('email').eq('custom_id', identifier).execute()
        if not id_res.data:
            return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200
        email = id_res.data[0]['email']
    else:
        email = identifier

    user_response = supabase.table('users').select('id, email').eq('email', email).execute()

    if not user_response.data:
        return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200

    expire_at = int(time.time() * 1000) + 5 * 60 * 1000
    raw_token = secrets.token_hex(32)
    reset_token = f'{raw_token}.{expire_at}'

    supabase.table('users').update({
        'reset_token': reset_token
    }).eq('email', email).execute()

    reset_link = f'{os.environ.get("FRONTEND_URL")}/reset-password?token={reset_token}'

    send_email(
        email,
        '知識王 密碼重設',
        get_reset_email_template(reset_link),
        '你已申請重設知識王密碼，請查看 HTML 版本完成操作。如非本人操作請忽略此信。'
    )

    return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'error': '請填寫所有欄位'}), 400

    if len(new_password) < 6:
        return jsonify({'error': '密碼至少需要6位數'}), 400

    parts = token.split('.')
    if len(parts) != 2:
        return jsonify({'error': '重設密碼連結無效'}), 400

    raw_token, expire_at = parts

    if int(time.time() * 1000) > int(expire_at):
        return jsonify({'error': '重設密碼連結已過期，請重新申請'}), 400

    user_response = supabase.table('users').select('id, email').eq('reset_token', token).execute()

    if not user_response.data:
        return jsonify({'error': '重設密碼連結無效'}), 400

    user_data = user_response.data[0]

    admin_update_user(user_data['id'], {'password': new_password})

    supabase.table('users').update({
        'reset_token': None
    }).eq('id', user_data['id']).execute()

    return jsonify({'message': '密碼重設成功，請重新登入'}), 200


@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    user_id = data.get('user_id')
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not user_id or not old_password or not new_password:
        return jsonify({'error': '請填寫所有欄位'}), 400

    if len(new_password) < 6:
        return jsonify({'error': '新密碼至少需要6位數'}), 400

    if old_password == new_password:
        return jsonify({'error': '新密碼不能和舊密碼相同'}), 400

    user_response = supabase.table('users').select('email').eq('id', user_id).execute()
    if not user_response.data:
        return jsonify({'error': '找不到使用者'}), 400

    email = user_response.data[0]['email']

    try:
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': old_password})
        if auth_response.user is None:
            return jsonify({'error': '舊密碼錯誤'}), 400
    except Exception:
        return jsonify({'error': '舊密碼錯誤'}), 400

    admin_update_user(user_id, {'password': new_password})

    return jsonify({'message': '密碼修改成功'}), 200