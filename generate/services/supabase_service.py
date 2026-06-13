import os  # 讀取環境變數
import requests  # 發送 HTTP 請求

SUPABASE_URL = os.getenv('SUPABASE_URL')  # Supabase 資料庫網址
SUPABASE_KEY = os.getenv('SUPABASE_KEY')  # Supabase API 金鑰


def get_headers():
    """取得 Supabase API 請求標頭"""
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }


def check_env():
    """確認環境變數已設定"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception('SUPABASE_URL 或 SUPABASE_KEY 未設定，請檢查 .env 檔案')


def save_questions(questions):
    """存入題目到 Supabase"""
    if not questions:
        raise ValueError('No questions to save')
    check_env()

    res = requests.post(
        f'{SUPABASE_URL}/rest/v1/questions',
        headers={**get_headers(), 'Prefer': 'return=minimal'},
        json=questions,
        timeout=30
    )

    if not res.ok:
        raise Exception(f'Supabase insert failed ({res.status_code}): {res.text}')

    return {'inserted': len(questions), 'status': res.status_code}


def get_questions(category=None, keyword=None, page=1, page_size=20):
    """查詢題目，支援分類篩選、關鍵字搜尋、分頁"""
    check_env()

    offset = (page - 1) * page_size  # 計算分頁偏移量
    params = {
        'select': '*',
        'order': 'id.desc',   # 最新的排前面
        'limit': page_size,
        'offset': offset,
    }

    if category:  # 分類篩選
        params['category'] = f'eq.{category}'
    if keyword:   # 關鍵字搜尋（搜尋題目欄位）
        params['question'] = f'ilike.*{keyword}*'

    headers = {**get_headers(), 'Prefer': 'count=exact'}  # 取得總數
    res = requests.get(
        f'{SUPABASE_URL}/rest/v1/questions',
        headers=headers,
        params=params,
        timeout=30
    )

    if not res.ok:
        raise Exception(f'查詢失敗 ({res.status_code}): {res.text}')

    # 從 Content-Range header 取得總數（格式：0-19/100）
    total = 0
    content_range = res.headers.get('Content-Range', '')
    if '/' in content_range:
        total = int(content_range.split('/')[1])

    return {'questions': res.json(), 'total': total}


def update_question(question_id, data):
    """更新單筆題目"""
    check_env()

    res = requests.patch(
        f'{SUPABASE_URL}/rest/v1/questions',
        headers={**get_headers(), 'Prefer': 'return=minimal'},
        params={'id': f'eq.{question_id}'},
        json=data,
        timeout=30
    )

    if not res.ok:
        raise Exception(f'更新失敗 ({res.status_code}): {res.text}')

    return {'message': '更新成功'}


def delete_questions(ids):
    """刪除一筆或多筆題目"""
    check_env()

    if not ids:
        raise ValueError('請提供要刪除的題目 ID')

    # 用 in 語法刪除多筆
    id_list = ','.join(str(i) for i in ids)

    res = requests.delete(
        f'{SUPABASE_URL}/rest/v1/questions',
        headers=get_headers(),
        params={'id': f'in.({id_list})'},
        timeout=30
    )

    if not res.ok:
        raise Exception(f'刪除失敗 ({res.status_code}): {res.text}')

    return {'message': f'已刪除 {len(ids)} 筆題目', 'deleted': len(ids)}