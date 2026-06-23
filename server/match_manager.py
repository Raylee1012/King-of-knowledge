"""配對管理器：支援隨機配對、建立房間與加入房間。"""
import random  # 用於產生隨機房間 ID


def gen_room_id():  # 產生房間 ID 函式
    return str(random.randint(100000, 999999))  # 返回 6 位隨機數字組成的房間 ID


class MatchManager:  # 配對管理器類別
    def __init__(self):  # 初始化函式
        self.random_queue = []  # 存放等待隨機配對的玩家
        self.room_waiting = {}  # 存放等待對手的房間（鑰匙為房間 ID）

    def enqueue_random(self, ws, on_match):  # 加入隨機配對佇列函式
        self.random_queue.append({'ws': ws, 'on_match': on_match})  # 將玩家添加到佇列
        print(f"[Match] 隨機佇列加入: {ws.player_name}, 佇列長度: {len(self.random_queue)}")  # 列印加入訊息
        if len(self.random_queue) >= 2:  # 如果佇列中至少有 2 位玩家
            e1 = self.random_queue.pop(0)  # 取出第一位玩家
            e2 = self.random_queue.pop(0)  # 取出第二位玩家
            room_id = gen_room_id()  # 產生房間 ID
            print(f"[Match] 隨機配對成功: {e1['ws'].player_name} vs {e2['ws'].player_name}, room={room_id}")  # 列印配對成功訊息
            e1['on_match'](e1['ws'], e2['ws'], room_id)  # 呼叫配對成功的回調函式

    def create_room(self, ws, room_id, on_match):  # 建立房間函式
        if room_id in self.room_waiting:  # 如果房間 ID 已存在
            print(f"[Match] 房號 {room_id} 已存在")  # 列印房號重複訊息
            return False  # 返回 False 表示建立失敗
        self.room_waiting[room_id] = {'ws': ws, 'on_match': on_match}  # 將房間添加到等待列表
        print(f"[Match] 建立房間 {room_id}，等待對手: {ws.player_name}")  # 列印建立房間訊息
        return True  # 返回 True 表示建立成功

    def join_room(self, ws, room_id, on_match):  # 加入房間函式
        entry = self.room_waiting.get(room_id)  # 尋找房間
        if not entry:  # 如果房間不存在
            print(f"[Match] 找不到房間 {room_id}")  # 列印房間不存在訊息
            return False  # 返回 False 表示加入失敗
        self.room_waiting.pop(room_id, None)  # 從等待列表移除房間
        print(f"[Match] 房間 {room_id} 配對成功: {entry['ws'].player_name} vs {ws.player_name}")  # 列印配對成功訊息
        entry['on_match'](entry['ws'], ws, room_id)  # 呼叫配對成功的回調函式
        return True  # 返回 True 表示加入成功

    def remove_from_queue(self, ws):  # 從佇列移除玩家函式
        self.random_queue = [e for e in self.random_queue if e['ws'] != ws]  # 移除該玩家的佇列項目
        print(f"[Match] 從隨機佇列移除: {ws.player_name}")  # 列印移除訊息

        for room_id, entry in list(self.room_waiting.items()):  # 遍歷所有等待房間
            if entry['ws'] == ws:  # 如果房間創建者是該玩家
                self.room_waiting.pop(room_id, None)  # 從等待列表移除房間
                print(f"[Match] 房間 {room_id} 建立者離開")  # 列印房間刪除訊息
                break  # 跳出迴圈
