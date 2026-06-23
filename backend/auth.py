from flask import Blueprint, request, jsonify, redirect
# Blueprint：將此檔案的路由獨立成一個藍圖，在 index.py 以 url_prefix='/auth' 掛載
# request：讀取 HTTP 請求的 body（get_json）、query string（args）等
# jsonify：將 Python dict 序列化成 JSON 格式的 HTTP 回應物件
# redirect：產生 302 跳轉回應，用於驗證成功 / 失敗後引導到對應頁面
from supabase import create_client  # 建立 Supabase 客戶端實例，提供 .table()、.auth、.storage 等操作介面
import httpx  # 同步 HTTP 客戶端，用於直接呼叫 Supabase Admin REST API（supabase-py 未封裝的管理員功能）
import smtplib  # Python 標準庫，提供 SMTP 協議支援，用於透過 Gmail SMTP SSL（port 465）寄送驗證 / 重設密碼信
from email.mime.text import MIMEText  # 將純文字或 HTML 字串包裝成 MIME 文字部分，附加到信件物件
from email.mime.multipart import MIMEMultipart  # 建立 multipart/alternative 格式的信件容器，同時包含純文字與 HTML 版本
import os  # Python 標準庫，用於讀取環境變數（os.environ.get）與組合檔案路徑（os.path）
import secrets  # Python 標準庫，產生密碼學強度的隨機字串（token_hex），用於驗證 / 重設密碼連結
import time  # Python 標準庫，取得目前的 Unix 時間戳記（time.time），用於計算 token 到期時間
import re  # Python 標準庫，提供正規表達式功能，用於驗證 email 格式與 custom_id 格式
import random  # Python 標準庫，產生隨機整數，用於生成六位數的 email 驗證碼
from dotenv import load_dotenv  # python-dotenv 套件，將 .env 檔案裡的 KEY=VALUE 載入到 os.environ，方便本地開發不需手動設定環境變數

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
    import uuid  # Python 標準庫，產生全球唯一識別碼（UUID4），用於設定 Message-ID 標頭讓每封信都有唯一編號，降低被 Gmail 等服務誤判為垃圾信的機率
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
def register():  # 處理玩家註冊請求：驗證欄位 → 建立 Auth → 插入 users 表 → 寄驗證信
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    custom_id = data.get('custom_id')  # 取出 custom_id 欄位
    nickname = data.get('nickname')    # 取出 nickname 欄位
    email = data.get('email')          # 取出 email 欄位
    password = data.get('password')    # 取出 password 欄位

    if not custom_id or not nickname or not email or not password:  # 判斷是否有任何必填欄位為空
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳欄位不完整錯誤

    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'  # 定義基本 Email 格式的正規表達式
    if not re.match(email_regex, email):  # 判斷 email 是否符合格式
        return jsonify({'error': 'Email格式不正確'}), 400  # 回傳 Email 格式錯誤

    id_regex = r'^[a-zA-Z0-9]{4,20}$'  # 定義帳號 ID 只允許英數字且長度 4–20 的正規表達式
    if not re.match(id_regex, custom_id):  # 判斷 custom_id 是否符合格式
        return jsonify({'error': 'ID只能使用英文和數字，長度4-20字'}), 400  # 回傳 ID 格式錯誤

    if len(password) < 6:  # 判斷密碼長度是否不足 6 位
        return jsonify({'error': '密碼至少需要6位數'}), 400  # 回傳密碼過短錯誤

    existing = supabase.table('users').select('id').eq('custom_id', custom_id).execute()  # 查詢 users 資料表是否已有相同 custom_id
    if existing.data:  # 判斷 custom_id 是否已被使用
        return jsonify({'error': '帳號 ID 已存在，請換一個'}), 400  # 回傳 ID 重複錯誤

    existing_nick = supabase.table('users').select('id').eq('nickname', nickname).execute()  # 查詢 users 資料表是否已有相同暱稱
    if existing_nick.data:  # 判斷暱稱是否已被使用
        return jsonify({'error': '暱稱已被使用，請換一個'}), 400  # 回傳暱稱重複錯誤

    try:  # 嘗試在 Supabase Auth 建立新帳號
        auth_response = supabase.auth.sign_up({'email': email, 'password': password})  # 呼叫 Supabase Auth 建立新帳號
        if auth_response.user is None:  # 判斷 Auth 是否回傳有效使用者物件
            return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400  # 回傳 Email 重複錯誤
    except Exception:  # Auth 建立帳號失敗（email 可能已被其他帳號使用）
        return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400  # 回傳 Auth 建立帳號失敗錯誤

    user_id = auth_response.user.id  # 取得 Supabase Auth 分配的使用者 UUID

    expire_at = int(time.time() * 1000) + 5 * 60 * 1000  # 計算驗證連結到期時間（目前毫秒時間戳 + 5 分鐘）
    raw_token = secrets.token_hex(32)  # 產生 64 字元隨機十六進位字串作為 token 主體
    token = f'{raw_token}.{expire_at}'  # 組合 token：隨機字串 + 到期時間戳，方便驗證時解析

    try:  # 嘗試在 users 資料表插入玩家資料
        supabase.table('users').insert({  # 在 users 資料表新增一筆使用者資料
            'id': user_id,  # 對應 Supabase Auth 的 UUID
            'custom_id': custom_id,  # 玩家自訂帳號 ID
            'nickname': nickname,  # 玩家暱稱
            'email': email,  # 電子信箱
            'is_verified': False,  # 預設尚未驗證
            'verify_token': token,  # 儲存驗證 token 供連結驗證使用
            'coins': 0  # 初始金幣為 0
        }).execute()
    except Exception:  # 插入失敗（通常是 custom_id 唯一性衝突）
        admin_delete_user(user_id)  # 插入失敗時刪除已建立的 Auth 帳號，避免殘留
        return jsonify({'error': '帳號 ID 已存在，請換一個'}), 400  # 回傳資料庫插入衝突錯誤

    code = random.randint(100000, 999999)  # 產生六位數隨機驗證碼
    verification_codes[email] = {  # 將驗證碼與到期時間存入記憶體字典
        'code': code,  # 六位數驗證碼
        'expire_at': int(time.time() * 1000) + 5 * 60 * 1000  # 到期時間為目前時間 + 5 分鐘
    }

    verify_link = f'{os.environ.get("BACKEND_URL")}/auth/verify-link?token={token}'  # 組合點擊驗證連結，帶上 token 參數

    try:  # 嘗試寄送驗證信，失敗則刪除剛建立的帳號
        send_email(  # 呼叫寄信函式發送驗證信
            email,  # 收件人信箱
            '知識王 帳號驗證',  # 信件主旨
            get_email_template(verify_link, code),  # HTML 信件內容
            '歡迎加入知識王！你的驗證碼是：' + str(code) + '，請在 5 分鐘內完成驗證。'  # 純文字備用內容
        )
    except Exception:  # 寄信失敗（SMTP 連線問題或無效 email），回滾帳號
        delete_unverified_account(email)  # 寄信失敗時刪除剛建立的帳號，防止殘留未驗證帳號
        if email in verification_codes:  # 判斷記憶體中是否還有該 email 的驗證碼紀錄
            del verification_codes[email]  # 清除記憶體中的驗證碼，避免佔用
        return jsonify({'error': '驗證信寄送失敗'}), 400  # 回傳寄信失敗錯誤

    return jsonify({'message': '註冊成功，請查收驗證信'}), 200  # 回傳註冊成功並提示查收信箱


@auth_bp.route('/verify', methods=['POST'])  # 定義 POST /verify 路由（驗證碼方式）
def verify():  # 處理玩家在遊戲頁面輸入驗證碼的開通請求
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    email = data.get('email')  # 取出 email 欄位
    code = data.get('code')  # 取出使用者輸入的驗證碼

    if not email or not code:  # 判斷 email 或驗證碼是否為空
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳欄位不完整錯誤

    record = verification_codes.get(email)  # 從記憶體字典取出該 email 的驗證碼紀錄

    if not record:  # 判斷是否找不到對應的驗證碼紀錄
        return jsonify({'error': '驗證碼不存在'}), 400  # 回傳驗證碼不存在錯誤

    if int(time.time() * 1000) > record['expire_at']:  # 判斷目前時間是否已超過驗證碼到期時間
        del verification_codes[email]  # 清除過期的驗證碼紀錄
        delete_unverified_account(email)  # 刪除對應的未驗證帳號
        return jsonify({'error': '驗證碼已過期，請重新註冊'}), 400  # 回傳驗證碼過期錯誤

    if str(record['code']) != str(code):  # 判斷使用者輸入的驗證碼是否與記錄不符
        return jsonify({'error': '驗證碼錯誤'}), 400  # 回傳驗證碼錯誤

    user_response = supabase.table('users').select('id, is_verified').eq('email', email).single().execute()  # 查詢 users 資料表取得使用者 id 與驗證狀態
    user_id = user_response.data['id']  # 取得使用者 UUID
    already_verified = user_response.data['is_verified']  # 取得是否已驗證的布林值

    del verification_codes[email]  # 驗證成功後清除記憶體中的驗證碼，防止重複使用

    if already_verified:  # 判斷帳號是否已經驗證過
        return jsonify({  # 回傳帳號已驗證過的狀態
            'message': '帳號已驗證過',
            'already_verified': True,
            'user_id': user_id
        }), 200

    supabase.table('users').update({  # 更新 users 資料表將帳號標記為已驗證
        'is_verified': True,  # 設定驗證旗標為 True
        'verify_token': None  # 清空驗證 token，使連結無效
    }).eq('email', email).execute()

    admin_update_user(user_id, {'email_confirm': True})  # 呼叫 admin API 將 Supabase Auth 的 email 確認狀態設為已確認

    return jsonify({  # 回傳驗證成功並帶回使用者 ID
        'message': '驗證成功，帳號已開通',
        'already_verified': False,
        'user_id': user_id
    }), 200


@auth_bp.route('/verify-link', methods=['GET'])  # 定義 GET /verify-link 路由（點擊信件連結方式）
def verify_link():  # 處理玩家點擊驗證信連結後的開通請求，含過期與重複點擊判斷
    token = request.args.get('token')  # 從 GET 請求的查詢參數取得 token

    if not token:  # 判斷 token 是否為空
        return jsonify({'error': '無效的驗證連結'}), 400  # 回傳缺少 token 錯誤

    parts = token.split('.')  # 以 '.' 分割 token，取得隨機字串與到期時間兩部分
    if len(parts) != 2:  # 判斷 token 格式是否正確（必須剛好兩段）
        return jsonify({'error': '驗證連結無效'}), 400  # 回傳格式不正確錯誤

    _, expire_at = parts  # 解構取得到期時間字串（忽略隨機字串段）

    # 先查使用者（不論是否過期），讓後續邏輯可以判斷 is_verified
    user_response = supabase.table('users').select('id, email, is_verified').eq('verify_token', token).execute()  # 查詢 users 資料表中符合此 verify_token 的使用者
    user_data = user_response.data[0] if user_response.data else None  # 取得第一筆資料，若無結果則設為 None

    # 已驗證過：不管連結有沒有過期，都直接導向「已驗證」頁
    if user_data and user_data['is_verified']:  # 判斷帳號是否已驗證過
        return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/already-verified')  # 跳轉到已驗證頁面

    # 連結過期：只在帳號尚未驗證時才刪除
    if int(time.time() * 1000) > int(expire_at):  # 判斷目前時間是否已超過連結到期時間
        if user_data:  # 判斷是否找到對應帳號
            delete_unverified_account(user_data['email'])  # 刪除過期的未驗證帳號
        return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/verify-expired')  # 跳轉到連結過期頁面

    # 找不到對應帳號：token 尚未過期卻找不到，代表已透過驗證碼完成驗證（token 已清空）
    if not user_data:  # 判斷是否找不到符合 token 的帳號
        return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/already-verified')  # 跳轉到已驗證頁面

    supabase.table('users').update({  # 更新 users 資料表將帳號標記為已驗證
        'is_verified': True,  # 設定驗證旗標為 True
        'verify_token': None  # 清空驗證 token，使連結失效
    }).eq('id', user_data['id']).execute()

    admin_update_user(user_data['id'], {'email_confirm': True})  # 呼叫 admin API 將 Supabase Auth 的 email 確認狀態設為已確認

    return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/verified')  # 跳轉到後端驗證成功頁面


@auth_bp.route('/login', methods=['POST'])  # 定義 POST /login 路由
def login():  # 處理玩家登入請求，支援 email 或 custom_id 兩種識別碼
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    identifier = data.get('identifier')  # 取出登入識別碼（可以是 email 或 custom_id）
    password = data.get('password')  # 取出密碼

    if not identifier or not password:  # 判斷識別碼或密碼是否為空
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳欄位不完整錯誤

    email = identifier  # 預設將識別碼當作 email 使用

    if '@' not in identifier:  # 判斷識別碼是否不含 '@'，表示使用者輸入的是 custom_id
        user_response = supabase.table('users').select('email').eq('custom_id', identifier).execute()  # 查詢 users 資料表以 custom_id 找出對應的 email
        if not user_response.data:  # 判斷是否找不到該 custom_id
            return jsonify({'error': '找不到使用者'}), 400  # 回傳找不到使用者錯誤
        email = user_response.data[0]['email']  # 取得對應的 email 供後續登入使用

    try:  # 嘗試以 email + 密碼向 Supabase Auth 登入
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': password})  # 呼叫 Supabase Auth 以 email + 密碼登入
        if auth_response.user is None:  # 判斷 Auth 是否回傳有效使用者物件
            return jsonify({'error': '帳號或密碼錯誤'}), 400  # 回傳帳密錯誤
    except Exception:  # Supabase Auth 拋出例外（帳號不存在或密碼錯誤）
        return jsonify({'error': '帳號或密碼錯誤'}), 400  # 回傳登入失敗錯誤

    user_response = supabase.table('users').select('id, is_verified').eq('email', email).execute()  # 查詢 users 資料表確認驗證狀態
    if not user_response.data or not user_response.data[0]['is_verified']:  # 判斷帳號是否不存在或尚未完成信箱驗證
        return jsonify({'error': '帳號尚未驗證，請先查收信箱完成驗證', 'unverified': True, 'email': email}), 403  # 回傳帳號未驗證錯誤

    return jsonify({  # 回傳登入成功並附上使用者基本資訊
        'message': '登入成功',
        'user': {
            'id': auth_response.user.id,  # 使用者 UUID
            'email': auth_response.user.email,  # 使用者 email
            'email_confirmed_at': str(auth_response.user.email_confirmed_at)  # email 確認時間轉為字串
        }
    }), 200


@auth_bp.route('/forgot-password', methods=['POST'])  # 定義 POST /forgot-password 路由
def forgot_password():  # 處理忘記密碼請求，寄送含重設連結的郵件（故意不揭露帳號是否存在）
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    identifier = data.get('identifier')  # 取出識別碼（email 或 custom_id）

    if not identifier:  # 判斷識別碼是否為空
        return jsonify({'error': '請填寫帳號或信箱'}), 400  # 回傳欄位不完整錯誤

    # 判斷是 custom_id 還是 email
    if '@' not in identifier:  # 判斷識別碼是否不含 '@'，表示輸入的是 custom_id
        id_res = supabase.table('users').select('email').eq('custom_id', identifier).execute()  # 查詢 users 資料表以 custom_id 找出對應 email
        if not id_res.data:  # 判斷是否找不到該 custom_id（故意不揭露帳號不存在，仍回傳成功）
            return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200  # 回傳假成功避免帳號列舉攻擊
        email = id_res.data[0]['email']  # 取得對應的 email
    else:  # 識別碼含有 '@'，視為直接輸入 email
        email = identifier  # 識別碼本身就是 email

    user_response = supabase.table('users').select('id, email').eq('email', email).execute()  # 查詢 users 資料表確認該 email 是否存在

    if not user_response.data:  # 判斷是否找不到該 email（故意不揭露帳號不存在）
        return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200  # 回傳假成功避免帳號列舉攻擊

    expire_at = int(time.time() * 1000) + 5 * 60 * 1000  # 計算重設連結到期時間（目前毫秒時間戳 + 5 分鐘）
    raw_token = secrets.token_hex(32)  # 產生 64 字元隨機十六進位字串
    reset_token = f'{raw_token}.{expire_at}'  # 組合 reset_token：隨機字串 + 到期時間戳

    supabase.table('users').update({  # 更新 users 資料表儲存重設 token
        'reset_token': reset_token  # 寫入新的 reset_token
    }).eq('email', email).execute()

    reset_link = f'{os.environ.get("FRONTEND_URL", "http://localhost:5500")}/index.html?reset_token={reset_token}'  # 組合前端重設密碼連結，帶上 token 參數

    send_email(  # 呼叫寄信函式發送重設密碼信
        email,  # 收件人信箱
        '知識王 密碼重設',  # 信件主旨
        get_reset_email_template(reset_link),  # HTML 信件內容
        '你已申請重設知識王密碼，請查看 HTML 版本完成操作。如非本人操作請忽略此信。'  # 純文字備用內容
    )

    return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200  # 回傳寄信成功狀態


@auth_bp.route('/reset-info', methods=['GET'])  # 定義 GET /reset-info 路由
def reset_info():  # 驗證重設 token 有效性並回傳玩家資訊（email 遮蔽），供前端顯示確認畫面
    token = request.args.get('token', '')  # 從 GET 查詢參數取得 reset_token，預設空字串
    parts = token.split('.')  # 以 '.' 分割 token 取得兩段資料
    if len(parts) != 2:  # 判斷 token 格式是否正確
        return jsonify({'error': '無效的連結'}), 400  # 回傳 token 格式無效錯誤
    try:  # 嘗試將 token 第二段轉為整數，取得到期時間戳
        expire_at = int(parts[1])  # 將第二段轉為整數取得到期時間戳
    except ValueError:  # token 第二段無法轉為整數，格式損毀
        return jsonify({'error': '無效的連結'}), 400  # 回傳無法解析到期時間的錯誤
    if int(time.time() * 1000) > expire_at:  # 判斷目前時間是否已超過到期時間
        return jsonify({'error': '連結已過期'}), 400  # 回傳連結過期錯誤

    res = supabase.table('users').select('nickname, custom_id, email').eq('reset_token', token).execute()  # 查詢 users 資料表以 reset_token 找出對應使用者的暱稱、帳號與信箱
    if not res.data:  # 判斷是否找不到符合 token 的帳號
        return jsonify({'error': '無效的連結'}), 400  # 回傳找不到帳號錯誤

    u = res.data[0]  # 取得查詢結果的第一筆資料
    email = u['email']  # 取出原始 email
    masked_email = email[:2] + '***' + email[email.index('@'):]  # 將 email 前段遮蔽，僅保留前兩字元與 @ 後段
    return jsonify({  # 回傳使用者資訊供前端顯示（email 已遮蔽）
        'nickname': u['nickname'],  # 玩家暱稱
        'custom_id': u['custom_id'],  # 玩家帳號 ID
        'email': masked_email  # 遮蔽後的 email
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])  # 定義 POST /reset-password 路由
def reset_password():  # 處理玩家重設密碼請求，驗證 token 有效性後呼叫 admin API 更新密碼
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    token = data.get('token')  # 取出重設密碼 token
    new_password = data.get('new_password')  # 取出使用者輸入的新密碼

    if not token or not new_password:  # 判斷 token 或新密碼是否為空
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳欄位不完整錯誤

    if len(new_password) < 6:  # 判斷新密碼長度是否不足 6 位
        return jsonify({'error': '密碼至少需要6位數'}), 400  # 回傳密碼過短錯誤

    parts = token.split('.')  # 以 '.' 分割 token 取得兩段資料
    if len(parts) != 2:  # 判斷 token 格式是否正確
        return jsonify({'error': '重設密碼連結無效'}), 400  # 回傳 token 格式無效錯誤

    _, expire_at = parts  # 解構取得到期時間字串（忽略隨機字串段）

    if int(time.time() * 1000) > int(expire_at):  # 判斷目前時間是否已超過連結到期時間
        return jsonify({'error': '重設密碼連結已過期，請重新申請'}), 400  # 回傳連結過期錯誤

    user_response = supabase.table('users').select('id, email').eq('reset_token', token).execute()  # 查詢 users 資料表以 reset_token 找出對應使用者

    if not user_response.data:  # 判斷是否找不到符合 token 的帳號
        return jsonify({'error': '重設密碼連結無效'}), 400  # 回傳找不到帳號錯誤

    user_data = user_response.data[0]  # 取得查詢結果的第一筆使用者資料

    admin_update_user(user_data['id'], {'password': new_password})  # 呼叫 admin API 更新 Supabase Auth 中的使用者密碼

    supabase.table('users').update({  # 更新 users 資料表清除已使用的 reset_token
        'reset_token': None  # 清空 reset_token，使連結失效
    }).eq('id', user_data['id']).execute()

    return jsonify({'message': '密碼重設成功，請重新登入'}), 200  # 回傳密碼重設成功狀態


@auth_bp.route('/change-password', methods=['POST'])  # 定義 POST /change-password 路由
def change_password():  # 處理已登入玩家修改密碼的請求，需先驗證舊密碼
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')  # 取出使用者 UUID
    old_password = data.get('old_password')  # 取出舊密碼
    new_password = data.get('new_password')  # 取出新密碼

    if not user_id or not old_password or not new_password:  # 判斷必填欄位是否有任何為空
        return jsonify({'error': '請填寫所有欄位'}), 400  # 回傳欄位不完整錯誤

    if len(new_password) < 6:  # 判斷新密碼長度是否不足 6 位
        return jsonify({'error': '新密碼至少需要6位數'}), 400  # 回傳新密碼過短錯誤

    if old_password == new_password:  # 判斷新舊密碼是否相同
        return jsonify({'error': '新密碼不能和舊密碼相同'}), 400  # 回傳新舊密碼相同錯誤

    user_response = supabase.table('users').select('email').eq('id', user_id).execute()  # 查詢 users 資料表以 user_id 取得對應 email
    if not user_response.data:  # 判斷是否找不到該使用者
        return jsonify({'error': '找不到使用者'}), 400  # 回傳找不到使用者錯誤

    email = user_response.data[0]['email']  # 取得使用者的 email 供後續驗證舊密碼使用

    try:  # 嘗試以舊密碼登入，藉此驗證舊密碼正確性
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': old_password})  # 呼叫 Supabase Auth 以舊密碼登入，驗證舊密碼是否正確
        if auth_response.user is None:  # 判斷登入是否成功
            return jsonify({'error': '舊密碼錯誤'}), 400  # 回傳舊密碼錯誤
    except Exception:  # Supabase Auth 拋出例外（舊密碼不正確）
        return jsonify({'error': '舊密碼錯誤'}), 400  # 回傳驗證舊密碼失敗錯誤

    admin_update_user(user_id, {'password': new_password})  # 呼叫 admin API 將 Supabase Auth 中的密碼更新為新密碼

    return jsonify({'message': '密碼修改成功'}), 200  # 回傳密碼修改成功狀態