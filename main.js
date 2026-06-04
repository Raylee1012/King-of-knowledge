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

// ─── QUESTIONS ───────────────────────────────────────────
const questions = [
  {topic:'🔬 科學',q:'光速大約是多少 km/s？',opts:['約 30 萬 km/s','約 3 萬 km/s','約 300 萬 km/s','約 3000 km/s'],ans:0},
  {topic:'🌍 地理',q:'世界上最長的河流是？',opts:['亞馬遜河','尼羅河','長江','密西西比河'],ans:1},
  {topic:'📚 歷史',q:'1492 年哥倫布登陸了哪裡？',opts:['北美洲大陸','加勒比海群島','南美洲大陸','中美洲'],ans:1},
  {topic:'🖥️ 科技',q:'HTML 的全稱是什麼？',opts:['Hyper Text Markup Language','High Tech Modern Language','Hyper Transfer Markup Logic','Home Text Markup Language'],ans:0},
  {topic:'🎮 電競',q:'《英雄聯盟》中，玩家需要摧毀對方什麼才能贏？',opts:['城堡','暴君','基地水晶','防禦塔'],ans:2},
  {topic:'📐 數學',q:'π（圓周率）精確到小數點後兩位是？',opts:['3.12','3.14','3.16','3.18'],ans:1},
  {topic:'🧪 化學',q:'水的化學式是？',opts:['H2O2','H3O','H2O','OH'],ans:2},
  {topic:'🎵 音樂',q:'吉他標準調音，最細的弦是哪個音？',opts:['E','A','G','B'],ans:0},
  {topic:'🚀 航太',q:'人類第一次登月是哪一年？',opts:['1965','1967','1969','1971'],ans:2},
  {topic:'💡 發明',q:'電話的發明者是？',opts:['愛迪生','特斯拉','貝爾','莫爾斯'],ans:2},
  {topic:'🐾 動物',q:'哪種動物有最長的壽命？',opts:['大象','格陵蘭鯊','烏龜','弓頭鯨'],ans:1},
  {topic:'⚽ 體育',q:'世界盃足球賽每幾年舉辦一次？',opts:['2年','3年','4年','5年'],ans:2},
  {topic:'🎬 電影',q:'《鐵達尼號》上映於哪一年？',opts:['1995','1996','1997','1998'],ans:2},
  {topic:'🍜 美食',q:'義大利麵的主要原料是？',opts:['米','小麥粉','玉米粉','馬鈴薯'],ans:1},
  {topic:'🌿 植物',q:'光合作用中，植物吸收哪種氣體？',opts:['O2','N2','CO2','H2'],ans:2},
  {topic:'🏛️ 政治',q:'聯合國總部位於哪個城市？',opts:['日內瓦','紐約','巴黎','維也納'],ans:1},
  {topic:'💰 經濟',q:'GDP 的全稱是什麼？',opts:['Gross Domestic Product','General Development Plan','Global Data Protocol','Government Debt Policy'],ans:0},
  {topic:'🔭 天文',q:'太陽系中最大的行星是？',opts:['土星','海王星','木星','天王星'],ans:2},
  {topic:'🌊 海洋',q:'地球表面約有多少比例是海洋？',opts:['51%','61%','71%','81%'],ans:2},
  {topic:'🦁 生態',q:'哪個生態系統被稱為「地球之肺」？',opts:['珊瑚礁','濕地','熱帶雨林','草原'],ans:2},
  {topic:'🎨 藝術',q:'《蒙娜麗莎》是哪位藝術家的作品？',opts:['米開朗基羅','達文西','拉斐爾','波提切利'],ans:1},
];

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
      setTimeout(() => next.classList.add('visible'), 10);  // 稍微延遲讓 CSS transition 生效
      if(id==='analyticsScreen') setTimeout(initCharts, 100);
      if(id==='shopScreen') renderShop('frames');
      if(id==='rankScreen') renderRank();
      if(id==='profileScreen') { updateProfileEditUI(); updateStatsDisplay(); }
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
  document.getElementById('coinDisplay').textContent = state.coins.toLocaleString();
  const shopCoinsEl = document.getElementById('shopCoins');
  if(shopCoinsEl) shopCoinsEl.textContent = state.coins.toLocaleString();
  document.getElementById('playerNameDisplay').innerHTML = escapeHTML(state.playerName) + renderPlayerTag();
  document.getElementById('playerLevel').textContent = state.level;
  document.getElementById('playerXP').textContent = state.xp;
  document.getElementById('playerXPMax').textContent = state.xpMax;
  const pct = (state.xp/state.xpMax*100).toFixed(0);
  document.getElementById('xpBar').style.width = pct+'%';
  document.getElementById('playerAvatar').textContent = state.equippedEmoji;
  const pf = document.getElementById('playerFrame');
  pf.className = 'avatar-frame ' + (state.equippedFrame !== 'frame-none' ? state.equippedFrame : '');
}

// ─── BATTLE ──────────────────────────────────────────────
let currentQ = 0, questionOrder = [];
let battleWs = null;       // 對戰 WebSocket 連線
let battleStartTime = 0;   // 題目開始時間，用來計算作答秒數

function startBattle(mode = 'bot') {
  // 重置對戰資料
  const bd = state.battleData;
  bd.round = 0; bd.playerScore = 0; bd.oppScore = 0; bd.correct = 0; bd.total = 0; bd.combo = 0; bd.answering = false;
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
    }
  };

  battleWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleBattleMessage(msg);
  };

  battleWs.onerror = (err) => {
    console.error('WebSocket 錯誤:', err);
    showToast('連線失敗，請確認對戰伺服器是否啟動');
  };

  battleWs.onclose = () => {
    console.log('WebSocket 已關閉');
  };

  showScreen('battleScreen');
}

function handleBattleMessage(msg) {
  const bd = state.battleData;

  if (msg.type === 'queued') {
    // 已加入配對佇列，等待對手
    showToast('尋找對手中...');
    return;
  }

  if (msg.type === 'game_start') {
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
        total: bd.total           // 總題數
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
    }
  } catch (err) {
    console.error('更新統計失敗:', err);
  }

  // 顯示結果畫面
  const coins = finalWon ? Math.floor(finalPlayerScore / 50) + 100 : Math.floor(finalPlayerScore / 100) + 30;
  document.getElementById('resultIcon').textContent = finalWon ? '🏆' : '💀';
  document.getElementById('resultTitle').className = 'result-title ' + (finalWon ? 'result-win' : 'result-lose');
  document.getElementById('resultTitle').textContent = finalWon ? '勝利！' : '敗北';
  document.getElementById('resultSub').textContent = finalWon ? `你以 ${finalPlayerScore} 分擊敗了對手！` : `對手以 ${finalOppScore} 分獲勝`;
  document.getElementById('statScore').textContent = finalPlayerScore;
  document.getElementById('statCorrect').textContent = `${bd.correct}/${bd.total}`;
  document.getElementById('statAccuracy').textContent = acc + '%';
  document.getElementById('statCoinsEarned').textContent = '+' + coins;
  showScreen('resultScreen');
}

// ─── SKILLS ──────────────────────────────────────────────
function resetSkillBtns() {
  document.getElementById('skill50').classList.remove('used');
  document.getElementById('skillTime').classList.remove('used');
  document.getElementById('skillHint').classList.remove('used');
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
    setTimeout(() => next.classList.add('visible'), 10);
    document.querySelectorAll('#analyticsNav .nav-btn').forEach((b, i) => {
      b.classList.remove('active');
      if (['distribution', 'radar', 'trend'][i] === tab) b.classList.add('active');
    });
    setTimeout(initCharts, 50);
  }, 200);
}

function initCharts() {
  const topics = Object.keys(state.topicStats);
  const vals = Object.values(state.topicStats);
  const bgColors = ['#ffd700','#ff6b35','#ff1744','#00e676','#00d4ff','#e040fb','#40c4ff',
    '#ffab40','#69f0ae','#ea80fc','#ff6090','#84ffff','#b9f6ca','#ffd740','#ff9e80',
    '#cfd8dc','#80d8ff','#a7ffeb','#ccff90','#ffe57f','#ff9d80'];

  if (document.getElementById('tab-distribution').classList.contains('active')) {
    if (distChart) distChart.destroy();
    distChart = new Chart(document.getElementById('distributionChart'), {
      type: 'bar',
      data: { labels: topics, datasets: [{
        label: '答題數', data: vals,
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

    const cats = ['自然科學','人文歷史','娛樂電競','地理政經','科技發明'];
    const catVals = [
      vals[0]+vals[14]+vals[12]+vals[11]+vals[19]+vals[20],
      vals[2]+vals[17]+vals[18]+vals[16],
      vals[3]+vals[4]+vals[5]+vals[6],
      vals[1]+vals[7]+vals[8]+vals[9]+vals[10],
      vals[7]+vals[13]+vals[15]
    ];
    const catColors = ['#ffd700','#ff6b35','#e040fb','#00d4ff','#00e676'];
    if (pieChartInst) pieChartInst.destroy();
    pieChartInst = new Chart(document.getElementById('pieChart'), {
      type: 'doughnut',
      data: { labels: cats, datasets: [{ data: catVals, backgroundColor: catColors, borderWidth:2, borderColor:'#0a0a1a' }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{display:false} },
        cutout: '60%'
      }
    });
    const legend = document.getElementById('pieLegend');
    legend.innerHTML = cats.map((c,i)=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:12px;height:12px;border-radius:2px;background:${catColors[i]};flex-shrink:0"></div>
        <span style="font-size:13px;color:#b0b0d0">${c}</span>
        <span style="margin-left:auto;font-size:13px;color:#fff;font-weight:700">${catVals[i]}</span>
      </div>`).join('');
  }

  if (document.getElementById('tab-radar').classList.contains('active')) {
    const radarLabels = ['科學知識','地理歷史','娛樂常識','體育競技','科技資訊','藝術文化','生活常識','數理邏輯'];
    const radarData = [85,72,90,60,88,65,78,82];
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
          label: '平均水準', data: [70,70,70,70,70,70,70,70],
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
    const topEntry = Object.entries(state.topicStats).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById('bestTopic').textContent = topEntry ? topEntry[0] : '-';
    document.getElementById('avgAccuracy').textContent = Math.round(state.recentAccuracy.reduce((a,b)=>a+b,0)/state.recentAccuracy.length)+'%';
    document.getElementById('totalAnswered').textContent = Object.values(state.topicStats).reduce((a,b)=>a+b,0);
    document.getElementById('winRate').textContent = total>0?Math.round(state.wins/total*100)+'%':'0%';
  }

  if (document.getElementById('tab-trend').classList.contains('active')) {
    const labels = state.recentScores.map((_,i)=>`第${i+1}場`);
    if (trendChartInst) trendChartInst.destroy();
    trendChartInst = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: { labels, datasets: [{
        label: '得分', data: state.recentScores,
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
    accChartInst = new Chart(document.getElementById('accuracyChart'), {
      type: 'bar',
      data: { labels, datasets: [{
        label: '正確率%', data: state.recentAccuracy,
        backgroundColor: state.recentAccuracy.map(v => v>=80?'#00e676':v>=60?'#ffd700':'#ff1744'),
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
      if (['frames', 'tags', 'effects'][i] === tab) b.classList.add('active');
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
        `<div class="item-price">🪙 ${item.price > 0 ? item.price : '免費'}</div>`}
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
function renderRank() {
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('rankList').innerHTML = rankData.map(r=>`
    <div class="card" style="${r.isYou?'border-color:#ffd700;background:rgba(255,215,0,.05)':''}">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:${r.rank<=3?'28px':'20px'};font-weight:900;min-width:36px;text-align:center;font-family:'Orbitron',monospace;color:${r.rank<=3?'#ffd700':'#7070a0'}">
          ${r.rank<=3?medals[r.rank-1]:r.rank}</div>
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#ff6b35);
          display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid rgba(255,255,255,.2);position:relative">
          ${r.emoji}
          ${r.frame?`<span style="position:absolute;inset:-6px;border-radius:50%;border:3px solid ${r.frame==='💎'?'#00d4ff':'#ff6b35'};box-shadow:0 0 8px ${r.frame==='💎'?'#00d4ff':'#ff6b35'}"></span>`:''}
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:900">${r.name}${r.isYou?' <span style="color:var(--accent);font-size:12px">(你)</span>':''}</div>
          <div style="font-size:12px;color:var(--text2)">${r.tag} · ${r.wins} 勝</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:900;color:${r.rank===1?'#ffd700':r.rank===2?'#c0c0c0':r.rank===3?'#cd7f32':'#7070a0'}">${r.score.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text2)">積分</div>
        </div>
      </div>
    </div>`).join('');
}

// ─── INIT ────────────────────────────────────────────────
createStars();
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

function toggleEffect(effectId, forceEquip = false) {
  if (!state.owned.effects || !state.owned.effects.includes(effectId)) {
    showToast('❌ 你還未擁有此特效！請先在商店購買');
    return;
  }
  if(!forceEquip && (state.activeEffect || state.owned.activeEffect) === effectId) {
    state.activeEffect = null;
    state.owned.activeEffect = null;
  } else {
    state.activeEffect = effectId;
    state.owned.activeEffect = effectId;
  }
  profileEditState.activeEffect = state.activeEffect;
  updateProfileEditUI();
  showToast(state.activeEffect ? '✅ 特效已套用！' : '✅ 已取消特效');
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

  // 更新帳號安全頁面的 email
  const emailDisplay = document.getElementById('accountEmailDisplay');
  if (emailDisplay) emailDisplay.textContent = state.email || '未登入';

  const topTopics = Object.entries(state.topicStats)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([topic,count],i)=>
      `<div class="stat-box" style="text-align:center">
        <div style="font-size:24px;margin-bottom:6px">${topic.split(' ')[0]}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:4px">${topic}</div>
        <div style="font-size:16px;font-weight:900;color:${['#ffd700','#c0c0c0','#cd7f32','#7070a0','#7070a0'][i]}">${count}</div>
      </div>`
    ).join('');
  document.getElementById('topTopics').innerHTML = topTopics;
}

// 密碼不顯示，只顯示遮罩
function togglePasswordVisibility() {
  showToast('基於安全考量，密碼無法顯示');  // 不顯示密碼
}

function changePassword() {
  showScreen('profileScreen');
  switchProfileTab('account');
  showToast('請使用帳號安全頁面的更換密碼功能');
}

function enableTwoFA() {
  alert('將啟用雙重認證\n\n1. 下載認證器應用程式\n2. 掃描 QR 碼\n3. 輸入驗證碼\n\n此功能將大大提升帳號安全性！');
}

function logout() {
  if(confirm('確定要登出嗎？')) {
    state.userId = null;
    showToast('👋 已登出，再見！');
    setTimeout(()=>showScreen('loginScreen'), 1500);
  }
}

// ─── LOGIN ───────────────────────────────────────────────
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
    state.topicStats = {};                // 主題統計（等對戰系統串接後才有）
    state.recentScores = [];              // 近期得分（等對戰系統串接後才有）
    state.recentAccuracy = [];            // 近期準確率（等對戰系統串接後才有）

    // 更新畫面上的玩家資料
    updatePlayerBar();    // 更新玩家列（金幣、等級、暱稱）
    updateStatsDisplay(); // 更新統計資料頁面

    // 如果是管理員，顯示題庫管理按鈕
    if (profile.is_admin) {
      const adminBtn = document.getElementById('adminBtn');
      if (adminBtn) adminBtn.style.display = 'flex';
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