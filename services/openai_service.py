import os
import requests
import json
import time

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

REQUIRED_FIELDS = {"category", "question", "answer_a", "answer_b", "answer_c", "answer_d", "correct_answer"}
VALID_ANSWERS = {"A", "B", "C", "D"}


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


def call_openai(prompt):
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY 未設定，請檢查 .env 檔案")

    res = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        },
        timeout=60  # 新增：避免無限等待
    )

    if not res.ok:
        raise Exception(f"OpenAI API error {res.status_code}: {res.text}")

    return res.json()["choices"][0]["message"]["content"]


def clean_json(text):
    """去掉 markdown 和雜訊"""
    return text.replace("```json", "").replace("```", "").strip()


def parse_json_safe(text):
    """防炸 JSON parser"""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def validate_questions(questions):
    """過濾掉欄位不完整或答案不合法的題目"""
    valid = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        # 檢查所有欄位都存在
        if not REQUIRED_FIELDS.issubset(q.keys()):
            print(f"[WARN] 題目缺少欄位，略過: {q}")
            continue
        # 檢查答案合法
        if q.get("correct_answer", "").upper() not in VALID_ANSWERS:
            print(f"[WARN] correct_answer 不合法，略過: {q.get('correct_answer')}")
            continue
        # 強制答案大寫
        q["correct_answer"] = q["correct_answer"].upper()
        valid.append(q)
    return valid


def generate_questions(categories, count, retry=2):
    prompt = build_prompt(categories, count)

    for attempt in range(retry + 1):
        try:
            raw = call_openai(prompt)
            clean = clean_json(raw)
            data = parse_json_safe(clean)

            if isinstance(data, list):
                valid = validate_questions(data)
                if valid:
                    return valid
                print(f"[WARN] 所有題目驗證失敗，retry {attempt + 1}")
            else:
                print(f"[WARN] JSON parse failed，retry {attempt + 1}")

        except Exception as e:
            print(f"[ERROR] attempt {attempt + 1}: {e}")
            if attempt == retry:
                raise

        time.sleep(1)

    raise Exception("OpenAI 多次重試後仍無法取得有效題目")
