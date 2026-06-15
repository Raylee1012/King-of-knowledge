// ─── CONFIG ──────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';  // 帳號系統後端（登入、註冊、玩家資料）
const WS_BASE  = 'ws://localhost:4000/ws'; // 對戰系統後端（WebSocket）
const GEN_BASE = 'http://localhost:5000';  // 題庫生成工具（管理員用）

// ─── STATE ──────────────────────────────────────────────
const state = {
  userId: null,  // 登入後存放玩家的 uuid
  email: '',       // 登入後存放玩家的 email
  coins: 0, level: 1, xp: 0, xpMax: 100,
  playerName: '知識戰士', playerTag: '新手', playerTagClass: 'tag-rookie', playerTagIcon: '🌱',  // 預設新手稱號
  equippedFrame: 'frame-none', equippedEmoji: '🧠', activeEffect: null,  // 預設無邊框
  owned: { frames: ['frame-none'], tags: ['tag-rookie'], effects: [] },  // 預設只有無邊框和新手稱號
  wins: 0, losses: 0,
  topicStats: {
    '🔬 科學':22,'🌍 地理':18,'📚 歷史':15,'🎮 電競':20,'🎵 音樂':12,
    '🎬 電影':8,'⚽ 體育':10,'🖥️ 科技':25,'🍜 美食':6,'🐾 動物':9,
    '🌿 植物':5,'🚀 航太':14,'💡 發明':11,'🎨 藝術':7,'🧪 化學':16,
    '📐 數學':19,'🌊 海洋':8,'🦁 生態':10,'🏛️ 政治':13,'💰 經濟':17,'🔭 天文':11
  },
  recentScores: [680,520,790,640,720,580,810,670,750,820],
  recentAccuracy: [72,65,83,70,78,62,88,74,80,85],
  battleData: { round:0, playerScore:0, oppScore:0, correct:0, total:0, timer:null, timerVal:15, combo:0, answering:false },
  skills: { used50: false, usedTime: false, usedHint: false },
  totalAnswered: 0,  // 累計答題數，從後端同步
  avgAccuracy: 0,    // 平均準確率，從後端同步
  totalScore: 0      // 累計積分，從後端同步
};


// ─── SHOP DATA ───────────────────────────────────────────
const shopData = {
  frames: [
    {id:'frame-none',name:'無邊框',desc:'標準外觀',price:0,preview:'⬜',class:''},
    {id:'frame-gold',name:'黃金戰士',desc:'閃耀黃金光芒',price:200,preview:'🟡',class:'frame-gold'},
    {id:'frame-diamond',name:'鑽石冠軍',desc:'藍色旋轉鑽石框',price:500,preview:'💎',class:'frame-diamond'},
    {id:'frame-fire',name:'火焰王者',desc:'橘紅火焰特效',price:800,preview:'🔥',class:'frame-fire'},
    {id:'frame-rainbow',name:'彩虹傳說',desc:'七彩漸變框（稀有）',price:1500,preview:'🌈',class:'frame-rainbow'},
  ],
  tags: [
    {id:'tag-rookie',name:'新手',desc:'剛入門的稱號',price:0,preview:'🌱',class:'tag-rookie'},
    {id:'tag-apprentice',name:'學徒',desc:'開始累積知識的挑戰者',price:150,preview:'📘',class:'tag-apprentice'},
    {id:'tag-expert',name:'專家',desc:'熟練掌握多種主題',price:450,preview:'🎯',class:'tag-expert'},
    {id:'tag-master',name:'大師',desc:'知識的探索者',price:800,preview:'⭐',class:'tag-master'},
    {id:'tag-legend',name:'傳說',desc:'頂尖知識戰士',price:1500,preview:'🏆',class:'tag-legend'},
    {id:'tag-king',name:'知識王',desc:'最高榮耀稱號',price:3000,preview:'👑',class:'tag-king'},
  ],
  effects: [
    {id:'eff-confetti',name:'彩紙爆炸',desc:'答對時彩紙飛舞',price:400,preview:'🎊'},
    {id:'eff-lightning',name:'閃電特效',desc:'連答正確閃電爆發',price:600,preview:'⚡'},
    {id:'eff-star',name:'星光迸發',desc:'每次答題星光特效',price:900,preview:'✨'},
  ],
  skills: [
    {id:'skill-5050',name:'50/50',desc:'消去兩個錯誤選項',price:300,preview:'🎯'},
    {id:'skill-time',name:'加時 +10秒',desc:'對戰時延長作答時間',price:300,preview:'⏱️'},
    {id:'skill-hint',name:'提示',desc:'顯示正確答案方向',price:300,preview:'💡'},
  ]
};

const rankData = [
  {rank:1,name:'天才博士',tag:'傳說',score:98540,wins:312,frame:'💎',emoji:'🧠'},
  {rank:2,name:'全知全能',tag:'傳說',score:91230,wins:287,frame:'💎',emoji:'🎓'},
  {rank:3,name:'知識爆炸',tag:'大師',score:84100,wins:241,frame:'🔥',emoji:'⚡'},
  {rank:4,name:'百科全書',tag:'大師',score:76550,wins:198,frame:'🟡',emoji:'📚'},
  {rank:5,name:'問題終結者',tag:'大師',score:70200,wins:175,frame:'🟡',emoji:'🎯'},
  {rank:6,name:'知識戰士',tag:'大師',score:62800,wins:159,frame:'🟡',emoji:'🧠',isYou:true},
  {rank:7,name:'無所不知',tag:'大師',score:58300,wins:142,frame:'',emoji:'🦉'},
  {rank:8,name:'答題機器',tag:'學徒',score:45100,wins:98,frame:'',emoji:'🤖'},
];

// ─── STARS ───────────────────────────────────────────────
function createStars() {
  const c = document.getElementById('stars');
  for (let i=0;i<80;i++) {
    const s=document.createElement('div');
    s.className='star';
    s.style.cssText=`width:${Math.random()*3+1}px;height:${Math.random()*3+1}px;
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s`;
    c.appendChild(s);
  }
}

// ─── SCREEN ──────────────────────────────────────────────
function showScreen(id) {
  // 先把所有頁面淡出
  const current = document.querySelector('.screen.active');
  if (current) {
    current.classList.remove('visible');  // 淡出目前頁面
    setTimeout(() => {
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.remove('visible');
      });
      // 淡入新頁面
      const next = document.getElementById(id);
      next.classList.add('active');
      setTimeout(() => { next.classList.add('visible'); document.getElementById(id).scrollTop = 0; }, 10);
      if(id==='analyticsScreen') { switchAnalytics('distribution'); setTimeout(initCharts, 100); }
      if(id==='shopScreen') renderShop('frames');
      if(id==='rankScreen') renderRank();
      if(id==='profileScreen') { switchProfileTab('edit'); updateProfileEditUI(); updateStatsDisplay(); }
      if(id==='adminScreen') { switchAdminTab('generate'); initAdminScreen(); }
    }, 350);  // 等淡出完成後再切換
  } else {
    // 第一次載入沒有 active 頁面
    const next = document.getElementById(id);
    next.classList.add('active');
    setTimeout(() => next.classList.add('visible'), 10);
  }
}

// ─── PLAYER BAR ──────────────────────────────────────────
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
}

function getTagIcon(tagClass) {
  const icons = {'tag-rookie':'🌱','tag-apprentice':'📘','tag-expert':'🎯','tag-master':'⭐','tag-legend':'🏆','tag-king':'👑'};
  return icons[tagClass] || state.playerTagIcon || '';
}

function renderTitleBadge(tagClass = state.playerTagClass, tagName = state.playerTag, compact = false) {
  const icon = getTagIcon(tagClass);
  return `<span class="title-badge ${tagClass} ${compact ? 'compact' : ''}"><span class="title-medal">${icon}</span><span class="title-plate">${escapeHTML(tagName)}</span></span>`;
}

function renderPlayerTag() {
  return renderTitleBadge(state.playerTagClass, state.playerTag, false);
}

function updatePlayerBar() {
  const coinsText = state.coins.toLocaleString();
  document.getElementById('coinDisplay').textContent = coinsText;
  const shopCoinsEl = document.getElementById('shopCoins');
  if(shopCoinsEl) shopCoinsEl.textContent = coinsText;
  // 同步對戰模式選擇屏幕的硬幣顯示
  ['coinDisplay2', 'coinDisplay3'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = coinsText;
  });
  document.getElementById('playerNameDisplay').innerHTML = escapeHTML(state.playerName) + renderPlayerTag();
  document.getElementById('playerLevel').textContent = state.level;
  document.getElementById('playerXP').textContent = state.xp;
  document.getElementById('playerXPMax').textContent = state.xpMax;
  const pct = (state.xp/state.xpMax*100).toFixed(0);
  document.getElementById('xpBar').style.width = pct+'%';
  if (document.getElementById('playerLevel3')) document.getElementById('playerLevel3').textContent = state.level;
  if (document.getElementById('playerXP3')) document.getElementById('playerXP3').textContent = state.xp;
  if (document.getElementById('playerXPMax3')) document.getElementById('playerXPMax3').textContent = state.xpMax;
  if (document.getElementById('xpBar3')) document.getElementById('xpBar3').style.width = pct+'%';
  if (document.getElementById('playerNameDisplay3')) document.getElementById('playerNameDisplay3').textContent = state.playerName;
  if (document.getElementById('playerAvatar3')) document.getElementById('playerAvatar3').textContent = state.equippedEmoji;
  if (document.getElementById('playerFrame3')) document.getElementById('playerFrame3').className = 'avatar-frame ' + (state.equippedFrame !== 'frame-none' ? state.equippedFrame : '');
  const coinDisplay3 = document.getElementById('coinDisplay3');
  if (coinDisplay3) coinDisplay3.textContent = state.coins.toLocaleString();
  const pf = document.getElementById('playerFrame');
  pf.className = 'avatar-frame ' + (state.equippedFrame !== 'frame-none' ? state.equippedFrame : '');
}

// ─── BATTLE ──────────────────────────────────────────────
let currentQ = 0, questionOrder = [];
let battleWs = null;       // 對戰 WebSocket 連線
let battleStartTime = 0;   // 題目開始時間，用來計算作答秒數
let currentBattleMode = null;  // 記錄當前對戰模式（'bot', 'queue', 'create_room', 'join_room'）
let currentRoomId = null;   // 記錄當前房間 ID
let battleClosing = false; // 是否為主動結束對戰

function startBattle(mode = 'bot') {
  currentBattleMode = mode;
  
  // 重置對戰資料
  const bd = state.battleData;
  bd.round = 0; bd.playerScore = 0; bd.oppScore = 0; bd.correct = 0; bd.oppCorrect = 0; bd.total = 0; bd.combo = 0; bd.answering = false;
  if (bd.timer) clearInterval(bd.timer);
  state.skills = { used50: false, usedTime: false, usedHint: false };
  resetSkillBtns();
  updateScoreDisplay();
  document.getElementById('battleAvatar').textContent = state.equippedEmoji;
  document.getElementById('battleName').textContent = state.playerName;

  // 關閉舊的 WebSocket 連線
  if (battleWs) {
    battleWs.close();
    battleWs = null;
  }

  // 建立新的 WebSocket 連線
  battleWs = new WebSocket(WS_BASE);

  battleWs.onopen = () => {
    // 連線成功後依模式發送對應訊息
    if (mode === 'bot') {
      battleWs.send(JSON.stringify({ type: 'join_bot', userName: state.playerName, userId: state.userId }));
    } else if (mode === 'queue') {
      battleWs.send(JSON.stringify({ type: 'join_queue', userName: state.playerName, userId: state.userId }));
    } else if (mode === 'create_room') {
      battleWs.send(JSON.stringify({ type: 'create_room', userName: state.playerName, userId: state.userId }));
    } else if (mode === 'join_room') {
      battleWs.send(JSON.stringify({ type: 'join_room', roomId: currentRoomId, userName: state.playerName, userId: state.userId }));
    }
  };

  battleWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleBattleMessage(msg);
  };

  battleWs.onerror = (err) => {
    if (battleClosing) return;
    console.error('WebSocket 錯誤:', err);
    // 延遲 1.5 秒再顯示錯誤，避免連線中就跳出提示
    setTimeout(() => {
      if (!battleWs || battleWs.readyState !== WebSocket.OPEN) {
        showToast('連線失敗，請確認對戰伺服器是否啟動');
      }
    }, 1500);
  };

  battleWs.onclose = () => {
    console.log('WebSocket 已關閉');
    battleClosing = false;
  };

  showScreen('battleScreen');
}

// 創建戰鬥房間
function createBattleRoom() {
  startBattle('create_room');
}

// 取消對戰佇列
function cancelBattleQueue() {
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: 'cancel_queue' }));
  }
  showScreen('battleModeScreen');
}

function requestQuitBattle() {
  if (currentBattleMode !== 'bot') {
    if (!confirm('你是否確定要退出對戰？')) return;
  }
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleClosing = true;
    battleWs.send(JSON.stringify({ type: 'quit_match' }));
    battleWs.close();
    battleWs = null;
  }
  endBattle(false);
}

// 顯示等待對手屏幕
function showWaitingScreen(mode) {
  const waitingScreen = document.getElementById('waitingForOpponentScreen');
  const normalScreen = document.getElementById('normalBattleScreen');
  if (waitingScreen && normalScreen) {
    waitingScreen.style.display = 'block';
    normalScreen.style.display = 'none';
    
    // 更新等待提示文本
    const waitingTitle = document.getElementById('waitingTitle');
    const waitingSubtext = document.getElementById('waitingSubtext');
    
    if (mode === 'queue') {
      waitingTitle.textContent = '尋找對手中...';
      waitingSubtext.textContent = '已加入快速配對佇列';
    } else if (mode === 'create_room') {
      waitingTitle.textContent = '等待對手加入...';
      waitingSubtext.textContent = '房號已生成，分享給朋友';
    } else if (mode === 'join_room') {
      waitingTitle.textContent = '等待遊戲開始...';
      waitingSubtext.textContent = '已加入房間，等待對手準備';
    }
  }
}

// 隱藏等待對手屏幕
function hideWaitingScreen() {
  const waitingScreen = document.getElementById('waitingForOpponentScreen');
  const normalScreen = document.getElementById('normalBattleScreen');
  if (waitingScreen && normalScreen) {
    waitingScreen.style.display = 'none';
    normalScreen.style.display = 'block';
  }
}

function handleBattleMessage(msg) {
  const bd = state.battleData;

  if (msg.type === 'queued') {
    // 已加入配對佇列，等待對手
    if (currentBattleMode === 'queue') {
      showWaitingScreen('queue');
    } else if (currentBattleMode === 'join_room') {
      showWaitingScreen('join_room');
    }
    return;
  }

  if (msg.type === 'room_created') {
    // 房間已建立，顯示房號
    currentRoomId = msg.roomId;
    showToast(`房間已建立！房號：${msg.roomId}\n請分享給朋友加入`, 5);
    showWaitingScreen('create_room');
    // 在等待屏幕上也顯示房號
    const waitingSubtext = document.getElementById('waitingSubtext');
    if (waitingSubtext) {
      waitingSubtext.innerHTML = `房號: <span style="font-weight:bold; font-size:18px; color:#FFD700;">${msg.roomId}</span><br>請分享給朋友`;
    }
    return;
  }

  if (msg.type === 'game_start') {
    // 遊戲開始，隱藏等待屏幕
    hideWaitingScreen();
    // 遊戲開始，設定對手名稱
    const oppName = msg.playerIndex === 0 ? msg.opponentName : msg.myName;
    const myName = msg.playerIndex === 0 ? msg.myName : msg.opponentName;
    document.getElementById('oppName').textContent = msg.opponentName;
    document.getElementById('battleName').textContent = state.playerName;
    bd.playerIndex = msg.playerIndex;  // 記錄我是 player 0 還是 1
    return;
  }

  if (msg.type === 'question') {
    // 收到新題目
    bd.round = msg.index + 1;
    bd.answering = false;
    bd.currentQuestion = msg;  // 儲存題目資料
    battleStartTime = Date.now();  // 記錄題目開始時間
    document.getElementById('roundNum').textContent = bd.round;
    document.getElementById('comboMult').textContent = bd.combo;

    // 顯示題目
    document.getElementById('topicBadge').textContent = '知識王';
    document.getElementById('questionText').textContent = msg.question;

    // 顯示選項
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];
    msg.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="option-label">${labels[i]}</span>${opt}`;
      btn.onclick = () => answerQuestion(i, btn);
      grid.appendChild(btn);
    });

    startTimer(10);  // 對戰系統是 10 秒計時
    return;
  }

  if (msg.type === 'opponent_answered') {
    // 對手已作答，顯示提示
    showToast('對手已作答！');
    return;
  }

  if (msg.type === 'question_result') {
    // 題目結算
    if (bd.timer) clearInterval(bd.timer);
    const myResult = msg.results[bd.playerIndex];
    const oppResult = msg.results[1 - bd.playerIndex];

    // 更新分數
    bd.playerScore = msg.scores[bd.playerIndex];
    bd.oppScore = msg.scores[1 - bd.playerIndex];

    // 顯示正確答案
    const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);
    if (btns[msg.correctAns]) btns[msg.correctAns].classList.add('correct');
    if (myResult.answerIdx !== -1 && myResult.answerIdx !== msg.correctAns) {
      if (btns[myResult.answerIdx]) btns[myResult.answerIdx].classList.add('wrong');
    }

    // 更新 combo 和統計
    bd.total++;
    if (oppResult.correct) {
      bd.oppCorrect++;
    }
    if (myResult.correct) {
      bd.correct++;
      bd.combo = bd.combo + 1;  // 答對加 1 連擊，無上限
      document.getElementById('comboMult').textContent = bd.combo;  // 顯示新 combo
      addCorrectEffect(myResult.gained);            // 答對特效
      if (bd.combo >= 2) showComboPopup(bd.combo); // 2 連擊以上顯示彈出提示
      showXpPopup();
    } else {
      bd.combo = 0;  // 答錯或超時重置 combo
      document.getElementById('comboMult').textContent = bd.combo;
      addWrongFlash();                              // 答錯特效
    }
    updateScoreDisplay();
    return;
  }

  if (msg.type === 'item_used') {
    // 道具使用成功
    const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
    if (btns[msg.removedOptionIdx]) {
      btns[msg.removedOptionIdx].style.opacity = '.2';
      btns[msg.removedOptionIdx].disabled = true;
    }
    return;
  }

  if (msg.type === 'item_error') {
    showToast(msg.message);
    return;
  }

  if (msg.type === 'opponent_disconnected') {
    // 對手斷線
    showToast('對手已斷線，本局結束');
    endBattle(true);
    return;
  }

  if (msg.type === 'game_end') {
    // 遊戲結束
    const bd = state.battleData;
    const won = msg.winner === bd.playerIndex;
    endBattle(won, msg.scores[bd.playerIndex], msg.scores[1 - bd.playerIndex]);
    return;
  }

  if (msg.type === 'error') {
    showToast(msg.message);
    // 如果是加入房間失敗，2 秒後返回房間配對屏幕
    if (currentBattleMode === 'join_room') {
      setTimeout(() => showScreen('roomMatchScreen'), 2000);
    }
    return;
  }
}


function startTimer(sec) {
  const bd = state.battleData;
  if (bd.timer) clearInterval(bd.timer);
  bd.timerVal = sec;
  updateTimer(sec);
  bd.timer = setInterval(() => {
    bd.timerVal--;
    updateTimer(bd.timerVal);
    if (bd.timerVal <= 0) {
      clearInterval(bd.timer);
      if (!bd.answering) timeOut();
    }
  }, 1000);
}

function updateTimer(val) {
  const circle = document.getElementById('timerCircle');
  const text = document.getElementById('timerText');
  const ring = document.querySelector('.timer-ring');
  const circumference = 188.4;
  const offset = circumference * (1 - val/15);
  circle.style.strokeDashoffset = offset;
  text.textContent = val;
  if (val <= 5) { ring.classList.add('timer-urgent'); circle.style.stroke='#ff1744'; }
  else { ring.classList.remove('timer-urgent'); circle.style.stroke='var(--accent)'; }
}

function timeOut() {
  const bd = state.battleData;
  if (bd.answering) return;  // 防止重複觸發
  bd.answering = true;
  bd.combo = 0;  // 超時 combo 重置
  document.getElementById('comboMult').textContent = 1;

  // 禁用所有選項
  const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);
  addWrongFlash();

  // 發送超時答案（answerIdx = -1 代表未作答）
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({
      type: 'submit_answer',
      answerIdx: -1,  // -1 代表超時未作答
      usedSec: 10     // 超時用完全部時間
    }));
  }
}

function answerQuestion(chosen, btn) {
  const bd = state.battleData;
  if (bd.answering) return;  // 防止重複作答
  bd.answering = true;

  // 計算作答秒數
  const usedSec = Math.min(10, (Date.now() - battleStartTime) / 1000);

  // 禁用所有選項按鈕
  const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);
  btn.classList.add('correct');  // 先標記選擇的選項，等 question_result 再修正

  // 發送答案給對戰系統後端
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({
      type: 'submit_answer',
      answerIdx: chosen,
      usedSec: usedSec
    }));
  }
}

function updateScoreDisplay() {
  const bd = state.battleData;
  document.getElementById('playerScore').textContent = bd.playerScore;
  document.getElementById('oppScore').textContent = bd.oppScore;
  const maxP = Math.max(bd.playerScore, bd.oppScore, 500);
  document.getElementById('playerHp').style.width = Math.max(5,(bd.playerScore/maxP*100)).toFixed(0)+'%';
  document.getElementById('oppHp').style.width = Math.max(5,(bd.oppScore/maxP*100)).toFixed(0)+'%';
}

async function endBattle(won, playerScore, oppScore) {
  const bd = state.battleData;
  if (bd.timer) clearInterval(bd.timer);  // 停止計時器

  // 如果沒傳入分數，用 battleData 的
  const finalPlayerScore = playerScore !== undefined ? playerScore : bd.playerScore;
  const finalOppScore = oppScore !== undefined ? oppScore : bd.oppScore;
  const finalWon = won !== undefined ? won : finalPlayerScore > finalOppScore;

  // 關閉 WebSocket 連線
  if (battleWs) {
    battleWs.close();
    battleWs = null;
  }

  const acc = bd.total > 0 ? Math.round(bd.correct / bd.total * 100) : 0;  // 計算準確率

  // 呼叫後端更新統計資料
  try {
    const res = await fetch(`${API_BASE}/user/update-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.userId,   // 玩家 ID
        won: finalWon,            // 是否獲勝
        score: finalPlayerScore,  // 本場得分
        correct: bd.correct,      // 答對題數
        total: bd.total,          // 總題數
        opp_correct: bd.oppCorrect || 0,
        mode: currentBattleMode || ''
      })
    });
    const data = await res.json();
    if (res.ok) {
      // 更新本地 state
      state.coins = data.coins;          // 更新金幣
      state.level = data.level;          // 更新等級
      state.xp = data.xp;               // 更新 XP
      state.xpMax = data.xp_max;         // 更新 XP 上限
      state.wins = data.wins;            // 更新勝場
      state.losses = data.losses;        // 更新敗場
      if (data.leveled_up) showToast('🎉 升級了！Lv.' + data.level);  // 升級提示
      updatePlayerBar();  // 更新玩家列
      if (document.getElementById('statXpEarned')) {
        document.getElementById('statXpEarned').textContent = (data.xp_gain >= 0 ? '+' : '') + data.xp_gain;
      }
    }
  } catch (err) {
    console.error('更新統計失敗:', err);
  }

  // 顯示結果畫面
  const coinDelta = finalWon ? 100 + 20 * bd.correct : -(50 + 20 * (bd.oppCorrect || 0));
  document.getElementById('resultIcon').textContent = finalWon ? '🏆' : '💀';
  document.getElementById('resultTitle').className = 'result-title ' + (finalWon ? 'result-win' : 'result-lose');
  document.getElementById('resultTitle').textContent = finalWon ? '勝利！' : '敗北';
  document.getElementById('resultSub').textContent = finalWon ? `你以 ${finalPlayerScore} 分擊敗了對手！` : `對手以 ${finalOppScore} 分獲勝`;
  document.getElementById('statScore').textContent = finalPlayerScore;
  document.getElementById('statCorrect').textContent = `${bd.correct}/${bd.total}`;
  document.getElementById('statAccuracy').textContent = acc + '%';
  document.getElementById('statCoinsEarned').textContent = (coinDelta >= 0 ? '+' : '') + coinDelta;
  if (document.getElementById('statXpEarned')) {
    document.getElementById('statXpEarned').textContent = data && data.xp_gain !== undefined ? (data.xp_gain >= 0 ? '+' : '') + data.xp_gain : '+' + (currentBattleMode === 'bot' ? (finalWon ? 20 + 3 * bd.correct : bd.correct) : 0);
  }
  showScreen('resultScreen');
}

// ─── SKILLS ──────────────────────────────────────────────
function resetSkillBtns() {
  // 根據已購買的道具決定是否可用
  const ownedSkills = state.owned.skills || [];
  const s50 = document.getElementById('skill50');
  const sTime = document.getElementById('skillTime');
  const sHint = document.getElementById('skillHint');
  if (s50) s50.classList.toggle('used', !ownedSkills.includes('skill-5050'));
  if (sTime) sTime.classList.toggle('used', !ownedSkills.includes('skill-time'));
  if (sHint) sHint.classList.toggle('used', !ownedSkills.includes('skill-hint'));
}
function useSkill50() {
  if (state.skills.used50) return;
  state.skills.used50 = true;
  document.getElementById('skill50').classList.add('used');

  // 發送使用道具訊息給對戰系統後端
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: 'use_item', item: 'delete_wrong' }));
  }
}
function useSkillTime() {
  if (state.skills.usedTime) return;
  state.skills.usedTime = true;
  document.getElementById('skillTime').classList.add('used');
  state.battleData.timerVal = Math.min(state.battleData.timerVal+10, 25);
  updateTimer(state.battleData.timerVal);
  const bd = state.battleData;
  clearInterval(bd.timer);
  bd.timer = setInterval(() => {
    bd.timerVal--;
    updateTimer(bd.timerVal);
    if (bd.timerVal <= 0) {
      clearInterval(bd.timer);
      if (!bd.answering) timeOut();
    }
  }, 1000);
}
function useSkillHint() {
  if (state.skills.usedHint) return;
  state.skills.usedHint = true;
  document.getElementById('skillHint').classList.add('used');
  const qi = questionOrder[(state.battleData.round-1)%questions.length];
  const q = questions[qi];
  const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
  btns[q.ans].style.boxShadow='0 0 15px rgba(0,230,118,.6)';
}

// ─── EFFECTS ─────────────────────────────────────────────
function getEffectOrigin() {
  const card = document.querySelector('#battleScreen .question-card');
  if (card) {
    const rect = card.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function createEffectNode(className, styles = {}) {
  const el = document.createElement('div');
  el.className = className;
  Object.entries(styles).forEach(([key, value]) => {
    if (key.startsWith('--')) {
      el.style.setProperty(key, value);
    } else {
      el.style[key] = value;
    }
  });
  return el;
}

function burstVector(angle, distance) {
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance
  };
}

function addCorrectEffect(points) {
  const overlay = document.getElementById('effectOverlay');


  const activeEffect = state.activeEffect || state.owned.activeEffect || 'eff-confetti';
  const origin = getEffectOrigin();
  if (activeEffect === 'eff-lightning') {
    addLightningEffect(overlay, origin);
  } else if (activeEffect === 'eff-star') {
    addStarEffect(overlay, origin);
  } else {
    addConfettiEffect(overlay, origin);
  }
}

function addConfettiEffect(overlay, origin) {
  const colors = ['#ff5aa5','#ffd34f','#67e8f9','#8b5cf6','#4ade80','#ff7b54'];
  const glow = createEffectNode('effect-glow', {
    left: origin.x + 'px', top: origin.y + 'px', width: '180px', height: '180px',
    background: 'radial-gradient(circle, rgba(255,255,255,.36) 0%, rgba(255,214,99,.24) 28%, rgba(108,225,255,.16) 54%, rgba(255,255,255,0) 75%)'
  });
  overlay.appendChild(glow);
  setTimeout(()=>glow.remove(),800);

  const ring = createEffectNode('effect-ring', {
    left: origin.x + 'px', top: origin.y + 'px', width: '130px', height: '130px',
    border: '3px solid rgba(255,255,255,.55)', boxShadow: '0 0 22px rgba(255,215,110,.42)'
  });
  overlay.appendChild(ring);
  setTimeout(()=>ring.remove(),750);

  for (let i = 0; i < 34; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * 180;
    const vec = burstVector(angle, distance);
    const isDot = Math.random() > 0.65;
    const piece = createEffectNode(`effect-burst-piece ${isDot ? 'confetti-dot' : 'confetti-piece'}`, {
      left: origin.x + 'px', top: origin.y + 'px',
      background: colors[Math.floor(Math.random() * colors.length)],
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--rot': (Math.random() * 360) + 'deg', '--spin': ((Math.random() * 480) - 240) + 'deg',
      '--scale': (0.85 + Math.random() * 0.7).toFixed(2), '--dur': (0.72 + Math.random() * 0.38) + 's'
    });
    if (!isDot) {
      piece.style.width = (8 + Math.random() * 6) + 'px';
      piece.style.height = (12 + Math.random() * 10) + 'px';
      piece.style.borderRadius = (2 + Math.random() * 5) + 'px';
    }
    overlay.appendChild(piece);
    setTimeout(()=>piece.remove(),1250);
  }

  for (let i = 0; i < 9; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 110;
    const vec = burstVector(angle, distance);
    const streamer = createEffectNode('effect-streamer confetti-streamer', {
      left: origin.x + 'px', top: origin.y + 'px',
      background: `linear-gradient(180deg, ${colors[i % colors.length]}, rgba(255,255,255,.18))`,
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--angle': (angle * 180 / Math.PI) + 'deg', '--spin': ((Math.random() * 100) - 50) + 'deg',
      '--dur': (0.88 + Math.random() * 0.28) + 's'
    });
    overlay.appendChild(streamer);
    setTimeout(()=>streamer.remove(),1350);
  }
}

function addLightningEffect(overlay, origin) {
  const glow = createEffectNode('effect-glow', {
    left: origin.x + 'px', top: origin.y + 'px', width: '220px', height: '220px',
    background: 'radial-gradient(circle, rgba(227,252,255,.42) 0%, rgba(88,220,255,.28) 24%, rgba(0,150,255,.2) 50%, rgba(0,150,255,0) 76%)'
  });
  overlay.appendChild(glow);
  setTimeout(()=>glow.remove(),850);

  const ring = createEffectNode('effect-ring', {
    left: origin.x + 'px', top: origin.y + 'px', width: '150px', height: '150px',
    border: '4px solid rgba(126,239,255,.85)', boxShadow: '0 0 26px rgba(29,194,255,.58)'
  });
  overlay.appendChild(ring);
  setTimeout(()=>ring.remove(),760);

  const core = createEffectNode('effect-core', {
    left: origin.x + 'px', top: origin.y + 'px', width: '86px', height: '86px',
    background: 'radial-gradient(circle, rgba(255,255,255,.96) 0%, rgba(175,242,255,.88) 22%, rgba(47,195,255,.6) 54%, rgba(47,195,255,0) 78%)'
  });
  overlay.appendChild(core);
  setTimeout(()=>core.remove(),560);

  for (let i = 0; i < 8; i++) {
    const angle = (-60 + i * 18) * Math.PI / 180;
    const distance = 80 + Math.random() * 60;
    const vec = burstVector(angle, distance);
    const bolt = createEffectNode('effect-burst-piece lightning-bolt', {
      left: origin.x + 'px', top: origin.y + 'px',
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--rot': ((angle * 180 / Math.PI) + (Math.random() * 24 - 12)) + 'deg', '--spin': ((Math.random() * 40) - 20) + 'deg',
      '--scale': (0.88 + Math.random() * 0.34).toFixed(2), '--dur': (0.5 + Math.random() * 0.16) + 's'
    });
    overlay.appendChild(bolt);
    setTimeout(()=>bolt.remove(),900);
  }

  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * 170;
    const vec = burstVector(angle, distance);
    const spark = createEffectNode('effect-ray lightning-spark', {
      left: origin.x + 'px', top: origin.y + 'px',
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--angle': (angle * 180 / Math.PI) + 'deg', animationDuration: (0.45 + Math.random() * 0.25) + 's'
    });
    overlay.appendChild(spark);
    setTimeout(()=>spark.remove(),900);
  }
}

function addStarEffect(overlay, origin) {
  const glow = createEffectNode('effect-glow', {
    left: origin.x + 'px', top: origin.y + 'px', width: '220px', height: '220px',
    background: 'radial-gradient(circle, rgba(255,248,206,.42) 0%, rgba(255,224,113,.32) 20%, rgba(255,189,72,.2) 44%, rgba(255,189,72,0) 78%)'
  });
  overlay.appendChild(glow);
  setTimeout(()=>glow.remove(),900);

  const core = createEffectNode('effect-core star-particle', {
    left: origin.x + 'px', top: origin.y + 'px', width: '62px', height: '62px'
  });
  overlay.appendChild(core);
  setTimeout(()=>core.remove(),700);

  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 / 12) * i;
    const distance = 80 + (i % 2 === 0 ? 110 : 65);
    const vec = burstVector(angle, distance);
    const ray = createEffectNode('effect-ray star-ray-line', {
      left: origin.x + 'px', top: origin.y + 'px',
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--angle': (angle * 180 / Math.PI) + 'deg', animationDuration: (0.6 + Math.random() * 0.2) + 's'
    });
    overlay.appendChild(ray);
    setTimeout(()=>ray.remove(),980);
  }

  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 75 + Math.random() * 180;
    const vec = burstVector(angle, distance);
    const star = createEffectNode('effect-burst-piece star-particle', {
      left: origin.x + 'px', top: origin.y + 'px',
      width: (14 + Math.random() * 14) + 'px', height: (14 + Math.random() * 14) + 'px',
      '--tx': vec.x + 'px', '--ty': vec.y + 'px',
      '--rot': (Math.random() * 360) + 'deg', '--spin': ((Math.random() * 240) - 120) + 'deg',
      '--scale': (0.85 + Math.random() * 0.6).toFixed(2), '--dur': (0.76 + Math.random() * 0.34) + 's'
    });
    overlay.appendChild(star);
    setTimeout(()=>star.remove(),1260);
  }

  const ring = createEffectNode('effect-ring', {
    left: origin.x + 'px', top: origin.y + 'px', width: '145px', height: '145px',
    border: '3px solid rgba(255,228,129,.7)', boxShadow: '0 0 24px rgba(255,202,76,.48)'
  });
  overlay.appendChild(ring);
  setTimeout(()=>ring.remove(),780);
}

function addWrongFlash() {
  const overlay = document.getElementById('effectOverlay');

}
function showComboPopup(combo) {
  const el = document.createElement('div');
  el.className = 'combo-popup';
  el.textContent = `🔥 ${combo}連擊！`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1500);
}
function showXpPopup() {
  const el = document.createElement('div');
  el.className = 'xp-popup';
  el.style.cssText=`left:${Math.random()*60+20}%;top:60%`;
  el.textContent = '+XP';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1500);
}

// ─── ANALYTICS ───────────────────────────────────────────
let chartsInit = false;
let distChart, pieChartInst, radarChartInst, trendChartInst, accChartInst;

function switchAnalytics(tab) {
  document.querySelectorAll('#analyticsScreen .tab-content').forEach(t => {
    t.classList.remove('visible');
  });
  setTimeout(() => {
    document.querySelectorAll('#analyticsScreen .tab-content').forEach(t => {
      t.classList.remove('active');
      t.classList.remove('visible');
    });
    const next = document.getElementById('tab-' + tab);
    next.classList.add('active');
    setTimeout(() => { next.classList.add('visible'); next.scrollTop = 0; }, 10);
    document.querySelectorAll('#analyticsNav .nav-btn').forEach((b, i) => {
      b.classList.remove('active');
      if (['distribution', 'radar', 'trend'][i] === tab) b.classList.add('active');
    });
    setTimeout(initCharts, 50);
  }, 200);
}

async function initCharts() {
  const bgColors = ['#ffd700','#ff6b35','#ff1744','#00e676','#00d4ff','#e040fb','#40c4ff',
    '#ffab40','#69f0ae','#ea80fc','#ff6090','#84ffff','#b9f6ca','#ffd740','#ff9e80',
    '#cfd8dc','#80d8ff','#a7ffeb','#ccff90','#ffe57f','#ff9d80'];

  const stats = state.topicStats || {};
  const topics = Object.keys(stats);
  const totalPerCat = topics.map(t => (stats[t].correct||0) + (stats[t].wrong||0));

  const NO_DATA = '<div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:120px"><p style="color:var(--text2);font-size:14px">尚無對戰記錄</p></div>';

  // ─── 主題分佈 ───────────────────────────────────────────
  if (document.getElementById('tab-distribution').classList.contains('active')) {
    const totalAll = totalPerCat.reduce((s,v) => s+v, 0);

    const distEl = document.getElementById('distributionChart');
    if (totalAll === 0) {
      if (distChart) { distChart.destroy(); distChart = null; }
      if (distEl) distEl.parentElement.innerHTML = NO_DATA;
    } else {
      if (distChart) distChart.destroy();
      distChart = new Chart(distEl, {
        type: 'bar',
        data: { labels: topics, datasets: [{
          label: '答題數', data: totalPerCat,
          backgroundColor: bgColors, borderWidth: 0, borderRadius: 6,
        }]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend:{display:false} },
          scales: {
            x: { ticks:{color:'#b0b0d0',font:{size:10},maxRotation:45}, grid:{color:'rgba(255,255,255,.05)'} },
            y: { ticks:{color:'#b0b0d0',font:{size:11}}, grid:{color:'rgba(255,255,255,.08)'} }
          }
        }
      });
    }

    const catMap = {
      '自然科學': ['物理','化學','生物','地科'],
      '人文社會': ['歷史','地理','公民','人文','軍教'],
      '語文數理': ['國文','英文','數學','程式','美術'],
      '生活體育': ['常識','健教','家政','體育'],
      '時事綜合': ['新聞','其他'],
    };
    const cats = Object.keys(catMap);
    const catColors = ['#ffd700','#ff6b35','#e040fb','#00d4ff','#00e676'];
    const catVals = cats.map(cat =>
      catMap[cat].reduce((s,c) => s + (stats[c] ? (stats[c].correct||0)+(stats[c].wrong||0) : 0), 0)
    );
    const totalCat = catVals.reduce((s,v) => s+v, 0);
    const pieEl = document.getElementById('pieChart');
    const legend = document.getElementById('pieLegend');
    const pieRow = pieEl ? pieEl.closest('.pie-chart-row') : null;

    if (totalCat === 0) {
      if (pieChartInst) { pieChartInst.destroy(); pieChartInst = null; }
      // 把整個 pie-chart-row 換成置中文字
      if (pieRow) pieRow.innerHTML = NO_DATA;
    } else {
      if (pieChartInst) pieChartInst.destroy();
      pieChartInst = new Chart(pieEl, {
        type: 'doughnut',
        data: { labels: cats, datasets: [{ data: catVals, backgroundColor: catColors, borderWidth:2, borderColor:'#0a0a1a' }]},
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, cutout:'60%' }
      });
      legend.innerHTML = cats.map((c,i) => {
        const pct = Math.round(catVals[i]/totalCat*100);
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:12px;height:12px;border-radius:2px;background:${catColors[i]};flex-shrink:0"></div>
          <span style="font-size:13px;color:#b0b0d0">${c}</span>
          <span style="margin-left:auto;font-size:13px;color:#fff;font-weight:700">${catVals[i]} 題 (${pct}%)</span>
        </div>`;
      }).join('');
    }
  }

  // ─── 個人能力雷達圖 ─────────────────────────────────────
  if (document.getElementById('tab-radar').classList.contains('active')) {
    const totalAnsweredCheck = topics.reduce((s,t) => s + (stats[t] ? (stats[t].correct||0)+(stats[t].wrong||0) : 0), 0);
    if (totalAnsweredCheck === 0) {
      if (radarChartInst) { radarChartInst.destroy(); radarChartInst = null; }
      const radarEl = document.getElementById('radarChart');
      if (radarEl) radarEl.parentElement.innerHTML = NO_DATA;
      document.getElementById('bestTopic').textContent = '-';
      document.getElementById('avgAccuracy').textContent = '0%';
      document.getElementById('totalAnswered').textContent = '0';
      const total0 = state.wins + state.losses;
      document.getElementById('winRate').textContent = total0 > 0 ? Math.round(state.wins/total0*100)+'%' : '0%';
    } else {
      const categoryMap = {
        '科學知識': ['物理','化學','生物','地科'],
        '地理歷史': ['地理','歷史'],
        '語文藝術': ['國文','英文','美術'],
        '數理邏輯': ['數學','程式'],
        '社會公民': ['公民','人文','軍教'],
        '生活常識': ['常識','健教','家政'],
        '體育競技': ['體育'],
        '時事新聞': ['新聞'],
        '綜合其他': ['其他'],
      };
      const radarLabels = Object.keys(categoryMap);
      const radarData = radarLabels.map(label => {
        const cats = categoryMap[label] || [];
        const total = cats.reduce((s,c) => s + (stats[c] ? (stats[c].correct||0)+(stats[c].wrong||0) : 0), 0);
        const correct = cats.reduce((s,c) => s + (stats[c] ? (stats[c].correct||0) : 0), 0);
        return total > 0 ? Math.round((correct/total)*100) : 0;
      });

      let avgData = radarLabels.map(() => 0);
      try {
        const avgRes = await fetch(`${API_BASE}/user/avg-topic-stats`);
        if (avgRes.ok) {
          const avgStats = await avgRes.json();
          avgData = radarLabels.map(label => {
            const cats = categoryMap[label] || [];
            const vals = cats.map(c => avgStats[c]).filter(v => v !== undefined);
            return vals.length > 0 ? Math.round(vals.reduce((s,v) => s+v, 0) / vals.length) : 0;
          });
        }
      } catch (e) {}

      if (radarChartInst) radarChartInst.destroy();
      radarChartInst = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: [{
            label: '你的能力', data: radarData,
            backgroundColor: 'rgba(255,215,0,.15)', borderColor: '#ffd700', pointBackgroundColor: '#ffd700',
            borderWidth: 2, pointRadius: 5
          }, {
            label: '平均水準', data: avgData,
            backgroundColor: 'rgba(0,212,255,.08)', borderColor: 'rgba(0,212,255,.5)',
            borderWidth: 1, borderDash:[5,5], pointRadius: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend:{labels:{color:'#b0b0d0',font:{size:12}}} },
          scales: { r: {
            ticks:{color:'#7070a0',backdropColor:'transparent',font:{size:10}},
            grid:{color:'rgba(255,255,255,.1)'},
            pointLabels:{color:'#b0b0d0',font:{size:12}},
            min:0, max:100
          }}
        }
      });

      const total = state.wins + state.losses;
      const totalAnswered = topics.reduce((s,t) => s + (stats[t].correct||0) + (stats[t].wrong||0), 0);
      const totalCorrect = topics.reduce((s,t) => s + (stats[t].correct||0), 0);
      const overallAcc = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : 0;
      const bestEntry = topics
        .filter(t => ((stats[t].correct||0)+(stats[t].wrong||0)) >= 5)
        .sort((a,b) => {
          const accA = stats[a].correct / ((stats[a].correct||0)+(stats[a].wrong||0));
          const accB = stats[b].correct / ((stats[b].correct||0)+(stats[b].wrong||0));
          return accB - accA;
        })[0];
      document.getElementById('bestTopic').textContent = bestEntry || '-';
      document.getElementById('avgAccuracy').textContent = overallAcc + '%';
      document.getElementById('totalAnswered').textContent = totalAnswered;
      document.getElementById('winRate').textContent = total > 0 ? Math.round(state.wins/total*100)+'%' : '0%';
    }
  }

  // ─── 戰績趨勢 ───────────────────────────────────────────
  if (document.getElementById('tab-trend').classList.contains('active')) {
    let recentScores = [];
    let recentAccuracy = [];
    try {
      const res = await fetch(`${API_BASE}/user/recent-battles?user_id=${state.userId}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        recentScores = data.scores || [];
        recentAccuracy = data.accuracy || [];
      }
    } catch (e) {}

    const trendEl = document.getElementById('trendChart');
    const accEl = document.getElementById('accuracyChart');
    if (recentScores.length === 0) {
      if (trendChartInst) { trendChartInst.destroy(); trendChartInst = null; }
      if (accChartInst) { accChartInst.destroy(); accChartInst = null; }
      if (trendEl) trendEl.parentElement.innerHTML = NO_DATA;
      if (accEl) accEl.parentElement.innerHTML = NO_DATA;
      return;
    }

    const labels = recentScores.map((_,i) => `第${i+1}場`);
    if (trendChartInst) trendChartInst.destroy();
    trendChartInst = new Chart(trendEl, {
      type: 'line',
      data: { labels, datasets: [{
        label: '得分', data: recentScores,
        borderColor: '#ffd700', backgroundColor: 'rgba(255,215,0,.1)',
        pointBackgroundColor: '#ffd700', borderWidth: 2, tension: .4, fill: true
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{display:false} },
        scales: {
          x: { ticks:{color:'#b0b0d0',font:{size:11}}, grid:{color:'rgba(255,255,255,.05)'} },
          y: { ticks:{color:'#b0b0d0',font:{size:11}}, grid:{color:'rgba(255,255,255,.08)'} }
        }
      }
    });
    if (accChartInst) accChartInst.destroy();
    accChartInst = new Chart(accEl, {
      type: 'bar',
      data: { labels, datasets: [{
        label: '正確率%', data: recentAccuracy,
        backgroundColor: recentAccuracy.map(v => v>=80?'#00e676':v>=60?'#ffd700':'#ff1744'),
        borderWidth: 0, borderRadius: 6
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{display:false} },
        scales: {
          x: { ticks:{color:'#b0b0d0',font:{size:11}}, grid:{color:'rgba(255,255,255,.05)'} },
          y: { min:0, max:100, ticks:{color:'#b0b0d0',font:{size:11},callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,.08)'} }
        }
      }
    });
  }
}

// ─── SHOP ────────────────────────────────────────────────
let currentShopTab = 'frames';
function switchShop(tab) {
  currentShopTab = tab;
  // 淡出商店內容
  const shopContent = document.getElementById('shopContent');
  shopContent.style.opacity = '0';
  shopContent.style.transform = 'translateY(10px)';
  shopContent.style.transition = 'opacity .2s ease, transform .2s ease';
  setTimeout(() => {
    document.querySelectorAll('#shopScreen .nav-btn').forEach((b, i) => {
      b.classList.remove('active');
      if (['frames', 'tags', 'effects', 'skills'][i] === tab) b.classList.add('active');
    });
    renderShop(tab);  // 重新渲染商店內容
    // 淡入商店內容
    setTimeout(() => {
      shopContent.style.opacity = '1';
      shopContent.style.transform = 'translateY(0)';
    }, 10);
  }, 200);
}

function renderEffectCard(effectId, name) {
  const effectMap = {
    'eff-confetti': { cls: 'confetti', icon: '🎊', label: 'COLOR BURST', pieces: '<i></i><i></i><i></i><i></i><i></i>' },
    'eff-lightning': { cls: 'lightning', icon: '⚡', label: 'BLUE SHOCK', pieces: '<i></i><i></i><i></i>' },
    'eff-star': { cls: 'star', icon: '✦', label: 'GOLDEN STAR', pieces: '<i></i><i></i><i></i><i></i>' }
  };
  const data = effectMap[effectId] || effectMap['eff-confetti'];
  return `<div class="effect-card ${data.cls}">
    <div class="effect-deco">${data.pieces}</div>
    <div class="effect-icon">${data.icon}</div>
    <div class="effect-name">${name}</div>
    <div class="effect-sub">${data.label}</div>
  </div>`;
}

function renderShop(tab) {
  const container = document.getElementById('shopContent');
  const items = shopData[tab];
  const note = '<div class="effect-shop-note">商店只負責購買；裝備請到「個人設定」裡選擇。</div>';
  container.innerHTML = note + `<div class="shop-grid">${items.map(item => {
    const isOwned = state.owned[tab] && state.owned[tab].includes(item.id);
    const isEquipped = (tab === 'frames' && state.equippedFrame === item.id) ||
      (tab === 'tags' && state.playerTagClass === item.id) ||
      (tab === 'effects' && (state.activeEffect || state.owned.activeEffect) === item.id);
    const previewClass = item.class || '';
    const previewHTML = tab === 'tags'
      ? `<div style="display:flex;justify-content:center;margin-bottom:12px">${renderTitleBadge(item.id, item.name, true)}</div>`
      : tab === 'effects'
        ? renderEffectCard(item.id, item.name)
        : `<div class="item-preview ${previewClass}">${item.preview}</div>`;
    return `<div class="shop-item ${isOwned?'owned':''} ${isEquipped?'equipped':''}" onclick="buyItem('${tab}','${item.id}')">
      ${previewHTML}
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>
      ${isEquipped ? '<span class="badge-equipped">使用中</span>' :
        isOwned ? '<span class="badge-owned">已擁有</span>' :
        `<div class="item-price">${item.price > 0 ? '🪙' + item.price : '免費'}</div>`}
    </div>`;
  }).join('')}</div>`;
}

function buyItem(tab, id) {
  const items = shopData[tab];
  const item = items.find(i=>i.id===id);
  if (!item) return;
  const isOwned = state.owned[tab] && state.owned[tab].includes(id);

  if (isOwned) {
    showToast('已擁有此道具，請到「個人設定」裝備');
    renderShop(tab);
    return;
  }

  if (item.price > state.coins) {
    showToast(`金幣不足！還差 ${item.price - state.coins} 🪙，繼續對戰賺取金幣`);
    return;
  }

  state.coins -= item.price;
  if (!state.owned[tab]) state.owned[tab] = [];
  state.owned[tab].push(id);
  updatePlayerBar();
  renderShop(tab);
  updateProfileEditUI();
  showToast(`🎉 購買成功！請到「個人設定」裝備`);
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

// ─── RANK ────────────────────────────────────────────────
async function renderRank() {
  const listEl = document.getElementById('rankList');
  listEl.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px">載入中...</p>';

  try {
    const res = await fetch(`${API_BASE}/user/rank?user_id=${state.userId || ''}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const medals = ['🥇', '🥈', '🥉'];
    const rankColor = (rank) => rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#7070a0';

    const renderRow = (r) => {
      const isTop3 = r.rank <= 3;
      const bg = isTop3 ? 'background:var(--card2);border-color:rgba(255,215,0,0.3);' : '';
      const you = r.isYou ? 'border-color:#ffd700;' : '';
      return `
      <div class="card" style="${bg}${you}">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="font-size:${r.rank <= 3 ? '28px' : '20px'};font-weight:900;min-width:36px;text-align:center;
            font-family:'Orbitron',monospace;color:${rankColor(r.rank)}">
            ${r.rank <= 3 ? medals[r.rank - 1] : r.rank}
          </div>
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#ff6b35);
            display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid rgba(255,255,255,.2)">
            🧠
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:900">
              ${r.name}${r.isYou ? ' <span style="color:var(--accent);font-size:12px">(你)</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text2)">Lv.${r.level} · ${r.wins} 勝</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:900;color:${rankColor(r.rank)}">${(r.score || 0).toLocaleString()}</div>
            <div style="font-size:11px;color:var(--text2)">積分</div>
          </div>
        </div>
      </div>`;
    };

    // 只顯示前 3 名
    let html = data.rank.slice(0, 3).map(r => renderRow(r)).join('');

    // 當前玩家（在前3裡或在myRank）
    const me = data.rank.find(r => r.isYou) || data.myRank;
    if (me && !data.rank.find(r => r.isYou)) {
      // 第 5 名以後才顯示直線
      if (me.rank >= 5) {
        html += `<div style="text-align:center;color:var(--text2);padding:2px 0;line-height:1.2">│<br>│<br>│</div>`;
      }
      html += renderRow(me);
    } else if (!me) {
      html += `<div class="card" style="text-align:center;color:var(--text2);padding:16px;font-size:13px">尚未有積分，快去對戰吧！</div>`;
    }

    listEl.innerHTML = html || '<p style="text-align:center;color:var(--text2);padding:40px">暫無資料</p>';

  } catch (e) {
    listEl.innerHTML = `<p style="text-align:center;color:var(--red);padding:40px">載入失敗：${e.message}</p>`;
  }
}

// ─── INIT ────────────────────────────────────────────────
createStars();

// ─── 密碼欄位初始化 ───────────────────────────────────────
(function initPasswordFields() {
  // 初始化指定 id 的眼睛按鈕

  ['passwordInput', 'regPasswordInput', 'regPasswordConfirm'].forEach(id => {
    const pwdEl = document.getElementById(id);
    const visEl = document.getElementById(id + 'Visible');
    const wrap = pwdEl && pwdEl.closest('.password-wrap');
    const btn = wrap && wrap.querySelector('.toggle-pwd-btn');
    if (!pwdEl || !visEl || !btn) return;

    // 預設：斜線（密碼隱藏）
    btn.classList.add('active');

    // 按著眼睛 → 顯示密碼
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      visEl.value = pwdEl.value;
      pwdEl.style.display = 'none';
      visEl.style.display = '';
      btn.classList.remove('active');  // 移除斜線（顯示中）
    });

    // 放開 → 隱藏密碼
    const hide = () => {
      pwdEl.value = visEl.value;
      visEl.style.display = 'none';
      pwdEl.style.display = '';
      btn.classList.add('active');  // 加上斜線（隱藏中）
    };
    btn.addEventListener('mouseup', hide);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      visEl.value = pwdEl.value;
      pwdEl.style.display = 'none';
      visEl.style.display = '';
      btn.classList.remove('active');
    });
    btn.addEventListener('touchend', hide);

    // 阻擋中文輸入
    let composing = false;
    pwdEl.addEventListener('compositionstart', () => { composing = true; });
    pwdEl.addEventListener('compositionend', () => {
      composing = false;
      pwdEl.value = pwdEl.value.replace(/[^ -~]/g, '');
    });
    pwdEl.addEventListener('input', () => {
      if (composing) return;
      const pos = pwdEl.selectionStart;
      const val = pwdEl.value.replace(/[^ -~]/g, '');
      if (val !== pwdEl.value) { pwdEl.value = val; pwdEl.setSelectionRange(pos, pos); }
    });
    pwdEl.addEventListener('keydown', (e) => {
      if (e.key.length === 1 && !/^[ -~]$/.test(e.key)) e.preventDefault();
    });
  });
})();
// 讓初始頁面淡入
setTimeout(() => {
  const active = document.querySelector('.screen.active');
  if (active) active.classList.add('visible');
  // 讓初始 active tab 也顯示
  document.querySelectorAll('.tab-content.active').forEach(t => t.classList.add('visible'));
}, 50);

// ─── PROFILE ─────────────────────────────────────────────
let profileEditState = {
  avatar: state.equippedEmoji,
  frame: state.equippedFrame,
  tag: state.playerTag,
  tagClass: state.playerTagClass,
  tagIcon: state.playerTagIcon,
  activeEffect: state.activeEffect || state.owned.activeEffect || null
};

function switchProfileTab(tab) {
  // 先淡出目前的 tab
  document.querySelectorAll('#profileScreen .tab-content').forEach(t => {
    t.classList.remove('visible');  // 淡出
  });
  setTimeout(() => {
    document.querySelectorAll('#profileScreen .tab-content').forEach(t => {
      t.classList.remove('active');  // 隱藏
      t.classList.remove('visible');
    });
    // 淡入新 tab
    const next = document.getElementById('tab-' + tab);
    next.classList.add('active');
    setTimeout(() => { next.classList.add('visible'); next.scrollTop = 0; }, 10);
    document.querySelectorAll('#profileNav .nav-btn').forEach((b, i) => {
      b.classList.remove('active');
      if (['edit', 'stats', 'account'][i] === tab) b.classList.add('active');
    });
    if (tab === 'stats') updateStatsDisplay();
    if (tab === 'edit') updateProfileEditUI();
  }, 200);  // 等淡出完成後再切換
}

function updateProfileEditUI() {
  profileEditState.avatar = state.equippedEmoji;
  profileEditState.frame = state.equippedFrame;
  profileEditState.tagClass = state.playerTagClass;
  profileEditState.tagIcon = state.playerTagIcon;
  profileEditState.activeEffect = state.activeEffect || state.owned.activeEffect || null;

  document.getElementById('editAvatar').textContent = profileEditState.avatar;
  document.getElementById('editFrame').className = `profile-frame ${profileEditState.frame !== 'frame-none' ? profileEditState.frame : ''}`;
  document.getElementById('playerNameInput').value = state.playerName;

  document.querySelectorAll('.emoji-btn').forEach(b=>{
    b.classList.remove('active');
    if(b.textContent === profileEditState.avatar) b.classList.add('active');
  });

  document.querySelectorAll('.frame-select').forEach(b=>{
    b.classList.remove('active', 'disabled');
    const frame = b.dataset.frame;
    if (state.owned.frames && state.owned.frames.includes(frame)) {
      if(frame === profileEditState.frame) b.classList.add('active');
    } else {
      b.classList.add('disabled');
    }
  });

  document.querySelectorAll('.tag-select').forEach(b=>{
    b.classList.remove('active', 'disabled');
    const tag = b.dataset.tag;
    if (state.owned.tags && state.owned.tags.includes(tag)) {
      if(tag === profileEditState.tagClass) b.classList.add('active');
    } else {
      b.classList.add('disabled');
    }
  });

  document.querySelectorAll('.effect-select').forEach(b=>{
    b.classList.remove('active', 'disabled');
    const effectId = b.dataset.effect;
    if (state.owned.effects && state.owned.effects.includes(effectId)) {
      if(effectId === profileEditState.activeEffect) b.classList.add('active');
    } else {
      b.classList.add('disabled');
    }
  });
}

function selectAvatar(emoji) {
  profileEditState.avatar = emoji;
  state.equippedEmoji = emoji;
  document.getElementById('editAvatar').textContent = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b=>{
    b.classList.remove('active');
    if(b.textContent === emoji) b.classList.add('active');
  });
  updatePlayerBar();
}

function selectFrame(frame) {
  if (!state.owned.frames || !state.owned.frames.includes(frame)) {
    showToast('❌ 你還未擁有此外框！請先在商店購買');
    return;
  }
  profileEditState.frame = frame;
  state.equippedFrame = frame;
  document.getElementById('editFrame').className = `profile-frame ${frame !== 'frame-none' ? frame : ''}`;
  document.querySelectorAll('.frame-select').forEach(b=>{
    b.classList.remove('active');
    if(b.dataset.frame === frame) b.classList.add('active');
  });
  updatePlayerBar();
}

function selectTag(tag) {
  const tagNames = {'tag-rookie':'新手','tag-apprentice':'學徒','tag-expert':'專家','tag-master':'大師','tag-legend':'傳說','tag-king':'知識王'};
  const tagIcons = {'tag-rookie':'🌱','tag-apprentice':'📘','tag-expert':'🎯','tag-master':'⭐','tag-legend':'🏆','tag-king':'👑'};
  if (!state.owned.tags || !state.owned.tags.includes(tag)) {
    showToast('❌ 你還未擁有此稱號！請先在商店購買');
    return;
  }
  profileEditState.tagClass = tag;
  state.playerTagClass = tag;
  state.playerTag = tagNames[tag] || '大師';
  state.playerTagIcon = tagIcons[tag] || '';
  document.querySelectorAll('.tag-select').forEach(b=>{
    b.classList.remove('active');
    if(b.dataset.tag === tag) b.classList.add('active');
  });
  updatePlayerBar();
}

async function toggleEffect(effectId, forceEquip = false) {
  if (!state.owned.effects || !state.owned.effects.includes(effectId)) {
    showToast('❌ 你還未擁有此特效！請先在商店購買');
    return;
  }

  // 切換特效：已是同一個就取消，否則套用
  const newEffect = (!forceEquip && (state.activeEffect || state.owned.activeEffect) === effectId)
    ? null : effectId;

  state.activeEffect = newEffect;
  state.owned.activeEffect = newEffect;
  profileEditState.activeEffect = newEffect;
  updateProfileEditUI();
  showToast(newEffect ? '✅ 特效已套用！' : '✅ 已取消特效');

  // 存到後端
  try {
    await fetch(`${API_BASE}/user/active-effect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, effect_id: newEffect })
    });
  } catch (e) {
    console.error('儲存特效失敗:', e);
  }
}

function toggleNameEdit() {
  const input = document.getElementById('playerNameInput');
  const btn = document.getElementById('editNameBtn');
  if (input.disabled) {
    input.disabled = false;
    input.focus();
    btn.textContent = '✓ 完成';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
  } else {
    const newName = input.value.trim();
    if(!newName) { showToast('玩家名稱不能為空！'); return; }
    state.playerName = newName;
    updatePlayerBar();
    input.disabled = true;
    btn.textContent = '✏️ 修改';
    btn.style.borderColor = '';
    btn.style.color = '';
    showToast('✅ 玩家名稱已保存！');
  }
}

function saveProfileChanges() {
  updatePlayerBar();
  showToast('✅ 資料已保存！');
}

function updateStatsDisplay() {
  // 計算勝率
  const total = state.wins + state.losses;  // 總場數
  const winRate = total > 0 ? Math.round(state.wins / total * 100) : 0;  // 勝率百分比

  // 直接從 state 讀取後端同步的數據
  document.getElementById('statLevel').textContent = state.level;                                    // 等級
  document.getElementById('statWins').textContent = state.wins;                                      // 勝場
  document.getElementById('statLosses').textContent = state.losses;                                  // 敗場
  document.getElementById('statWinRate').textContent = winRate + '%';                                // 勝率
  document.getElementById('statTotalAnswered').textContent = state.totalAnswered || 0;               // 累計答題
  document.getElementById('statAvgAcc').textContent = (state.avgAccuracy || 0) + '%';               // 平均準確率
  document.getElementById('statTotalScore').textContent = (state.totalScore || 0).toLocaleString(); // 累計積分
  document.getElementById('statCoinsDisplay').textContent = state.coins.toLocaleString() + ' 🪙';  // 金幣
  document.getElementById('statXp').textContent = state.xp.toLocaleString() + '/' + state.xpMax.toLocaleString();  // XP

  // 更新帳號安全頁面
  const idDisplay = document.getElementById('accountIdDisplay');
  const nickDisplay = document.getElementById('accountNicknameDisplay');
  const emailDisplay = document.getElementById('accountEmailDisplay');
  if (idDisplay) idDisplay.textContent = state.customId || '-';
  if (nickDisplay) nickDisplay.textContent = state.playerName || '-';
  if (emailDisplay) emailDisplay.textContent = state.email || '-';

  const _colors = ['#ffd700','#c0c0c0','#cd7f32','#7070a0','#7070a0'];
  const _topEntries = Object.entries(state.topicStats)
    .map(([topic, val]) => {
      const total = typeof val === 'object' ? (val.correct||0)+(val.wrong||0) : (val||0);
      const correct = typeof val === 'object' ? (val.correct||0) : (val||0);
      return [topic, total, correct];
    })
    .filter(([,total]) => total > 0)
    .sort((a,b) => b[1]-a[1])
    .slice(0,5);
  const topTopics = _topEntries.length === 0
    ? '<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text2);font-size:13px">尚無對戰記錄</div>'
    : _topEntries.map(([topic, total, correct], i) => {
        const acc = total > 0 ? Math.round(correct/total*100) : 0;
        return `<div class="stat-box" style="text-align:center">
          <div style="font-size:24px;margin-bottom:4px">${topic.split(' ')[0]}</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${topic.includes(' ') ? topic.split(' ').slice(1).join(' ') : topic}</div>
          <div style="font-size:15px;font-weight:900;color:${_colors[i]}">${total} 題</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${acc}% 正確</div>
        </div>`;
      }).join('');
  document.getElementById('topTopics').innerHTML = topTopics;
}

// 密碼不顯示，只顯示遮罩
function togglePasswordVisibility() {
  showToast('基於安全考量，密碼無法顯示');  // 不顯示密碼
}

function ensureModalsAtBody() {
  ['changePwdModal', 'deleteAccountModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  });
}

function getPwdVal(id) {
  const vis = document.getElementById(id + 'Visible');
  const pwd = document.getElementById(id);
  if (vis && vis.style.display !== 'none') return vis.value.trim();
  return pwd ? pwd.value.trim() : '';
}

function showChangePwdModal() {
  ensureModalsAtBody();
  ['changePwdOld', 'changePwdNew', 'changePwdConfirm'].forEach(id => {
    const pwd = document.getElementById(id);
    const vis = document.getElementById(id + 'Visible');
    if (pwd) { pwd.value = ''; pwd.style.display = ''; }
    if (vis) { vis.value = ''; vis.style.display = 'none'; }
  });
  document.getElementById('changePwdError').style.display = 'none';
  const _cpM = document.getElementById('changePwdModal');
  _cpM.style.display = 'flex';
  requestAnimationFrame(() => _cpM.classList.add('modal-open'));
  ['changePwdOld', 'changePwdNew', 'changePwdConfirm'].forEach(id => {
    const pwdEl = document.getElementById(id);
    const visEl = document.getElementById(id + 'Visible');
    const wrap = pwdEl && pwdEl.closest('.password-wrap');
    const oldBtn = wrap && wrap.querySelector('.toggle-pwd-btn');
    if (!pwdEl || !visEl || !oldBtn) return;
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    btn.classList.add('active');
    const show = (e) => { e.preventDefault(); visEl.value = pwdEl.value; pwdEl.style.display = 'none'; visEl.style.display = ''; btn.classList.remove('active'); };
    const hide = () => { pwdEl.value = visEl.value; visEl.style.display = 'none'; pwdEl.style.display = ''; btn.classList.add('active'); };
    btn.addEventListener('mousedown', show);
    btn.addEventListener('mouseup', hide);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('touchstart', show, { passive: false });
    btn.addEventListener('touchend', hide);
  });
}

async function handleChangePassword() {
  const oldPwd = getPwdVal('changePwdOld');
  const newPwd = getPwdVal('changePwdNew');
  const confirmPwd = getPwdVal('changePwdConfirm');
  const errEl = document.getElementById('changePwdError');
  if (!oldPwd || !newPwd || !confirmPwd) { errEl.textContent = '請填寫所有欄位'; errEl.style.display = 'block'; return; }
  if (newPwd.length < 6) { errEl.textContent = '新密碼至少需要 6 位'; errEl.style.display = 'block'; return; }
  if (newPwd !== confirmPwd) { errEl.textContent = '兩次輸入的新密碼不一致'; errEl.style.display = 'block'; return; }
  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, old_password: oldPwd, new_password: newPwd })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || '更換失敗'; errEl.style.display = 'block'; return; }
    const _cpC = document.getElementById('changePwdModal');
    _cpC.classList.remove('modal-open');
    setTimeout(() => { _cpC.style.display = 'none'; }, 250);
    showToast('✅ 密碼已更換成功');
  } catch (err) {
    errEl.textContent = '無法連線到伺服器';
    errEl.style.display = 'block';
  }
}

function showDeleteAccountModal() {
  ensureModalsAtBody();
  const pwd = document.getElementById('deleteAccountPwd');
  const vis = document.getElementById('deleteAccountPwdVisible');
  if (pwd) { pwd.value = ''; pwd.style.display = ''; }
  if (vis) { vis.value = ''; vis.style.display = 'none'; }
  document.getElementById('deleteAccountError').style.display = 'none';
  const _daM = document.getElementById('deleteAccountModal');
  _daM.style.display = 'flex';
  requestAnimationFrame(() => _daM.classList.add('modal-open'));
  const wrap = pwd && pwd.closest('.password-wrap');
  const oldBtn = wrap && wrap.querySelector('.toggle-pwd-btn');
  if (pwd && vis && oldBtn) {
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    btn.classList.add('active');
    const show = (e) => { e.preventDefault(); vis.value = pwd.value; pwd.style.display = 'none'; vis.style.display = ''; btn.classList.remove('active'); };
    const hide = () => { pwd.value = vis.value; vis.style.display = 'none'; pwd.style.display = ''; btn.classList.add('active'); };
    btn.addEventListener('mousedown', show);
    btn.addEventListener('mouseup', hide);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('touchstart', show, { passive: false });
    btn.addEventListener('touchend', hide);
  }
}

async function handleDeleteAccount() {
  const pwd = getPwdVal('deleteAccountPwd');
  const errEl = document.getElementById('deleteAccountError');
  if (!pwd) { errEl.textContent = '請輸入密碼'; errEl.style.display = 'block'; return; }
  if (!confirm('確定要永久刪除帳號嗎？此操作無法復原！')) return;
  try {
    const res = await fetch(`${API_BASE}/user/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || '刪除失敗'; errEl.style.display = 'block'; return; }
    const _daC = document.getElementById('deleteAccountModal');
    _daC.classList.remove('modal-open');
    setTimeout(() => { _daC.style.display = 'none'; }, 250);
    state.userId = null;
    showToast('帳號已刪除');
    setTimeout(() => showScreen('loginScreen'), 1500);
  } catch (err) {
    errEl.textContent = '無法連線到伺服器';
    errEl.style.display = 'block';
  }
}

function logout() {
  if (confirm('確定要登出嗎？')) {
    state.userId = null;
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    showToast('👋 已登出，再見！');
    setTimeout(() => showScreen('loginScreen'), 1500);
  }
}

// ─── LOGIN ───────────────────────────────────────────────
// 忘記密碼：寄送重設連結
async function handleForgotPassword() {
  const email = document.getElementById('forgotEmailInput').value.trim();
  const errEl = document.getElementById('forgotError');
  const sucEl = document.getElementById('forgotSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!email) { errEl.textContent = '請輸入信箱'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || '寄送失敗，請再試一次'; errEl.style.display = 'block'; return; }
    sucEl.textContent = '✅ 重設連結已寄出，請查收信箱';
    sucEl.style.display = 'block';
    document.getElementById('forgotEmailInput').value = '';
  } catch (err) {
    errEl.textContent = '無法連線到伺服器';
    errEl.style.display = 'block';
  }
}

async function handleLogin() {
  const identifier = document.getElementById('usernameInput').value.trim(); // 取得帳號（custom_id 或 email）
  const password = document.getElementById('passwordInput').value.trim();   // 取得密碼

  // 防呆：兩個欄位都必填
  if (!identifier || !password) {
    showLoginError('請填寫帳號和密碼');
    return;
  }

  // 顯示載入中
  const btn = document.querySelector('#loginScreen .btn-gold');
  btn.textContent = '登入中...';
  btn.disabled = true;

  try {
    // 呼叫後端登入 API
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();

    if (!res.ok) {
      // 登入失敗，顯示錯誤訊息
      showLoginError(data.error || '登入失敗，請再試一次');
      return;
    }

    // 登入成功，存放玩家資料
    state.userId = data.user.id;  // 存放玩家的 uuid，之後其他 API 都需要這個

    // 從後端取得玩家完整資料
    await loadUserProfile(data.user.id);

    // 跳轉到主頁
    showScreen('homeScreen');
    updatePlayerBar();

  } catch (err) {
    showLoginError('無法連線到伺服器，請確認後端是否已啟動');
  } finally {
    btn.textContent = '進入競技場';
    btn.disabled = false;
  }
}

async function loadUserProfile(userId) {
  try {
    const res = await fetch(`${API_BASE}/user/profile/${userId}`);
    if (!res.ok) return;
    const profile = await res.json();

    // 從後端更新所有 state 資料
    state.playerName = profile.nickname || profile.custom_id;  // 有暱稱用暱稱，沒有用 custom_id
    state.customId = profile.custom_id;  // 帳號 ID
    state.coins = profile.coins;          // 金幣數量
    state.userId = profile.id;            // 玩家 uuid
    state.email = profile.email;          // 玩家 email
    state.wins = profile.wins ?? 0;            // 勝場數，預設 0
    state.losses = profile.losses ?? 0;        // 敗場數，預設 0
    state.level = profile.level ?? 1;          // 等級，預設 1
    state.xp = profile.xp ?? 0;               // 目前 XP，預設 0
    state.xpMax = profile.xp_max ?? 100;               // XP 上限，預設 100
    state.totalAnswered = profile.total_answered; // 累計答題數
    state.avgAccuracy = profile.avg_accuracy;     // 平均準確率
    state.totalScore = profile.total_score;       // 累計積分
    // 同步已擁有的道具（從資料庫讀取）
    state.owned.frames = profile.owned_frames || ['frame-none'];  // 已擁有的頭像框
    state.owned.tags = profile.owned_tags || ['tag-rookie'];      // 已擁有的稱號
    state.owned.effects = profile.owned_effects || [];            // 已擁有的特效
    state.activeEffect = profile.active_effect || null;           // 目前裝備的特效
    state.owned.activeEffect = profile.active_effect || null;     // 同步 owned.activeEffect

    state.topicStats = profile.topic_stats || {};  // 主題統計（從後端讀取）
    state.recentScores = [];              // 近期得分（等對戰系統串接後才有）
    state.recentAccuracy = [];            // 近期準確率（等對戰系統串接後才有）

    // 更新畫面上的玩家資料
    updatePlayerBar();    // 更新玩家列（金幣、等級、暱稱）
    updateStatsDisplay(); // 更新統計資料頁面

    // 如果是管理員，顯示題庫管理按鈕
    // 管理員才顯示題庫管理按鈕，並控制個人設定的位置
    const adminBtn = document.getElementById('adminBtn');
    const profileBtn = document.getElementById('profileBtn');
    if (profile.is_admin) {
      if (adminBtn) adminBtn.style.display = '';      // 顯示題庫管理（排在第5格）
      if (profileBtn) profileBtn.style.gridColumn = ''; // 個人設定排第6格
    } else {
      if (adminBtn) adminBtn.style.display = 'none';  // 隱藏題庫管理
      if (profileBtn) profileBtn.style.gridColumn = '2'; // 個人設定移到第2欄（排行榜旁邊）
    }
  } catch (err) {
    console.error('載入玩家資料失敗:', err);
  }
}

function showLoginError(msg) {
  const errEl = document.getElementById('loginError');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  } else {
    showToast('❌ ' + msg);
  }
}

// 按下 Enter 鍵也可以登入
document.addEventListener('DOMContentLoaded', () => {
  // Modal 移到 body 最上層，避免被 transform/overflow 影響 position:fixed
  ['changePwdModal', 'deleteAccountModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) document.body.appendChild(el);
  });
  const pwdInput = document.getElementById('passwordInput');
  if (pwdInput) {
    pwdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
  const userInput = document.getElementById('usernameInput');
  if (userInput) {
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
});

// ─── REGISTER & VERIFY ───────────────────────────────────
let pendingVerifyEmail = '';    // 等待驗證的 email，用來傳給驗證 API
let pendingVerifyNickname = ''; // 等待驗證的暱稱，驗證成功後設定
let pendingVerifyPassword = ''; // 等待驗證的密碼，驗證成功後自動登入
let pendingVerifyId = '';       // 等待驗證的 custom_id，驗證成功後自動登入

async function handleRegister() {
  const custom_id = document.getElementById('regIdInput').value.trim();         // 取得玩家 ID
  const nickname = document.getElementById('regNicknameInput').value.trim();    // 取得暱稱
  const email = document.getElementById('regEmailInput').value.trim();          // 取得 email
  const password = document.getElementById('regPasswordInput').value.trim();    // 取得密碼

  // 防呆：四個欄位都必填
  if (!custom_id || !nickname || !email || !password) {
    showRegisterError('請填寫所有欄位');
    return;
  }

  // 顯示載入中
  const btn = document.querySelector('#registerScreen .btn-gold');
  btn.textContent = '建立中...';
  btn.disabled = true;

  try {
    // 呼叫後端註冊 API
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_id, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      // 註冊失敗，顯示錯誤訊息
      showRegisterError(data.error || '註冊失敗，請再試一次');
      return;
    }

    // 註冊成功，把暱稱暫存起來，驗證完後設定
    pendingVerifyEmail = email;
    pendingVerifyNickname = nickname;   // 暫存暱稱
    pendingVerifyPassword = password;   // 暫存密碼（驗證後自動登入用）
    pendingVerifyId = custom_id;        // 暫存 custom_id（驗證後自動登入用）
    document.getElementById('verifyEmailDisplay').textContent = email;
    showScreen('verifyScreen');

  } catch (err) {
    showRegisterError('無法連線到伺服器，請確認後端是否已啟動');
  } finally {
    btn.textContent = '建立帳號';
    btn.disabled = false;
  }
}

async function handleVerify() {
  const code = document.getElementById('verifyCodeInput').value.trim(); // 取得驗證碼

  // 防呆：驗證碼必填
  if (!code) {
    showVerifyError('請輸入驗證碼');
    return;
  }

  // 顯示載入中
  const btn = document.querySelector('#verifyScreen .btn-gold');
  btn.textContent = '驗證中...';
  btn.disabled = true;

  try {
    // 呼叫後端驗證 API
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingVerifyEmail, code })
    });

    const data = await res.json();

    if (!res.ok) {
      // 驗證失敗，顯示錯誤訊息
      showVerifyError(data.error || '驗證失敗，請再試一次');
      return;
    }

    // 驗證成功，自動登入拿到 user_id
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: pendingVerifyId, password: pendingVerifyPassword })
    });

    const loginData = await loginRes.json();

    if (loginRes.ok && loginData.user) {
      // 自動登入成功，設定暱稱
      await fetch(`${API_BASE}/user/nickname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: loginData.user.id, new_nickname: pendingVerifyNickname })
      });
    }

    // 清空暫存資料和輸入欄位
    pendingVerifyEmail = '';
    pendingVerifyNickname = '';
    pendingVerifyPassword = '';
    pendingVerifyId = '';
    document.getElementById('verifyCodeInput').value = '';
    document.getElementById('regIdInput').value = '';
    document.getElementById('regNicknameInput').value = '';
    document.getElementById('regEmailInput').value = '';
    document.getElementById('regPasswordInput').value = '';

    showToast('✅ 帳號開通成功！請登入');
    showScreen('loginScreen');

  } catch (err) {
    showVerifyError('無法連線到伺服器，請確認後端是否已啟動');
  } finally {
    btn.textContent = '確認驗證';
    btn.disabled = false;
  }
}

function showRegisterError(msg) {
  const errEl = document.getElementById('registerError');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function showVerifyError(msg) {
  const errEl = document.getElementById('verifyError');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

// ─── 題庫管理（管理員專用）────────────────────────────────
const ADMIN_CATEGORIES = [
  '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
  '物理', '化學', '生物', '地科', '程式', '健教', '家政',
  '軍教', '人文', '常識', '新聞', '其他'
];

let adminSelectedCats = [...ADMIN_CATEGORIES];  // 已選擇的分類
let adminGeneratedQuestions = [];               // 本次生成的題目
let adminReady = false;                         // generate 後端是否已連線

// 初始化題庫管理頁面
async function initAdminScreen() {
  // 確認 generate 後端可以連線
  if (!adminReady) {
    try {
      const res = await fetch(`${GEN_BASE}/config`);
      if (!res.ok) throw new Error();
      adminReady = true;  // 連線成功
    } catch (e) {
      showToast('無法連線到題庫生成工具後端');
      return;
    }
  }

  adminInitCategorySelects();  // 初始化分類下拉選單
  adminLoadQuestions(1);         // 載入題目列表

  // 初始化分類按鈕（只初始化一次）
  const grid = document.getElementById('adminCatGrid');
  if (grid && grid.children.length === 0) {
    ['全選', '全清'].forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn special';
      btn.textContent = label;
      btn.onclick = () => {
        const active = label === '全選';
        adminSelectedCats = active ? [...ADMIN_CATEGORIES] : [];
        grid.querySelectorAll('.cat-btn.cat-item').forEach(b => b.classList.toggle('active', active));
      };
      grid.appendChild(btn);
    });

    ADMIN_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn cat-item active';
      btn.textContent = cat;
      btn.onclick = () => {
        if (adminSelectedCats.includes(cat)) {
          adminSelectedCats = adminSelectedCats.filter(c => c !== cat);
          btn.classList.remove('active');
        } else {
          adminSelectedCats.push(cat);
          btn.classList.add('active');
        }
      };
      grid.appendChild(btn);
    });
  }
}

// 開始生成題目
async function adminStartGenerate() {
  if (adminSelectedCats.length === 0) {
    showToast('請至少選擇一個分類！');
    return;
  }

  if (!adminReady) {
    showToast('尚未連線到題庫生成工具後端');
    return;
  }

  const count = parseInt(document.getElementById('adminCountInput').value) || 10;
  const btn = document.getElementById('adminGenBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';

  document.getElementById('adminProgressWrap').style.display = 'block';
  document.getElementById('adminResultsSection').style.display = 'none';
  document.getElementById('adminLogArea').innerHTML = '';
  document.getElementById('adminPreviewArea').innerHTML = '';
  adminGeneratedQuestions = [];

  adminSetProgress(10, 'AI 正在生成題目...');
  adminLog(`開始生成 ${count} 題，分類：${adminSelectedCats.join('、')}`, 'info');

  try {
    const questions = await adminGenerateQuestions(adminSelectedCats, count);
    adminGeneratedQuestions = questions;

    adminSetProgress(100, '完成！');
    adminLog(`✓ 完成！共生成並存入 ${questions.length} 題`, 'ok');

    document.getElementById('adminStatTotal').textContent = questions.length;
    document.getElementById('adminStatSaved').textContent = questions.length;
    document.getElementById('adminStatFail').textContent = 0;
    document.getElementById('adminResultsSection').style.display = 'block';
    showToast(`✅ 成功存入 ${questions.length} 題！`);

  } catch (e) {
    adminLog(`✗ 錯誤: ${e.message}`, 'err');
    showToast('生成失敗：' + e.message);
    adminSetProgress(0, '失敗');
  }

  btn.disabled = false;
  btn.textContent = '⚡ 開始生題並存入資料庫';
}

// 呼叫 generate 後端 POST /generate，後端負責呼叫 Gemini 和存入 Supabase
async function adminGenerateQuestions(categories, count) {
  const res = await fetch(`${GEN_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories, count })  // 傳送分類和數量
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '生成失敗');
  return data.questions;  // 回傳題目列表
}

function adminLog(msg, type = '') {
  const area = document.getElementById('adminLogArea');
  const div = document.createElement('div');
  div.className = type;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function adminSetProgress(pct, text) {
  document.getElementById('adminProgressBar').style.width = pct + '%';
  document.getElementById('adminProgressText').textContent = text;
  document.getElementById('adminProgressPct').textContent = pct + '%';
}

function adminShowPreview() {
  if (!adminGeneratedQuestions.length) return;
  const preview = adminGeneratedQuestions.slice(0, 5);
  document.getElementById('adminPreviewArea').innerHTML = `
    <div class="admin-preview-wrap">
      <table>
        <thead><tr><th>#</th><th>分類</th><th>題目</th><th>A</th><th>B</th><th>C</th><th>D</th><th>答</th></tr></thead>
        <tbody>
          ${preview.map((q, i) => `
            <tr>
              <td style="color:var(--text2)">${i + 1}</td>
              <td><span class="cat-tag">${q.category}</span></td>
              <td>${q.question}</td>
              <td>${q.answer_a}</td>
              <td>${q.answer_b}</td>
              <td>${q.answer_c}</td>
              <td>${q.answer_d}</td>
              <td><strong style="color:var(--accent)">${q.correct_answer}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="color:var(--text2);font-size:0.8rem;margin-top:8px;text-align:center">顯示前 ${preview.length} 題預覽</p>
  `;
}

function adminExportSQL() {
  if (!adminGeneratedQuestions.length) return;
  const esc = s => (s || '').replace(/'/g, "''");
  const sql = adminGeneratedQuestions.map(q =>
    `INSERT INTO questions (category, question, answer_a, answer_b, answer_c, answer_d, correct_answer) VALUES ('${esc(q.category)}', '${esc(q.question)}', '${esc(q.answer_a)}', '${esc(q.answer_b)}', '${esc(q.answer_c)}', '${esc(q.answer_d)}', '${esc(q.correct_answer)}');`
  ).join('\n');
  const blob = new Blob([sql], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `questions_${new Date().toISOString().slice(0, 10)}.sql`;
  a.click();
}

// ─── 題目管理（查詢、編輯、刪除）────────────────────────────
const ADMIN_CATEGORIES_LIST = [
  '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
  '物理', '化學', '生物', '地科', '程式', '健教', '家政',
  '軍教', '人文', '常識', '新聞', '其他'
];

let adminCurrentPage = 1;   // 目前頁數
let adminTotalPages = 1;    // 總頁數
let adminSelectedIds = new Set();  // 已勾選的題目 ID

// 初始化分類下拉選單
function adminInitCategorySelects() {
  const filterSel = document.getElementById('adminFilterCat');
  const editSel = document.getElementById('editQCat');
  if (filterSel && filterSel.options.length <= 1) {
    ADMIN_CATEGORIES_LIST.forEach(cat => {
      filterSel.appendChild(new Option(cat, cat));
      if (editSel) editSel.appendChild(new Option(cat, cat));
    });
  }
}

// 載入題目列表
// 切換題庫管理 Tab
function switchAdminTab(tab) {
  // 更新 nav 按鈕
  document.querySelectorAll('#adminNav .nav-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tab === 'generate') || (i === 1 && tab === 'manage'));
  });

  // 切換 tab 內容
  ['generate', 'manage'].forEach(t => {
    const el = document.getElementById('admin-tab-' + t);
    if (!el) return;
    if (t === tab) {
      el.classList.add('active');
      setTimeout(() => el.classList.add('visible'), 10);
    } else {
      el.classList.remove('active', 'visible');
    }
  });

  // 切換到管理 Tab 時載入題目
  if (tab === 'manage') adminLoadQuestions(1);
}

async function adminLoadQuestions(page = 1) {
  adminCurrentPage = page;
  adminSelectedIds.clear();

  const keyword = document.getElementById('adminKeyword').value.trim();  // 搜尋關鍵字
  const category = document.getElementById('adminFilterCat').value;       // 分類篩選

  const params = new URLSearchParams({ page, page_size: 15 });
  if (keyword) params.set('keyword', keyword);
  if (category) params.set('category', category);

  const listEl = document.getElementById('adminQuestionList');
  listEl.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px">載入中...</p>';

  try {
    const res = await fetch(`${GEN_BASE}/questions?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const questions = data.questions;
    adminTotalPages = Math.ceil(data.total / 15) || 1;

    if (questions.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px">沒有找到題目</p>';
      document.getElementById('adminPagination').innerHTML = '';
      return;
    }

    // 渲染題目列表
    listEl.innerHTML = questions.map(q => `
      <div class="admin-q-row" id="qrow-${q.id}">
        <input type="checkbox" class="admin-q-check" value="${q.id}" onchange="adminToggleSelect(${q.id}, this.checked)">
        <span class="cat-tag">${q.category}</span>
        <span class="admin-q-text">${q.question}</span>
        <span class="admin-q-ans">答：${q.correct_answer}</span>
        <div class="admin-q-actions">
          <button class="btn btn-outline btn-sm" onclick="adminOpenEdit(${JSON.stringify(q).replace(/"/g, '&quot;')})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteOne(${q.id})">🗑️</button>
        </div>
      </div>
    `).join('');

    // 渲染分頁
    adminRenderPagination(data.total);

  } catch (e) {
    listEl.innerHTML = `<p style="color:var(--red);text-align:center;padding:20px">載入失敗：${e.message}</p>`;
  }
}

// 渲染分頁按鈕
function adminRenderPagination(total) {
  const el = document.getElementById('adminPagination');
  if (adminTotalPages <= 1) { el.innerHTML = ''; return; }

  const cur = adminCurrentPage;
  const last = adminTotalPages;
  let html = `<span style="color:var(--text2);font-size:13px;margin-right:4px">共 ${total} 筆</span>`;

  if (cur > 1) html += `<button class="btn btn-sm btn-outline" onclick="adminLoadQuestions(${cur - 1})">‹</button>`;

  const pages = new Set([1, last, cur-2, cur-1, cur, cur+1, cur+2].filter(p => p >= 1 && p <= last));
  let prev = 0;
  for (const p of [...pages].sort((a,b) => a-b)) {
    if (prev && p - prev > 1) html += `<span style="color:var(--text2);padding:0 4px">…</span>`;
    html += `<button class="btn btn-sm ${p === cur ? 'btn-gold' : 'btn-outline'}" onclick="adminLoadQuestions(${p})">${p}</button>`;
    prev = p;
  }

  if (cur < last) html += `<button class="btn btn-sm btn-outline" onclick="adminLoadQuestions(${cur + 1})">›</button>`;

  el.innerHTML = html;
}

// 勾選題目
function adminToggleSelect(id, checked) {
  if (checked) adminSelectedIds.add(id);
  else adminSelectedIds.delete(id);
}

// 刪除單筆
async function adminDeleteOne(id) {
  if (!confirm('確定要刪除這題嗎？')) return;
  await adminDoDelete([id]);
}

// 刪除選取的多筆
async function adminDeleteSelected() {
  if (adminSelectedIds.size === 0) { showToast('請先勾選要刪除的題目'); return; }
  if (!confirm(`確定要刪除選取的 ${adminSelectedIds.size} 題嗎？`)) return;
  await adminDoDelete([...adminSelectedIds]);
}

// 執行刪除
async function adminDoDelete(ids) {
  try {
    const res = await fetch(`${GEN_BASE}/questions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`✅ 已刪除 ${ids.length} 題`);
    adminLoadQuestions(adminCurrentPage);  // 重新載入
  } catch (e) {
    showToast('刪除失敗：' + e.message);
  }
}

// 開啟編輯 Modal
function adminOpenEdit(q) {
  document.getElementById('editQId').value = q.id;
  document.getElementById('editQText').value = q.question;
  document.getElementById('editQA').value = q.answer_a;
  document.getElementById('editQB').value = q.answer_b;
  document.getElementById('editQC').value = q.answer_c;
  document.getElementById('editQD').value = q.answer_d;
  document.getElementById('editQAns').value = q.correct_answer;
  document.getElementById('editQCat').value = q.category;
  document.getElementById('adminEditModal').style.display = 'flex';
}

// 關閉編輯 Modal
function adminCloseEdit() {
  document.getElementById('adminEditModal').style.display = 'none';
}

// 儲存編輯
async function adminSaveEdit() {
  const id = document.getElementById('editQId').value;
  const data = {
    question: document.getElementById('editQText').value.trim(),
    answer_a: document.getElementById('editQA').value.trim(),
    answer_b: document.getElementById('editQB').value.trim(),
    answer_c: document.getElementById('editQC').value.trim(),
    answer_d: document.getElementById('editQD').value.trim(),
    correct_answer: document.getElementById('editQAns').value,
    category: document.getElementById('editQCat').value,
  };

  if (!data.question || !data.answer_a || !data.answer_b || !data.answer_c || !data.answer_d) {
    showToast('請填寫所有欄位');
    return;
  }

  try {
    const res = await fetch(`${GEN_BASE}/questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    showToast('✅ 題目已更新');
    adminCloseEdit();
    adminLoadQuestions(adminCurrentPage);  // 重新載入
  } catch (e) {
    showToast('更新失敗：' + e.message);
  }
}