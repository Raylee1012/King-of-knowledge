// ─── CONFIG ──────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';  // 帳號系統後端（登入、註冊、玩家資料）
const WS_BASE  = 'ws://localhost:4000/ws'; // 對戰系統後端（WebSocket）
const GEN_BASE = 'http://localhost:5000';  // 題庫生成管理工具（管理員用）

// ─── STATE ──────────────────────────────────────────────
const state = {
  userId: null,  // 登入後存放玩家的 uuid
  email: '',       // 登入後存放玩家的 email
  coins: 0, level: 1, xp: 0, xpMax: 100,
  playerName: '知識戰士', playerTag: '新手', playerTagClass: 'tag-rookie', playerTagIcon: '🌱',  // 預設新手稱號
  equippedFrame: 'frame-none', equippedEmoji: '🧠', avatarMode: 'emoji', customAvatarDataUrl: '', activeEffect: null,  // 預設無邊框
  owned: { frames: ['frame-none'], tags: ['tag-rookie'], effects: [] },  // 預設只有無邊框和新手稱號
  wins: 0, losses: 0,
  topicStats: {},
  recentScores: [],
  recentAccuracy: [],
  nicknameRemainingFree: 3,
  renameCards: 0,
  battleData: { round:0, playerScore:0, oppScore:0, correct:0, total:0, timer:null, timerVal:15, combo:0, answering:false, topicStats: {} },
  totalAnswered: 0,  // 累計答題數，從後端同步
  avgAccuracy: 0,    // 平均準確率，從後端同步
  totalScore: 0      // 累計積分，從後端同步
};


// ─── SHOP DATA ───────────────────────────────────────────
const shopData = {
  frames: [
    {id:'frame-none',name:'無邊框',desc:'標準外觀',price:0,preview:'⬜',class:''},
    {id:'frame-gold',name:'黃金戰士',desc:'閃耀黃金光芒',price:1000,preview:'🟡',class:'frame-gold'},
    {id:'frame-diamond',name:'鑽石冠軍',desc:'藍色旋轉鑽石框',price:2000,preview:'💎',class:'frame-diamond'},
    {id:'frame-fire',name:'火焰王者',desc:'橘紅火焰特效',price:2000,preview:'🔥',class:'frame-fire'},
    {id:'frame-rainbow',name:'彩虹傳說',desc:'七彩漸變框（稀有）',price:5000,preview:'🌈',class:'frame-rainbow'},
  ],
  tags: [
    {id:'tag-rookie',name:'新手',desc:'剛入門的稱號',price:0,unlockLevel:1,preview:'🌱',class:'tag-rookie'},
    {id:'tag-apprentice',name:'學徒',desc:'開始累積知識的挑戰者',price:200,unlockLevel:10,preview:'📘',class:'tag-apprentice'},
    {id:'tag-expert',name:'專家',desc:'熟練掌握多種主題',price:500,unlockLevel:25,preview:'🎯',class:'tag-expert'},
    {id:'tag-master',name:'大師',desc:'知識的探索者',price:1000,unlockLevel:50,preview:'⭐',class:'tag-master'},
    {id:'tag-legend',name:'傳說',desc:'頂尖知識戰士',price:2000,unlockLevel:75,preview:'🏆',class:'tag-legend'},
    {id:'tag-king',name:'知識王',desc:'最高榮耀稱號',price:5000,unlockLevel:100,preview:'👑',class:'tag-king'},
  ],
  effects: [
    {id:'eff-confetti',name:'彩紙爆炸',desc:'答對時彩紙飛舞',price:2000,preview:'🎊'},
    {id:'eff-lightning',name:'閃電特效',desc:'連答正確閃電爆發',price:2500,preview:'⚡'},
    {id:'eff-star',name:'星光迸發',desc:'每次答題星光特效',price:3000,preview:'✨'},
  ],
  skills: [
    {id:'skill-5050',name:'50/50',desc:'消去兩個錯誤選項',price:500,preview:'🎯'},
    {id:'skill-time',name:'加時 +10秒',desc:'對戰時延長作答時間',price:300,preview:'⏱️'},
  ],
  items: [
    {id:'item-rename',name:'改名卡',desc:'每月免費次數用完後，可多改一次暱稱',price:500,preview:'✏️'},
  ]
};


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
    if (current.id === 'registerScreen') {
      ['regIdInput', 'regNicknameInput', 'regEmailInput',
       'regPasswordInput', 'regPasswordInputVisible',
       'regPasswordConfirm', 'regPasswordConfirmVisible'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const errEl = document.getElementById('registerError');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    }
    if (current.id === 'loginScreen') {
      document.getElementById('usernameInput').value = '';
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInputVisible').value = '';
      const errEl = document.getElementById('loginError');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    }
    if (current.id === 'forgotScreen') {
      document.getElementById('forgotEmailInput').value = '';
      const errEl = document.getElementById('forgotError');
      const sucEl = document.getElementById('forgotSuccess');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      if (sucEl) { sucEl.textContent = ''; sucEl.style.display = 'none'; }
    }
    if (current.id === 'roomMatchScreen') {
      const roomInput = document.getElementById('roomIdInput');
      if (roomInput) roomInput.value = '';
    }
    setTimeout(() => {
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.remove('visible');
      });
      // 淡入新頁面
      const next = document.getElementById(id);
      next.classList.add('active');
      setTimeout(() => next.classList.add('visible'), 10);  // 稍微延遲讓 CSS transition 生效
      if(id==='analyticsScreen') { switchAnalytics('distribution'); setTimeout(initCharts, 100); }
      if(id==='shopScreen') switchShop('frames');
      if(id==='rankScreen') renderRank();
      if(id==='profileScreen') { switchProfileTab('edit'); updateProfileEditUI(); updateStatsDisplay(); }
      if(id==='adminScreen') { switchAdminTab('generate'); initAdminScreen(); }

      if(id==='forgotScreen') {
        document.getElementById('forgotEmailInput').value = '';
        const fe = document.getElementById('forgotError');
        const fs = document.getElementById('forgotSuccess');
        if (fe) { fe.textContent = ''; fe.style.display = 'none'; }
        if (fs) { fs.textContent = ''; fs.style.display = 'none'; }
      }
      if(id==='verifyScreen') {
        clearVerifyCodeInputs();
        setTimeout(() => focusVerifyCodeInput(0), 60);
      }
    }, 350);  // 等淡出完成後再切換
  } else {
    // 第一次載入沒有 active 頁面
    const next = document.getElementById(id);
    next.classList.add('active');
    setTimeout(() => next.classList.add('visible'), 10);
  }
}

// ─── MATH RENDER ─────────────────────────────────────────
const KATEX_OPTS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$',  right: '$',  display: false },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false }
  ],
  throwOnError: false
};

function renderMath(el, text) {
  el.textContent = text;
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(el, KATEX_OPTS);
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

let _coinSyncTimer = null;

function startCoinSync() {
  stopCoinSync();
  _coinSyncTimer = setInterval(async () => {
    if (!state.userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/coins/${state.userId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.coins !== undefined && data.coins !== state.coins) {
        state.coins = data.coins;
        updatePlayerBar();
      }
    } catch {}
  }, 60000);
}

function stopCoinSync() {
  if (_coinSyncTimer) { clearInterval(_coinSyncTimer); _coinSyncTimer = null; }
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
  ['playerAvatar', 'playerAvatar3'].forEach(id => renderAvatarElement(document.getElementById(id)));
  const pf = document.getElementById('playerFrame');
  pf.className = 'avatar-frame ' + (state.equippedFrame !== 'frame-none' ? state.equippedFrame : '');
}

// ─── BATTLE ──────────────────────────────────────────────
let currentQ = 0, questionOrder = [];
let battleWs = null;       // 對戰 WebSocket 連線
let battleStartTime = 0;   // 題目開始時間，用來計算作答秒數
let currentBattleMode = null;  // 記錄當前對戰模式（'bot', 'queue', 'create_room', 'join_room'）
let currentRoomId = null;   // 記錄當前房間 ID
let battleIntentionalClose = false; // 是否為故意關閉連線
let battleSuppressErrorUntil = 0; // 抑制錯誤提示的時間戳
let battleGameStarted = false; // 是否已收到 game_start，才算對戰真正開始

function suppressBattleError() {
  battleIntentionalClose = true;
  battleSuppressErrorUntil = Date.now() + 3000;
}

function startBattle(mode = 'bot') {
  // 隨機對戰前檢查金幣是否足夠（>0）
  if (mode === 'queue' && state.coins <= 0) {
    showToast('金幣不足，無法進行隨機對戰！');
    return;
  }

  currentBattleMode = mode;
  battleIntentionalClose = false;
  battleGameStarted = false;
  
  // 重置對戰資料
  const bd = state.battleData;
  bd.round = 0; bd.playerScore = 0; bd.oppScore = 0; bd.correct = 0; bd.oppCorrect = 0; bd.total = 0; bd.combo = 0; bd.answering = false; bd.topicStats = {};
  if (bd.timer) clearInterval(bd.timer);
  resetSkillBtns();
  updateScoreDisplay();
  renderAvatarElement(document.getElementById('battleAvatar'));
  document.getElementById('battleName').textContent = state.playerName;

  // 關閉舊的 WebSocket 連線
  if (battleWs) {
    battleIntentionalClose = true;
    battleWs.close();
    battleWs = null;
  }

  // 建立新的 WebSocket 連線
  battleWs = new WebSocket(WS_BASE);

  battleWs.onopen = () => {
    // 連線成功後才進入對戰畫面，並依模式發送對應訊息
    showScreen('battleScreen');
    const joinBase = { userName: state.playerName, userId: state.userId, equippedEmoji: state.equippedEmoji || '🧠' };
    if (mode === 'bot') {
      battleWs.send(JSON.stringify({ type: 'join_bot', ...joinBase }));
    } else if (mode === 'queue') {
      battleWs.send(JSON.stringify({ type: 'join_queue', ...joinBase }));
    } else if (mode === 'create_room') {
      battleWs.send(JSON.stringify({ type: 'create_room', ...joinBase }));
    } else if (mode === 'join_room') {
      battleWs.send(JSON.stringify({ type: 'join_room', roomId: currentRoomId, ...joinBase }));
    }
  };

  battleWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleBattleMessage(msg);
  };

  battleWs.onerror = (err) => {
    setTimeout(() => {
      if (Date.now() < battleSuppressErrorUntil) return;
      if (!battleIntentionalClose && (!battleWs || battleWs.readyState !== WebSocket.OPEN)) {
        console.error('WebSocket 錯誤:', err);
        showToast('連線失敗，請確認對戰伺服器是否啟動');
      }
    }, 1500);
  };

  battleWs.onclose = (event) => {
    console.log('WebSocket 已關閉', event.code, event.reason);
    if (Date.now() >= battleSuppressErrorUntil) {
      if (!battleIntentionalClose && event.code !== 1000) {
        showToast('連線失敗，請確認對戰伺服器是否啟動');
      }
    }
    battleIntentionalClose = false;
  };
}

// 創建戰鬥房間
function createBattleRoom() {
  startBattle('create_room');
}

// 加入房間
function joinBattleRoom() {
  const roomId = document.getElementById('roomIdInput').value.trim();
  if (!roomId || roomId.length !== 6 || isNaN(roomId)) {
    showToast('請輸入有效的房號（6位數字）');
    return;
  }
  currentRoomId = roomId;
  startBattle('join_room');
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
    suppressBattleError();
    battleWs.send(JSON.stringify({ type: 'quit_match' }));
    battleWs.close();
    battleWs = null;
  }
  if (currentBattleMode === 'bot') {
    showScreen('battleModeScreen');
    return;
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
      waitingSubtext.innerHTML = `房號: <span class="room-id-highlight">${msg.roomId}</span><br>請分享給朋友`;
    }
    return;
  }

  if (msg.type === 'rematch_requested') {
    // 對手邀請再來一局，顯示詢問覆蓋層
    const overlay = document.getElementById('rematchInviteOverlay');
    if (overlay) overlay.style.display = 'flex';
    return;
  }

  if (msg.type === 'rematch_declined') {
    showDeclineAndExit('對手婉拒了再來一局，遊戲結束！');
    return;
  }

  if (msg.type === 'game_start') {
    // 若從結果頁收到 game_start（即再來一局），重設對戰 UI
    const onResultScreen = document.getElementById('resultScreen')?.classList.contains('active');
    if (onResultScreen) {
      const bd = state.battleData;
      bd.round = 0; bd.playerScore = 0; bd.oppScore = 0; bd.correct = 0; bd.oppCorrect = 0;
      bd.total = 0; bd.combo = 0; bd.answering = false; bd.topicStats = {};
      if (bd.timer) clearInterval(bd.timer);
      resetSkillBtns();
      updateScoreDisplay();
      renderAvatarElement(document.getElementById('battleAvatar'));
      document.getElementById('battleName').textContent = state.playerName;
      showScreen('battleScreen');
    }
    battleGameStarted = true;
    hideWaitingScreen();
    document.getElementById('oppName').textContent = msg.opponentName;
    document.getElementById('battleName').textContent = state.playerName;
    bd.playerIndex = msg.playerIndex;

    // 渲染對手頭像
    const oppAvatarEl = document.getElementById('oppAvatar');
    if (oppAvatarEl) {
      if (msg.opponentUserId) {
        // 真人對手：抓 profile 取得頭像
        fetch(`${API_BASE}/user/profile/${msg.opponentUserId}`)
          .then(r => r.ok ? r.json() : null)
          .then(profile => {
            oppAvatarEl.innerHTML = '';
            if (profile?.avatar_url) {
              oppAvatarEl.classList.add('avatar-has-image');
              const img = document.createElement('img');
              img.className = 'custom-avatar-img';
              img.src = profile.avatar_url;
              img.alt = 'avatar';
              oppAvatarEl.appendChild(img);
            } else {
              oppAvatarEl.classList.remove('avatar-has-image');
              oppAvatarEl.textContent = profile?.equipped_emoji || msg.opponentEmoji || '🧠';
            }
          })
          .catch(() => {
            oppAvatarEl.classList.remove('avatar-has-image');
            oppAvatarEl.textContent = msg.opponentEmoji || '🧠';
          });
      } else {
        // Bot：固定顯示 🤖
        oppAvatarEl.classList.remove('avatar-has-image');
        oppAvatarEl.innerHTML = '';
        oppAvatarEl.textContent = '🤖';
      }
    }
    return;
  }

  if (msg.type === 'question') {
    // 收到新題目
    bd.round = msg.index + 1;
    bd.answering = false;
    bd.currentQuestion = msg;  // 儲存題目資料
    battleStartTime = Date.now();  // 記錄題目開始時間
    document.getElementById('roundNum').textContent = bd.round;
    document.getElementById('comboMult').textContent = bd.combo || 1;

    // 顯示題目
    const badge = document.getElementById('topicBadge');
    if (msg.isDaily) {
      const emoji = DAILY_EMOJI[msg.category] || '📌';
      badge.textContent = `${emoji} ${msg.category} ⚡x2`;
      badge.classList.add('daily');
    } else {
      badge.textContent = msg.category || '知識王';
      badge.classList.remove('daily');
    }
    renderMath(document.getElementById('questionText'), msg.question);

    // 顯示選項
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];
    msg.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'option-label';
      labelSpan.textContent = labels[i];
      const textSpan = document.createElement('span');
      btn.appendChild(labelSpan);
      btn.appendChild(textSpan);
      renderMath(textSpan, opt);
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
      if (msg.isDaily) showToast(`⚡ 今日主題 x2！+${myResult.gained}`);
      if (bd.combo >= 2) showComboPopup(bd.combo); // 2 連擊以上顯示彈出提示
      showXpPopup();
    } else {
      bd.combo = 0;  // 答錯或超時重置 combo
      document.getElementById('comboMult').textContent = 1;
      addWrongFlash();                              // 答錯特效
    }
    updateScoreDisplay();
    return;
  }

  if (msg.type === 'item_used') {
    // 道具使用成功
    const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
    if (btns[msg.removedOptionIdx]) {
      btns[msg.removedOptionIdx].classList.add('option-removed');
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
    suppressBattleError();
    endBattle(true);
    return;
  }

  if (msg.type === 'game_end') {
    // 遊戲結束
    const bd = state.battleData;
    const won = msg.winner === bd.playerIndex;
    // 保存當前玩家的題目分類統計
    if (msg.topicStats && msg.topicStats[bd.playerIndex]) {
      bd.topicStats = msg.topicStats[bd.playerIndex];
    }
    suppressBattleError();
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

  // 非房號對戰才立即關閉 WebSocket；房號對戰保留連線以等待再來一局邀請
  const isRoomMode = currentBattleMode === 'create_room' || currentBattleMode === 'join_room';
  if (!isRoomMode) {
    if (battleWs) {
      suppressBattleError();
      battleWs.close();
      battleWs = null;
    }
  }

  const acc = bd.total > 0 ? Math.round(bd.correct / bd.total * 100) : 0;  // 計算準確率

  let xpGain = 0;
  let serverCoinDelta = null;
  const prevLevel = state.level;  // 升等動畫用：記錄舊等級
  // 未真正開始對戰（伺服器未連上），不寫入任何記錄
  if (!battleGameStarted) {
    showScreen('battleModeScreen');
    return;
  }
  // 呼叫後端更新統計資料
  try {
    console.log('[endBattle] 發送數據到後端:', {  // 調試：列印發送的數據
      user_id: state.userId,
      mode: currentBattleMode,
      won: finalWon,
      correct: bd.correct,
      total: bd.total,
      opp_correct: bd.oppCorrect || 0
    });
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
        mode: currentBattleMode,
        topic_stats: bd.topicStats  // 題目分類統計
      })
    });
    
    console.log('[endBattle] 響應狀態:', res.status, res.statusText);
    
    let data = null;
    try {
      data = await res.json();
      console.log('[endBattle] 後端返回數據:', data);
    } catch (parseErr) {
      console.error('[endBattle] JSON 解析失敗:', parseErr, '響應文本:', await res.text());
      throw parseErr;
    }
    
    if (res.ok && data) {
      // 更新本地 state
      state.coins = data.coins;
      state.level = data.level;
      state.xp = data.xp;
      state.xpMax = data.xp_max;
      state.wins = data.wins;
      state.losses = data.losses;
      state.totalAnswered = data.total_answered;
      state.avgAccuracy = data.avg_accuracy;
      state.totalScore = data.total_score;
      if (data.topic_stats) state.topicStats = data.topic_stats;
      
      // 關鍵：確保 xp_gain 被正確提取
      const receivedXpGain = parseInt(data.xp_gain);
      xpGain = !isNaN(receivedXpGain) ? receivedXpGain : 0;
      
      console.log('[endBattle] xpGain 最終值:', xpGain, '(來自後端:', data.xp_gain, ')');
      
      serverCoinDelta = data.coin_delta !== undefined ? data.coin_delta : null;
      if (data.leveled_up) showLevelUpOverlay(data.level, data.level_up_base || 0, data.level_up_milestone || 0);
      updatePlayerBar();  // 更新玩家列
      renderRank();
    } else {
      console.error('[endBattle] 後端返回非 OK 狀態:', res.status, data);
      // 即使後端失敗，也嘗試設置 xpGain
      if (data && data.xp_gain !== undefined) {
        const receivedXpGain = parseInt(data.xp_gain);
        xpGain = !isNaN(receivedXpGain) ? receivedXpGain : 0;
        console.log('[endBattle] 從錯誤響應中提取 xp_gain:', xpGain);
      }
    }
  } catch (err) {
    console.error('[endBattle] 更新統計失敗:', err);
  }

  // 顯示結果畫面
  let coinDelta = 0;
  if (serverCoinDelta !== null) {
    coinDelta = serverCoinDelta;
  } else if (currentBattleMode === 'bot') {
    coinDelta = finalWon ? 100 + 20 * bd.correct : 0;
  } else if (currentBattleMode === 'create_room' || currentBattleMode === 'join_room') {
    coinDelta = 0;  // 房號配對不計錢
  } else {
    // queue 模式
    coinDelta = finalWon ? 100 + 20 * bd.correct : -(50 + 20 * (bd.oppCorrect || 0));
  }
  document.getElementById('resultIcon').textContent = finalWon ? '🏆' : '💀';
  document.getElementById('resultTitle').className = 'result-title ' + (finalWon ? 'result-win' : 'result-lose');
  document.getElementById('resultTitle').textContent = finalWon ? '勝利！' : '敗北';
  document.getElementById('resultSub').textContent = finalWon ? `你以 ${finalPlayerScore} 分擊敗了對手！` : `對手以 ${finalOppScore} 分獲勝`;
  document.getElementById('statScore').textContent = finalPlayerScore;
  document.getElementById('statCorrect').textContent = `${bd.correct}/${bd.total}`;
  document.getElementById('statAccuracy').textContent = acc + '%';
  document.getElementById('statCoinsEarned').textContent = (coinDelta >= 0 ? '+' : '') + coinDelta;
  document.getElementById('statXpEarned').textContent = (xpGain >= 0 ? '+' : '') + xpGain;
  // 重設再次挑戰按鈕狀態
  const playAgainBtn = document.getElementById('playAgainBtn');
  if (playAgainBtn) { playAgainBtn.disabled = false; playAgainBtn.textContent = '⚔️ 再次挑戰'; }
  // 隱藏再來一局邀請覆蓋層
  const rematchOverlay = document.getElementById('rematchInviteOverlay');
  if (rematchOverlay) rematchOverlay.style.display = 'none';
  showScreen('resultScreen');
}

function requestRematch() {
  const isRoomMode = currentBattleMode === 'create_room' || currentBattleMode === 'join_room';
  if (!isRoomMode) {
    // 非房號模式直接重新開局
    startBattle(currentBattleMode);
    return;
  }
  if (!battleWs || battleWs.readyState !== WebSocket.OPEN) {
    showToast('連線已中斷，無法邀請再來一局');
    return;
  }
  battleWs.send(JSON.stringify({ type: 'rematch_request' }));
  const btn = document.getElementById('playAgainBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 等待對手...'; }
}

function acceptRematch() {
  document.getElementById('rematchInviteOverlay').style.display = 'none';
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: 'rematch_request' }));
  }
  showToast('已接受！等待新局開始...');
}

function declineRematch() {
  document.getElementById('rematchInviteOverlay').style.display = 'none';
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: 'rematch_decline' }));
  }
  showDeclineAndExit('已拒絕再來一局，感謝遊玩！');
}

function showDeclineAndExit(message) {
  const banner = document.createElement('div');
  banner.className = 'decline-banner';
  banner.textContent = message;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.classList.add('decline-banner-out');
    setTimeout(() => banner.remove(), 400);
  }, 2000);
  setTimeout(() => {
    if (document.getElementById('resultScreen')?.classList.contains('active')) {
      leaveResultScreen('battleModeScreen');
    }
  }, 2200);
}

function leaveResultScreen(target) {
  // 離開結果畫面時，若仍在房號模式則關閉 WS
  const isRoomMode = currentBattleMode === 'create_room' || currentBattleMode === 'join_room';
  if (isRoomMode && battleWs) {
    suppressBattleError();
    battleWs.close();
    battleWs = null;
  }
  showScreen(target);
}

// ─── SKILLS ──────────────────────────────────────────────
function resetSkillBtns() {
  const ownedSkills = state.owned.skills || [];
  const count50 = ownedSkills.filter(id => id === 'skill-5050').length;
  const countTime = ownedSkills.filter(id => id === 'skill-time').length;
  const s50 = document.getElementById('skill50');
  const sTime = document.getElementById('skillTime');
  if (s50) s50.classList.toggle('used', count50 === 0);
  if (sTime) sTime.classList.toggle('used', countTime === 0);
  const el50 = document.getElementById('skill50Count');
  const elTime = document.getElementById('skillTimeCount');
  if (el50) el50.textContent = `x${count50}`;
  if (elTime) elTime.textContent = `x${countTime}`;
}
function deductSkill(skillId) {
  const idx = state.owned.skills.indexOf(skillId);
  if (idx !== -1) state.owned.skills.splice(idx, 1);
  fetch(`${API_BASE}/user/use-skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.userId, skill_id: skillId })
  }).catch(() => {});
}

function useSkill50() {
  if (!(state.owned.skills || []).includes('skill-5050')) return;
  deductSkill('skill-5050');
  resetSkillBtns();
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: 'use_item', item: 'delete_wrong' }));
  }
}
function useSkillTime() {
  if (!(state.owned.skills || []).includes('skill-time')) return;
  deductSkill('skill-time');
  resetSkillBtns();
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
    setTimeout(() => next.classList.add('visible'), 10);
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

  const NO_DATA = '<div class="no-data-wrap"><p class="no-data-text">尚無對戰記錄</p></div>';

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
        .filter(t => ((stats[t].correct||0)+(stats[t].wrong||0)) >= 1)
        .sort((a,b) => {
          const totalA = (stats[a].correct||0)+(stats[a].wrong||0);
          const totalB = (stats[b].correct||0)+(stats[b].wrong||0);
          const accA = Math.round((stats[a].correct||0) / totalA * 1000);
          const accB = Math.round((stats[b].correct||0) / totalB * 1000);
          if (accB !== accA) return accB - accA;
          return totalB - totalA;  // 持平時答題量多的優先
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
  const shopContent = document.getElementById('shopContent');
  shopContent.classList.add('fading');
  setTimeout(() => {
    document.querySelectorAll('#shopScreen .nav-btn').forEach((b, i) => {
      b.classList.remove('active');
      if (['frames', 'tags', 'effects', 'skills', 'items'][i] === tab) b.classList.add('active');
    });
    renderShop(tab);
    setTimeout(() => shopContent.classList.remove('fading'), 10);
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
  const noteText = tab === 'items'
    ? '💡 至「個人設定 → 帳號」改名，免費次數不足時自動消耗。'
    : tab === 'skills'
      ? '💡 對戰時使用，可重複購買補充。'
      : ['frames','tags','effects'].includes(tab)
        ? '💡 購買後，至「個人設定 → 外觀」頁面選擇裝備。'
        : '';
  const note = noteText ? `<div class="effect-shop-note">${noteText}</div>` : '';
  container.innerHTML = note + `<div class="shop-grid">${items.map(item => {
    const isSkill = tab === 'skills';
    const isItem = tab === 'items';
    const skillCount = isSkill ? (state.owned.skills || []).filter(id => id === item.id).length
      : isItem && item.id === 'item-rename' ? (state.renameCards || 0) : 0;
    const isOwned = !isSkill && !isItem && state.owned[tab] && state.owned[tab].includes(item.id);
    const isEquipped = (tab === 'frames' && state.equippedFrame === item.id) ||
      (tab === 'tags' && state.playerTagClass === item.id) ||
      (tab === 'effects' && (state.activeEffect || state.owned.activeEffect) === item.id);
    const isLocked = tab === 'tags' && item.unlockLevel > 1 && state.level < item.unlockLevel;
    const previewClass = item.class || '';
    const previewHTML = tab === 'tags'
      ? `<div class="tag-preview-wrap">${renderTitleBadge(item.id, item.name, true)}</div>`
      : tab === 'effects'
        ? renderEffectCard(item.id, item.name)
        : `<div class="item-preview ${previewClass}">${item.preview}</div>`;
    const bottomHTML = isEquipped ? '<span class="badge-equipped">使用中</span>'
      : isSkill ? `<div class="item-price">🪙${item.price}<span class="skill-owned-count">已有 ${skillCount} 個</span></div>`
      : isItem ? `<div class="item-price">🪙${item.price}<span class="skill-owned-count">已有 ${skillCount} 張</span></div>`
      : isOwned ? '<span class="badge-owned">已擁有</span>'
      : isLocked ? `<div class="item-price item-price-locked">🔒 需 Lv.${item.unlockLevel}</div>`
      : `<div class="item-price">${item.price > 0 ? '🪙' + item.price : '免費'}</div>`;
    return `<div class="shop-item ${isOwned?'owned':''} ${isEquipped?'equipped':''} ${isLocked?'locked':''}" onclick="buyItem('${tab}','${item.id}')">
      ${previewHTML}
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>
      ${bottomHTML}
    </div>`;
  }).join('')}</div>`;
}

async function buyItem(tab, id) {
  const items = shopData[tab];
  const item = items.find(i=>i.id===id);
  if (!item) return;
  const isOwned = state.owned[tab] && state.owned[tab].includes(id);

  // 改名卡：買了先囤著
  if (id === 'item-rename') {
    if (item.price > state.coins) {
      showToast(`金幣不足！還差 ${item.price - state.coins} 🪙`);
      return;
    }
    const res = await fetch(`${API_BASE}/user/buy-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, item_type: 'items', item_id: id, price: item.price })
    });
    const data = await res.json();
    if (!res.ok) { showToast(`❌ ${data.error}`); return; }
    state.coins = data.remaining_coins;
    state.renameCards = data.rename_cards;
    updatePlayerBar();
    renderShop(tab);
    showToast(`✅ 改名卡購買成功！共有 ${state.renameCards} 張，在個人設定→帳號頁使用`);
    return;
  }

  if (isOwned && tab !== 'skills') {
    showToast('已擁有此道具，請到「個人設定」裝備');
    return;
  }

  if (tab === 'tags' && item.unlockLevel > 1 && state.level < item.unlockLevel) {
    showToast(`需達到 Lv.${item.unlockLevel} 才能購買此稱號（目前 Lv.${state.level}）`);
    return;
  }

  if (item.price > state.coins) {
    showToast(`金幣不足！還差 ${item.price - state.coins} 🪙，繼續對戰賺取金幣`);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/user/buy-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, item_type: tab, item_id: id, price: item.price })
    });
    const data = await res.json();
    if (!res.ok) { showToast(`❌ ${data.error}`); return; }
    state.coins = data.remaining_coins;
    if (!state.owned[tab]) state.owned[tab] = [];
    state.owned[tab].push(id);  // 技能允許重複，push 讓計數正確
  } catch {
    showToast('❌ 購買失敗，請確認後端是否已啟動');
    return;
  }

  updatePlayerBar();
  renderShop(tab);
  updateProfileEditUI();
  const msg = tab === 'skills' ? `🎉 購買成功！對戰時可使用 ${item.name}` : `🎉 購買成功！請到「個人設定」裝備`;
  showToast(msg);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('closing');
  setTimeout(() => {
    el.classList.remove('closing');
    el.style.display = 'none';
  }, 210);
}

// ─── 新手禮包 Modal ───────────────────────────────────────
let _welcomeOpened = false;

async function showWelcomeModal(userId) {
  if (state.welcomeClaimed) return;

  try {
    const res = await fetch(`${API_BASE}/user/welcome-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId })
    });
    if (res.ok) {
      const data = await res.json();
      state.coins = data.coins;
      state.welcomeClaimed = true;
      updatePlayerBar();
    } else {
      return;
    }
  } catch { return; }

  _welcomeOpened = false;
  document.getElementById('welcomeGiftBtn').style.display = 'flex';
  document.getElementById('welcomeRewardWrap').style.display = 'none';
  document.getElementById('welcomeGiftIcon').style.animation = '';

  const wrap = document.getElementById('welcomeCoinsWrap');
  wrap.innerHTML = '';

  const modal = document.getElementById('welcomeModal');
  modal.style.display = 'flex';
}

function openWelcomeGift(event) {
  event.stopPropagation();
  if (_welcomeOpened) return;
  _welcomeOpened = true;

  const icon = document.getElementById('welcomeGiftIcon');

  // 抖動 → 爆開
  icon.style.animation = 'giftShake .35s ease';
  setTimeout(() => {
    icon.style.animation = 'giftExplode .4s cubic-bezier(.36,.07,.19,.97) forwards';

    // 噴出金幣特效
    const rect = icon.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    for (let i = 0; i < 16; i++) {
      const coin = document.createElement('span');
      coin.textContent = '🪙';
      coin.className = 'gift-burst-coin';
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 130;
      coin.style.cssText = `left:${ox}px;top:${oy}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;animation-delay:${Math.random()*.1}s`;
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 900);
    }
  }, 350);

  setTimeout(() => {
    document.getElementById('welcomeGiftBtn').style.display = 'none';
    document.getElementById('welcomeRewardWrap').style.display = 'block';

    const wrap = document.getElementById('welcomeCoinsWrap');
    const coins = ['🪙','🪙','💰','🪙','🪙','💰','🪙'];
    coins.forEach((c, i) => {
      const el = document.createElement('span');
      el.className = 'welcome-coin';
      el.textContent = c;
      el.style.cssText = `left:${10 + i * 13}%;--dur:${1.8 + Math.random() * 1.2}s;--delay:${i * 0.18}s`;
      wrap.appendChild(el);
    });
  }, 750);
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('closing');
    modal.style.display = 'none';
  }, 210);
}

// ─── 升等動畫 Overlay ─────────────────────────────────────
let _levelUpBase = 0;
let _levelUpMilestone = 0;
let _levelUpOpened = false;

function showLevelUpOverlay(level, base, milestone) {
  _levelUpBase = base;
  _levelUpMilestone = milestone;
  _levelUpOpened = false;

  fetch(`${API_BASE}/user/levelup-gift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.userId })
  }).then(r => r.ok ? r.json() : null).then(d => {
    if (d?.coins != null) { state.coins = d.coins; state.pendingLevelupCoins = 0; updatePlayerBar(); }
  }).catch(() => {});

  document.getElementById('levelUpNum').textContent = level - 1 || level;
  document.getElementById('levelUpGiftBtn').style.display = 'flex';
  document.getElementById('levelUpRewardWrap').style.display = 'none';
  document.getElementById('levelUpHint').style.display = 'none';

  const raysEl = document.getElementById('levelUpRays');
  raysEl.innerHTML = '';
  const count = 20;
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const len = 200 + Math.random() * 200;
    const ray = document.createElement('div');
    ray.className = 'levelup-ray';
    ray.style.cssText = `rotate:${angle}deg;translate:-50% 0;height:${len}px;--ray-opacity:${0.35 + Math.random() * 0.55};animation-delay:${i * 0.025}s`;
    raysEl.appendChild(ray);
  }

  const burstColors = ['#ffd700','#ff6b35','#00d4ff','#e040fb','#00e676','#ff1744','#fff'];

  // 衝擊波環
  for (let i = 0; i < 4; i++) {
    const wave = document.createElement('div');
    wave.className = 'levelup-shockwave';
    wave.style.setProperty('--wave-delay', (i * 0.16) + 's');
    raysEl.appendChild(wave);
    setTimeout(() => wave.remove(), 1600 + i * 180);
  }

  // 漂浮閃爍粒子
  for (let i = 0; i < 24; i++) {
    const spark = document.createElement('div');
    spark.className = 'levelup-sparkle';
    const size = 3 + Math.random() * 5;
    spark.style.left = `${5 + Math.random() * 90}%`;
    spark.style.top = `${10 + Math.random() * 80}%`;
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.setProperty('--spark-delay', `${Math.random() * 2.5}s`);
    spark.style.setProperty('--spark-dur', `${1.8 + Math.random() * 2}s`);
    raysEl.appendChild(spark);
    setTimeout(() => spark.remove(), 6000);
  }

  // 落下彩紙
  for (let i = 0; i < 32; i++) {
    const piece = document.createElement('div');
    piece.className = 'levelup-confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = burstColors[Math.floor(Math.random() * burstColors.length)];
    piece.style.setProperty('--fall-delay', `${Math.random() * 3}s`);
    piece.style.setProperty('--fall-dur', `${1.8 + Math.random() * 2.2}s`);
    piece.style.setProperty('--fall-x', `${(Math.random() - .5) * 200}px`);
    raysEl.appendChild(piece);
    setTimeout(() => piece.remove(), 6500);
  }

  const overlay = document.getElementById('levelUpOverlay');
  overlay.style.display = 'flex';

  // 全屏金色閃光
  const flash = document.createElement('div');
  flash.className = 'levelup-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);

  // 中心爆發粒子（與卡片彈入同步，delay 280ms）
  setTimeout(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'levelup-burst';
      const angle = (Math.PI * 2 / 30) * i + (Math.random() - .5) * .28;
      const dist = 80 + Math.random() * 230;
      const size = 6 + Math.random() * 11;
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = burstColors[Math.floor(Math.random() * burstColors.length)];
      p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--bur-delay', (Math.random() * .09) + 's');
      p.style.setProperty('--bur-dur', (.72 + Math.random() * .42) + 's');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }, 280);

  // 數字從舊等級計數到新等級，結束時 punch
  const prevLevel = level - 1 || level;
  const numEl = document.getElementById('levelUpNum');
  const duration = 700;
  const startTime = performance.now() + 400;
  function tickCounter(now) {
    if (now < startTime) { requestAnimationFrame(tickCounter); return; }
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    numEl.textContent = Math.round(prevLevel + (level - prevLevel) * ease);
    if (t < 1) {
      requestAnimationFrame(tickCounter);
    } else {
      numEl.classList.remove('punch');
      void numEl.offsetWidth;
      numEl.classList.add('punch');
    }
  }
  requestAnimationFrame(tickCounter);
}

function openLevelUpGift(event) {
  event.stopPropagation();
  if (_levelUpOpened) return;
  _levelUpOpened = true;

  const giftBtn = document.getElementById('levelUpGiftBtn');
  const giftIcon = giftBtn.querySelector('.levelup-gift-icon');

  // 抖動 → 爆開
  giftIcon.style.animation = 'giftShake .35s ease';
  setTimeout(() => {
    giftIcon.style.animation = 'giftExplode .4s cubic-bezier(.36,.07,.19,.97) forwards';

    // 爆開時噴出金幣特效
    const overlay = document.getElementById('levelUpOverlay');
    const rect = giftIcon.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    for (let i = 0; i < 14; i++) {
      const coin = document.createElement('span');
      coin.textContent = '🪙';
      coin.className = 'gift-burst-coin';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      coin.style.cssText = `left:${ox}px;top:${oy}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;animation-delay:${Math.random()*.12}s`;
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 900);
    }
  }, 350);

  setTimeout(async () => {
    giftBtn.style.display = 'none';

    const list = document.getElementById('levelUpRewardList');
    const total = document.getElementById('levelUpRewardTotal');
    const items = [];
    if (_levelUpBase > 0)      items.push({ label: '升等獎勵', coins: _levelUpBase });
    if (_levelUpMilestone > 0) items.push({ label: '里程碑獎勵', coins: _levelUpMilestone });

    list.innerHTML = items.map((item, i) =>
      `<div class="levelup-reward-item" style="animation-delay:${i * 0.12}s">
        <span class="reward-label">${item.label}</span>
        <span class="reward-coins">+${item.coins} 🪙</span>
      </div>`
    ).join('');

    const totalCoins = _levelUpBase + _levelUpMilestone;
    total.innerHTML = `合計 <span>+${totalCoins} 🪙</span>`;

    document.getElementById('levelUpRewardWrap').style.display = 'block';
    setTimeout(() => {
      document.getElementById('levelUpHint').style.display = 'block';
    }, items.length * 120 + 400);

    setTimeout(() => closeLevelUpOverlay(), 4000);
  }, 750);
}

function closeLevelUpOverlay() {
  const overlay = document.getElementById('levelUpOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('closing');
    overlay.style.display = 'none';
  }, 400);
}

function showRenameCardModal() {
  document.getElementById('renameCardInput').value = '';
  const errEl = document.getElementById('renameCardError');
  errEl.style.display = 'none';
  errEl.textContent = '';
  document.getElementById('renameCardModal').style.display = 'flex';
}

async function confirmRenameCard() {
  const newName = document.getElementById('renameCardInput').value.trim();
  const errEl = document.getElementById('renameCardError');
  const btn = document.querySelector('#renameCardModal .btn-gold');
  errEl.style.display = 'none';

  if (!newName) { errEl.textContent = '暱稱不能為空'; errEl.style.display = 'block'; return; }
  if (newName.length < 2 || newName.length > 20) { errEl.textContent = '暱稱長度需在 2-20 字之間'; errEl.style.display = 'block'; return; }
  if (state.nicknameRemainingFree <= 0 && state.renameCards <= 0) {
    errEl.textContent = '本月免費次數已用完，且沒有改名卡，請至商店購買';
    errEl.style.display = 'block';
    return;
  }

  btn.textContent = '修改中...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/user/nickname`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, new_nickname: newName, use_card: true })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || '修改失敗，請再試一次'; errEl.style.display = 'block'; return; }

    state.playerName = newName;
    let renameToast;
    if (data.used_rename_card) {
      state.renameCards = data.rename_cards ?? Math.max(0, state.renameCards - 1);
      renameToast = `✅ 名稱已更新！已消耗 1 張改名卡，剩餘 ${state.renameCards} 張`;
    } else if (data.remaining_free !== undefined && data.remaining_free > 0) {
      state.nicknameRemainingFree = data.remaining_free;
      renameToast = `✅ 名稱已更新！本月免費次數剩餘 ${data.remaining_free} 次`;
    } else {
      state.nicknameRemainingFree = 0;
      renameToast = state.renameCards > 0
        ? `✅ 名稱已更新！本月免費次數已全部用完，下次將自動使用改名卡（剩 ${state.renameCards} 張）`
        : `✅ 名稱已更新！本月免費次數已全部用完，請至商店購買改名卡`;
    }
    updatePlayerBar();
    updateStatsDisplay();
    closeModal('renameCardModal');
    showToast(renameToast);
    renderRank();
  } catch (e) {
    errEl.textContent = '無法連線到伺服器';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = '✅ 確認修改';
    btn.disabled = false;
  }
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

// ─── DAILY THEME ─────────────────────────────────────────
const DAILY_EMOJI = {
  '體育': '⚽', '美術': '🎨', '國文': '📖', '英文': '🔤',
  '數學': '🔢', '歷史': '📜', '地理': '🌍', '公民': '🏛️',
  '物理': '⚛️', '化學': '⚗️', '生物': '🧬', '地科': '🌋',
  '程式': '💻', '健教': '🏥', '家政': '🏠', '軍教': '🪖',
  '人文': '🎭', '常識': '💡', '新聞': '📰', '其他': '📌',
};

function renderDailyChips(categories) {
  const chipsEl = document.getElementById('dailyThemeChips');
  if (!chipsEl) return;
  chipsEl.innerHTML = categories.map(cat => {
    const emoji = DAILY_EMOJI[cat] || '📌';
    return `<span class="topic-chip">${emoji} ${cat}</span>`;
  }).join('');
}

async function loadDailyTheme() {
  const chipsEl = document.getElementById('dailyThemeChips');
  if (!chipsEl) return;
  try {
    const res = await fetch('http://localhost:4000/daily-theme');
    const data = await res.json();
    renderDailyChips(data.categories);
  } catch {
    chipsEl.innerHTML = `<span style="color:var(--text2);font-size:13px">對戰伺服器未開啟</span>`;
  }
}

// ─── DAILY GIFT ──────────────────────────────────────────
let _dailyGiftOpened = false;

async function checkDailyGift() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.dailyClaimedAt && state.dailyClaimedAt.slice(0, 10) === today) return;

  try {
    const res = await fetch(`${API_BASE}/user/daily-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId })
    });
    if (res.ok) {
      const data = await res.json();
      state.coins = data.coins;
      state.dailyClaimedAt = new Date().toISOString();
      updatePlayerBar();
    } else {
      return;
    }
  } catch { return; }

  _dailyGiftOpened = false;
  document.getElementById('dailyGiftOpenBtn').style.display = 'flex';
  document.getElementById('dailyRewardWrap').style.display = 'none';
  document.getElementById('dailyGiftIcon').style.animation = '';
  document.getElementById('dailyCoinsWrap').innerHTML = '';

  setTimeout(() => {
    document.getElementById('dailyGiftModal').style.display = 'flex';
  }, 800);
}

function openDailyGift(event) {
  event.stopPropagation();
  if (_dailyGiftOpened) return;
  _dailyGiftOpened = true;

  const icon = document.getElementById('dailyGiftIcon');
  icon.style.animation = 'giftShake .35s ease';
  setTimeout(() => {
    icon.style.animation = 'giftExplode .4s cubic-bezier(.36,.07,.19,.97) forwards';

    const rect = icon.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    for (let i = 0; i < 16; i++) {
      const coin = document.createElement('span');
      coin.textContent = '🪙';
      coin.className = 'gift-burst-coin';
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 130;
      coin.style.cssText = `left:${ox}px;top:${oy}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;animation-delay:${Math.random()*.1}s`;
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 900);
    }
  }, 350);

  setTimeout(() => {
    document.getElementById('dailyGiftOpenBtn').style.display = 'none';
    document.getElementById('dailyRewardWrap').style.display = 'block';

    const wrap = document.getElementById('dailyCoinsWrap');
    const coins = ['🪙','🪙','💰','🪙','🪙','💰','🪙'];
    coins.forEach((c, i) => {
      const el = document.createElement('span');
      el.className = 'welcome-coin';
      el.textContent = c;
      el.style.cssText = `left:${10 + i * 13}%;--dur:${1.8 + Math.random() * 1.2}s;--delay:${i * 0.18}s`;
      wrap.appendChild(el);
    });
  }, 750);
}

function closeDailyGiftModal() {
  const modal = document.getElementById('dailyGiftModal');
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('closing');
    modal.style.display = 'none';
  }, 210);
}

// ─── RANK ────────────────────────────────────────────────
async function renderRank() {
  const listEl = document.getElementById('rankList');
  listEl.innerHTML = '<p class="rank-empty">載入中...</p>';

  try {
    const res = await fetch(`${API_BASE}/user/rank?user_id=${state.userId || ''}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const rank = data.rank || [];
    if (rank.length === 0) {
      listEl.innerHTML = '<p class="rank-empty">暫無資料</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rankColor = (r) => r === 1 ? '#ffd700' : r === 2 ? '#c0c0c0' : r === 3 ? '#cd7f32' : 'var(--text2)';

    const renderRow = (r) => {
      const isTop3 = r.rank <= 3;
      const cls = ['card rank-row', isTop3 ? 'rank-top3' : 'rank-normal', r.isYou ? 'rank-you' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}">
        <div class="rank-row-inner">
          <div class="rank-num ${isTop3 ? 'top3' : ''}" style="color:${rankColor(r.rank)}">
            ${isTop3 ? medals[r.rank - 1] : r.rank}
          </div>
          <div class="rank-avatar ${isTop3 ? 'top3' : ''}">🧠</div>
          <div class="rank-info">
            <div class="rank-name ${isTop3 ? 'top3' : ''}">
              ${escapeHTML(r.name)}${r.isYou ? ' <span class="rank-you-tag">(你)</span>' : ''}
            </div>
            <div class="rank-meta">Lv.${r.level} · ${r.wins} 勝</div>
          </div>
          <div class="rank-score-wrap">
            <div class="rank-score ${isTop3 ? 'top3' : ''}" style="color:${rankColor(r.rank)}">${(r.score || 0).toLocaleString()}</div>
            <div class="rank-score-label">積分</div>
          </div>
        </div>
      </div>`;
    };

    const total = data.total || 0;
    const sep = '<div class="rank-sep">⋮</div>';
    let html = rank.map(r => renderRow(r)).join('');

    const meInList = rank.some(r => r.isYou);
    if (meInList) {
      // 自己在前 50 名：若全服總人數 > 50，後面還有人
      if (total > 50) html += sep;
    } else {
      // 自己在 50 名外
      if (rank.length === 50) html += sep;    // 前 50 筆與自己之間有間隔
      if (data.myRank) {
        html += renderRow(data.myRank);
        if (data.myRank.rank < total) html += sep;  // 自己後面還有更多人
      }
    }

    listEl.innerHTML = html;

  } catch (e) {
    listEl.innerHTML = `<p class="rank-error">載入失敗：${e.message}</p>`;
  }
}

// ─── INIT ────────────────────────────────────────────────
createStars();

// 偵測 URL 是否帶有重設密碼 token
(function checkResetToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset_token');
  if (!token) return;

  // 清掉 URL 上的 token，避免重新整理重複觸發
  history.replaceState(null, '', window.location.pathname);

  const parts = token.split('.');
  const expired = parts.length !== 2 || Date.now() > parseInt(parts[1]);

  if (expired) {
    showScreen('resetExpiredScreen');
    startResetExpiredCountdown();
  } else {
    window._resetToken = token;
    showScreen('resetPasswordScreen');
    const infoEl = document.getElementById('resetAccountInfo');
    if (infoEl) infoEl.innerHTML = '載入帳號資訊中...';
    fetch(`${API_BASE}/auth/reset-info?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          const el = document.getElementById('resetAccountInfo');
          if (el) el.innerHTML = `帳號 ID：<strong>${escapeHTML(data.custom_id)}</strong>`;
        } else {
          showScreen('resetUsedScreen');
          startResetUsedCountdown();
        }
      })
      .catch(() => {
        showScreen('resetUsedScreen');
        startResetUsedCountdown();
      });
  }
})();

async function handleResetPassword() {
  const pw1 = getPwdVal('resetPw1');
  const pw2 = getPwdVal('resetPw2');
  const errEl = document.getElementById('resetError');
  const btn = document.getElementById('resetSubmitBtn');
  errEl.textContent = '';

  if (!pw1 || !pw2) { errEl.textContent = '請填寫所有欄位'; return; }
  if (pw1.length < 6) { errEl.textContent = '密碼至少需要 6 位數'; return; }
  if (pw1 !== pw2) { errEl.textContent = '兩次密碼不一致'; return; }

  btn.textContent = '重設中...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: window._resetToken, new_password: pw1 })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error && data.error.includes('過期')) {
        showScreen('resetExpiredScreen');
        startResetExpiredCountdown();
      } else {
        errEl.textContent = data.error || '重設失敗，請再試一次';
      }
      return;
    }
    showToast('✅ 密碼重設成功！請重新登入');
    document.getElementById('resetPw1').value = '';
    document.getElementById('resetPw2').value = '';
    showScreen('loginScreen');
  } catch (e) {
    errEl.textContent = '無法連線到伺服器';
  } finally {
    btn.textContent = '✅ 確認重設密碼';
    btn.disabled = false;
  }
}

// ─── 密碼欄位初始化 ───────────────────────────────────────
(function initPasswordFields() {
  // 初始化指定 id 的眼睛按鈕
  function initPwdToggle(id) {
    const pwdEl = document.getElementById(id);
    const visEl = document.getElementById(id + 'Visible');
    const wrap = pwdEl && pwdEl.closest('.password-wrap');
    const btn = wrap && wrap.querySelector('.toggle-pwd-btn');
    if (!pwdEl || !visEl || !btn) return;
    if (btn.dataset.pwdBound === '1') return;  // 防止重複綁定
    btn.dataset.pwdBound = '1';
    btn.classList.add('active');
    const show = (e) => { e.preventDefault(); visEl.value = pwdEl.value; pwdEl.style.display = 'none'; visEl.style.display = 'block'; btn.classList.remove('active'); };
    const hide = () => { if (visEl.style.display === 'block') pwdEl.value = visEl.value; visEl.style.display = 'none'; pwdEl.style.display = ''; btn.classList.add('active'); };
    btn.addEventListener('mousedown', show);
    btn.addEventListener('mouseup', hide);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('touchstart', show, { passive: false });
    btn.addEventListener('touchend', hide);
  }

  window.initPwdToggle = initPwdToggle;  // 暴露給 showScreen 呼叫

  ['passwordInput', 'regPasswordInput', 'regPasswordConfirm', 'resetPw1', 'resetPw2',
   'changePwdOld', 'changePwdNew', 'changePwdConfirm', 'deleteAccountPwd'].forEach(id => {
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
      visEl.style.display = 'block';
      btn.classList.remove('active');  // 移除斜線（顯示中）
    });

    // 放開 → 隱藏密碼
    const hide = () => {
      if (visEl.style.display === 'block') pwdEl.value = visEl.value;
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
      visEl.style.display = 'block';
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
      if (e.key && e.key.length === 1 && !/^[ -~]$/.test(e.key)) e.preventDefault();
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
  avatarMode: state.avatarMode,
  customAvatarDataUrl: state.customAvatarDataUrl,
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
    setTimeout(() => next.classList.add('visible'), 10);  // 稍微延遲讓 CSS transition 生效
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
  profileEditState.avatarMode = state.avatarMode;
  profileEditState.customAvatarDataUrl = state.customAvatarDataUrl;
  profileEditState.frame = state.equippedFrame;
  profileEditState.tagClass = state.playerTagClass;
  profileEditState.tagIcon = state.playerTagIcon;
  profileEditState.activeEffect = state.activeEffect || state.owned.activeEffect || null;

  renderAvatarElement(document.getElementById('editAvatar'));
  document.getElementById('editFrame').className = `profile-frame ${profileEditState.frame !== 'frame-none' ? profileEditState.frame : ''}`;
  document.getElementById('playerNameInput').value = state.playerName;

  updateAvatarChoiceButtons();

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

  const skillsEl = document.getElementById('ownedSkillsList');
  if (skillsEl) {
    const owned = state.owned.skills || [];
    const allSkills = shopData.skills || [];
    const chips = allSkills.map(s => {
      const count = owned.filter(id => id === s.id).length;
      return `<div class="owned-skill-chip ${count === 0 ? 'empty' : ''}">${s.preview} ${s.name} <span class="skill-count">× ${count}</span></div>`;
    });
    skillsEl.innerHTML = chips.join('');
  }
}

function getAvatarStorageKey(type) {
  return `knowledgeKing:${state.userId || 'guest'}:${type}`;
}

function loadLocalAvatarPrefs() {
  try {
    const customAvatar = localStorage.getItem(getAvatarStorageKey('customAvatar')) || '';
    const savedMode = localStorage.getItem(getAvatarStorageKey('avatarMode')) || 'emoji';
    const savedEmoji = localStorage.getItem(getAvatarStorageKey('equippedEmoji'));
    state.equippedEmoji = savedEmoji || '🧠';
    state.customAvatarDataUrl = customAvatar;
    state.avatarMode = customAvatar && savedMode === 'image' ? 'image' : 'emoji';
  } catch (e) {
    console.warn('讀取自訂頭像失敗:', e);
  }
}

function saveLocalAvatarPrefs() {
  try {
    localStorage.setItem(getAvatarStorageKey('avatarMode'), state.avatarMode);
    localStorage.setItem(getAvatarStorageKey('equippedEmoji'), state.equippedEmoji);
    if (state.customAvatarDataUrl) {
      localStorage.setItem(getAvatarStorageKey('customAvatar'), state.customAvatarDataUrl);
    }
  } catch (e) {
    console.error('保存自訂頭像失敗:', e);
    showToast('❌ 圖片太大，請換一張較小的圖片');
  }
}

function renderAvatarElement(el) {
  if (!el) return;
  const useCustomImage = state.avatarMode === 'image' && state.customAvatarDataUrl;
  el.classList.toggle('avatar-has-image', Boolean(useCustomImage));
  el.innerHTML = '';
  if (useCustomImage) {
    const img = document.createElement('img');
    img.className = 'custom-avatar-img';
    img.alt = '自訂頭像';
    img.src = state.customAvatarDataUrl;
    el.appendChild(img);
  } else {
    el.textContent = state.equippedEmoji;
  }
}

function updateAvatarChoiceButtons() {
  document.querySelectorAll('.emoji-btn:not(.custom-avatar-btn)').forEach(b => {
    b.classList.remove('active');
    if (state.avatarMode === 'emoji' && b.textContent === state.equippedEmoji) b.classList.add('active');
  });
  const customBtn = document.getElementById('customAvatarBtn');
  if (customBtn) customBtn.classList.toggle('active', state.avatarMode === 'image' && Boolean(state.customAvatarDataUrl));
}

function openCustomAvatarPicker() {
  const input = document.getElementById('customAvatarInput');
  if (input) input.click();
}

function initCustomAvatarControls() {
  const btn = document.getElementById('customAvatarBtn');
  const input = document.getElementById('customAvatarInput');
  if (btn && btn.dataset.avatarBound !== '1') {
    btn.dataset.avatarBound = '1';
    btn.addEventListener('click', (e) => { e.preventDefault(); openCustomAvatarPicker(); });
  }
  if (input && input.dataset.avatarBound !== '1') {
    input.dataset.avatarBound = '1';
    input.addEventListener('change', handleCustomAvatarUpload);
  }
}

async function handleCustomAvatarUpload(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('❌ 請選擇圖片檔案'); return; }
  try {
    await openCustomAvatarEditor(file);
  } catch (e) {
    showToast('❌ 圖片讀取失敗，請換一張試試');
  }
}

let customAvatarEditor = {
  src: '', img: null, zoom: 1, offsetX: 0, offsetY: 0,
  dragging: false, startClientX: 0, startClientY: 0, startOffsetX: 0, startOffsetY: 0
};

function revokeCustomAvatarEditorSrc() {
  if (customAvatarEditor.src) URL.revokeObjectURL(customAvatarEditor.src);
  customAvatarEditor.src = '';
}

function openCustomAvatarEditor(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      revokeCustomAvatarEditorSrc();
      customAvatarEditor = { src: objectUrl, img, zoom: 1, offsetX: 0, offsetY: 0, dragging: false, startClientX: 0, startClientY: 0, startOffsetX: 0, startOffsetY: 0 };
      const preview = document.getElementById('avatarEditorImage');
      const zoomInput = document.getElementById('avatarZoomInput');
      const zoomValue = document.getElementById('avatarZoomValue');
      if (preview) preview.src = objectUrl;
      if (zoomInput) zoomInput.value = '100';
      if (zoomValue) zoomValue.textContent = '100%';
      const modal = document.getElementById('customAvatarEditorModal');
      if (modal) modal.style.display = 'flex';
      updateAvatarEditorPreview();
      resolve();
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image-load-failed')); };
    img.src = objectUrl;
  });
}

function getAvatarEditorStageSize() {
  const stage = document.getElementById('avatarEditorStage');
  return stage ? stage.clientWidth || 260 : 260;
}

function getAvatarEditorMetrics() {
  const img = customAvatarEditor.img;
  const stageSize = getAvatarEditorStageSize();
  if (!img) return null;
  const baseScale = Math.max(stageSize / img.naturalWidth, stageSize / img.naturalHeight);
  const zoom = customAvatarEditor.zoom || 1;
  return { stageSize, displayWidth: img.naturalWidth * baseScale * zoom, displayHeight: img.naturalHeight * baseScale * zoom };
}

function clampAvatarEditorOffset() {
  const metrics = getAvatarEditorMetrics();
  if (!metrics) return;
  const maxX = Math.max(0, (metrics.displayWidth - metrics.stageSize) / 2);
  const maxY = Math.max(0, (metrics.displayHeight - metrics.stageSize) / 2);
  customAvatarEditor.offsetX = Math.max(-maxX, Math.min(maxX, customAvatarEditor.offsetX));
  customAvatarEditor.offsetY = Math.max(-maxY, Math.min(maxY, customAvatarEditor.offsetY));
}

function updateAvatarEditorPreview() {
  const preview = document.getElementById('avatarEditorImage');
  const zoomValue = document.getElementById('avatarZoomValue');
  const metrics = getAvatarEditorMetrics();
  if (!preview || !metrics) return;
  clampAvatarEditorOffset();
  const left = (metrics.stageSize - metrics.displayWidth) / 2 + customAvatarEditor.offsetX;
  const top = (metrics.stageSize - metrics.displayHeight) / 2 + customAvatarEditor.offsetY;
  preview.style.width = `${metrics.displayWidth}px`;
  preview.style.height = `${metrics.displayHeight}px`;
  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  if (zoomValue) zoomValue.textContent = `${Math.round(customAvatarEditor.zoom * 100)}%`;
}

function setAvatarEditorZoom(value) {
  customAvatarEditor.zoom = Math.max(1, Math.min(3, Number(value) / 100 || 1));
  updateAvatarEditorPreview();
}

function resetAvatarEditorPosition() {
  customAvatarEditor.offsetX = 0;
  customAvatarEditor.offsetY = 0;
  const zoomInput = document.getElementById('avatarZoomInput');
  if (zoomInput) zoomInput.value = Math.round((customAvatarEditor.zoom || 1) * 100);
  updateAvatarEditorPreview();
}

function startAvatarEditorDrag(event) {
  if (!customAvatarEditor.img) return;
  customAvatarEditor.dragging = true;
  customAvatarEditor.startClientX = event.clientX;
  customAvatarEditor.startClientY = event.clientY;
  customAvatarEditor.startOffsetX = customAvatarEditor.offsetX;
  customAvatarEditor.startOffsetY = customAvatarEditor.offsetY;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

window.addEventListener('pointermove', (event) => {
  if (!customAvatarEditor.dragging) return;
  customAvatarEditor.offsetX = customAvatarEditor.startOffsetX + event.clientX - customAvatarEditor.startClientX;
  customAvatarEditor.offsetY = customAvatarEditor.startOffsetY + event.clientY - customAvatarEditor.startClientY;
  updateAvatarEditorPreview();
});

window.addEventListener('pointerup', () => { customAvatarEditor.dragging = false; });

function confirmCustomAvatarCrop() {
  const img = customAvatarEditor.img;
  const metrics = getAvatarEditorMetrics();
  if (!img || !metrics) return;
  clampAvatarEditorOffset();
  const outputSize = 512;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize; canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  const scale = outputSize / metrics.stageSize;
  const left = ((metrics.stageSize - metrics.displayWidth) / 2 + customAvatarEditor.offsetX) * scale;
  const top = ((metrics.stageSize - metrics.displayHeight) / 2 + customAvatarEditor.offsetY) * scale;
  ctx.drawImage(img, left, top, metrics.displayWidth * scale, metrics.displayHeight * scale);
  const dataUrl = canvas.toDataURL('image/webp', 0.86);
  state.customAvatarDataUrl = dataUrl;
  state.avatarMode = 'image';
  profileEditState.customAvatarDataUrl = dataUrl;
  profileEditState.avatarMode = 'image';
  saveLocalAvatarPrefs();
  renderAvatarElement(document.getElementById('editAvatar'));
  updateAvatarChoiceButtons();
  updatePlayerBar();
  closeCustomAvatarEditor();
  showToast('⏳ 上傳頭像中...');
  uploadAvatarToCloud(dataUrl);
}

async function uploadAvatarToCloud(dataUrl) {
  if (!state.userId) return;
  try {
    const res = await fetch(`${API_BASE}/user/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, avatar_data: dataUrl })
    });
    if (res.ok) {
      showToast('✅ 自訂頭像已儲存');
    } else {
      showToast('⚠️ 頭像上傳失敗，僅暫存本機');
    }
  } catch (e) {
    showToast('⚠️ 頭像上傳失敗，僅暫存本機');
  }
}

function closeCustomAvatarEditor() {
  closeModal('customAvatarEditorModal');
  setTimeout(() => {
    const preview = document.getElementById('avatarEditorImage');
    if (preview) preview.removeAttribute('src');
    revokeCustomAvatarEditorSrc();
    customAvatarEditor.img = null;
    customAvatarEditor.dragging = false;
  }, 230);
}

function selectAvatar(emoji) {
  profileEditState.avatar = emoji;
  profileEditState.avatarMode = 'emoji';
  state.equippedEmoji = emoji;
  state.avatarMode = 'emoji';
  saveLocalAvatarPrefs();
  renderAvatarElement(document.getElementById('editAvatar'));
  updateAvatarChoiceButtons();
  updatePlayerBar();
  // 同步儲存到後端 DB，跨裝置 / 讓對手看到真實頭貼
  if (state.userId) {
    fetch(`${API_BASE}/user/equipped-emoji`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId, emoji })
    }).catch(() => {});
  }
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

async function toggleNameEdit() {
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
    if (!newName) { showToast('玩家名稱不能為空！'); return; }
    if (state.nicknameRemainingFree <= 0 && state.renameCards <= 0) {
      showToast('❌ 本月免費次數已用完，且沒有改名卡，請至商店購買');
      return;
    }
    btn.textContent = '儲存中...';
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/user/nickname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.userId, new_nickname: newName, use_card: true })
      });
      const data = await res.json();
      if (!res.ok) { showToast(`❌ ${data.error || '修改失敗'}`); return; }
      state.playerName = newName;
      if (data.remaining_coins !== undefined) state.coins = data.remaining_coins;
      if (data.remaining_free !== undefined) state.nicknameRemainingFree = data.remaining_free;
      if (data.rename_cards !== undefined) state.renameCards = data.rename_cards;
      updatePlayerBar();
      updateStatsDisplay();
      renderRank();
      input.disabled = true;
      btn.textContent = '✏️ 修改';
      btn.style.borderColor = '';
      btn.style.color = '';
      const freeLeft = data.remaining_free ?? state.nicknameRemainingFree;
      let resultMsg;
      if (freeLeft > 0) {
        resultMsg = `本月免費次數剩餘 ${freeLeft} 次`;
      } else if (data.used_rename_card) {
        const cardsLeft = data.rename_cards ?? state.renameCards;
        resultMsg = `已消耗 1 張改名卡，剩餘 ${cardsLeft} 張`;
      } else {
        resultMsg = state.renameCards > 0
          ? `本月免費次數已全部用完，下次將自動使用改名卡（剩 ${state.renameCards} 張）`
          : `本月免費次數已全部用完，請至商店購買改名卡`;
      }
      showToast(`✅ 名稱已更新！${resultMsg}`);
    } catch (e) {
      showToast('❌ 無法連線到伺服器');
    } finally {
      btn.disabled = false;
      if (!input.disabled) {
        btn.textContent = '✓ 完成';
        btn.style.borderColor = 'var(--green)';
        btn.style.color = 'var(--green)';
      }
    }
  }
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

  const topTopics = Object.entries(state.topicStats)
    .map(([topic, val]) => [topic, typeof val === 'object' ? (val.correct||0)+(val.wrong||0) : (val||0)])
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([topic,count],i)=>
      `<div class="stat-box">
        <div class="topic-stat-emoji">${topic.split(' ')[0]}</div>
        <div class="topic-stat-name">${topic}</div>
        <div class="topic-stat-count" style="color:${['#ffd700','#c0c0c0','#cd7f32','#7070a0','#7070a0'][i]}">${count}</div>
      </div>`
    ).join('');
  document.getElementById('topTopics').innerHTML = topTopics;
}

// 密碼不顯示，只顯示遮罩
function ensureModalsAtBody() {
  ['changePwdModal', 'deleteAccountModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  });
}

function getPwdVal(id) {
  const vis = document.getElementById(id + 'Visible');
  const pwd = document.getElementById(id);
  if (vis && vis.style.display === 'block') return vis.value.trim();
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
  document.getElementById('changePwdModal').style.display = 'flex';
  ['changePwdOld', 'changePwdNew', 'changePwdConfirm'].forEach(id => {
    const pwdEl = document.getElementById(id);
    const visEl = document.getElementById(id + 'Visible');
    const wrap = pwdEl && pwdEl.closest('.password-wrap');
    const oldBtn = wrap && wrap.querySelector('.toggle-pwd-btn');
    if (!pwdEl || !visEl || !oldBtn) return;
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    btn.classList.add('active');
    const show = (e) => { e.preventDefault(); visEl.value = pwdEl.value; pwdEl.style.display = 'none'; visEl.style.display = 'block'; btn.classList.remove('active'); };
    const hide = () => { if (visEl.style.display === 'block') pwdEl.value = visEl.value; visEl.style.display = 'none'; pwdEl.style.display = ''; btn.classList.add('active'); };
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
    closeModal('changePwdModal');
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
  document.getElementById('deleteAccountModal').style.display = 'flex';
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
    closeModal('deleteAccountModal');
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
    stopCoinSync();
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
  const identifier = document.getElementById('forgotEmailInput').value.trim();
  const errEl = document.getElementById('forgotError');
  const sucEl = document.getElementById('forgotSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!identifier) { errEl.textContent = '請輸入帳號或信箱'; errEl.style.display = 'block'; return; }

  const btn = document.querySelector('#forgotScreen .btn-gold');
  btn.textContent = '寄送中...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || '寄送失敗，請再試一次'; errEl.style.display = 'block'; return; }
    sucEl.textContent = '✅ 重設連結已寄出，請查收信箱';
    sucEl.style.display = 'block';
    document.getElementById('forgotEmailInput').value = '';
  } catch (err) {
    errEl.textContent = '無法連線到伺服器';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = '📧 寄送重設連結';
    btn.disabled = false;
  }
}

async function autoClaimMissedGifts() {
  if (state.pendingLevelupCoins > 0) {
    try {
      const r = await fetch(`${API_BASE}/user/levelup-gift`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: state.userId})
      });
      if (r.ok) { const d = await r.json(); state.coins = d.coins; state.pendingLevelupCoins = 0; updatePlayerBar(); }
    } catch {}
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
      if (data.unverified) {
        showLoginError(data.error);
      } else {
        showLoginError(data.error || '登入失敗，請再試一次');
      }
      return;
    }

    // 登入成功，存放玩家資料
    state.userId = data.user.id;  // 存放玩家的 uuid，之後其他 API 都需要這個

    // 從後端取得玩家完整資料
    await loadUserProfile(data.user.id);

    // 跳轉到主頁
    showScreen('homeScreen');
    updatePlayerBar();
    startCoinSync();
    loadDailyTheme();
    await autoClaimMissedGifts();
    checkDailyGift();
    setTimeout(() => showWelcomeModal(data.user.id), 600);

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
    state.coins = profile.coins ?? 0;     // 金幣數量
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
    state.owned.skills = profile.owned_skills || [];              // 已擁有的對戰技能
    state.activeEffect = profile.active_effect || null;           // 目前裝備的特效
    state.owned.activeEffect = profile.active_effect || null;     // 同步 owned.activeEffect
    loadLocalAvatarPrefs();
    // 後端有頭像 URL 時，優先用後端的（跨裝置同步）
    if (profile.avatar_url) {
      state.customAvatarDataUrl = profile.avatar_url;
      state.avatarMode = 'image';
      saveLocalAvatarPrefs();
    }
    // 同步 emoji 頭貼（DB 優先，但若已有自訂圖片則不覆蓋模式）
    if (profile.equipped_emoji && !state.customAvatarDataUrl) {
      state.equippedEmoji = profile.equipped_emoji;
      state.avatarMode = 'emoji';
      saveLocalAvatarPrefs();
    }

    state.topicStats = profile.topic_stats || {};  // 主題統計（從後端讀取）
    state.nicknameRemainingFree = profile.nickname_remaining_free ?? 3;  // 本月剩餘改名次數
    state.welcomeClaimed = profile.welcome_claimed ?? false;             // 是否已領取新手禮包
    state.renameCards = profile.rename_cards || 0;                       // 改名卡數量
    state.dailyClaimedAt = profile.daily_claimed_at || null;            // 上次領取每日禮包時間
    state.recentScores = [];              // 近期得分（等對戰系統串接後才有）
    state.recentAccuracy = [];            // 近期準確率（等對戰系統串接後才有）
    state.pendingLevelupCoins = profile.pending_levelup_coins || 0;  // 待領取的升等獎勵

    // 更新畫面上的玩家資料
    try { updatePlayerBar(); } catch (e) { console.error('updatePlayerBar 失敗:', e); }
    try { updateStatsDisplay(); } catch (e) { console.error('updateStatsDisplay 失敗:', e); }

    // 管理員才顯示題庫管理按鈕，並控制個人設定的位置
    const isAdmin = Boolean(profile.is_admin);
    const adminBtn = document.getElementById('adminBtn');
    const profileBtn = document.getElementById('profileBtn');
    if (isAdmin) {
      if (adminBtn) adminBtn.style.display = 'block';
      if (profileBtn) profileBtn.style.gridColumn = '';
    } else {
      if (adminBtn) adminBtn.style.display = 'none';
      if (profileBtn) profileBtn.style.gridColumn = '2';
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
  ['customAvatarEditorModal', 'changePwdModal', 'deleteAccountModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) document.body.appendChild(el);
  });
  initCustomAvatarControls();
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
  initVerifyCodeInputs();
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
  const password = getPwdVal('regPasswordInput');    // 取得密碼（相容眼睛按鈕）

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
      body: JSON.stringify({ custom_id, nickname, email, password })
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
  const inputs = getVerifyCodeInputs();
  const code = getVerifyCodeValue(); // 取得驗證碼

  // 防呆：驗證碼必填
  if (inputs.length !== 6 || code.length !== 6 || inputs.some(input => !input.value.trim())) {
    showVerifyError('請輸入完整驗證碼');
    const firstEmptyIndex = inputs.findIndex(input => !input.value.trim());
    focusVerifyCodeInput(firstEmptyIndex >= 0 ? firstEmptyIndex : 0);
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
      if (data.error && data.error.includes('過期')) {
        showVerifiedScreen('expired');
      } else {
        showVerifyError(data.error || '驗證失敗，請再試一次');
      }
      return;
    }

    showVerifiedScreen(data.already_verified ? 'already' : 'success');

  } catch (err) {
    showVerifyError('無法連線到伺服器，請確認後端是否已啟動');
  } finally {
    btn.textContent = '確認驗證';
    btn.disabled = false;
  }
}

let verifiedCountdownTimer = null;

function showVerifiedScreen(type) {
  const iconEl  = document.querySelector('#verifiedScreen .verified-icon');
  const titleEl = document.querySelector('#verifiedScreen .verified-title');
  const descEl  = document.querySelector('#verifiedScreen .verified-desc');
  const barEl   = document.querySelector('#verifiedScreen .verified-progress-bar');
  const btnEl   = document.querySelector('#verifiedScreen .btn-gold');

  if (type === 'already') {
    if (iconEl)  iconEl.textContent = '✅';
    if (titleEl) titleEl.textContent = '你已經開通過囉！';
    if (descEl)  descEl.innerHTML = '此帳號已完成驗證<br>即將跳轉到登入頁面';
    if (barEl)   { barEl.style.background = 'linear-gradient(90deg,#ffd700,#ff6b35)'; }
    if (btnEl)   btnEl.textContent = '立即前往登入';
  } else if (type === 'expired') {
    if (iconEl)  iconEl.textContent = '⏰';
    if (titleEl) titleEl.textContent = '驗證碼過期啦！';
    if (descEl)  descEl.innerHTML = '這組驗證碼已經失效了<br>請重新註冊再試一次';
    if (barEl)   { barEl.style.background = 'linear-gradient(90deg,#ff6b6b,#ff9a3c)'; }
    if (btnEl)   btnEl.textContent = '立即前往註冊';
  } else {
    if (iconEl)  iconEl.textContent = '🎉';
    if (titleEl) titleEl.textContent = '帳號開通成功囉！';
    if (descEl)  descEl.innerHTML = '歡迎加入知識王戰場<br>即將跳轉到登入頁面';
    if (barEl)   { barEl.style.background = 'linear-gradient(90deg,#ffd700,#ff6b35)'; }
    if (btnEl)   btnEl.textContent = '立即前往登入';
  }
  showScreen('verifiedScreen');
  startVerifiedCountdown(type === 'expired' ? 'registerScreen' : 'loginScreen');
}

let verifiedCountdownTarget = 'loginScreen';

function startVerifiedCountdown(target = 'loginScreen') {
  verifiedCountdownTarget = target;
  if (verifiedCountdownTimer) clearInterval(verifiedCountdownTimer);
  let sec = 5;
  const countdownEl = document.getElementById('verifiedCountdown');
  const barEl = document.getElementById('verifiedProgressBar');
  if (barEl) {
    barEl.classList.remove('running');
    void barEl.offsetWidth;
    barEl.classList.add('running');
  }
  if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
  verifiedCountdownTimer = setInterval(() => {
    sec--;
    if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
    if (sec <= 0) {
      clearInterval(verifiedCountdownTimer);
      goToLogin();
    }
  }, 1000);
}

function goToLogin() {
  if (verifiedCountdownTimer) { clearInterval(verifiedCountdownTimer); verifiedCountdownTimer = null; }
  showScreen(verifiedCountdownTarget);
}

let resetExpiredCountdownTimer = null;

function startResetExpiredCountdown() {
  if (resetExpiredCountdownTimer) clearInterval(resetExpiredCountdownTimer);
  let sec = 5;
  const countdownEl = document.getElementById('resetExpiredCountdown');
  const barEl = document.getElementById('resetExpiredBar');
  if (barEl) {
    barEl.classList.remove('running');
    void barEl.offsetWidth;
    barEl.classList.add('running');
  }
  if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
  resetExpiredCountdownTimer = setInterval(() => {
    sec--;
    if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
    if (sec <= 0) {
      clearInterval(resetExpiredCountdownTimer);
      resetExpiredCountdownTimer = null;
      goToForgot();
    }
  }, 1000);
}

function goToForgot() {
  if (resetExpiredCountdownTimer) { clearInterval(resetExpiredCountdownTimer); resetExpiredCountdownTimer = null; }
  showScreen('forgotScreen');
}

let resetUsedCountdownTimer = null;

function startResetUsedCountdown() {
  if (resetUsedCountdownTimer) clearInterval(resetUsedCountdownTimer);
  let sec = 5;
  const countdownEl = document.getElementById('resetUsedCountdown');
  const barEl = document.getElementById('resetUsedBar');
  if (barEl) {
    barEl.classList.remove('running');
    void barEl.offsetWidth;
    barEl.classList.add('running');
  }
  if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
  resetUsedCountdownTimer = setInterval(() => {
    sec--;
    if (countdownEl) countdownEl.textContent = `${sec} 秒後自動跳轉...`;
    if (sec <= 0) {
      clearInterval(resetUsedCountdownTimer);
      resetUsedCountdownTimer = null;
      goToLoginFromUsed();
    }
  }, 1000);
}

function goToLoginFromUsed() {
  if (resetUsedCountdownTimer) { clearInterval(resetUsedCountdownTimer); resetUsedCountdownTimer = null; }
  showScreen('loginScreen');
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

function getVerifyCodeInputs() {
  return Array.from(document.querySelectorAll('.verify-code-input'));
}

function getVerifyCodeValue() {
  return getVerifyCodeInputs().map(input => input.value.trim()).join('');
}

function clearVerifyCodeInputs() {
  getVerifyCodeInputs().forEach(input => {
    input.value = '';
  });
}

function focusVerifyCodeInput(index = 0) {
  const inputs = getVerifyCodeInputs();
  const target = inputs[index];
  if (target) {
    target.focus();
    if (typeof target.select === 'function') target.select();
  }
}

function initVerifyCodeInputs() {
  const inputs = getVerifyCodeInputs();
  if (!inputs.length || window.__verifyCodeInputsReady) return;
  window.__verifyCodeInputsReady = true;

  const fillFromText = (startIndex, text) => {
    const digits = text.replace(/\D/g, '').split('').slice(0, inputs.length - startIndex);
    digits.forEach((digit, offset) => {
      const target = inputs[startIndex + offset];
      if (target) target.value = digit;
    });
    const nextEmpty = Math.min(startIndex + digits.length, inputs.length - 1);
    if (digits.length > 0) inputs[nextEmpty].focus();
  };

  inputs.forEach((input, index) => {
    input.addEventListener('input', (event) => {
      const raw = event.target.value;
      if (!raw) return;

      const sanitized = raw.replace(/\D/g, '');
      if (sanitized !== raw) {
        event.target.value = sanitized;
      }

      if (event.target.value.length > 1) {
        event.target.value = '';
        fillFromText(index, raw);
        return;
      }

      if (event.target.value && index < inputs.length - 1) {
        focusVerifyCodeInput(index + 1);
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        event.preventDefault();
        inputs[index - 1].value = '';
        focusVerifyCodeInput(index - 1);
        return;
      }

      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        focusVerifyCodeInput(index - 1);
        return;
      }

      if (event.key === 'ArrowRight' && index < inputs.length - 1) {
        event.preventDefault();
        focusVerifyCodeInput(index + 1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleVerify();
      }
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const pastedText = (event.clipboardData || window.clipboardData).getData('text');
      if (pastedText) fillFromText(index, pastedText);
    });
  });
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
    headers: { 'Content-Type': 'application/json', 'X-User-Id': state.userId },
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
              <td class="admin-idx">${i + 1}</td>
              <td><span class="cat-tag">${q.category}</span></td>
              <td>${q.question}</td>
              <td>${q.answer_a}</td>
              <td>${q.answer_b}</td>
              <td>${q.answer_c}</td>
              <td>${q.answer_d}</td>
              <td><strong class="admin-answer">${q.correct_answer}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="admin-preview-note">顯示前 ${preview.length} 題預覽</p>
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
    const res = await fetch(`${GEN_BASE}/questions?${params}`, {
      headers: { 'X-User-Id': state.userId }
    });
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
  let html = `<span class="admin-page-total">共 ${total} 筆</span>`;

  if (cur > 1) html += `<button class="btn btn-sm btn-outline" onclick="adminLoadQuestions(${cur - 1})">‹</button>`;

  const pages = new Set([1, last, cur-2, cur-1, cur, cur+1, cur+2].filter(p => p >= 1 && p <= last));
  let prev = 0;
  for (const p of [...pages].sort((a,b) => a-b)) {
    if (prev && p - prev > 1) html += '<span class="admin-page-sep">…</span>';
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
      headers: { 'Content-Type': 'application/json', 'X-User-Id': state.userId },
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
      headers: { 'Content-Type': 'application/json', 'X-User-Id': state.userId },
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