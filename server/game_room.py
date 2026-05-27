"""GameRoom: 每個房間管理一場兩人對戰。"""
import json
import random
import threading

QUESTION_TIMEOUT = 10
RESULT_DELAY = 1.5
QUESTIONS_PER_GAME = 10
ITEM_MAX_USES = 2


class GameRoom:
    def __init__(self, room_id, p1, p2, question_bank, on_end):
        self.room_id = room_id
        self.players = [p1, p2]
        self.on_end = on_end
        self.questions = self.sample_questions(question_bank, QUESTIONS_PER_GAME)
        self.scores = [0, 0]
        self.answers = [None, None]
        self.answered = [False, False]
        self.item_uses_left = [ITEM_MAX_USES, ITEM_MAX_USES]
        self.removed_options = [set(), set()]
        self.current_q = 0
        self.question_timer = None
        self.ended = False

    def start(self):
        for i, p in enumerate(self.players):
            opp = self.players[1 - i]
            self._send(p, {
                'type': 'game_start',
                'roomId': self.room_id,
                'playerIndex': i,
                'myName': p.player_name,
                'opponentName': opp.player_name,
                'totalQuestions': QUESTIONS_PER_GAME,
            })

        threading.Timer(1.5, self._send_question).start()

    def _send_question(self):
        if self.current_q >= len(self.questions):
            self._end_game()
            return

        q = self.questions[self.current_q]
        self.answers = [None, None]
        self.answered = [False, False]
        self.removed_options = [set(), set()]

        for i, p in enumerate(self.players):
            self._send(p, {
                'type': 'question',
                'index': self.current_q,
                'total': QUESTIONS_PER_GAME,
                'question': q['q'],
                'options': q['opts'],
                'itemUsesLeft': self.item_uses_left[i],
            })

        self.question_timer = threading.Timer(QUESTION_TIMEOUT, self._resolve_question)
        self.question_timer.start()
        # === 機器人作答邏輯 ===
        for i, p in enumerate(self.players):
            if getattr(p, 'is_bot', False):
                think_time = random.uniform(2.0, 8.0)
                threading.Timer(think_time, self._bot_answer, args=(p.id, think_time)).start()

    def submit_answer(self, player_id, answer_idx, used_sec):
        player_idx = self._find_player_index(player_id)
        if player_idx == -1 or self.answered[player_idx] or self.ended:
            return

        self.answered[player_idx] = True
        self.answers[player_idx] = {
            'answerIdx': answer_idx,
            'usedSec': max(0, min(QUESTION_TIMEOUT, used_sec)),
        }

        opponent = self.players[1 - player_idx]
        self._send(opponent, {'type': 'opponent_answered'})

        if self.answered[0] and self.answered[1]:
            if self.question_timer:
                self.question_timer.cancel()
            self._resolve_question()

    def use_item(self, player_id, item_name):
        player_idx = self._find_player_index(player_id)
        if player_idx == -1 or self.ended:
            return

        if self.answered[player_idx]:
            self._send(self.players[player_idx], {
                'type': 'item_error',
                'message': '已作答後無法使用道具',
            })
            return

        if item_name != 'delete_wrong':
            self._send(self.players[player_idx], {
                'type': 'item_error',
                'message': '未知的道具類型',
            })
            return

        if self.item_uses_left[player_idx] <= 0:
            self._send(self.players[player_idx], {
                'type': 'item_error',
                'message': '本局已無剩餘刪除錯誤選項道具',
            })
            return

        current = self.questions[self.current_q]
        wrong_indices = [i for i in range(len(current['opts']))
                         if i != current['ans'] and i not in self.removed_options[player_idx]]
        if not wrong_indices:
            self._send(self.players[player_idx], {
                'type': 'item_error',
                'message': '已無可刪除的錯誤選項',
            })
            return

        removed_idx = random.choice(wrong_indices)
        self.removed_options[player_idx].add(removed_idx)
        self.item_uses_left[player_idx] -= 1

        self._send(self.players[player_idx], {
            'type': 'item_used',
            'item': 'delete_wrong',
            'removedOptionIdx': removed_idx,
            'remainingUses': self.item_uses_left[player_idx],
        })
    def _bot_answer(self, bot_id, used_sec):
     if self.ended:
         return
     player_idx = self._find_player_index(bot_id)
     if player_idx != -1 and not self.answered[player_idx]:
         # 避開已經被道具刪除的選項（雖然機器人不會用道具，但防呆一下）
         valid_opts = [i for i in range(4) if i not in self.removed_options[player_idx]]
         random_choice = random.choice(valid_opts) if valid_opts else random.randint(0, 3)

         self.submit_answer(bot_id, random_choice, used_sec)
         print(f"[Bot] 機器人選擇了選項 {random_choice}，耗時 {used_sec:.1f} 秒")
         
    def _resolve_question(self):
        q = self.questions[self.current_q]
        results = []
        for i in range(2):
            ans = self.answers[i]
            answer_idx = ans['answerIdx'] if ans else -1
            used_sec = ans['usedSec'] if ans else QUESTION_TIMEOUT
            correct = answer_idx == q['ans']
            gained = self.calc_score(used_sec) if correct else 0
            self.scores[i] += gained
            results.append({
                'playerIndex': i,
                'answerIdx': answer_idx,
                'correct': correct,
                'gained': gained,
                'usedSec': used_sec,
            })

        self._broadcast({
            'type': 'question_result',
            'index': self.current_q,
            'correctAns': q['ans'],
            'results': results,
            'scores': list(self.scores),
        })

        threading.Timer(RESULT_DELAY, self._next_question).start()

    def _next_question(self):
        self.current_q += 1
        if self.current_q < QUESTIONS_PER_GAME:
            self._send_question()
        else:
            self._end_game()

    def _end_game(self):
        if self.ended:
            return
        self.ended = True
        winner = None
        if self.scores[0] > self.scores[1]:
            winner = 0
        elif self.scores[1] > self.scores[0]:
            winner = 1

        self._broadcast({
            'type': 'game_end',
            'scores': list(self.scores),
            'winner': winner,
            'playerNames': [p.player_name for p in self.players],
        })
        self.on_end()
        print(f"[GameRoom {self.room_id}] 結束. 分數: {self.scores[0]} vs {self.scores[1]}")

    def handle_disconnect(self, player_id):
        if self.ended:
            return
        player_idx = self._find_player_index(player_id)
        if player_idx == -1:
            return

        self.ended = True
        if self.question_timer:
            self.question_timer.cancel()

        opponent = self.players[1 - player_idx]
        self._send(opponent, {
            'type': 'opponent_disconnected',
            'message': '對手已斷線，本局結束',
        })
        self.on_end()

    def is_empty(self):
        return all(getattr(p, 'closed', False) or getattr(p, 'closed', None) for p in self.players)

    def _find_player_index(self, player_id):
        for idx, p in enumerate(self.players):
            if getattr(p, 'id', None) == player_id:
                return idx
        return -1

    def _send(self, ws, data):
        try:
            ws.send(json.dumps(data))
        except Exception:
            pass

    def _broadcast(self, data):
        for p in self.players:
            self._send(p, data)

    @staticmethod
    def calc_score(used_sec):
        bonus = round(50 - (used_sec / QUESTION_TIMEOUT) * 50)
        return 150 + max(0, bonus)

    @staticmethod
    def sample_questions(bank, n):
        if len(bank) <= n:
            return bank.copy()
        selected = bank.copy()
        random.shuffle(selected)
        return selected[:n]
