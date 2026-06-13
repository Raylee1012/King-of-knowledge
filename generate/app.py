import os  # 讀取環境變數
from dotenv import load_dotenv  # 讀取 .env 檔案
from flask import Flask, jsonify, request  # Flask 框架
from flask_cors import CORS  # 允許跨域請求

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=False)

from services.gemini_service import generate_questions    # Gemini 生題服務
from services.supabase_service import (                   # Supabase 服務
    save_questions, get_questions, update_question, delete_questions
)

app = Flask(__name__)
CORS(app)

# ─── 連線測試 ──────────────────────────────────────────────
# 路徑：GET /config
# initAdminScreen() 用來確認後端是否可以連線
@app.route('/config')
def config():
    return jsonify({'status': 'ok'}), 200

# ─── 生成題目 ──────────────────────────────────────────────
# 路徑：POST /generate
# 傳入：{ categories: [...], count: 10 }
@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    categories = data.get('categories', [])  # 分類列表
    count = int(data.get('count', 10))       # 生成數量

    if not categories:
        return jsonify({'error': '請至少選擇一個分類'}), 400
    if count < 1 or count > 50:
        return jsonify({'error': '數量需在 1~50 之間'}), 400

    try:
        questions = generate_questions(categories, count)  # 呼叫 Gemini
        result = save_questions(questions)                 # 存入 Supabase
        return jsonify({
            'message': '生成成功',
            'questions': questions,
            'inserted': result['inserted']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── 查詢題目 ──────────────────────────────────────────────
# 路徑：GET /questions
# 參數：category（分類）、keyword（關鍵字）、page（頁數）、page_size（每頁數量）
@app.route('/questions', methods=['GET'])
def list_questions():
    category = request.args.get('category')        # 分類篩選
    keyword = request.args.get('keyword')          # 關鍵字搜尋
    page = int(request.args.get('page', 1))        # 頁數，預設第 1 頁
    page_size = int(request.args.get('page_size', 20))  # 每頁數量，預設 20

    try:
        result = get_questions(category, keyword, page, page_size)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── 編輯題目 ──────────────────────────────────────────────
# 路徑：PATCH /questions/<id>
# 傳入：{ question, answer_a, answer_b, answer_c, answer_d, correct_answer, category }
@app.route('/questions/<int:question_id>', methods=['PATCH'])
def edit_question(question_id):
    data = request.get_json()

    # 只允許更新這些欄位
    allowed = {'question', 'answer_a', 'answer_b', 'answer_c', 'answer_d', 'correct_answer', 'category'}
    update_data = {k: v for k, v in data.items() if k in allowed}  # 過濾非法欄位

    if not update_data:
        return jsonify({'error': '沒有可更新的欄位'}), 400

    try:
        result = update_question(question_id, update_data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── 刪除題目 ──────────────────────────────────────────────
# 路徑：DELETE /questions
# 傳入：{ ids: [1, 2, 3] }（支援批量刪除）
@app.route('/questions', methods=['DELETE'])
def remove_questions():
    data = request.get_json()
    ids = data.get('ids', [])  # 要刪除的題目 ID 列表

    if not ids:
        return jsonify({'error': '請提供要刪除的題目 ID'}), 400

    try:
        result = delete_questions(ids)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, port=port)