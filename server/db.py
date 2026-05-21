"""
Supabase 題庫載入模組。
參考原本 db.js 的邏輯，使用 SUPABASE_URL 與 SUPABASE_ANON_KEY 讀取 questions 資料表。
"""
import os
import random
from dotenv import load_dotenv
import requests

load_dotenv()


def load_questions():
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_ANON_KEY')

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError('缺少 Supabase 環境變數：SUPABASE_URL 或 SUPABASE_KEY')
    page_size = 1000
    all_rows = []
    start = 0

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Accept': 'application/json',
        'Prefer': 'count=exact',
    }

    while True:
        params = {
            'select': '*',
            'limit': page_size,
            'offset': start,
        }
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/questions"
        response = requests.get(url, headers=headers, params=params)
        if response.status_code not in (200, 206):
            raise RuntimeError(f'載入題庫失敗: {response.status_code} {response.text}')

        data = response.json()
        if not data:
            break

        all_rows.extend(data)
        if len(data) < page_size:
            break
        start += page_size

    if not all_rows:
        raise RuntimeError('questions 資料表為空，請確認 Supabase 資料')

    questions = []
    for row in all_rows:
        opts = [
            row.get('answer_a'),
            row.get('answer_b'),
            row.get('answer_c'),
            row.get('answer_d'),
        ]
        if None in opts:
            continue
        ans = 'ABCD'.find(str(row.get('correct_answer', '')).upper())
        if ans == -1:
            continue

        questions.append({
            'q': row.get('question', ''),
            'opts': opts,
            'ans': ans,
            'category': row.get('category') or '一般',
        })

    if not questions:
        raise RuntimeError('未找到有效題目，請確認 questions 資料表內容')

    random.shuffle(questions)
    return questions
