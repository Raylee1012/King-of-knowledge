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

def send_email(to_email, subject, html_content):
    """寄送 Email 的函式，使用 Gmail SMTP"""
    msg = MIMEMultipart('alternative')  # 建立多部分 Email 物件
    msg['Subject'] = subject  # 設定信件主旨
    msg['From'] = f'知識王 <{os.environ.get("GMAIL_USER")}>'  # 設定寄件人
    msg['To'] = to_email  # 設定收件人

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
    """產生驗證信的 HTML 模板（全頁星空風格）"""
    return f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a1a;font-family:'Helvetica Neue',Arial,sans-serif;">
      <!-- 全頁星星背景 -->
      <div style="position:relative;min-height:100vh;background:#0a0a1a;">
        <div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:83%;top:16%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:33%;top:30%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.4);border-radius:50%;left:88%;top:96%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:56%;top:6%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.3);border-radius:50%;left:31%;top:66%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:27%;top:93%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:55%;top:30%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.6);border-radius:50%;left:2%;top:22%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.9);border-radius:50%;left:37%;top:21%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.5);border-radius:50%;left:45%;top:15%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.5);border-radius:50%;left:47%;top:46%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:7%;top:95%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.5);border-radius:50%;left:50%;top:12%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:82%;top:81%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:92%;top:10%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:39%;top:12%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:50%;top:37%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.5);border-radius:50%;left:48%;top:22%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.9);border-radius:50%;left:87%;top:36%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:84%;top:11%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:70%;top:95%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:50%;top:36%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:30%;top:89%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:9%;top:31%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:53%;top:36%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:74%;top:93%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.6);border-radius:50%;left:65%;top:52%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:35%;top:19%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:70%;top:35%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:76%;top:53%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:19%;top:67%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:8%;top:16%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.3);border-radius:50%;left:89%;top:56%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:50%;top:78%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:72%;top:3%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:89%;top:70%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:45%;top:16%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.8);border-radius:50%;left:60%;top:2%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:35%;top:66%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:15%;top:82%;"></div>
        <!-- 內容區 -->
        <div style="position:relative;z-index:1;max-width:600px;margin:0 auto;padding:32px 16px;">

          <!-- Header -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:32px;font-weight:900;letter-spacing:2px;color:#ffd700;font-family:'Helvetica Neue',Arial,sans-serif;">👑 知識王</div>
            <div style="margin-top:6px;color:#00d4ff;font-size:12px;letter-spacing:5px;font-weight:700;">KNOWLEDGE KING</div>
          </div>

          <!-- 驗證信內容 -->
          <div style="background:#1e1e42;border:1px solid rgba(255,215,0,0.25);border-radius:18px;padding:32px 28px;">
            <h2 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:900;">🎉 歡迎加入知識王！</h2>
            <p style="margin:0 0 24px;color:#b0b0d0;font-size:14px;line-height:1.7;">請選擇以下其中一種方式完成帳號驗證，連結與驗證碼皆在 5 分鐘內有效。</p>

            <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
              <p style="margin:0 0 4px;color:#ffd700;font-size:11px;font-weight:700;letter-spacing:2px;">方式一</p>
              <p style="margin:0 0 16px;color:#fff;font-size:15px;font-weight:700;">點擊連結一鍵開通帳號</p>
              <div style="text-align:center;">
                <a href="{verify_link}" style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a0a00;font-size:15px;font-weight:900;padding:13px 34px;border-radius:10px;text-decoration:none;">✅ 點我開通帳號</a>
              </div>
            </div>

            <div style="text-align:center;color:#7070a0;font-size:12px;margin:12px 0;">— 或者 —</div>

            <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:20px;">
              <p style="margin:0 0 4px;color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:2px;">方式二</p>
              <p style="margin:0 0 16px;color:#fff;font-size:15px;font-weight:700;">在遊戲頁面輸入驗證碼</p>
              <div style="background:#0d0d24;border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:18px;text-align:center;">
                <span style="font-size:38px;font-weight:900;color:#00d4ff;letter-spacing:10px;font-family:monospace;">{code}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align:center;margin-top:24px;">
            <p style="color:#7070a0;font-size:12px;line-height:1.8;margin:0;">此信件為系統自動發送，請勿直接回覆。<br>如果你沒有申請知識王帳號，請忽略此信件。</p>
          </div>

        </div>
      </div>
    </body>
    </html>"""

def get_reset_email_template(reset_link):
    """產生重設密碼信的 HTML 模板（全頁星空風格）"""
    return f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a1a;font-family:'Helvetica Neue',Arial,sans-serif;">
      <!-- 全頁星星背景 -->
      <div style="position:relative;min-height:100vh;background:#0a0a1a;">
        <div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:83%;top:16%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:33%;top:30%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.4);border-radius:50%;left:88%;top:96%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:56%;top:6%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.3);border-radius:50%;left:31%;top:66%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:27%;top:93%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:55%;top:30%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.6);border-radius:50%;left:2%;top:22%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.9);border-radius:50%;left:37%;top:21%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.5);border-radius:50%;left:45%;top:15%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.5);border-radius:50%;left:47%;top:46%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:7%;top:95%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.5);border-radius:50%;left:50%;top:12%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:82%;top:81%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:92%;top:10%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:39%;top:12%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:50%;top:37%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.5);border-radius:50%;left:48%;top:22%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.9);border-radius:50%;left:87%;top:36%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:84%;top:11%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:70%;top:95%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:50%;top:36%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:30%;top:89%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:9%;top:31%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:53%;top:36%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:74%;top:93%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.6);border-radius:50%;left:65%;top:52%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:35%;top:19%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:70%;top:35%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:76%;top:53%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.4);border-radius:50%;left:19%;top:67%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.7);border-radius:50%;left:8%;top:16%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.3);border-radius:50%;left:89%;top:56%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:50%;top:78%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.7);border-radius:50%;left:72%;top:3%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:89%;top:70%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:45%;top:16%;"></div><div style="position:absolute;width:2px;height:2px;background:rgba(255,255,255,0.8);border-radius:50%;left:60%;top:2%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.6);border-radius:50%;left:35%;top:66%;"></div><div style="position:absolute;width:1px;height:1px;background:rgba(255,255,255,0.8);border-radius:50%;left:15%;top:82%;"></div>
        <!-- 內容區 -->
        <div style="position:relative;z-index:1;max-width:600px;margin:0 auto;padding:32px 16px;">

          <!-- Header -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:32px;font-weight:900;letter-spacing:2px;color:#ffd700;font-family:'Helvetica Neue',Arial,sans-serif;">👑 知識王</div>
            <div style="margin-top:6px;color:#00d4ff;font-size:12px;letter-spacing:5px;font-weight:700;">KNOWLEDGE KING</div>
          </div>

          <!-- 重設密碼內容 -->
          <div style="background:#1e1e42;border:1px solid rgba(255,215,0,0.25);border-radius:18px;padding:32px 28px;">
            <h2 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:900;">🔑 重設你的密碼</h2>
            <p style="margin:0 0 24px;color:#b0b0d0;font-size:14px;line-height:1.7;">收到你的密碼重設請求，點擊下方按鈕更新密碼。連結在 5 分鐘內有效。</p>
            <div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:24px;text-align:center;">
              <a href="{reset_link}" style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a0a00;font-size:15px;font-weight:900;padding:13px 34px;border-radius:10px;text-decoration:none;">🔑 點我重設密碼</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align:center;margin-top:24px;">
            <p style="color:#7070a0;font-size:12px;line-height:1.8;margin:0;">此信件為系統自動發送，請勿直接回覆。<br>如果你沒有申請知識王帳號，請忽略此信件。</p>
          </div>

        </div>
      </div>
    </body>
    </html>"""

@auth_bp.route('/register', methods=['POST'])  # 定義 POST /register 路由
def register():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    custom_id = data.get('custom_id')  # 取出 custom_id 欄位
    email = data.get('email')          # 取出 email 欄位
    password = data.get('password')    # 取出 password 欄位

    # 防呆一：三個欄位都必填
    if not custom_id or not email or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆二：驗證 Email 格式
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'  # 正規表達式：不含空白和@，接@，不含空白和@，接.，不含空白和@
    if not re.match(email_regex, email):  # re.match() 測試字串是否符合格式
        return jsonify({'error': 'Email格式不正確'}), 400  # 400 客戶端錯誤：Email 格式錯誤

    # 防呆三：ID 只能英文和數字，長度 4-20 字
    id_regex = r'^[a-zA-Z0-9]{4,20}$'  # 正規表達式：只允許英文大小寫和數字，長度 4 到 20
    if not re.match(id_regex, custom_id):  # 不符合格式就回傳錯誤
        return jsonify({'error': 'ID只能使用英文和數字，長度4-20字'}), 400  # 400 客戶端錯誤：ID 格式錯誤

    # 防呆四：密碼至少 6 位數
    if len(password) < 6:  # len() 取字串長度
        return jsonify({'error': '密碼至少需要6位數'}), 400  # 400 客戶端錯誤：密碼太短

    # 用 Supabase Auth 建立帳號，密碼會自動加密（hash）後存入
    try:
        auth_response = supabase.auth.sign_up({'email': email, 'password': password})
        if auth_response.user is None:  # 如果 user 是 None 代表建立失敗
            return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400  # 400 客戶端錯誤：Email 已存在
    except Exception:
        return jsonify({'error': '註冊失敗，Email 可能已存在'}), 400  # 400 客戶端錯誤：註冊失敗

    user_id = auth_response.user.id  # 取得 Supabase Auth 產生的 user id

    # 產生驗證 token
    expire_at = int(time.time() * 1000) + 5 * 60 * 1000  # 現在時間（毫秒）+ 5 分鐘
    raw_token = secrets.token_hex(32)  # 產生 64 字元隨機亂碼
    token = f'{raw_token}.{expire_at}'  # 組合成 token，用 . 分隔

    # 把玩家資料存進 users 資料表
    supabase.table('users').insert({
        'id': user_id,           # 用 Supabase Auth 產生的同一個 id
        'custom_id': custom_id,  # 玩家自訂 ID
        'email': email,          # 玩家 email
        'is_verified': False,    # 預設尚未驗證
        'verify_token': token,   # 存入驗證 token
        'coins': 500             # 新玩家初始金幣
    }).execute()

    # 產生 6 位數驗證碼
    code = random.randint(100000, 999999)  # 產生 100000 到 999999 之間的隨機整數
    verification_codes[email] = {  # 存入暫存字典
        'code': code,  # 驗證碼
        'expire_at': int(time.time() * 1000) + 5 * 60 * 1000  # 5 分鐘後過期
    }

    # 組合驗證連結
    verify_link = f'{os.environ.get("BACKEND_URL")}/auth/verify-link?token={token}'

    # 寄驗證信
    send_email(email, '知識王 - 帳號驗證', get_email_template(verify_link, code))

    return jsonify({'message': '註冊成功，請查收驗證信'}), 200  # 200 成功

# 驗證碼確認 API
# 路徑：POST /auth/verify
# 傳入：{ email, code }
@auth_bp.route('/verify', methods=['POST'])  # 定義 POST /verify 路由
def verify():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    email = data.get('email')  # 取出 email 欄位
    code = data.get('code')    # 取出 code 欄位

    # 防呆：兩個欄位都必填
    if not email or not code:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    record = verification_codes.get(email)  # 取出該 email 的驗證碼記錄

    # 找不到記錄，代表沒有發送過驗證碼或已被刪除
    if not record:
        return jsonify({'error': '驗證碼不存在'}), 400  # 400 客戶端錯誤：找不到驗證碼

    # 現在時間 > 過期時間，代表已過期
    if int(time.time() * 1000) > record['expire_at']:
        del verification_codes[email]  # 刪除過期記錄，釋放記憶體
        delete_unverified_account(email)  # 自動刪除未驗證的帳號
        return jsonify({'error': '驗證碼已過期，請重新註冊'}), 400  # 400 客戶端錯誤：驗證碼過期

    # 比對驗證碼，用 str() 把兩邊都轉成字串再比對
    if str(record['code']) != str(code):
        return jsonify({'error': '驗證碼錯誤'}), 400  # 400 客戶端錯誤：驗證碼不正確

    # 驗證成功，開通帳號並清空 verify_token
    supabase.table('users').update({
        'is_verified': True,  # 把 is_verified 改成 True
        'verify_token': None  # 清空 token
    }).eq('email', email).execute()  # 條件：只更新這個 email 的玩家

    # 查詢玩家的 id，用來確認 Supabase Auth 的 email
    user_response = supabase.table('users').select('id').eq('email', email).single().execute()
    user_id = user_response.data['id']  # 取得玩家的 id

    # 用 httpx 直接呼叫 Supabase admin API，把 email 標記為已確認
    admin_update_user(user_id, {'email_confirm': True})

    del verification_codes[email]  # 驗證完刪除暫存碼，避免重複使用

    return jsonify({
        'message': '驗證成功，帳號已開通',
        'redirect': f'{os.environ.get("FRONTEND_URL")}/verified'  # 回傳跳轉網址
    }), 200  # 200 成功

# 驗證連結 API
# 路徑：GET /auth/verify-link?token=xxx
# 玩家點 Email 裡的連結時呼叫，瀏覽器自動帶 token 來
@auth_bp.route('/verify-link', methods=['GET'])  # 定義 GET /verify-link 路由
def verify_link():
    token = request.args.get('token')  # request.args 是 URL 參數，取得 ?token=xxx 的 token

    # 沒有帶 token，代表連結無效
    if not token:
        return jsonify({'error': '無效的驗證連結'}), 400  # 400 客戶端錯誤：沒有帶 token

    # 拆開 token，用 . 分隔成兩個部分
    parts = token.split('.')  # 例如：['a3f8c2d1...', '1776856823200']
    if len(parts) != 2:  # token 格式不對
        return jsonify({'error': '驗證連結無效'}), 400  # 400 客戶端錯誤：token 格式錯誤

    raw_token, expire_at = parts  # 解包成兩個變數

    # 現在時間 > 過期時間，代表已過期
    if int(time.time() * 1000) > int(expire_at):
        user_response = supabase.table('users').select('email').eq('verify_token', token).execute()  # 查詢對應的玩家
        if user_response.data:  # 找到玩家才刪除
            delete_unverified_account(user_response.data[0]['email'])  # 自動刪除未驗證的帳號
        return jsonify({'error': '驗證連結已過期，請重新註冊'}), 400  # 400 客戶端錯誤：連結過期

    # 用 token 查詢資料庫，找到對應的玩家
    user_response = supabase.table('users').select('id, email, is_verified').eq('verify_token', token).execute()

    # 找不到代表 token 無效或已被清空
    if not user_response.data:
        return jsonify({'error': '驗證連結無效'}), 400  # 400 客戶端錯誤：token 無效

    user_data = user_response.data[0]  # 取得第一筆資料

    # 已驗證過，不需要再驗證，直接跳轉登入
    if user_data['is_verified']:
        return redirect(os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html')  # 跳轉到前端登入頁面

    # 開通帳號並清空 verify_token
    supabase.table('users').update({
        'is_verified': True,  # 開通帳號
        'verify_token': None  # 清空 token 避免重複使用
    }).eq('id', user_data['id']).execute()  # 條件：只更新這個玩家的資料

    # 用 httpx 直接呼叫 Supabase admin API，把 email 標記為已確認
    admin_update_user(user_data['id'], {'email_confirm': True})

    return redirect(os.environ.get('BACKEND_URL', 'http://localhost:3000') + '/verified')  # 跳轉到後端驗證成功頁面

# 登入 API
# 路徑：POST /auth/login
# 傳入：{ identifier, password }，identifier 可以是 email 或 custom_id
@auth_bp.route('/login', methods=['POST'])  # 定義 POST /login 路由
def login():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    identifier = data.get('identifier')  # 取出 identifier 欄位
    password = data.get('password')      # 取出 password 欄位

    # 防呆：兩個欄位都必填
    if not identifier or not password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    email = identifier  # 預設 email 就是 identifier

    # email 一定包含 @，custom_id 不包含 @
    # 如果不包含 @，代表是 custom_id，需要先查詢對應的 email
    if '@' not in identifier:
        user_response = supabase.table('users').select('email').eq('custom_id', identifier).execute()
        if not user_response.data:  # 找不到玩家
            return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家
        email = user_response.data[0]['email']  # 取得對應的 email

    # 用 email 和密碼登入 Supabase Auth，密碼錯誤會丟出 exception
    try:
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': password})
        if auth_response.user is None:  # 登入失敗
            return jsonify({'error': '帳號或密碼錯誤'}), 400  # 400 客戶端錯誤：登入失敗
    except Exception:
        return jsonify({'error': '帳號或密碼錯誤'}), 400  # 400 客戶端錯誤：密碼錯誤

    return jsonify({
        'message': '登入成功',
        'user': {
            'id': auth_response.user.id,                                       # 玩家的 id
            'email': auth_response.user.email,                                 # 玩家的 email
            'email_confirmed_at': str(auth_response.user.email_confirmed_at)   # Email 確認時間
        }
    }), 200  # 200 成功，回傳玩家資料

# 忘記密碼 API
# 路徑：POST /auth/forgot-password
# 傳入：{ email }
@auth_bp.route('/forgot-password', methods=['POST'])  # 定義 POST /forgot-password 路由
def forgot_password():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    email = data.get('email')  # 取出 email 欄位

    # 防呆：email 必填
    if not email:
        return jsonify({'error': '請填寫 Email'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 查詢玩家是否存在
    user_response = supabase.table('users').select('id, email').eq('email', email).execute()

    # 找不到玩家，回傳一樣的訊息，避免被用來查詢哪些 email 已註冊
    if not user_response.data:
        return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200  # 200 成功但不透漏是否存在

    # 產生重設密碼 token
    expire_at = int(time.time() * 1000) + 5 * 60 * 1000  # 5 分鐘後過期
    raw_token = secrets.token_hex(32)  # 產生 64 字元隨機亂碼
    reset_token = f'{raw_token}.{expire_at}'  # 組合成 token，用 . 分隔

    # 把 reset_token 存進資料庫
    supabase.table('users').update({
        'reset_token': reset_token  # 更新 reset_token 欄位
    }).eq('email', email).execute()  # 條件：只更新這個 email 的玩家

    # 組合重設密碼連結
    reset_link = f'{os.environ.get("FRONTEND_URL")}/reset-password?token={reset_token}'

    # 寄重設密碼信
    send_email(email, '知識王 - 重設密碼', get_reset_email_template(reset_link))

    return jsonify({'message': '重設密碼信已寄出，請查收信箱'}), 200  # 200 成功

# 重設密碼 API
# 路徑：POST /auth/reset-password
# 傳入：{ token, new_password }
@auth_bp.route('/reset-password', methods=['POST'])  # 定義 POST /reset-password 路由
def reset_password():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    token = data.get('token')                # 取出 token 欄位
    new_password = data.get('new_password')  # 取出 new_password 欄位

    # 防呆：兩個欄位都必填
    if not token or not new_password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：新密碼至少 6 位數
    if len(new_password) < 6:
        return jsonify({'error': '密碼至少需要6位數'}), 400  # 400 客戶端錯誤：密碼太短

    # 拆開 token，用 . 分隔成兩個部分
    parts = token.split('.')  # 例如：['a3f8c2d1...', '1776856823200']
    if len(parts) != 2:  # token 格式不對
        return jsonify({'error': '重設密碼連結無效'}), 400  # 400 客戶端錯誤：token 格式錯誤

    raw_token, expire_at = parts  # 解包成兩個變數

    # 檢查 token 是否過期
    if int(time.time() * 1000) > int(expire_at):
        return jsonify({'error': '重設密碼連結已過期，請重新申請'}), 400  # 400 客戶端錯誤：token 過期

    # 用 token 查詢資料庫，找到對應的玩家
    user_response = supabase.table('users').select('id, email').eq('reset_token', token).execute()

    # 找不到代表 token 無效或已被清空
    if not user_response.data:
        return jsonify({'error': '重設密碼連結無效'}), 400  # 400 客戶端錯誤：token 無效

    user_data = user_response.data[0]  # 取得第一筆資料

    # 用 httpx 直接呼叫 Supabase admin API 更新密碼
    admin_update_user(user_data['id'], {'password': new_password})

    # 清空 reset_token，避免同一個連結被重複使用
    supabase.table('users').update({
        'reset_token': None  # 清空 reset_token
    }).eq('id', user_data['id']).execute()  # 條件：只更新這個玩家的資料

    return jsonify({'message': '密碼重設成功，請重新登入'}), 200  # 200 成功

# 修改密碼 API
# 路徑：POST /auth/change-password
# 傳入：{ user_id, old_password, new_password }
@auth_bp.route('/change-password', methods=['POST'])  # 定義 POST /change-password 路由
def change_password():
    data = request.get_json()  # 取得前端傳來的 JSON 資料
    user_id = data.get('user_id')            # 取出 user_id 欄位
    old_password = data.get('old_password')  # 取出 old_password 欄位
    new_password = data.get('new_password')  # 取出 new_password 欄位

    # 防呆：三個欄位都必填
    if not user_id or not old_password or not new_password:
        return jsonify({'error': '請填寫所有欄位'}), 400  # 400 客戶端錯誤：欄位未填寫

    # 防呆：新密碼至少 6 位數
    if len(new_password) < 6:
        return jsonify({'error': '新密碼至少需要6位數'}), 400  # 400 客戶端錯誤：密碼太短

    # 防呆：新密碼不能和舊密碼一樣
    if old_password == new_password:
        return jsonify({'error': '新密碼不能和舊密碼相同'}), 400  # 400 客戶端錯誤：密碼相同

    # 查詢玩家的 email，用來驗證舊密碼
    user_response = supabase.table('users').select('email').eq('id', user_id).execute()
    if not user_response.data:  # 找不到玩家
        return jsonify({'error': '找不到使用者'}), 400  # 400 客戶端錯誤：找不到玩家

    email = user_response.data[0]['email']  # 取得玩家的 email

    # 用舊密碼嘗試登入，驗證舊密碼是否正確
    try:
        auth_response = supabase.auth.sign_in_with_password({'email': email, 'password': old_password})
        if auth_response.user is None:  # 登入失敗
            return jsonify({'error': '舊密碼錯誤'}), 400  # 400 客戶端錯誤：舊密碼不正確
    except Exception:
        return jsonify({'error': '舊密碼錯誤'}), 400  # 400 客戶端錯誤：舊密碼不正確

    # 用 httpx 直接呼叫 Supabase admin API 更新密碼
    admin_update_user(user_id, {'password': new_password})

    return jsonify({'message': '密碼修改成功'}), 200  # 200 成功