from flask import Flask, jsonify  # Flask 框架，jsonify 把 dict 轉成 JSON 回傳
from flask_cors import CORS  # 允許跨域請求，讓前端可以呼叫後端 API
from dotenv import load_dotenv  # 讀取 .env 檔案裡的環境變數
import os  # Python 內建模組，用來讀取環境變數

load_dotenv(override=False)  # 讀取 .env 檔案，override=False 代表不覆蓋已存在的環境變數

app = Flask(__name__)  # 建立 Flask 伺服器實體，__name__ 是目前模組的名稱
app.config['JSON_AS_ASCII'] = False  # 讓 JSON 回傳時不轉義中文字元，保持原本的中文
app.json.ensure_ascii = False  # 新版 Flask 需要這行才能正確顯示中文
CORS(app)  # 讓所有來源的跨域請求都可以存取這個伺服器

from auth import auth_bp  # 從 auth.py 載入 auth_bp 藍圖（Blueprint）
app.register_blueprint(auth_bp, url_prefix='/auth')  # 把 auth_bp 掛載到 /auth 路徑，所有 auth.py 的路由前面都會加上 /auth

from user import user_bp  # 從 user.py 載入 user_bp 藍圖
app.register_blueprint(user_bp, url_prefix='/user')  # 把 user_bp 掛載到 /user 路徑，所有 user.py 的路由前面都會加上 /user

# TODO: 刪除 - 測試用首頁，正式上線後刪除
@app.route('/')  # 定義 GET / 路由
def index():  # 函式名稱，對應到這個路由的處理邏輯
    return '知識王後端運作中'  # 回傳純文字

# 提供前端需要的設定（Gemini 金鑰、Supabase 網址和金鑰）
# 路徑：GET /config
# 只有管理員頁面才會呼叫這個 API
@app.route('/config')  # 定義 GET /config 路由
def config():  # 函式名稱，對應到這個路由的處理邏輯
    return jsonify({
        'gemini_key': os.environ.get('GEMINI_API_KEY'),  # Gemini API 金鑰，用來生成題目
        'supabase_url': os.environ.get('SUPABASE_URL'),  # Supabase 資料庫網址
        'supabase_key': os.environ.get('SUPABASE_KEY')   # Supabase 金鑰，用來存入題目
    })

# TODO: 替換 - 等第三組前端做好後，這個頁面由前端負責
# 玩家驗證成功後會跳轉到這裡，5 秒後自動跳轉到登入頁面
@app.route('/verified')  # 定義 GET /verified 路由
def verified():  # 函式名稱，對應到這個路由的處理邏輯
    return '''
    <html>
      <head>
        <meta charset="utf-8">
        <title>知識王 - 帳號開通</title>
      </head>
      <body>
        <h2>✅ 帳號開通成功！</h2>
        <p id="countdown">5 秒後自動跳轉到登入頁面...</p>
        <a href="/">立即前往登入頁面</a>
        <script>
          let seconds = 5
          const el = document.getElementById('countdown')
          const timer = setInterval(() => {
            seconds--
            el.textContent = seconds + ' 秒後自動跳轉到登入頁面...'
            if (seconds <= 0) {
              clearInterval(timer)
              window.location.href = '/'
            }
          }, 1000)
        </script>
      </body>
    </html>
    '''  # 回傳 HTML 字串，包含倒數計時器

if __name__ == '__main__':  # 只有直接執行 index.py 時才會執行這段，被 import 時不會
    port = int(os.environ.get('PORT', 3000))  # 從環境變數取得 port，沒有設定的話預設用 3000
    app.run(host='0.0.0.0', port=port, debug=True)  # debug=True 代表程式碼改變後自動重啟