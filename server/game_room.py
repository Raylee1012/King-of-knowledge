"""GameRoom: 每個房間管理一場兩人對戰。"""
import json  # 用於 JSON 序列化
import random  # 用於隨機選擇題目和道具
import threading  # 用於多執行緒計時器
import time  # 用於記錄題目開始時間

QUESTION_TIMEOUT = 10  # 每題的時間限制（秒）
RESULT_DELAY = 1.5  # 題目結算後等待時間（秒）
QUESTIONS_PER_GAME = 10  # 每場遊戲的題目數


class GameRoom:  # 遊戲房間類別
    def __init__(self, room_id, p1, p2, question_bank, daily_categories, on_end):  # 初始化函式
        self.room_id = room_id  # 房間 ID
        self.players = [p1, p2]  # 玩家列表 [玩家1, 玩家2]
        self.daily_categories = set(daily_categories)  # 今日挑戰主題分類集合
        self.on_end = on_end  # 遊戲結束時的回調函式
        self.questions = self.sample_questions(question_bank, QUESTIONS_PER_GAME)  # 從題庫中隨機抽取題目
        self.scores = [0, 0]  # 兩位玩家的分數
        self.answers = [None, None]  # 記錄兩位玩家的答案
        self.answered = [False, False]  # 記錄兩位玩家是否已作答
        self.removed_options = [set(), set()]  # 記錄兩位玩家刪除的選項
        self.current_q = 0  # 當前題目索引
        self.question_timer = None  # 題目計時器
        self.question_start_time = 0  # 題目開始的時間戳
        self.player_time_limit = [QUESTION_TIMEOUT, QUESTION_TIMEOUT]  # 各玩家本題時間上限
        self.skill_time_notified = [False, False]  # 是否已通知該玩家對手使用了加時道具
        self.ended = False  # 遊戲是否已結束
        self.question_resolved = False  # 當前題目是否已結算（防止 race condition 導致雙重結算）
        # 初始化題目分類統計，格式：{ 'category': { 'correct': 0, 'wrong': 0 } }
        self.topic_stats = [{}, {}]  # 兩位玩家各自的題目分類統計

    def start(self):  # 啟動遊戲函式
        for i, p in enumerate(self.players):  # 遍歷兩位玩家
            opp = self.players[1 - i]  # 取得對手
            self._send(p, {  # 發送遊戲開始訊息
                'type': 'game_start',  # 訊息類型
                'roomId': self.room_id,  # 房間 ID
                'playerIndex': i,  # 玩家索引（0 或 1）
                'myName': p.player_name,  # 我的名稱
                'opponentName': opp.player_name,  # 對手名稱
                'opponentUserId': getattr(opp, 'user_id', None),  # 對手用戶 ID（Bot 無此欄位）
                'opponentEmoji': getattr(opp, 'equipped_emoji', '🧠'),  # 對手 emoji 頭貼（Bot 為 🤖）
                'totalQuestions': QUESTIONS_PER_GAME,  # 總題數
            })

        threading.Timer(1.5, self._send_question).start()  # 1.5 秒後開始發送第一題

    def _send_question(self):  # 發送題目函式
        if self.ended:  # 如果遊戲已結束
            return  # 函式結束
        if self.current_q >= len(self.questions):  # 如果已超過題目數量
            self._end_game()  # 結束遊戲
            return  # 函式結束

        q = self.questions[self.current_q]  # 取得當前題目
        self.answers = [None, None]  # 重置答案
        self.answered = [False, False]  # 重置作答狀態
        self.removed_options = [set(), set()]  # 重置已刪除選項
        self.player_time_limit = [QUESTION_TIMEOUT, QUESTION_TIMEOUT]  # 重置各玩家時間上限
        self.skill_time_notified = [False, False]  # 重置加時通知旗標
        self.question_resolved = False  # 重置結算旗標
        category = q.get('category', '一般')
        is_daily = category in self.daily_categories

        for i, p in enumerate(self.players):  # 遍歷兩位玩家
            self._send(p, {  # 發送題目訊息
                'type': 'question',  # 訊息類型
                'index': self.current_q,  # 題目索引
                'total': QUESTIONS_PER_GAME,  # 總題數
                'question': q['q'],  # 題目文本
                'options': q['opts'],  # 選項列表
                'category': category,  # 題目分類
                'isDaily': is_daily,  # 是否為今日挑戰主題（答對 x2 分）
            })

        self.question_start_time = time.time()  # 記錄題目開始時間
        self.question_timer = threading.Timer(QUESTION_TIMEOUT, self._resolve_question)  # 建立計時器
        self.question_timer.start()  # 啟動計時器

        for i, p in enumerate(self.players):  # 若房間內有機器人，模擬機器人作答
            if getattr(p, 'is_bot', False):
                think_time = random.uniform(2.0, 8.0)  # 機器人等待 2-8 秒再作答
                threading.Timer(think_time, self._bot_answer, args=(p.id, think_time)).start()

    def submit_answer(self, player_id, answer_idx, used_sec):  # 提交答案函式
        player_idx = self._find_player_index(player_id)  # 尋找玩家索引
        if player_idx == -1 or self.answered[player_idx] or self.ended:  # 如果玩家無效、已作答或遊戲已結束
            return  # 函式結束

        self.answered[player_idx] = True  # 標記玩家已作答
        self.answers[player_idx] = {  # 儲存答案
            'answerIdx': answer_idx,  # 答案選項索引
            'usedSec': max(0, min(self.player_time_limit[player_idx], used_sec)),  # 用時（限制在玩家自身時間上限內）
        }

        opponent = self.players[1 - player_idx]  # 取得對手
        self._send(opponent, {'type': 'opponent_answered'})  # 通知對手已作答

        if self.answered[0] and self.answered[1]:  # 如果雙方都已作答
            if self.question_timer:  # 如果計時器存在
                self.question_timer.cancel()  # 取消計時器
            self._resolve_question()  # 立即結算題目

    def use_item(self, player_id, item_name):  # 使用道具函式
        player_idx = self._find_player_index(player_id)  # 尋找玩家索引
        if player_idx == -1 or self.ended:  # 如果玩家無效或遊戲已結束
            return  # 函式結束

        if self.answered[player_idx]:  # 如果玩家已作答
            self._send(self.players[player_idx], {  # 發送錯誤訊息
                'type': 'item_error',  # 訊息類型
                'message': '已作答後無法使用道具',  # 錯誤訊息
            })
            return  # 函式結束

        if item_name != 'delete_wrong':  # 如果道具名稱不是 'delete_wrong'
            self._send(self.players[player_idx], {  # 發送錯誤訊息
                'type': 'item_error',  # 訊息類型
                'message': '未知的道具類型',  # 錯誤訊息
            })
            return  # 函式結束

        current = self.questions[self.current_q]  # 取得當前題目
        wrong_indices = [i for i in range(len(current['opts']))  # 找出所有錯誤選項
                if i != current['ans'] and i not in self.removed_options[player_idx]]  # 排除正確答案和已刪除選項
        if not wrong_indices:  # 如果沒有可刪除的選項
            self._send(self.players[player_idx], {  # 發送錯誤訊息
                'type': 'item_error',  # 訊息類型
                'message': '已無可刪除的錯誤選項',  # 錯誤訊息
            })
            return  # 函式結束

        removed_idx = random.choice(wrong_indices)  # 隨機選擇一個錯誤選項刪除
        self.removed_options[player_idx].add(removed_idx)  # 將選項標記為已刪除
        self._send(self.players[player_idx], {  # 發送道具使用成功訊息
            'type': 'item_used',  # 訊息類型
            'item': 'delete_wrong',  # 道具名稱
            'removedOptionIdx': removed_idx,  # 已刪除的選項索引
            })

    def use_skill_time(self, player_id):  # 玩家使用加時道具
        player_idx = self._find_player_index(player_id)
        if player_idx == -1 or self.answered[player_idx] or self.ended:
            return

        self.player_time_limit[player_idx] += 10  # 延長該玩家本題時間上限 10 秒

        # 重新計算計時器：以尚未作答的玩家中，最早到期的時間為準
        elapsed = time.time() - self.question_start_time
        if self.question_timer:
            self.question_timer.cancel()
        min_remaining = None
        for i in range(2):
            if not self.answered[i]:
                remaining = self.player_time_limit[i] - elapsed
                if remaining > 0 and (min_remaining is None or remaining < min_remaining):
                    min_remaining = remaining
        if min_remaining and min_remaining > 0:
            self.question_timer = threading.Timer(min_remaining, self._resolve_question)
            self.question_timer.start()
        else:
            self._resolve_question()

    def _bot_answer(self, bot_id, used_sec):  # 機器人自動作答函式
        if self.ended:  # 若遊戲已結束，則不再作答
            return
        player_idx = self._find_player_index(bot_id)  # 取得機器人索引
        if player_idx == -1 or self.answered[player_idx]:  # 若機器人已作答或不在房間
            return

        valid_opts = [i for i in range(4) if i not in self.removed_options[player_idx]]  # 可選擇的選項
        answer_idx = random.choice(valid_opts) if valid_opts else random.randint(0, 3)  # 隨機選擇答案
        self.submit_answer(bot_id, answer_idx, used_sec)  # 提交機器人答案
        print(f"[Bot] 機器人選擇了選項 {answer_idx}，耗時 {used_sec:.1f} 秒")

    def _resolve_question(self):  # 結算題目函式
        if self.ended:  # 若遊戲已結束
            return  # 函式結束

        # 若有玩家使用加時道具，且尚未作答且還有剩餘時間，先等該玩家
        elapsed = time.time() - self.question_start_time
        earliest_remaining = None
        for i in range(2):
            if not self.answered[i]:
                remaining = self.player_time_limit[i] - elapsed
                if remaining > 0.1:  # 還有超過 100ms，值得等待
                    if earliest_remaining is None or remaining < earliest_remaining:
                        earliest_remaining = remaining
        if earliest_remaining is not None:
            # 通知已做完（作答或逾時）但對手還有剩餘加時的玩家
            for i in range(2):
                if self.skill_time_notified[i]:
                    continue
                i_done = self.answered[i] or (self.player_time_limit[i] - elapsed <= 0.1)
                opp_still_going = (
                    not self.answered[1 - i] and
                    self.player_time_limit[1 - i] - elapsed > 0.1
                )
                if i_done and opp_still_going:
                    self._send(self.players[i], {'type': 'opponent_used_skill_time'})
                    self.skill_time_notified[i] = True
            self.question_timer = threading.Timer(earliest_remaining, self._resolve_question)
            self.question_timer.start()
            return
        if self.question_resolved:  # 防止 race condition：計時器與 submit_answer 同時觸發時只結算一次
            return
        self.question_resolved = True

        q = self.questions[self.current_q]  # 取得當前題目
        category = q.get('category', '一般')  # 取得題目分類
        is_daily = category in self.daily_categories  # 是否為今日主題
        results = []  # 儲存結算結果
        for i in range(2):  # 遍歷兩位玩家
            ans = self.answers[i]  # 取得玩家的答案
            answer_idx = ans['answerIdx'] if ans else -1  # 提取答案選項索引，如未作答則為 -1
            used_sec = ans['usedSec'] if ans else QUESTION_TIMEOUT  # 提取用時，如未作答則為 10 秒
            correct = answer_idx == q['ans']  # 判斷答案是否正確
            gained = self.calc_score(used_sec) if correct else 0  # 計算得分，錯誤則為 0
            if correct and is_daily:
                gained *= 2  # 今日主題答對得分 x2
            self.scores[i] += gained  # 累加玩家分數
            
            # 更新題目分類統計
            if category not in self.topic_stats[i]:
                self.topic_stats[i][category] = {'correct': 0, 'wrong': 0}
            if correct:
                self.topic_stats[i][category]['correct'] += 1
            else:
                self.topic_stats[i][category]['wrong'] += 1
            
            results.append({  # 添加結果到列表
                'playerIndex': i,  # 玩家索引
                'answerIdx': answer_idx,  # 玩家答案
                'correct': correct,  # 是否正確
                'gained': gained,  # 獲得的分數
                'usedSec': used_sec,  # 用時
            })

        self._broadcast({  # 向雙方播送結算訊息
            'type': 'question_result',  # 訊息類型
            'index': self.current_q,  # 題目索引
            'correctAns': q['ans'],  # 正確答案
            'results': results,  # 結果列表
            'scores': list(self.scores),  # 當前分數
            'isDaily': is_daily,  # 是否為今日主題
        })

        threading.Timer(RESULT_DELAY, self._next_question).start()  # 1.5 秒後進行下一題

    def _next_question(self):  # 進行下一題函式
        if self.ended:  # 如果遊戲已結束
            return  # 函式結束
        self.current_q += 1  # 題目索引加 1
        if self.current_q < QUESTIONS_PER_GAME:  # 如果還有題目
            self._send_question()  # 發送下一題
        else:  # 如果已超過題目數量
            self._end_game()  # 結束遊戲

    def _end_game(self):  # 結束遊戲函式
        if self.ended:  # 如果遊戲已結束
            return  # 函式結束
        self.ended = True  # 標記遊戲已結束
        winner = None  # 初始化勝者為 None（平局）
        if self.scores[0] > self.scores[1]:  # 如果玩家 1 分數更高
            winner = 0  # 玩家 1 獲勝
        elif self.scores[1] > self.scores[0]:  # 如果玩家 2 分數更高
            winner = 1  # 玩家 2 獲勝

        self._broadcast({  # 向雙方播送遊戲結束訊息
            'type': 'game_end',  # 訊息類型
            'scores': list(self.scores),  # 最終分數
            'winner': winner,  # 勝者（0、1 或 None）
            'playerNames': [p.player_name for p in self.players],  # 玩家名稱
            'topicStats': self.topic_stats,  # 題目分類統計（兩位玩家的統計）
        })
        self.on_end()  # 呼叫遊戲結束回調函式
        print(f"[GameRoom {self.room_id}] 結束. 分數: {self.scores[0]} vs {self.scores[1]}")  # 列印遊戲結束訊息

    def handle_disconnect(self, player_id):  # 處理玩家斷線函式
        if self.ended:  # 如果遊戲已結束
            return  # 函式結束
        player_idx = self._find_player_index(player_id)  # 尋找玩家索引
        if player_idx == -1:  # 如果玩家無效
            return  # 函式結束

        self.ended = True  # 標記遊戲已結束
        if self.question_timer:  # 如果計時器存在
            self.question_timer.cancel()  # 取消計時器

        opponent = self.players[1 - player_idx]  # 取得對手
        self._send(opponent, {  # 發送對手斷線訊息
            'type': 'opponent_disconnected',  # 訊息類型
            'message': '對手已斷線，本局結束',  # 訊息內容
        })
        self.on_end()  # 呼叫遊戲結束回調函式

    def is_empty(self):  # 檢查房間是否為空函式
        return all(getattr(p, 'closed', False) or getattr(p, 'closed', None) for p in self.players)  # 如果所有玩家都已斷線則返回 True

    def _find_player_index(self, player_id):  # 尋找玩家索引函式
        for idx, p in enumerate(self.players):  # 遍歷玩家列表
            if getattr(p, 'id', None) == player_id:  # 如果找到匹配的玩家 ID
                return idx  # 返回索引
        return -1  # 如果未找到返回 -1

    def _send(self, ws, data):  # 發送訊息給玩家函式
        try:  # 開始 try 區塊
            ws.send(json.dumps(data))  # 將數據轉為 JSON 字符串並發送
        except Exception:  # 如果發送失敗
            pass  # 忽略錯誤

    def _broadcast(self, data):  # 向雙方播送訊息函式
        for p in self.players:  # 遍歷兩位玩家
            self._send(p, data)  # 發送訊息給每位玩家

    @staticmethod  # 靜態方法裝飾器
    def calc_score(used_sec):  # 計算分數的靜態方法
        bonus = round(50 - (used_sec / QUESTION_TIMEOUT) * 50)  # 根據用時計算獎勵分數
        return 150 + max(0, bonus)  # 返回基礎 150 分加獎勵分數（最少 150）

    @staticmethod  # 靜態方法裝飾器
    def sample_questions(bank, n):  # 從題庫中隨機抽取題目的靜態方法
        if len(bank) <= n:  # 如果題庫數量少於需要數量
            return bank.copy()  # 返回題庫副本
        selected = bank.copy()  # 複製題庫
        random.shuffle(selected)  # 隨機打亂順序
        return selected[:n]  # 返回前 n 個題目