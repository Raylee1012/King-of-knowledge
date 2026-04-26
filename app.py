from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from services.openai_service import generate_questions
from services.supabase_service import save_questions

app = Flask(__name__)
CORS(app)  # 允許跨域請求
app.config['JSON_AS_ASCII'] = False


# =========================
# 🌐 1. 提供前端 HTML
# =========================
@app.route("/")
def home():
    return send_file("index.html")


# =========================
# 🤖 2. API：生成題目
# =========================
@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Invalid JSON"}), 400

        categories = data.get("categories", [])
        count = data.get("count", 10)

        # 驗證參數
        if not isinstance(categories, list) or len(categories) == 0:
            return jsonify({"error": "categories must be a non-empty list"}), 400

        if not isinstance(count, int) or count < 1 or count > 50:
            return jsonify({"error": "count must be between 1 and 50"}), 400

        # 1. 生成題目
        raw_questions = generate_questions(categories, count)

        if not raw_questions:
            return jsonify({"error": "AI returned empty data"}), 500

        if not isinstance(raw_questions, list):
            return jsonify({"error": "AI output is not a list"}), 500

        # 2. 存入 Supabase
        save_questions(raw_questions)

        return jsonify({
            "success": True,
            "count": len(raw_questions),
            "questions": raw_questions
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =========================
# 🚀 3. 啟動
# =========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
