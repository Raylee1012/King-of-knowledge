/**
 * server.js - 知識王主伺服器
 * 啟動時從 Supabase 載入題庫，之後用 WebSocket 處理配對與遊戲
 * 啟動方式: node server/server.js
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { MatchManager } = require('./matchManager');
const { GameRoom } = require('./gameRoom');
const { loadQuestions } = require('./db');

const PORT = process.env.PORT || 3000;

// ── HTTP + 靜態檔案 ──────────────────────────────────────
const app = express();
app.use(express.static(path.join(__dirname, '../client')));

// 健康檢查端點（Railway 用）
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);

// ── WebSocket 伺服器 ─────────────────────────────────────
const wss = new WebSocket.Server({ server });

const matchManager = new MatchManager();
const rooms = new Map(); // roomId → GameRoom

// 題庫（從 Supabase 載入後存放在此）
let QUESTIONS = [];

// ── 連線處理 ────────────────────────────────────────────
wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).slice(2, 9);
  ws.isAlive = true;
  console.log(`[Server] 新連線: ${ws.id}`);

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    console.log(`[Server] 斷線: ${ws.id} (${ws.playerName || '未命名'})`);
    matchManager.removeFromQueue(ws);

    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      room.handleDisconnect(ws.id);
      if (room.isEmpty()) rooms.delete(ws.roomId);
    }
  });
});

// ── 訊息路由 ────────────────────────────────────────────
function handleMessage(ws, msg) {
  switch (msg.type) {

    // 隨機配對：先送 queued 讓前端進等待畫面，再加入佇列
    // 順序重要：先送 queued，enqueue 觸發的 game_start 才會在 queued 之後送到
    case 'join_queue': {
      ws.playerName = (msg.name || '玩家').slice(0, 12);
      send(ws, { type: 'queued' });
      matchManager.enqueueRandom(ws, (p1, p2, roomId) => {
        startRoom(p1, p2, roomId);
      });
      break;
    }

    // 建立私人房間：先送 room_created 讓前端顯示房號，再加入等待表
    case 'create_room': {
      ws.playerName = (msg.name || '玩家').slice(0, 12);
      const roomId = genRoomId();
      send(ws, { type: 'room_created', roomId });
      matchManager.createRoom(ws, roomId, (p1, p2, rid) => {
        startRoom(p1, p2, rid);
      });
      break;
    }

    // 加入私人房間
    case 'join_room': {
      ws.playerName = (msg.name || '玩家').slice(0, 12);
      const roomId = (msg.roomId || '').trim();
      if (!roomId) { send(ws, { type: 'error', message: '請輸入房號' }); return; }

      const ok = matchManager.joinRoom(ws, roomId, (p1, p2, rid) => {
        startRoom(p1, p2, rid);
      });

      if (!ok) send(ws, { type: 'error', message: '找不到此房間，請確認房號' });
      break;
    }

    // 取消等待
    case 'cancel_queue': {
      matchManager.removeFromQueue(ws);
      send(ws, { type: 'cancelled' });
      break;
    }

    // 提交答案
    case 'submit_answer': {
      if (!ws.roomId || !rooms.has(ws.roomId)) return;
      rooms.get(ws.roomId).submitAnswer(ws.id, msg.answerIdx, msg.usedSec);
      break;
    }

    default:
      console.warn('[Server] 未知訊息:', msg.type);
  }
}

// ── 建立遊戲房間 ─────────────────────────────────────────
function startRoom(p1, p2, roomId) {
  p1.roomId = roomId;
  p2.roomId = roomId;

  // 若題庫不足10題，取全部
  const room = new GameRoom(roomId, p1, p2, QUESTIONS, () => {
    rooms.delete(roomId);
  });

  rooms.set(roomId, room);
  room.start();

  console.log(`[Server] 遊戲開始 room=${roomId}: ${p1.playerName} vs ${p2.playerName} (題庫${QUESTIONS.length}題)`);
}

// ── 心跳：每30秒 ping，移除死連線 ───────────────────────
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// ── 工具 ─────────────────────────────────────────────────
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function genRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── 啟動：先載入題庫，成功後才監聽 ─────────────────────
async function bootstrap() {
  console.log('[Server] 載入 Supabase 題庫...');
  try {
    QUESTIONS = await loadQuestions();
    console.log(`[Server] 題庫就緒，共 ${QUESTIONS.length} 題`);
  } catch (err) {
    console.error('[Server] 題庫載入失敗:', err.message);
    console.error('請確認環境變數 SUPABASE_DB_URL 是否正確設定');
    process.exit(1); // 題庫載入失敗則停止伺服器
  }

  server.listen(PORT, () => {
    console.log(`[Server] 知識王伺服器啟動: http://localhost:${PORT}`);
  });
}

bootstrap();
