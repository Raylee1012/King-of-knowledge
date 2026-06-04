"""
Supabase 題庫載入模組。
參考原本 db.js 的邏輯，使用 SUPABASE_URL 與 SUPABASE_ANON_KEY 讀取 questions 資料表。
"""
import os  # 用於環境變數操作
import random  # 用於隨機打亂題庫
from dotenv import load_dotenv  # 用於載入 .env 文件
import requests  # 用於發送 HTTP 請求

load_dotenv()  # 載入 .env 文件中的環境變數


def load_questions():  # 載入題庫函式
    SUPABASE_URL = os.getenv('SUPABASE_URL')  # 從環境變數取得 Supabase URL
    SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_ANON_KEY')  # 從環境變數取得 Supabase 金鑰

    if not SUPABASE_URL or not SUPABASE_KEY:  # 如果 URL 或金鑰為空
        raise RuntimeError('缺少 Supabase 環境變數：SUPABASE_URL 或 SUPABASE_KEY')  # 拋出錯誤
    page_size = 1000  # 每次查詢的題目數量
    all_rows = []  # 存放所有查詢結果
    start = 0  # 查詢起始位置

    headers = {  # HTTP 請求標頭
        'apikey': SUPABASE_KEY,  # API 金鑰
        'Authorization': f'Bearer {SUPABASE_KEY}',  # 授權標頭
        'Accept': 'application/json',  # 接受 JSON 格式
        'Prefer': 'count=exact',  # 請求精確計數
    }

    while True:  # 無限迴圈，用於分頁查詢
        params = {  # 查詢參數
            'select': '*',  # 選擇所有欄位
            'limit': page_size,  # 限制查詢數量
            'offset': start,  # 設定查詢偏移量
        }
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/questions"  # 組合 API URL
        response = requests.get(url, headers=headers, params=params)  # 發送 GET 請求
        if response.status_code not in (200, 206):  # 如果狀態碼不是成功
            raise RuntimeError(f'載入題庫失敗: {response.status_code} {response.text}')  # 拋出錯誤

        data = response.json()  # 解析 JSON 響應
        if not data:  # 如果沒有數據
            break  # 跳出迴圈

        all_rows.extend(data)  # 將數據添加到列表
        if len(data) < page_size:  # 如果返回數據少於分頁大小
            break  # 代表已取得所有數據，跳出迴圈
        start += page_size  # 設定下一次查詢的偏移量

    if not all_rows:  # 如果沒有獲得任何題目
        raise RuntimeError('questions 資料表為空，請確認 Supabase 資料')  # 拋出錯誤

    questions = []  # 建立空題庫列表
    for row in all_rows:  # 遍歷所有查詢結果
        opts = [  # 提取選項
            row.get('answer_a'),  # 選項 A
            row.get('answer_b'),  # 選項 B
            row.get('answer_c'),  # 選項 C
            row.get('answer_d'),  # 選項 D
        ]
        if None in opts:  # 如果任何選項為 None
            continue  # 跳過此題
        ans = 'ABCD'.find(str(row.get('correct_answer', '')).upper())  # 將正確答案轉為索引（0-3）
        if ans == -1:  # 如果正確答案無效
            continue  # 跳過此題

        questions.append({  # 將題目添加到列表
            'q': row.get('question', ''),  # 題目文本
            'opts': opts,  # 選項列表
            'ans': ans,  # 正確答案索引
            'category': row.get('category') or '一般',  # 題目分類
        })

    if not questions:  # 如果沒有有效題目
        raise RuntimeError('未找到有效題目，請確認 questions 資料表內容')  # 拋出錯誤

    random.shuffle(questions)  # 隨機打亂題庫順序
    return questions  # 返回題庫列表
