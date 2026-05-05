/**
 * gameRoom.js - 遊戲房間
 *
 * 每個房間管理一場兩人對戰：
 *   - 同步發題（雙方同時看到同一題）
 *   - 收集雙方答案，10 秒後統一結算
 *   - 即時廣播對手的作答狀態（不揭露答案）
 *   - 10 題結束後廣播結算資料
 */

const WebSocket = require('ws');

// 每題作答時限（毫秒）
const QUESTION_TIMEOUT = 10000;
// 每題結算後顯示答案的緩衝時間（毫秒）
const RESULT_DELAY = 1500;
// 每場抽出的題數
const QUESTIONS_PER_GAME = 10;

class GameRoom {
  /**
   * @param {string} roomId
   * @param {WebSocket} p1
   * @param {WebSocket} p2
   * @param {Array} questionBank - 完整題庫
   * @param {Function} onEnd     - 遊戲結束回呼
   */
  constructor(roomId, p1, p2, questionBank, onEnd) {
    this.roomId = roomId;
    this.players = [p1, p2];           // 索引 0=p1, 1=p2
    this.onEnd = onEnd;

    // 隨機抽題
    this.questions = sampleQuestions(questionBank, QUESTIONS_PER_GAME);

    // 每位玩家的狀態
    this.scores = [0, 0];              // 累積分數
    this.answers = [null, null];       // 本題答案 {answerIdx, usedSec} | null=未作答
    this.answered = [false, false];    // 本題是否已提交

    this.currentQ = 0;                 // 當前題目索引 (0–9)
    this.questionTimer = null;         // 題目倒數計時器
    this.ended = false;                // 防止重複結算
  }

  // ── 開始遊戲 ──────────────────────────────────────────
  start() {
    // 通知雙方遊戲開始，附帶對手資訊
    this.players.forEach((p, i) => {
      const opp = this.players[1 - i];
      this._send(p, {
        type: 'game_start',
        roomId: this.roomId,
        playerIndex: i,            // 0 或 1，用於前端識別自己
        myName: p.playerName,
        opponentName: opp.playerName,
        totalQuestions: QUESTIONS_PER_GAME,
      });
    });

    // 短暫延遲後發第一題
    setTimeout(() => this._sendQuestion(), 1500);
  }

  // ── 發送當前題目 ──────────────────────────────────────
  _sendQuestion() {
    if (this.currentQ >= this.questions.length) {
      this._endGame();
      return;
    }

    const q = this.questions[this.currentQ];

    // 重置本題作答狀態
    this.answers = [null, null];
    this.answered = [false, false];

    this._broadcast({
      type: 'question',
      index: this.currentQ,
      total: QUESTIONS_PER_GAME,
      question: q.q,
      options: q.opts,
      // 注意：不發送正確答案給前端，防止作弊
    });

    // 10 秒後強制結算
    this.questionTimer = setTimeout(() => {
      this._resolveQuestion();
    }, QUESTION_TIMEOUT);
  }

  // ── 玩家提交答案 ──────────────────────────────────────
  /**
   * @param {string} playerId  - ws.id
   * @param {number} answerIdx - 選擇的選項索引 (0–3)，-1=超時
   * @param {number} usedSec   - 使用秒數（前端計算）
   */
  submitAnswer(playerId, answerIdx, usedSec) {
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1 || this.answered[playerIdx]) return;

    this.answered[playerIdx] = true;
    this.answers[playerIdx] = { answerIdx, usedSec: Math.min(10, Math.max(0, usedSec)) };

    // 通知對手「對方已作答」（不揭露答案）
    const opponent = this.players[1 - playerIdx];
    this._send(opponent, { type: 'opponent_answered' });

    // 若雙方都提交，提前結算
    if (this.answered[0] && this.answered[1]) {
      clearTimeout(this.questionTimer);
      this._resolveQuestion();
    }
  }

  // ── 結算本題 ──────────────────────────────────────────
  _resolveQuestion() {
    const q = this.questions[this.currentQ];
    const results = [];

    // 計算每位玩家本題得分
    this.players.forEach((p, i) => {
      const ans = this.answers[i];
      const answerIdx = ans ? ans.answerIdx : -1;   // -1=超時
      const usedSec = ans ? ans.usedSec : 10;
      const correct = answerIdx === q.ans;
      const gained = correct ? calcScore(usedSec) : 0;

      this.scores[i] += gained;

      results.push({ playerIndex: i, answerIdx, correct, gained, usedSec });
    });

    // 廣播本題結果（包含正確答案）
    this._broadcast({
      type: 'question_result',
      index: this.currentQ,
      correctAns: q.ans,
      results,
      scores: [...this.scores],
    });

    // 延遲後進入下一題或結算
    setTimeout(() => {
      this.currentQ++;
      if (this.currentQ < QUESTIONS_PER_GAME) {
        this._sendQuestion();
      } else {
        this._endGame();
      }
    }, RESULT_DELAY);
  }

  // ── 遊戲結束，廣播結算 ────────────────────────────────
  _endGame() {
    if (this.ended) return;
    this.ended = true;

    const [s0, s1] = this.scores;
    let winner = null;
    if (s0 > s1) winner = 0;
    else if (s1 > s0) winner = 1;
    // winner=null 表示平局

    this._broadcast({
      type: 'game_end',
      scores: [...this.scores],
      winner,
      playerNames: this.players.map(p => p.playerName),
    });

    this.onEnd();
    console.log(`[GameRoom ${this.roomId}] 結束. 分數: ${s0} vs ${s1}`);
  }

  // ── 處理斷線 ──────────────────────────────────────────
  handleDisconnect(playerId) {
    if (this.ended) return;
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return;

    clearTimeout(this.questionTimer);
    this.ended = true;

    // 通知對手對方已離線
    const opponent = this.players[1 - playerIdx];
    this._send(opponent, {
      type: 'opponent_disconnected',
      message: '對手已斷線，本局結束',
    });

    this.onEnd();
  }

  // ── 是否雙方都已離線 ──────────────────────────────────
  isEmpty() {
    return this.players.every(p => p.readyState !== WebSocket.OPEN);
  }

  // ── 私有工具：向單一玩家發送 ─────────────────────────
  _send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // ── 私有工具：廣播給房間所有玩家 ─────────────────────
  _broadcast(data) {
    this.players.forEach(p => this._send(p, data));
  }
}

// ── 工具函式 ──────────────────────────────────────────

// 計分：答對得 150 + 速度加分（最多+50），答對即可得150~200
function calcScore(usedSec) {
  const bonus = Math.round(50 - (usedSec / 10) * 50);
  return 150 + Math.max(0, bonus);
}

// 從題庫隨機不重複抽出 n 題
function sampleQuestions(bank, n) {
  return [...bank].sort(() => Math.random() - 0.5).slice(0, n);
}

module.exports = { GameRoom };
