/**
 * matchManager.js - 配對管理器
 *
 * 三種入口，邏輯完全分離：
 *   enqueueRandom(ws, onMatch)        隨機配對
 *   createRoom(ws, roomId, onMatch)   建立指定房間並等待
 *   joinRoom(ws, roomId, onMatch)     加入指定房間
 *
 * onMatch(p1, p2, roomId) 配對成功時觸發
 */

class MatchManager {
  constructor() {
    // 隨機配對佇列
    this.randomQueue = [];

    // 指定房間等待表：roomId → { ws, onMatch }
    this.roomWaiting = new Map();
  }

  // ── 隨機配對 ─────────────────────────────────────────────
  enqueueRandom(ws, onMatch) {
    this.randomQueue.push({ ws, onMatch });
    console.log(`[Match] 隨機佇列加入: ${ws.playerName}，佇列長度: ${this.randomQueue.length}`);

    if (this.randomQueue.length >= 2) {
      const e1 = this.randomQueue.shift();
      const e2 = this.randomQueue.shift();
      const roomId = genRoomId();
      console.log(`[Match] 隨機配對成功: ${e1.ws.playerName} vs ${e2.ws.playerName}, room=${roomId}`);
      e1.onMatch(e1.ws, e2.ws, roomId);
    }
  }

  // ── 建立指定房間：加入等待表 ─────────────────────────────
  createRoom(ws, roomId, onMatch) {
    if (this.roomWaiting.has(roomId)) {
      console.warn(`[Match] 房號 ${roomId} 已存在`);
      return false;
    }
    this.roomWaiting.set(roomId, { ws, onMatch });
    console.log(`[Match] 建立房間 ${roomId}，等待對手: ${ws.playerName}`);
    return true;
  }

  // ── 加入指定房間：找到等待者後配對 ──────────────────────
  joinRoom(ws, roomId, onMatch) {
    if (!this.roomWaiting.has(roomId)) {
      console.log(`[Match] 找不到房間 ${roomId}`);
      return false;
    }
    const host = this.roomWaiting.get(roomId);
    this.roomWaiting.delete(roomId);
    console.log(`[Match] 房間 ${roomId} 配對成功: ${host.ws.playerName} vs ${ws.playerName}`);
    host.onMatch(host.ws, ws, roomId);
    return true;
  }

  // ── 移除玩家（斷線或取消）────────────────────────────────
  removeFromQueue(ws) {
    const idx = this.randomQueue.findIndex(e => e.ws === ws);
    if (idx !== -1) {
      this.randomQueue.splice(idx, 1);
      console.log(`[Match] 從隨機佇列移除: ${ws.playerName}`);
    }

    for (const [roomId, entry] of this.roomWaiting.entries()) {
      if (entry.ws === ws) {
        this.roomWaiting.delete(roomId);
        console.log(`[Match] 房間 ${roomId} 建立者離開`);
        break;
      }
    }
  }
}

// 產生 6 位隨機房號
function genRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { MatchManager };
