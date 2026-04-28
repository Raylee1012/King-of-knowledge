// ─── STATE ──────────────────────────────────────────────
const state = {
  coins: 1200, level: 7, xp: 2840, xpMax: 3000,
  playerName: '知識戰士', playerTag: '大師', playerTagClass: 'tag-master',
  equippedFrame: 'frame-gold', equippedEmoji: '🧠',
  owned: { frames: ['frame-none','frame-gold'], tags: ['tag-rookie','tag-master'], effects: [] },
  wins: 18, losses: 11,
  topicStats: {
    '🔬 科學':22,'🌍 地理':18,'📚 歷史':15,'🎮 電競':20,'🎵 音樂':12,
    '🎬 電影':8,'⚽ 體育':10,'🖥️ 科技':25,'🍜 美食':6,'🐾 動物':9,
    '🌿 植物':5,'🚀 航太':14,'💡 發明':11,'🎨 藝術':7,'🧪 化學':16,
    '📐 數學':19,'🌊 海洋':8,'🦁 生態':10,'🏛️ 政治':13,'💰 經濟':17,'🔭 天文':11
  },
  recentScores: [680,520,790,640,720,580,810,670,750,820],
  recentAccuracy: [72,65,83,70,78,62,88,74,80,85],
  battleData: { round:0, playerScore:0, oppScore:0, correct:0, total:0, timer:null, timerVal:15, combo:1, answering:false },
  skills: { used50: false, usedTime: false, usedHint: false }
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
    {id:'frame-rainbow',name:'彩虹傳說',desc:'七彩漸變框（稀有）',price:1500,preview:'🌈',class:'frame-diamond'},
  ],
  tags: [
    {id:'tag-rookie',name:'新手村民',desc:'剛入門的稱號',price:0,preview:'🌱'},
    {id:'tag-master',name:'大師',desc:'知識的探索者',price:300,preview:'⭐',class:'tag-master'},
    {id:'tag-legend',name:'傳說',desc:'頂尖知識戰士',price:800,preview:'🏆',class:'tag-legend'},
    {id:'tag-king',name:'知識王',desc:'最高榮耀稱號',price:2000,preview:'👑',class:'tag-legend'},
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
  {rank:8,name:'答題機器',tag:'新手',score:45100,wins:98,frame:'',emoji:'🤖'},
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
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='analyticsScreen') setTimeout(initCharts,100);
  if(id==='shopScreen') renderShop('frames');
  if(id==='rankScreen') renderRank();
}

// ─── PLAYER BAR ──────────────────────────────────────────
function updatePlayerBar() {
  document.getElementById('coinDisplay').textContent = state.coins;
  document.getElementById('shopCoins').textContent = state.coins;
  document.getElementById('playerNameDisplay').innerHTML = state.playerName +
    `<span class="player-tag ${state.playerTagClass}" id="playerTagDisplay">${state.playerTag}</span>`;
  document.getElementById('playerLevel').textContent = state.level;
  document.getElementById('playerXP').textContent = state.xp;
  const pct = (state.xp/state.xpMax*100).toFixed(0);
  document.getElementById('xpBar').style.width = pct+'%';
  document.getElementById('playerAvatar').textContent = state.equippedEmoji;
  const pf = document.getElementById('playerFrame');
  pf.className = 'avatar-frame ' + (state.equippedFrame !== 'frame-none' ? state.equippedFrame : '');
}

// ─── BATTLE ──────────────────────────────────────────────
let currentQ = 0, questionOrder = [];

function startBattle() {
  showScreen('battleScreen');
  const bd = state.battleData;
  bd.round=0; bd.playerScore=0; bd.oppScore=0; bd.correct=0; bd.total=0; bd.combo=1; bd.answering=false;
  state.skills = { used50:false, usedTime:false, usedHint:false };
  resetSkillBtns();
  questionOrder = [...Array(questions.length).keys()].sort(()=>Math.random()-.5);
  updateScoreDisplay();
  document.getElementById('battleAvatar').textContent = state.equippedEmoji;
  document.getElementById('battleName').textContent = state.playerName;
  loadQuestion();
}

function loadQuestion() {
  const bd = state.battleData;
  if (bd.round >= 10) { endBattle(); return; }
  bd.round++;
  bd.answering = false;
  document.getElementById('roundNum').textContent = bd.round;
  document.getElementById('comboMult').textContent = bd.combo;

  const qi = questionOrder[(bd.round-1) % questions.length];
  const q = questions[qi];
  document.getElementById('topicBadge').textContent = q.topic;
  document.getElementById('questionText').textContent = q.q;

  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const labels = ['A','B','C','D'];
  q.opts.forEach((opt,i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-label">${labels[i]}</span>${opt}`;
    btn.onclick = () => answerQuestion(i, q.ans, btn);
    grid.appendChild(btn);
  });

  startTimer(15);
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
  state.battleData.answering = true;
  state.battleData.combo = 1;
  document.getElementById('comboMult').textContent = 1;
  addWrongFlash();
  // opponent might "answer"
  const oppPoints = Math.floor(Math.random()*100)+50;
  state.battleData.oppScore += oppPoints;
  updateScoreDisplay();
  setTimeout(loadQuestion, 1500);
}

function answerQuestion(chosen, correct, btn) {
  const bd = state.battleData;
  if (bd.answering) return;
  bd.answering = true;
  clearInterval(bd.timer);
  bd.total++;
  state.topicStats[questions[questionOrder[(bd.round-1)%questions.length]].topic] = 
    (state.topicStats[questions[questionOrder[(bd.round-1)%questions.length]].topic]||0)+1;

  const grid = document.getElementById('optionsGrid');
  const btns = grid.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);
  btns[correct].classList.add('correct');

  if (chosen === correct) {
    btn.classList.add('correct');
    bd.correct++;
    const timeBonus = bd.timerVal * 5;
    const points = (100 + timeBonus) * bd.combo;
    bd.playerScore += points;
    bd.combo = Math.min(bd.combo+1, 5);
    addCorrectEffect(points);
    if (bd.combo >= 3) showComboPopup(bd.combo);
    showXpPopup();
  } else {
    btn.classList.add('wrong');
    btns[correct].classList.add('correct');
    bd.combo = 1;
    addWrongFlash();
    const oppPoints = Math.floor(Math.random()*120)+80;
    bd.oppScore += oppPoints;
  }
  document.getElementById('comboMult').textContent = bd.combo;
  updateScoreDisplay();
  setTimeout(loadQuestion, 1800);
}

function updateScoreDisplay() {
  const bd = state.battleData;
  document.getElementById('playerScore').textContent = bd.playerScore;
  document.getElementById('oppScore').textContent = bd.oppScore;
  const maxP = Math.max(bd.playerScore, bd.oppScore, 500);
  document.getElementById('playerHp').style.width = Math.max(5,(bd.playerScore/maxP*100)).toFixed(0)+'%';
  document.getElementById('oppHp').style.width = Math.max(5,(bd.oppScore/maxP*100)).toFixed(0)+'%';
}

function endBattle() {
  const bd = state.battleData;
  const won = bd.playerScore > bd.oppScore;
  const coins = won ? Math.floor(bd.playerScore/50)+100 : Math.floor(bd.playerScore/100)+30;
  state.coins += coins;
  state.xp += won ? 200 : 80;
  if (state.xp >= state.xpMax) { state.level++; state.xp -= state.xpMax; state.xpMax = Math.floor(state.xpMax*1.3); }
  if (won) state.wins++; else state.losses++;
  state.recentScores.push(bd.playerScore);
  state.recentScores = state.recentScores.slice(-10);
  const acc = bd.total > 0 ? Math.round(bd.correct/bd.total*100) : 0;
  state.recentAccuracy.push(acc);
  state.recentAccuracy = state.recentAccuracy.slice(-10);
  updatePlayerBar();

  document.getElementById('resultIcon').textContent = won ? '🏆' : '💀';
  document.getElementById('resultTitle').className = 'result-title ' + (won?'result-win':'result-lose');
  document.getElementById('resultTitle').textContent = won ? '勝利！' : '敗北';
  document.getElementById('resultSub').textContent = won ? `你以 ${bd.playerScore} 分擊敗了對手！` : `對手以 ${bd.oppScore} 分獲勝`;
  document.getElementById('statScore').textContent = bd.playerScore;
  document.getElementById('statCorrect').textContent = `${bd.correct}/${bd.total}`;
  document.getElementById('statAccuracy').textContent = acc+'%';
  document.getElementById('statCoins').textContent = '+'+coins;
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
  const qi = questionOrder[(state.battleData.round-1)%questions.length];
  const q = questions[qi];
  const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
  let removed = 0;
  for (let i=0;i<4&&removed<2;i++) {
    if (i !== q.ans && !btns[i].disabled) { btns[i].style.opacity='.2'; btns[i].disabled=true; removed++; }
  }
}
function useSkillTime() {
  if (state.skills.usedTime) return;
  state.skills.usedTime = true;
  document.getElementById('skillTime').classList.add('used');
  state.battleData.timerVal = Math.min(state.battleData.timerVal+10, 25);
  updateTimer(state.battleData.timerVal);
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
function addCorrectEffect(points) {
  const overlay = document.getElementById('effectOverlay');
  const flash = document.createElement('div');
  flash.className = 'correct-flash';
  overlay.appendChild(flash);
  setTimeout(()=>flash.remove(),400);
  const colors = ['#ffd700','#ff6b35','#00e676','#00d4ff','#e040fb'];
  for (let i=0;i<20;i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const x = (Math.random()*200-100)+'px', y = (Math.random()*200-100)+'px';
    p.style.cssText=`width:8px;height:8px;background:${colors[Math.floor(Math.random()*colors.length)]};
      left:50%;top:50%;--tx:${x};--ty:${y};animation-duration:${.6+Math.random()*.6}s`;
    overlay.appendChild(p);
    setTimeout(()=>p.remove(),1200);
  }
}
function addWrongFlash() {
  const overlay = document.getElementById('effectOverlay');
  const flash = document.createElement('div');
  flash.className = 'wrong-flash';
  overlay.appendChild(flash);
  setTimeout(()=>flash.remove(),400);
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
  document.querySelectorAll('#analyticsScreen .tab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('#analyticsNav .nav-btn').forEach((b,i)=>{
    b.classList.remove('active');
    if(['distribution','radar','trend'][i]===tab) b.classList.add('active');
  });
  setTimeout(initCharts, 50);
}

function initCharts() {
  const topics = Object.keys(state.topicStats);
  const vals = Object.values(state.topicStats);
  const bgColors = ['#ffd700','#ff6b35','#ff1744','#00e676','#00d4ff','#e040fb','#40c4ff',
    '#ffab40','#69f0ae','#ea80fc','#ff6090','#84ffff','#b9f6ca','#ffd740','#ff9e80',
    '#cfd8dc','#80d8ff','#a7ffeb','#ccff90','#ffe57f','#ff9d80'];

  // Distribution bar
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

    // Pie
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

  // Radar
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
  }

  // Trend
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
  document.querySelectorAll('#shopScreen .nav-btn').forEach((b,i)=>{
    b.classList.remove('active');
    if(['frames','tags','effects'][i]===tab) b.classList.add('active');
  });
  renderShop(tab);
}

function renderShop(tab) {
  const container = document.getElementById('shopContent');
  const items = shopData[tab];
  container.innerHTML = `<div class="shop-grid">${items.map(item => {
    const isOwned = state.owned[tab] && state.owned[tab].includes(item.id);
    const isEquipped = (tab==='frames' && state.equippedFrame===item.id) ||
      (tab==='tags' && state.playerTag===item.name);
    return `<div class="shop-item ${isOwned?'owned':''} ${isEquipped?'equipped':''}" onclick="buyItem('${tab}','${item.id}')">
      <div class="item-preview" style="${item.class&&tab==='frames'?`border-color:${item.class.includes('diamond')?'#00d4ff':item.class.includes('fire')?'#ff6b35':'#ffd700'};box-shadow:0 0 12px ${item.class.includes('diamond')?'#00d4ff':item.class.includes('fire')?'#ff6b35':'#ffd700'}`:''}">${item.preview}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>
      ${isEquipped ? '<span class="badge-equipped">已裝備</span>' :
        isOwned ? '<span class="badge-owned">已擁有</span>' :
        `<div class="item-price">🪙 ${item.price || '免費'}</div>`}
    </div>`;
  }).join('')}</div>`;
}

function buyItem(tab, id) {
  const items = shopData[tab];
  const item = items.find(i=>i.id===id);
  if (!item) return;
  const isOwned = state.owned[tab] && state.owned[tab].includes(id);

  if (isOwned) {
    // Equip
    if (tab==='frames') { state.equippedFrame = id; }
    else if (tab==='tags') {
      state.playerTag = item.name;
      state.playerTagClass = item.class || 'tag-rookie';
    }
    updatePlayerBar();
    renderShop(tab);
    return;
  }

  if (item.price > state.coins) {
    showToast('金幣不足！繼續對戰賺取金幣 🪙');
    return;
  }

  state.coins -= item.price;
  if (!state.owned[tab]) state.owned[tab] = [];
  state.owned[tab].push(id);
  // auto equip
  if (tab==='frames') state.equippedFrame = id;
  else if (tab==='tags') { state.playerTag = item.name; state.playerTagClass = item.class||'tag-rookie'; }
  updatePlayerBar();
  renderShop(tab);
  showToast(`🎉 購買成功！${item.name} 已裝備`);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText=`position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
    background:#1a1a3e;border:1px solid #ffd700;color:#fff;padding:12px 24px;border-radius:12px;
    font-size:14px;font-weight:700;z-index:200;animation:popUp .3s ease`;
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
updatePlayerBar();