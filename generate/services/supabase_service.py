import os
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def save_questions(questions):
    if not questions:
        raise ValueError("No questions to save")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("SUPABASE_URL 或 SUPABASE_KEY 未設定，請檢查 .env 檔案")

    url = f"{SUPABASE_URL}/rest/v1/questions"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    res = requests.post(url, headers=headers, json=questions, timeout=30)

    if not res.ok:
        raise Exception(f"Supabase insert failed ({res.status_code}): {res.text}")

    return {
        "inserted": len(questions),
        "status": res.status_code
    }
