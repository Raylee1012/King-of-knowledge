"""Python Flask + WebSocket 伺服器。"""
import json  # 用於 JSON 序列化/反序列化
import os  # 用於環境變數和檔案路徑操作
import random  # 用於產生隨機房間 ID 和隨機數
import string  # 用於定義隨機字符集
import sys  # 用於修改 Python 路徑
from dotenv import load_dotenv  # 用於載入 .env 環境變數
from flask import Flask, jsonify  # Flask 網頁框架和 JSON 響應
from flask_cors import CORS  # CORS 支援
from flask_sock import Sock  # WebSocket 支援

BASE_DIR = os.path.dirname(__file__)  # 取得當前文件目錄
sys.path.insert(0, BASE_DIR)  # 將當前目錄加入 Python 路徑

# 指定 .env 的絕對路徑，不管從哪裡啟動都找得到
load_dotenv(os.path.join(BASE_DIR, '.env'), override=False)

from db import load_questions  # 導入載入題庫函式
from game_room import GameRoom  # 導入遊戲房間類別
from match_manager import MatchManager  # 導入配對管理器

PORT = int(os.getenv('PORT', 4000))  # 從環境變數取得埠號，預設 4000

app = Flask(__name__, static_folder='../client', static_url_path='')  # 建立 Flask 應用，靜態文件位置為 client 資料夾

# 配置 CORS
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://localhost"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
    }
})

sock = Sock(app)  # 為 Flask 應用添加 WebSocket 支援

match_manager = MatchManager()  # 建立配對管理器實例
rooms = {}  # 儲存所有遊戲房間的字典
questions = []  # 儲存所有題庫的列表


@app.route('/')  # 定義根路由
def index():  # 索引頁面處理函式
    return '知識王對戰系統運作中'  # 回傳純文字


@app.route('/health')  # 定義健康檢查路由
def health():  # 健康狀態檢查函式
    return jsonify({'status': 'ok', 'questionCount': len(questions)})  # 返回服務器狀態和題庫數量


@sock.route('/ws')  # 定義 WebSocket 路由
def websocket(ws):  # WebSocket 連接處理函式
    ws.id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))  # 為連接分配 7 個隨機字符的唯一 ID
    ws.player_name = None  # 初始化玩家名稱為空
    ws.user_id = None  # 初始化用戶 ID 為空
    ws.room_id = None  # 初始化房間 ID 為空
    print(f"[Server] 新連線: {ws.id}")  # 列印新連接的 ID

    try:  # 開始 try 區塊
        while True:  # 無限迴圈，持續接收訊息
            raw = ws.receive()  # 接收客戶端訊息
            if raw is None:  # 如果無訊息接收
                break  # 跳出迴圈

            try:  # 嘗試解析 JSON
                msg = json.loads(raw)  # 將接收的字符串解析為 JSON 對象
            except Exception:  # 如果 JSON 解析失敗
                continue  # 跳過這條訊息

            handle_message(ws, msg)  # 調用訊息處理函式
    except Exception as err:  # 如果發生任何異常
        print(f"[Server] 連線錯誤: {err}")  # 列印連接錯誤
    finally:  # 無論如何都會執行（連接結束時）
        print(f"[Server] 斷線: {ws.id} ({getattr(ws, 'player_name', '未命名')})")  # 列印斷開連接的玩家
        match_manager.remove_from_queue(ws)  # 從配對佇列中移除玩家
        if ws.room_id and ws.room_id in rooms:  # 如果玩家在房間中
            room = rooms[ws.room_id]  # 取得房間對象
            room.handle_disconnect(ws.id)  # 在房間中處理斷開連接
            rooms.pop(ws.room_id, None)  # 從房間字典中移除房間


def get_player_name(msg):  # 從訊息中取得玩家名稱的函式
    return str(msg.get('userName') or msg.get('name') or '玩家')[:12]  # 返回玩家名稱，如沒有預設為 '玩家'，限制 12 字符


def handle_message(ws, msg):  # 訊息處理函式
    msg_type = msg.get('type')  # 取得訊息類型

    if msg_type == 'join_bot':  # 如果是加入 AI 機器人對戰
        ws.player_name = get_player_name(msg)  # 設定玩家名稱
        ws.user_id = msg.get('userId')  # 設定玩家用戶 ID

        class Bot:  # 定義簡單機器人類別
            def __init__(self):
                self.id = 'bot-' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
                self.player_name = 'AI 練習生'
                self.is_bot = True
                self.room_id = None

            def send(self, data):
                pass

        bot = Bot()  # 建立機器人實例
        room_id = gen_room_id()  # 產生隨機房間 ID
        send(ws, {'type': 'queued'})  # 發送已加入佇列確認給玩家
        start_room(ws, bot, room_id)  # 直接開始玩家與機器人的房間
        return  # 函式結束

    if msg_type == 'join_queue':  # 如果是加入隨機佇列
        ws.player_name = get_player_name(msg)  # 設定玩家名稱
        ws.user_id = msg.get('userId')  # 設定玩家用戶 ID
        send(ws, {'type': 'queued'})  # 發送已加入佇列的確認
        match_manager.enqueue_random(ws, lambda p1, p2, room_id: start_room(p1, p2, room_id))  # 加入隨機配對佇列
        return  # 函式結束

    if msg_type == 'create_room':  # 如果是建立房間
        ws.player_name = get_player_name(msg)  # 設定玩家名稱
        ws.user_id = msg.get('userId')  # 設定玩家用戶 ID
        room_id = gen_room_id()  # 產生隨機房間 ID
        send(ws, {'type': 'room_created', 'roomId': room_id})  # 發送房間已建立訊息和房號
        match_manager.create_room(ws, room_id, lambda p1, p2, rid: start_room(p1, p2, rid))  # 在配對管理器中建立房間
        return  # 函式結束

    if msg_type == 'join_room':  # 如果是加入現有房間
        ws.player_name = get_player_name(msg)  # 設定玩家名稱
        ws.user_id = msg.get('userId')  # 設定玩家用戶 ID
        room_id = str(msg.get('roomId', '')).strip()  # 取得房號並去除空白
        if not room_id:  # 如果房號為空
            send(ws, {'type': 'error', 'message': '請輸入房號'})  # 發送錯誤訊息
            return  # 函式結束

        ok = match_manager.join_room(ws, room_id, lambda p1, p2, rid: start_room(p1, p2, rid))  # 嘗試加入房間
        if not ok:  # 如果加入失敗
            send(ws, {'type': 'error', 'message': '找不到此房間，請確認房號'})  # 發送錯誤訊息
        return  # 函式結束

    if msg_type == 'cancel_queue':  # 如果是取消佇列
        match_manager.remove_from_queue(ws)  # 從配對佇列中移除玩家
        send(ws, {'type': 'cancelled'})  # 發送取消確認訊息
        return  # 函式結束

    if msg_type == 'quit_match':  # 如果玩家主動退出對戰
        if ws.room_id and ws.room_id in rooms:  # 如果在有效房間中
            room = rooms[ws.room_id]
            room.handle_disconnect(ws.id)  # 將退出視為斷線，結束本局
            rooms.pop(ws.room_id, None)  # 從房間字典中移除房間
            ws.room_id = None
        return  # 函式結束

    if msg_type == 'submit_answer':  # 如果是提交答案
        if not ws.room_id or ws.room_id not in rooms:  # 檢查玩家是否在有效房間
            return  # 如果不在房間則返回
        room = rooms[ws.room_id]  # 取得房間對象
        room.submit_answer(ws.id, msg.get('answerIdx', -1), float(msg.get('usedSec', 10)))  # 提交答案給房間
        return  # 函式結束

    if msg_type == 'use_item':  # 如果是使用道具
        if not ws.room_id or ws.room_id not in rooms:  # 檢查玩家是否在有效房間
            return  # 如果不在房間則返回
        room = rooms[ws.room_id]  # 取得房間對象
        room.use_item(ws.id, msg.get('item'))  # 在房間中使用道具
        return  # 函式結束

    print(f"[Server] 未知訊息: {msg_type}")  # 列印未知訊息類型


def ensure_questions_loaded():  # 確保題庫已載入的函式
    global questions  # 聲明使用全局變數
    if not questions:  # 如果題庫為空
        print('[Server] 題庫尚未載入，開始載入...')  # 列印載入訊息
        bootstrap()  # 呼叫啟動函式


def start_room(p1, p2, room_id):  # 啟動遊戲房間函式
    ensure_questions_loaded()  # 確保題庫已載入
    p1.room_id = room_id  # 設定玩家 1 的房間 ID
    p2.room_id = room_id  # 設定玩家 2 的房間 ID
    room = GameRoom(room_id, p1, p2, questions, lambda: rooms.pop(room_id, None))  # 建立遊戲房間
    rooms[room_id] = room  # 將房間添加到房間字典
    room.start()  # 啟動遊戲
    print(f"[Server] 遊戲開始 room={room_id}: {p1.player_name} vs {p2.player_name} (題庫{len(questions)}題)")  # 列印遊戲開始訊息


def send(ws, data):  # 發送訊息給客戶端的函式
    try:  # 開始 try 區塊
        ws.send(json.dumps(data))  # 將數據轉為 JSON 字符串並發送
    except Exception:  # 如果發送失敗
        pass  # 忽略錯誤


def gen_room_id():  # 產生房間 ID 的函式
    return ''.join(random.choices('0123456789', k=6))  # 返回 6 個隨機數字組成的房間 ID


def bootstrap():  # 啟動函式（載入題庫）
    global questions  # 聲明使用全局變數
    print('[Server] 載入題庫...')  # 列印載入訊息
    try:  # 開始 try 區塊
        questions = load_questions()  # 從資料庫載入題庫
        print(f"[Server] 題庫就緒，共 {len(questions)} 題")  # 列印成功訊息
    except Exception as err:  # 如果載入失敗
        print(f"[Server] 題庫載入失敗: {err}")  # 列印錯誤訊息
        raise  # 重新拋出異常


if __name__ == '__main__':  # 如果這是主程序
    bootstrap()  # 啟動並載入題庫
    print(f"[Server] 知識王伺服器啟動: http://localhost:{PORT}")  # 列印伺服器啟動訊息
    app.run(host='0.0.0.0', port=PORT, debug=False)  # 用 Flask 內建伺服器啟動，debug=False 避免衝突