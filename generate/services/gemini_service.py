import os
import requests
import json
import time

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

REQUIRED_FIELDS = {"category", "question", "answer_a", "answer_b", "answer_c", "answer_d", "correct_answer"}
VALID_ANSWERS = {"A", "B", "C", "D"}

# Gemini REST API 網址（不需要安裝任何套件）
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"


def build_prompt(categories, count):
    cat_list = "、".join(categories)
    return f"""你是知識問答出題專家，請生成 {count} 題繁體中文單選題。

分類：{cat_list}

⚠️ 嚴格規則：
1. 只輸出 JSON 陣列，不要 markdown，不要解釋，不要多餘文字
2. correct_answer 只能是 A、B、C、D 其中一個
3. 四個選項要合理，不能太明顯

格式：
[
  {{
    "category": "分類",
    "question": "題目",
    "answer_a": "A選項",
    "answer_b": "B選項",
    "answer_c": "C選項",
    "answer_d": "D選項",
    "correct_answer": "A"
  }}
]"""


def call_gemini(prompt):
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY 未設定，請檢查 .env 檔案")

    res = requests.post(
        GEMINI_URL,
        params={"key": GEMINI_API_KEY},
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7}
        },
        timeout=60
    )

    if not res.ok:
        raise Exception(f"Gemini API error {res.status_code}: {res.text}")

    return res.json()["candidates"][0]["content"]["parts"][0]["text"]


def clean_json(text):
    return text.replace("```json", "").replace("```", "").strip()


def parse_json_safe(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def validate_questions(questions):
    valid = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        if not REQUIRED_FIELDS.issubset(q.keys()):
            print(f"[WARN] 題目缺少欄位，略過")
            continue
        if q.get("correct_answer", "").upper() not in VALID_ANSWERS:
            print(f"[WARN] correct_answer 不合法，略過")
            continue
        q["correct_answer"] = q["correct_answer"].upper()
        valid.append(q)
    return valid


def generate_questions(categories, count, retry=2):
    prompt = build_prompt(categories, count)

    for attempt in range(retry + 1):
        try:
            raw = call_gemini(prompt)
            clean = clean_json(raw)
            data = parse_json_safe(clean)

            if isinstance(data, list):
                valid = validate_questions(data)
                if valid:
                    return valid
                print(f"[WARN] 驗證失敗，retry {attempt + 1}")
            else:
                print(f"[WARN] JSON parse 失敗，retry {attempt + 1}")

        except Exception as e:
            print(f"[ERROR] attempt {attempt + 1}: {e}")
            if attempt == retry:
                raise

        time.sleep(2)

    raise Exception("Gemini 多次重試後仍無法取得有效題目")