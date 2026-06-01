"""配對管理器：支援隨機配對、建立房間與加入房間。"""
import random


def gen_room_id():
    return str(random.randint(100000, 999999))


class MatchManager:
    def __init__(self):
        self.random_queue = []
        self.room_waiting = {}

    def enqueue_random(self, ws, on_match):
        self.random_queue.append({'ws': ws, 'on_match': on_match})
        print(f"[Match] 隨機佇列加入: {ws.player_name}, 佇列長度: {len(self.random_queue)}")
        if len(self.random_queue) >= 2:
            e1 = self.random_queue.pop(0)
            e2 = self.random_queue.pop(0)
            room_id = gen_room_id()
            print(f"[Match] 隨機配對成功: {e1['ws'].player_name} vs {e2['ws'].player_name}, room={room_id}")
            e1['on_match'](e1['ws'], e2['ws'], room_id)

    def create_room(self, ws, room_id, on_match):
        if room_id in self.room_waiting:
            print(f"[Match] 房號 {room_id} 已存在")
            return False
        self.room_waiting[room_id] = {'ws': ws, 'on_match': on_match}
        print(f"[Match] 建立房間 {room_id}，等待對手: {ws.player_name}")
        return True

    def join_room(self, ws, room_id, on_match):
        entry = self.room_waiting.get(room_id)
        if not entry:
            print(f"[Match] 找不到房間 {room_id}")
            return False
        self.room_waiting.pop(room_id, None)
        print(f"[Match] 房間 {room_id} 配對成功: {entry['ws'].player_name} vs {ws.player_name}")
        entry['on_match'](entry['ws'], ws, room_id)
        return True

    def remove_from_queue(self, ws):
        self.random_queue = [e for e in self.random_queue if e['ws'] != ws]
        print(f"[Match] 從隨機佇列移除: {ws.player_name}")

        for room_id, entry in list(self.room_waiting.items()):
            if entry['ws'] == ws:
                self.room_waiting.pop(room_id, None)
                print(f"[Match] 房間 {room_id} 建立者離開")
                break
