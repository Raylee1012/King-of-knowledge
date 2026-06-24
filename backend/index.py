from flask import Flask, jsonify, request, redirect
# Flask 建框架，jsonify 回傳 JSON，request 讀前端資料，redirect 做頁面跳轉
from flask_cors import CORS  # 讓前端可以跨網域呼叫後端 API
from dotenv import load_dotenv  # 載入 .env 設定檔
import os  # 讀取環境變數

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

app = Flask(__name__)  # 建立 Flask 伺服器實體，__name__ 是目前模組的名稱
app.config['JSON_AS_ASCII'] = False  # 讓 JSON 回傳時不轉義中文字元，保持原本的中文
app.json.ensure_ascii = False  # 新版 Flask 需要這行才能正確顯示中文

# 配置 CORS：允許來自前端的跨域請求
CORS(app, resources={
    r"/*": {  # 對所有路由套用 CORS 設定
        "origins": ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://localhost"],  # 允許的前端來源網址清單
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 允許的 HTTP 方法
        "allow_headers": ["Content-Type", "Authorization"],  # 允許的請求標頭
        "supports_credentials": True  # 允許攜帶 Cookie 或 Authorization 憑證
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
    return f'''  # 回傳星空風格 HTML 頁面，5 秒倒數後自動跳轉前端登入頁
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

@app.route('/verify-expired')  # 定義 GET /verify-expired 路由
def verify_expired():  # 驗證連結已過期的提示頁面
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'  # 前端網址，倒數結束後跳轉
    return f'''  # 回傳星空風格 HTML 頁面，提示驗證連結已過期並倒數跳轉
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
    '''  # 回傳暗色星空風格的 HTML，提示驗證連結已過期並倒數跳轉

@app.route('/already-verified')  # 定義 GET /already-verified 路由
def already_verified():  # 帳號已驗證的提示頁面（防止重複點擊驗證連結）
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'  # 前端網址，倒數結束後跳轉
    return f'''  # 回傳星空風格 HTML 頁面，提示帳號已驗證過並倒數跳轉
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
    '''  # 回傳暗色星空風格的 HTML，提示帳號已驗證並倒數跳轉

@app.route('/reset-password')  # 定義 GET /reset-password 路由，顯示重設密碼表單
def reset_password_page():  # 從 URL 取得 token，驗證有效性後顯示密碼表單
    token = request.args.get('token', '')  # 從 URL query string 取得 reset token 參數
    backend_url = os.environ.get('BACKEND_URL', 'http://localhost:3000')  # 後端 API 網址，嵌入頁面供前端 fetch 呼叫
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'  # 重設成功後跳轉的前端登入頁

    # 解析 expire_at 並做過期判斷，直接在頁面層擋掉
    import time  # 用來取得目前的 Unix 時間戳記（毫秒）
    parts = token.split('.')  # token 格式為 uuid.expire_at，以 . 切割成兩段
    if len(parts) == 2:  # 確認 token 格式正確，必須有兩個部分
        try:  # 嘗試解析過期時間，token 格式不對時捕捉例外
            expire_at = int(parts[1])  # 取第二段轉成整數，代表過期的 Unix 毫秒時間
            if int(time.time() * 1000) > expire_at:  # 目前時間超過過期時間，token 已失效
                return redirect(backend_url + '/reset-expired')  # 跳轉到過期提示頁，阻止繼續重設
        except ValueError:  # parts[1] 無法轉成整數，token 格式損毀
            return redirect(backend_url + '/reset-expired')  # 跳轉到過期提示頁
    else:  # token 中沒有 . 分隔符，格式完全錯誤
        return redirect(backend_url + '/reset-expired')  # 跳轉到過期提示頁

    return f'''  # 回傳重設密碼表單頁面，玩家填寫新密碼後呼叫 /auth/reset-password API
    <!DOCTYPE html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>知識王 - 重設密碼</title>
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
          .star {{ position: absolute; border-radius: 50%; background: #fff; animation: twinkle 3s infinite; }}
          @keyframes twinkle {{
            0%, 100% {{ opacity: .2; transform: scale(1); }}
            50% {{ opacity: .8; transform: scale(1.2); }}
          }}
          .card {{
            position: relative; z-index: 1;
            background: #1a1a3e;
            border: 1px solid rgba(255,215,0,0.2);
            border-radius: 20px;
            padding: 48px 40px;
            text-align: center;
            max-width: 420px; width: 90%;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
          }}
          .icon {{ font-size: 56px; margin-bottom: 16px; display: block; }}
          .title {{
            font-family: 'Orbitron', monospace; font-size: 20px; font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 24px;
          }}
          .field {{ margin-bottom: 16px; text-align: left; }}
          .field label {{ font-size: 13px; color: #b0b0d0; display: block; margin-bottom: 6px; }}
          .field input {{
            width: 100%; padding: 12px 16px; border-radius: 10px;
            background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15);
            color: #fff; font-size: 15px; font-family: inherit; outline: none;
          }}
          .field input:focus {{ border-color: #ffd700; }}
          .error {{ color: #ff6b6b; font-size: 13px; margin-bottom: 12px; min-height: 18px; }}
          .btn {{
            width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer;
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a0a00; font-family: inherit; font-size: 15px; font-weight: 900;
            box-shadow: 0 0 20px rgba(255,215,0,.4);
          }}
          .btn:disabled {{ opacity: .5; cursor: not-allowed; }}
          .success {{ color: #00e676; font-size: 14px; margin-bottom: 12px; }}
        </style>
      </head>
      <body>
        <div class="stars" id="stars"></div>
        <div class="card">
          <span class="icon">🔑</span>
          <div class="title">重設密碼</div>
          <div class="field">
            <label>新密碼（至少 6 位）</label>
            <input type="password" id="pw1" placeholder="請輸入新密碼">
          </div>
          <div class="field">
            <label>確認新密碼</label>
            <input type="password" id="pw2" placeholder="請再輸入一次">
          </div>
          <div class="error" id="errMsg"></div>
          <button class="btn" id="submitBtn" onclick="doReset()">確認重設</button>
        </div>
        <script>
          const c = document.getElementById('stars');
          for (let i = 0; i < 80; i++) {{
            const s = document.createElement('div'); s.className = 'star';
            s.style.cssText = `width:${{Math.random()*3+1}}px;height:${{Math.random()*3+1}}px;left:${{Math.random()*100}}%;top:${{Math.random()*100}}%;animation-delay:${{Math.random()*3}}s;animation-duration:${{2+Math.random()*3}}s`;
            c.appendChild(s);
          }}
          async function doReset() {{
            const pw1 = document.getElementById('pw1').value;
            const pw2 = document.getElementById('pw2').value;
            const err = document.getElementById('errMsg');
            const btn = document.getElementById('submitBtn');
            err.textContent = '';
            if (!pw1 || !pw2) {{ err.textContent = '請填寫所有欄位'; return; }}
            if (pw1.length < 6) {{ err.textContent = '密碼至少需要 6 位數'; return; }}
            if (pw1 !== pw2) {{ err.textContent = '兩次密碼不一致'; return; }}
            btn.textContent = '重設中...'; btn.disabled = true;
            try {{
              const res = await fetch('{backend_url}/auth/reset-password', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ token: '{token}', new_password: pw1 }})
              }});
              const data = await res.json();
              if (!res.ok) {{ err.textContent = data.error || '重設失敗，請再試一次'; return; }}
              err.style.color = '#00e676';
              err.textContent = '✅ 密碼重設成功！即將跳轉到登入頁...';
              setTimeout(() => window.location.href = '{frontend_url}', 2000);
            }} catch (e) {{
              err.textContent = '無法連線到伺服器';
            }} finally {{
              btn.textContent = '確認重設'; btn.disabled = false;
            }}
          }}
        </script>
      </body>
    </html>
    '''  # 回傳重設密碼表單頁面，玩家填寫新密碼後呼叫 /auth/reset-password API

@app.route('/reset-expired')  # 定義 GET /reset-expired 路由
def reset_expired():  # 密碼重設連結已過期的提示頁面
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5500') + '/index.html'  # 前端網址，倒數結束後跳轉
    return f'''  # 回傳星空風格 HTML 頁面，提示重設連結已過期並倒數跳轉
    <!DOCTYPE html>
    <html lang="zh-TW">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>知識王 - 重設連結已過期</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
        <style>
          * {{ margin: 0; padding: 0; box-sizing: border-box; }}
          body {{
            background: #0a0a1a; color: #fff;
            font-family: 'Noto Sans TC', sans-serif;
            min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden;
          }}
          .stars {{ position: fixed; inset: 0; pointer-events: none; z-index: 0; }}
          .star {{ position: absolute; border-radius: 50%; background: #fff; animation: twinkle 3s infinite; }}
          @keyframes twinkle {{
            0%, 100% {{ opacity: .2; transform: scale(1); }}
            50% {{ opacity: .8; transform: scale(1.2); }}
          }}
          .card {{
            position: relative; z-index: 1; background: #1a1a3e;
            border: 1px solid rgba(255,100,100,0.3); border-radius: 20px;
            padding: 48px 40px; text-align: center; max-width: 420px; width: 90%;
            box-shadow: 0 0 40px rgba(255,100,100,0.1);
          }}
          .icon {{ font-size: 64px; margin-bottom: 16px; display: block; animation: bounce .6s ease infinite alternate; }}
          @keyframes bounce {{ from {{ transform: translateY(0); }} to {{ transform: translateY(-8px); }} }}
          .title {{
            font-family: 'Orbitron', monospace; font-size: 22px; font-weight: 900;
            background: linear-gradient(135deg, #ff6b6b, #ff9a3c);
            -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
          }}
          .desc {{ color: #b0b0d0; font-size: 14px; margin-bottom: 28px; line-height: 1.6; }}
          .progress-wrap {{ background: rgba(255,255,255,.08); border-radius: 99px; height: 6px; overflow: hidden; margin-bottom: 20px; }}
          .progress-bar {{ height: 100%; background: linear-gradient(90deg, #ff6b6b, #ff9a3c); border-radius: 99px; width: 100%; animation: shrink 5s linear forwards; }}
          @keyframes shrink {{ from {{ width: 100%; }} to {{ width: 0%; }} }}
          .countdown {{ font-size: 13px; color: #7070a0; margin-bottom: 24px; }}
          .btn {{
            display: inline-block; background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a0a00; font-family: 'Noto Sans TC', sans-serif; font-size: 15px; font-weight: 900;
            padding: 14px 32px; border-radius: 12px; border: none; cursor: pointer;
            text-decoration: none; box-shadow: 0 0 20px rgba(255,215,0,.4);
          }}
        </style>
      </head>
      <body>
        <div class="stars" id="stars"></div>
        <div class="card">
          <span class="icon">⏰</span>
          <div class="title">重設連結過期啦！</div>
          <p class="desc">這個連結已經失效了<br>請重新申請忘記密碼</p>
          <div class="progress-wrap"><div class="progress-bar"></div></div>
          <div class="countdown" id="countdown">5 秒後自動跳轉...</div>
          <a href="{frontend_url}" class="btn">立即前往</a>
        </div>
        <script>
          const c = document.getElementById('stars');
          for (let i = 0; i < 80; i++) {{
            const s = document.createElement('div'); s.className = 'star';
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
    '''  # 回傳暗色星空風格的 HTML，提示重設連結已過期並倒數跳轉

if __name__ == '__main__':  # 只有直接執行 index.py 時才會執行這段，被 import 時不會
    port = int(os.environ.get('PORT', 3000))  # 從環境變數取得 port，沒有設定的話預設用 3000
    app.run(host='0.0.0.0', port=port, debug=True)  # debug=True 代表程式碼改變後自動重啟