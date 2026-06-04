import os
from dotenv import load_dotenv
from flask import Flask, send_file, jsonify
from flask_cors import CORS

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return send_file("index.html")

@app.route("/config")
def config():
    return jsonify({
        "gemini_key": os.getenv("GEMINI_API_KEY"),
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_key": os.getenv("SUPABASE_KEY")
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))  # 從環境變數取得 port，預設 5000
    app.run(debug=True, port=port)