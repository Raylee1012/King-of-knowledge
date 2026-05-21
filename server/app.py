"""Python Flask + WebSocket 伺服器。"""
import json
import os
import random
import string
import sys
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_sock import Sock

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

load_dotenv()

from db import load_questions
from game_room import GameRoom
from match_manager import MatchManager

PORT = int(os.getenv('PORT', 3000))

app = Flask(__name__, static_folder='../client', static_url_path='')
sock = Sock(app)

match_manager = MatchManager()
rooms = {}
questions = []


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'questionCount': len(questions)})


@sock.route('/ws')
def websocket(ws):
    ws.id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    ws.player_name = None
    ws.room_id = None
    print(f"[Server] 新連線: {ws.id}")

    try:
        while True:
            raw = ws.receive()
            if raw is None:
                break

            try:
                msg = json.loads(raw)
            except Exception:
                continue

            handle_message(ws, msg)
    except Exception as err:
        print(f"[Server] 連線錯誤: {err}")
    finally:
        print(f"[Server] 斷線: {ws.id} ({getattr(ws, 'player_name', '未命名')})")
        match_manager.remove_from_queue(ws)
        if ws.room_id and ws.room_id in rooms:
            room = rooms[ws.room_id]
            room.handle_disconnect(ws.id)
            rooms.pop(ws.room_id, None)


def handle_message(ws, msg):
    msg_type = msg.get('type')

    if msg_type == 'join_queue':
        ws.player_name = str(msg.get('name', '玩家'))[:12]
        send(ws, {'type': 'queued'})
        match_manager.enqueue_random(ws, lambda p1, p2, room_id: start_room(p1, p2, room_id))
        return

    if msg_type == 'create_room':
        ws.player_name = str(msg.get('name', '玩家'))[:12]
        room_id = gen_room_id()
        send(ws, {'type': 'room_created', 'roomId': room_id})
        match_manager.create_room(ws, room_id, lambda p1, p2, rid: start_room(p1, p2, rid))
        return

    if msg_type == 'join_room':
        ws.player_name = str(msg.get('name', '玩家'))[:12]
        room_id = str(msg.get('roomId', '')).strip()
        if not room_id:
            send(ws, {'type': 'error', 'message': '請輸入房號'})
            return

        ok = match_manager.join_room(ws, room_id, lambda p1, p2, rid: start_room(p1, p2, rid))
        if not ok:
            send(ws, {'type': 'error', 'message': '找不到此房間，請確認房號'})
        return

    if msg_type == 'cancel_queue':
        match_manager.remove_from_queue(ws)
        send(ws, {'type': 'cancelled'})
        return

    if msg_type == 'submit_answer':
        if not ws.room_id or ws.room_id not in rooms:
            return
        room = rooms[ws.room_id]
        room.submit_answer(ws.id, msg.get('answerIdx', -1), float(msg.get('usedSec', 10)))
        return

    if msg_type == 'use_item':
        if not ws.room_id or ws.room_id not in rooms:
            return
        room = rooms[ws.room_id]
        room.use_item(ws.id, msg.get('item'))
        return

    print(f"[Server] 未知訊息: {msg_type}")


def ensure_questions_loaded():
    global questions
    if not questions:
        print('[Server] 題庫尚未載入，開始載入...')
        bootstrap()


def start_room(p1, p2, room_id):
    ensure_questions_loaded()
    p1.room_id = room_id
    p2.room_id = room_id
    room = GameRoom(room_id, p1, p2, questions, lambda: rooms.pop(room_id, None))
    rooms[room_id] = room
    room.start()
    print(f"[Server] 遊戲開始 room={room_id}: {p1.player_name} vs {p2.player_name} (題庫{len(questions)}題)")


def send(ws, data):
    try:
        ws.send(json.dumps(data))
    except Exception:
        pass


def gen_room_id():
    return ''.join(random.choices('0123456789', k=6))


def bootstrap():
    global questions
    print('[Server] 載入題庫...')
    try:
        questions = load_questions()
        print(f"[Server] 題庫就緒，共 {len(questions)} 題")
    except Exception as err:
        print(f"[Server] 題庫載入失敗: {err}")
        raise


if __name__ == '__main__':
    bootstrap()
    from gevent import pywsgi
    from geventwebsocket.handler import WebSocketHandler

    http_server = pywsgi.WSGIServer(('0.0.0.0', PORT), app, handler_class=WebSocketHandler)
    print(f"[Server] 知識王伺服器啟動: http://localhost:{PORT}")
    http_server.serve_forever()
