from flask import Flask, jsonify  # Flask 框架，jsonify 把 dict 轉成 JSON 回傳
from flask_cors import CORS  # 允許跨域請求，讓前端可以呼叫後端 API
from dotenv import load_dotenv  # 讀取 .env 檔案裡的環境變數
import os  # Python 內建模組，用來讀取環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

app = Flask(__name__)  # 建立 Flask 伺服器實體，__name__ 是目前模組的名稱
app.config['JSON_AS_ASCII'] = False  # 讓 JSON 回傳時不轉義中文字元，保持原本的中文
app.json.ensure_ascii = False  # 新版 Flask 需要這行才能正確顯示中文

# 配置 CORS：允許來自前端的跨域請求
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://localhost"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

from auth import auth_bp  # 從 auth.py 載入 auth_bp 藍圖（Blueprint）
app.register_blueprint(auth_bp, url_prefix='/auth')  # 把 auth_bp 掛載到 /auth 路徑，所有 auth.py 的路由前面都會加上 /auth

from user import user_bp  # 從 user.py 載入 user_bp 藍圖
app.register_blueprint(user_bp, url_prefix='/user')  # 把 user_bp 掛載到 /user 路徑，所有 user.py 的路由前面都會加上 /user

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

# 玩家驗證成功後會跳轉到這裡，5 秒後自動跳轉到登入頁面
@app.route('/verified')  # 定義 GET /verified 路由
def verified():  # 函式名稱，對應到這個路由的處理邏輯
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'  # 前端網址
    return f'''
    <!DOCTYPE html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>知識王 - 帳號開通成功</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
        <style>
          * {{ margin: 0; padding: 0; box-sizing: border-box; }}
          body {{
            background: #0a0a1a;
            color: #fff;
            font-family: 'Noto Sans TC', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }}
          .stars {{ position: fixed; inset: 0; pointer-events: none; z-index: 0; }}
          .star {{
            position: absolute;
            border-radius: 50%;
            background: #fff;
            animation: twinkle 3s infinite;
          }}
          @keyframes twinkle {{
            0%, 100% {{ opacity: .2; transform: scale(1); }}
            50% {{ opacity: .8; transform: scale(1.2); }}
          }}
          .card {{
            position: relative;
            z-index: 1;
            background: #1a1a3e;
            border: 1px solid rgba(255,215,0,0.2);
            border-radius: 20px;
            padding: 48px 40px;
            text-align: center;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
          }}
          .icon {{ font-size: 64px; margin-bottom: 16px; display: block; animation: bounce .6s ease infinite alternate; }}
          @keyframes bounce {{
            from {{ transform: translateY(0); }}
            to {{ transform: translateY(-10px); }}
          }}
          .title {{
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
          }}
          .desc {{ color: #b0b0d0; font-size: 14px; margin-bottom: 28px; line-height: 1.6; }}
          .progress-wrap {{ background: rgba(255,255,255,.08); border-radius: 99px; height: 6px; overflow: hidden; margin-bottom: 20px; }}
          .progress-bar {{ height: 100%; background: linear-gradient(90deg, #ffd700, #ff6b35); border-radius: 99px; width: 100%; animation: shrink 5s linear forwards; }}
          @keyframes shrink {{ from {{ width: 100%; }} to {{ width: 0%; }} }}
          .countdown {{ font-size: 13px; color: #7070a0; margin-bottom: 24px; }}
          .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a0a00;
            font-family: 'Noto Sans TC', sans-serif;
            font-size: 15px;
            font-weight: 900;
            padding: 14px 32px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 0 20px rgba(255,215,0,.4);
          }}
        </style>
      </head>
      <body>
        <div class="stars" id="stars"></div>
        <div class="card">
          <span class="icon">🎉</span>
          <div class="title">帳號開通成功囉！</div>
          <p class="desc">歡迎加入知識王戰場<br>即將跳轉到登入頁面</p>
          <div class="progress-wrap"><div class="progress-bar"></div></div>
          <div class="countdown" id="countdown">5 秒後自動跳轉...</div>
          <a href="{frontend_url}" class="btn">立即前往登入</a>
        </div>
        <script>
          const c = document.getElementById('stars');
          for (let i = 0; i < 80; i++) {{
            const s = document.createElement('div');
            s.className = 'star';
            s.style.cssText = `width:${{Math.random()*3+1}}px;height:${{Math.random()*3+1}}px;left:${{Math.random()*100}}%;top:${{Math.random()*100}}%;animation-delay:${{Math.random()*3}}s;animation-duration:${{2+Math.random()*3}}s`;
            c.appendChild(s);
          }}
          let sec = 5;
          const el = document.getElementById('countdown');
          const timer = setInterval(() => {{
            sec--;
            el.textContent = sec + ' 秒後自動跳轉...';
            if (sec <= 0) {{ clearInterval(timer); window.location.href = '{frontend_url}'; }}
          }}, 1000);
        </script>
      </body>
    </html>
    '''  # 回傳暗色星空風格的 HTML，5 秒後跳轉到前端登入頁面

@app.route('/verify-expired')
def verify_expired():
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'
    return f'''
    <!DOCTYPE html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>知識王 - 驗證連結已過期</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
        <style>
          * {{ margin: 0; padding: 0; box-sizing: border-box; }}
          body {{
            background: #0a0a1a;
            color: #fff;
            font-family: 'Noto Sans TC', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }}
          .stars {{ position: fixed; inset: 0; pointer-events: none; z-index: 0; }}
          .star {{
            position: absolute;
            border-radius: 50%;
            background: #fff;
            animation: twinkle 3s infinite;
          }}
          @keyframes twinkle {{
            0%, 100% {{ opacity: .2; transform: scale(1); }}
            50% {{ opacity: .8; transform: scale(1.2); }}
          }}
          .card {{
            position: relative;
            z-index: 1;
            background: #1a1a3e;
            border: 1px solid rgba(255,100,100,0.3);
            border-radius: 20px;
            padding: 48px 40px;
            text-align: center;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 0 40px rgba(255,100,100,0.1);
          }}
          .icon {{ font-size: 64px; margin-bottom: 16px; display: block; animation: bounce .6s ease infinite alternate; }}
          @keyframes bounce {{
            from {{ transform: translateY(0); }}
            to {{ transform: translateY(-8px); }}
          }}
          .title {{
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b6b, #ff9a3c);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
          }}
          .desc {{ color: #b0b0d0; font-size: 14px; margin-bottom: 28px; line-height: 1.6; }}
          .progress-wrap {{ background: rgba(255,255,255,.08); border-radius: 99px; height: 6px; overflow: hidden; margin-bottom: 20px; }}
          .progress-bar {{ height: 100%; background: linear-gradient(90deg, #ff6b6b, #ff9a3c); border-radius: 99px; width: 100%; animation: shrink 5s linear forwards; }}
          @keyframes shrink {{ from {{ width: 100%; }} to {{ width: 0%; }} }}
          .countdown {{ font-size: 13px; color: #7070a0; margin-bottom: 24px; }}
          .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a0a00;
            font-family: 'Noto Sans TC', sans-serif;
            font-size: 15px;
            font-weight: 900;
            padding: 14px 32px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 0 20px rgba(255,215,0,.4);
          }}
        </style>
      </head>
      <body>
        <div class="stars" id="stars"></div>
        <div class="card">
          <span class="icon">⏰</span>
          <div class="title">驗證連結過期啦！</div>
          <p class="desc">這個連結已經失效了<br>請重新註冊再試一次</p>
          <div class="progress-wrap"><div class="progress-bar"></div></div>
          <div class="countdown" id="countdown">5 秒後自動跳轉...</div>
          <a href="{frontend_url}" class="btn">立即前往註冊</a>
        </div>
        <script>
          const c = document.getElementById('stars');
          for (let i = 0; i < 80; i++) {{
            const s = document.createElement('div');
            s.className = 'star';
            s.style.cssText = `width:${{Math.random()*3+1}}px;height:${{Math.random()*3+1}}px;left:${{Math.random()*100}}%;top:${{Math.random()*100}}%;animation-delay:${{Math.random()*3}}s;animation-duration:${{2+Math.random()*3}}s`;
            c.appendChild(s);
          }}
          let sec = 5;
          const el = document.getElementById('countdown');
          const timer = setInterval(() => {{
            sec--;
            el.textContent = sec + ' 秒後自動跳轉...';
            if (sec <= 0) {{ clearInterval(timer); window.location.href = '{frontend_url}'; }}
          }}, 1000);
        </script>
      </body>
    </html>
    '''

@app.route('/already-verified')
def already_verified():
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'
    return f'''
    <!DOCTYPE html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>知識王 - 帳號已驗證</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
        <style>
          * {{ margin: 0; padding: 0; box-sizing: border-box; }}
          body {{
            background: #0a0a1a;
            color: #fff;
            font-family: 'Noto Sans TC', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }}
          .stars {{ position: fixed; inset: 0; pointer-events: none; z-index: 0; }}
          .star {{
            position: absolute;
            border-radius: 50%;
            background: #fff;
            animation: twinkle 3s infinite;
          }}
          @keyframes twinkle {{
            0%, 100% {{ opacity: .2; transform: scale(1); }}
            50% {{ opacity: .8; transform: scale(1.2); }}
          }}
          .card {{
            position: relative;
            z-index: 1;
            background: #1a1a3e;
            border: 1px solid rgba(255,215,0,0.2);
            border-radius: 20px;
            padding: 48px 40px;
            text-align: center;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
          }}
          .icon {{ font-size: 64px; margin-bottom: 16px; display: block; animation: bounce .6s ease infinite alternate; }}
          @keyframes bounce {{
            from {{ transform: translateY(0); }}
            to {{ transform: translateY(-10px); }}
          }}
          .title {{
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
          }}
          .desc {{ color: #b0b0d0; font-size: 14px; margin-bottom: 28px; line-height: 1.6; }}
          .progress-wrap {{ background: rgba(255,255,255,.08); border-radius: 99px; height: 6px; overflow: hidden; margin-bottom: 20px; }}
          .progress-bar {{ height: 100%; background: linear-gradient(90deg, #ffd700, #ff6b35); border-radius: 99px; width: 100%; animation: shrink 5s linear forwards; }}
          @keyframes shrink {{ from {{ width: 100%; }} to {{ width: 0%; }} }}
          .countdown {{ font-size: 13px; color: #7070a0; margin-bottom: 24px; }}
          .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a0a00;
            font-family: 'Noto Sans TC', sans-serif;
            font-size: 15px;
            font-weight: 900;
            padding: 14px 32px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 0 20px rgba(255,215,0,.4);
          }}
        </style>
      </head>
      <body>
        <div class="stars" id="stars"></div>
        <div class="card">
          <span class="icon">✅</span>
          <div class="title">你已經開通過囉！</div>
          <p class="desc">此帳號已驗證過<br>即將跳轉到登入頁面</p>
          <div class="progress-wrap"><div class="progress-bar"></div></div>
          <div class="countdown" id="countdown">5 秒後自動跳轉...</div>
          <a href="{frontend_url}" class="btn">立即前往登入</a>
        </div>
        <script>
          const c = document.getElementById('stars');
          for (let i = 0; i < 80; i++) {{
            const s = document.createElement('div');
            s.className = 'star';
            s.style.cssText = `width:${{Math.random()*3+1}}px;height:${{Math.random()*3+1}}px;left:${{Math.random()*100}}%;top:${{Math.random()*100}}%;animation-delay:${{Math.random()*3}}s;animation-duration:${{2+Math.random()*3}}s`;
            c.appendChild(s);
          }}
          let sec = 5;
          const el = document.getElementById('countdown');
          const timer = setInterval(() => {{
            sec--;
            el.textContent = sec + ' 秒後自動跳轉...';
            if (sec <= 0) {{ clearInterval(timer); window.location.href = '{frontend_url}'; }}
          }}, 1000);
        </script>
      </body>
    </html>
    '''

if __name__ == '__main__':  # 只有直接執行 index.py 時才會執行這段，被 import 時不會
    port = int(os.environ.get('PORT', 3000))  # 從環境變數取得 port，沒有設定的話預設用 3000
    app.run(host='0.0.0.0', port=port, debug=True)  # debug=True 代表程式碼改變後自動重啟