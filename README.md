# 🧠 知識王 - Quiz King

## 📋 遊戲介紹（簡報版）

**知識王** 是一款在線實時知識競答遊戲，玩家透過登錄帳戶參與激烈的一對一對戰。遊戲包含 20+ 個知識主題，如科學、歷史、地理、電競、美食等，每場對戰 10 道題目。

**核心特色：**
- 🎮 **實時對戰**：WebSocket 實現毫秒級同步，兩名玩家同時作答
- 💰 **成長系統**：透過勝負獲得金幣、經驗值、升級等級
- 🎁 **裝扮系統**：解鎖頭像框、稱號、特效等獎勵
- 🤖 **AI 練習**：可與 AI 對手進行練習
- 📊 **數據統計**：追蹤勝率、準確率、各主題成績
- 🎯 **道具系統**：使用「50/50」、「加時」、「提示」等技能翻盤

---

## 📁 檔案結構與功能說明

### 🎨 **前端部分（Frontend）**

#### `index.html` - 主頁面
```
功能：定義遊戲的 HTML 結構
主要元素：
- 登入／註冊／忘記密碼介面
- 遊戲大廳（個人數據、排行榜、商城）
- 遊戲對戰介面（題目顯示、選項、計時器、道具）
- 結算介面（勝負統計、獲得獎勵）
```

#### `main.js` - 客戶端邏輯與業務流程（核心檔案）
```
核心變數：
- state：玩家狀態（id、等級、金幣、題目統計等）
- shopData：商城數據（頭像框、稱號、特效、道具價格）
- rankData：排行榜數據

關鍵函數：
- handleLogin()：處理玩家登入
- handleRegister()：處理玩家註冊
- showScreen(id)：切換介面
- handleRandomMatch()：加入隨機配對佇列
- submitAnswer()：提交答案
- useItem(itemName)：使用道具
- buyItem(type, id)：購買裝扮／道具
- syncUserData()：同步使用者數據
- createStars()：生成背景星空動畫
- updateStats()：更新個人統計數據
```

#### `style.css` - 樣式表
```
功能：定義遊戲的視覺設計
包含：
- 星空背景主題（深藍色 #0a0a1a）
- 發光黃金色按鈕（#FFD700）
- 動畫效果（星星閃爍、卡片滑入、答題振動）
- 響應式佈局
```

---

### 🔐 **後端部分（驗證系統）** - `backend/` 資料夾

#### `index.py` - 驗證服務主檔案
```
功能：Flask 應用入口，配置 CORS、路由註冊、環境變數載入

關鍵函數：
- app = Flask(__name__)：建立 Flask 服務實例
- CORS(app)：配置跨域資源共享，允許前端跨域請求
- register_blueprint(auth_bp)：註冊驗證藍圖，路由前綴為 /auth
- register_blueprint(user_bp)：註冊使用者藍圖，路由前綴為 /user
- config()：返回管理員所需的 Gemini/Supabase 配置
- verified()：驗證郵箱後的成功頁面

API 路由：
- GET /config：取得後端配置（僅管理員）
- GET /verified：郵箱驗證成功頁面
```

#### `auth.py` - 驗證與帳戶管理
```
功能：處理註冊、登入、忘記密碼、郵箱驗證

關鍵函數與 API：

1. send_email(to_email, subject, html_content)
   - 使用 Gmail SMTP 發送郵件
   - 參數：收件人、主旨、HTML 內容

2. POST /auth/register - 使用者註冊
   - 請求：{ custom_id, nickname, email, password }
   - 流程：
     * 檢查 custom_id 是否已存在（查詢 users 表）
     * 密碼長度驗證（至少 6 位）
     * Email 格式驗證
     * 在 Supabase Auth 建立使用者
     * 在 users 表記錄使用者數據（預設等級1、金幣0、暱稱nickname）
     * 發送驗證郵件，24小時內驗證有效
     * 逾期未驗證則刪除帳戶
   - 響應：{ user_id, message }

3. POST /auth/verify-email - 郵箱驗證
   - 請求：{ token }
   - 流程：
     * 解析 token 取得使用者資訊
     * 更新 users 表的 is_verified 為 true
     * 發送歡迎郵件
   - 響應：{ message } 或錯誤資訊

4. POST /auth/login - 使用者登入
   - 請求：{ email_or_id, password }
   - 流程：
     * 向 Supabase Auth 發送登入請求
     * 返回 JWT token 和使用者 ID
     * 前端將 token 存儲到 localStorage
   - 響應：{ access_token, user_id, email }

5. POST /auth/forgot-password - 忘記密碼
   - 請求：{ email }
   - 流程：
     * 查詢使用者是否存在
     * 生成重置 token，有效期 1 小時
     * 發送重置郵件連結
   - 響應：{ message }

6. POST /auth/reset-password - 重置密碼
   - 請求：{ token, new_password }
   - 流程：
     * 驗證 token 有效性
     * 呼叫 Supabase admin API 更新密碼
     * 清除舊 token
   - 響應：{ message }

關鍵變數：
- supabase：Supabase 資料庫連接
- verification_codes：暫存驗證碼字典（{ email: { code, expire_at } }）
- SUPABASE_ADMIN_HEADERS：Admin API 請求頭，具有最高權限
```

#### `user.py` - 玩家數據管理
```
功能：取得玩家資訊、修改暱稱、購買裝扮、更新對戰結果

關鍵函數與 API：

1. GET /user/profile/<user_id> - 取得玩家資訊
   - 返回：{ id, custom_id, email, coins, nickname, level, xp, wins, losses, 
            total_answered, avg_accuracy, total_score, owned_frames, owned_tags, 
            owned_effects, active_effect, topic_stats, nickname_remaining_free }
   - 計算邏輯：
     * nickname_remaining_free = 本月剩餘免費改名次數（每月3次，超過則需花500金幣）

2. POST /user/nickname - 修改暱稱
   - 請求：{ user_id, new_nickname }
   - 流程：
     * 檢查暱稱長度（1-16字）
     * 檢查本月是否已用完3次免費改名
     * 若已超過，扣除 500 金幣
     * 更新 users 表的 nickname 欄位
   - 響應：{ message, cost }

3. POST /user/buy-item - 購買裝扮／道具
   - 請求：{ user_id, item_type, item_id }
     * item_type: 'frame' | 'tag' | 'effect' | 'skill'
   - 流程：
     * 查詢物品價格（從 shopData）
     * 檢查金幣是否充足
     * 扣除金幣
     * 將物品新增到 owned_frames/owned_tags/owned_effects
     * 返回剩餘金幣
   - 響應：{ remaining_coins, message }

4. POST /user/equip-item - 裝備物品
   - 請求：{ user_id, item_type, item_id }
   - 流程：
     * 檢查玩家是否擁有此物品
     * 更新 users 表的 equippedFrame / equippedEmoji / activeEffect
   - 響應：{ message }

5. POST /user/sync-battle-result - 同步對戰結果
   - 請求：{ user_id, won, score, questions_total, questions_correct, 
             opponent_name, topic_stats }
   - 流程：
     * 更新 wins / losses
     * 計算 avg_accuracy = questions_correct / questions_total
     * 更新 total_score、total_answered
     * 根據勝利增加 xp 和金幣（勝利 +100xp +150金幣；失敗 +50xp +50金幣）
     * 檢查是否升級（xp >= xp_max 則升級，xp_max 增加 200）
     * 合併 topic_stats（記錄各主題正確／錯誤次數）
   - 響應：{ level, xp, xp_max, coins, wins, losses, level_up }

關鍵變數：
- FREE_NICKNAME_CHANGE_LIMIT = 3：每月免費改名次數
- NICKNAME_CHANGE_COST = 500：超過免費次數的費用
```

---

### 🎮 **遊戲伺服器（對戰系統）** - `server/` 資料夾

#### `app.py` - 遊戲服務主檔案
```
功能：WebSocket 伺服器，管理實時對戰連接

關鍵變數：
- PORT = 4000：服務運行埠號
- match_manager：配對管理器實例
- rooms：所有活躍遊戲房間字典 { room_id: GameRoom }
- questions：題庫列表

關鍵函數：

1. @app.route('/') - 根路由
   - 返回：'知識王對戰系統運作中'

2. @app.route('/health') - 健康檢查
   - 返回：{ status: 'ok', questionCount: 題庫數量 }

3. @sock.route('/ws') - WebSocket 連接處理
   - 為每個連接分配唯一 ID（7 位隨機字元）
   - 初始化：ws.player_name, ws.user_id, ws.room_id
   - 持續接收客戶端訊息，呼叫 handle_message()
   - 連接斷開時：
     * 從配對佇列移除玩家
     * 從房間移除玩家
     * 如果房間全空，刪除房間

4. get_player_name(msg) - 從訊息提取玩家名稱
   - 取值順序：userName → name → '玩家'
   - 限制長度 12 字元

5. handle_message(ws, msg) - 訊息處理分發器
   處理訊息類型：
   - 'join_bot'：加入 AI 練習
   - 'join_random'：加入隨機匹配佇列
   - 'create_room'：建立房間
   - 'join_room'：加入指定房間
   - 'submit_answer'：提交答案
   - 'use_item'：使用道具
   - 'forfeit'：認輸
```

#### `match_manager.py` - 配對管理器
```
功能：管理隨機配對佇列、房間建立與加入

關鍵類和方法：

class MatchManager:
    def __init__()
        - self.random_queue：等待隨機配對的玩家列表
        - self.room_waiting：等待對手的房間字典 { room_id: { ws, on_match } }

    def enqueue_random(ws, on_match)
        - 將玩家加入隨機佇列
        - 當佇列 >= 2 人時，立即配對建立房間
        - 參數：ws（WebSocket）、on_match（配對成功回呼）
        - 返回：呼叫 on_match(player1_ws, player2_ws, room_id)

    def create_room(ws, room_id, on_match)
        - 建立房間，等待對手加入
        - 參數：room_id（6位隨機數字）
        - 返回：True（成功）或 False（房間已存在）

    def join_room(ws, room_id, on_match)
        - 加入現存房間，配對成功後刪除等待項
        - 返回：True（加入成功）或 False（房間不存在）

    def remove_from_queue(ws)
        - 從佇列移除玩家（玩家離線或進入房間）
        - 同時檢查房間建立者是否為該玩家，若是則刪除房間
```

#### `game_room.py` - 遊戲房間邏輯
```
功能：管理一局兩人對戰的全部流程

常數：
- QUESTION_TIMEOUT = 10：每題回答時間限制（秒）
- RESULT_DELAY = 1.5：題目結算延遲（秒）
- QUESTIONS_PER_GAME = 10：每局題目數
- ITEM_MAX_USES = 2：每位玩家道具使用次數

class GameRoom:
    def __init__(room_id, p1, p2, question_bank, on_end)
        - self.room_id：房間 ID
        - self.players：[玩家1, 玩家2]
        - self.questions：本局使用的 10 道隨機題目
        - self.scores：[玩家1分數, 玩家2分數]
        - self.answers：[玩家1答案, 玩家2答案]
        - self.answered：[玩家1是否已答, 玩家2是否已答]
        - self.item_uses_left：[玩家1剩餘道具數, 玩家2剩餘道具數]
        - self.removed_options：[玩家1已刪除的選項集合, 玩家2已刪除的選項集合]
        - self.current_q：當前題目索引（0-9）
        - self.topic_stats：{ player_id: { category: { correct, wrong } } }

    def start()
        - 發送 'game_start' 訊息給兩位玩家
        - 1.5 秒後呼叫 _send_question() 發送第一題

    def _send_question()
        - 發送當前題目及選項給兩位玩家
        - 啟動 10 秒計時器
        - 若房間內有 AI，模擬 AI 在 2-8 秒後隨機作答

    def submit_answer(player_id, answer_idx, used_sec)
        - 記錄玩家答案和用時
        - 通知對方已作答
        - 當雙方都作答時，取消計時器並立即結算題目

    def use_item(player_id, item_name)
        - 處理玩家使用道具 'delete_wrong'
        - 流程：
          * 檢查玩家是否已作答（已答不可用）
          * 檢查剩餘道具（無則報錯）
          * 隨機選擇一個錯誤選項刪除
          * 通知玩家已刪除的選項索引
          * 剩餘道具 -1

    def _resolve_question()
        - 結算當前題目
        - 流程：
          * 比較雙方答案與正確答案
          * 答對方獲得分數（基於用時：用時越短分數越高）
          * 記錄答題統計（topic_stats）
          * 1.5 秒後發送下一題或結束遊戲

    def _end_game()
        - 遊戲結束處理
        - 發送 'game_end' 訊息，包含最終分數、勝者、統計數據
        - 呼叫 on_end() 回呼，傳入結果

    def _send(player, msg)
        - 向玩家發送 JSON 訊息

    def handle_disconnect(ws_id)
        - 玩家斷線處理
        - 通知對方玩家已斷線
        - 結束遊戲
```

#### `db.py` - 題庫載入
```
功能：從 Supabase 資料庫載入題庫

def load_questions()
    - 從環境變數讀取 SUPABASE_URL 和 SUPABASE_KEY
    - 分頁查詢 questions 表（每頁 1000 題）
    - 提取題目格式：{ q: '題目', opts: ['A','B','C','D'], ans: 0-3, category: '分類' }
    - 跳過格式不完整的題目
    - 打亂題庫順序
    - 返回題庫列表

API 請求頭：
    - apikey：Supabase Key
    - Authorization：Bearer token
    - Accept：application/json

錯誤處理：
    - 缺少 SUPABASE_URL 或 SUPABASE_KEY 則拋出錯誤
    - 表為空或無有效題目則拋出錯誤
```

#### `questions.py` - 本地題庫備份
```
功能：包含 50 道示例題目，當 Supabase 不可用時作為備選

題目格式：
{ "q": "題目文本", "opts": ["A選項", "B選項", "C選項", "D選項"], "ans": 0 }

涵蓋主題：地理、科學、歷史、語言、數學、常識等
可用於測試和演示
```

---

### 🤖 **題目生成系統** - `generate/` 資料夾

#### `app.py` - 題目生成服務
```
功能：使用 Google Gemini AI 生成題目，存儲到 Supabase

關鍵 API：

1. GET /config - 連接測試
   - 返回：{ status: 'ok' }
   - 用途：管理員頁面確認後端連接

2. POST /generate - 生成題目
   - 請求：{ categories: ['科學', '歷史', ...], count: 10 }
   - 流程：
     * 驗證分類不為空
     * 驗證數量在 1-50 之間
     * 呼叫 Gemini API 生成題目
     * 存入 Supabase questions 表
     * 返回生成的題目列表
   - 響應：{ message, questions, inserted }

3. GET /questions - 查詢題目
   - 參數：category（分類）、keyword（關鍵字）、page（頁數）、page_size（每頁數量）
   - 返回：分頁的題目列表

4. PATCH /questions/<id> - 編輯題目
   - 請求：{ question, answer_a, answer_b, answer_c, answer_d, correct_answer, category }
   - 只允許更新這些欄位，其他欄位被忽略
   - 返回：編輯結果

5. DELETE /questions - 刪除題目
   - 請求：{ ids: [1, 2, 3] }
   - 支援批量刪除
   - 返回：刪除結果

關鍵模組導入：
- services.gemini_service.generate_questions：呼叫 Gemini 生成題目
- services.supabase_service：保存、查詢、編輯、刪除題目
```

---

## 🔄 程序執行流程（從玩家登入開始）

### **階段 1：玩家啟動遊戲**

```
1. 用戶打開 index.html
   ↓
2. main.js 執行初始化：
   - createStars() 生成背景星空效果
   - 檢查 localStorage 中是否有 token（已登入）
   - 若有則自動跳轉到遊戲大廳；若無則顯示登入介面
```

### **階段 2：玩家登入**

```
用戶輸入 Email/ID 和密碼
   ↓
main.js 呼叫 handleLogin()
   ↓
發送 POST 請求到 backend:3000/auth/login
   ↓
backend/auth.py 處理登入：
   - 呼叫 Supabase Auth API 驗證郵箱和密碼
   - 驗證成功返回 JWT token 和 user_id
   ↓
main.js 接收響應：
   - 保存 token 和 user_id 到 localStorage
   - 呼叫 syncUserData() 從後端取得使用者數據
   ↓
發送 GET 請求到 backend:3000/user/profile/<user_id>
   ↓
backend/user.py 返回玩家資訊：
   - 等級、金幣、暱稱、勝負統計、擁有的裝扮等
   ↓
main.js 接收數據，更新 state 變數
   ↓
顯示遊戲大廳介面（showScreen('dashboardScreen')）
```

### **階段 3：遊戲大廳**

用戶可選擇：
- **查看排行榜**：顯示 rankData，前 8 名玩家的戰績
- **進入商城**：購買頭像框、稱號、特效、技能
- **修改暱稱**：POST /user/nickname，可免費改 3 次／月
- **開始對戰**：選擇隨機配對或建立房間

### **階段 4：匹配階段**

```
用戶點擊「隨機匹配」或「建立房間」
   ↓
main.js 建立 WebSocket 連接到 server:4000/ws
   ↓
server/app.py 的 websocket() 函數：
   - 為連接分配唯一 ID（7 位隨機字元）
   - 等待客戶端訊息

main.js 發送訊息：
   { type: 'join_random', userName: 玩家名稱, userId: user_id }
   ↓
server/app.py 的 handle_message() 處理 'join_random'：
   - 呼叫 match_manager.enqueue_random(ws, on_match_callback)
   - 將玩家加入隨機佇列
   - 若佇列 >= 2 人：
     * 取出前兩個玩家
     * 生成房間 ID（6 位數字）
     * 呼叫 on_match_callback()

on_match_callback() 執行：
   - 建立 GameRoom 實例
   - 呼叫 room.start()
   - 存入 rooms 字典
   - 發送 'game_start' 訊息給兩位玩家
```

### **階段 5：遊戲進行中**

```
GameRoom.start() 執行：
   ↓
1.5 秒後呼叫 _send_question()
   ↓
server/game_room.py 發送第 1 題到兩位玩家：
   {
     type: 'question',
     index: 0,
     total: 10,
     question: '題目文本',
     options: ['A', 'B', 'C', 'D'],
     category: '科學',
     itemUsesLeft: 2
   }
   ↓
main.js 接收題目：
   - 顯示題目和選項
   - 啟動倒計時器（10 秒）
   - 若有 AI 則 AI 在 2-8 秒後隨機作答

用戶做出選擇或點擊道具：
   - 選擇選項 → 發送 { type: 'submit_answer', answerIdx: 0, usedSec: 5.2 }
   - 使用道具 → 發送 { type: 'use_item', item: 'delete_wrong' }
   ↓
server/game_room.py 處理答案提交：
   - 記錄 answers 和 answered 狀態
   - 通知對方 { type: 'opponent_answered' }
   - 若雙方都答題，立即結算
   - 若 10 秒計時器觸發，強制結算
   ↓
_resolve_question() 結算：
   - 對比雙方答案與正確答案
   - 計算得分（基於用時：10秒內答對 max_score = 100 - used_sec * 5）
   - 發送結果到兩位玩家：
     {
       type: 'result',
       correct: true/false,
       myScore: 80,
       oppScore: 65,
       correctIdx: 2,
       your_accuracy: 0.8,
       opp_accuracy: 0.6
     }
   ↓
1.5 秒後發送下一題或結束遊戲
   ↓
重複：第 2-10 題
```

### **階段 6：遊戲結束**

```
第 10 題結算完後，呼叫 _end_game()
   ↓
GameRoom 發送 'game_end' 訊息：
   {
     type: 'game_end',
     winner: 'player1' / 'player2' / 'draw',
     my_total_score: 850,
     opp_total_score: 720,
     my_accuracy: 0.82,
     opp_accuracy: 0.75,
     topic_stats: { '科學': { correct: 7, wrong: 1 }, ... }
   }
   ↓
main.js 接收遊戲結束訊息：
   - 顯示結算介面（勝負、分數、獲得的金幣和經驗）
   - 呼叫 syncBattleResult() 上報對戰結果
   ↓
POST 請求到 backend:3000/user/sync-battle-result
   ↓
backend/user.py 處理對戰結果：
   - 更新 wins / losses / total_score / total_answered / avg_accuracy
   - 計算獲得的金幣和 XP
   - 檢查是否升級（xp >= xp_max）
   - 更新 topic_stats（各主題的答題統計）
   ↓
後端返回更新後的數據：
   { level, xp, xp_max, coins, wins, losses, level_up }
   ↓
main.js 更新 state，顯示升級動畫或獎勵提示
   ↓
點擊「返回大廳」按鈕，回到階段 3（遊戲大廳）
   可繼續進行下一場對戰
```

### **階段 7：遊戲斷線處理**

```
若玩家在對戰中斷線：
   ↓
server/app.py 的 websocket() finally 塊：
   - 從 random_queue 移除玩家
   - 呼叫 room.handle_disconnect(ws_id)
   ↓
GameRoom 的 handle_disconnect()：
   - 通知對方玩家已斷線
   - 對方玩家自動獲勝
   - 房間結束
```

---

## 🏗️ 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                     🎮 前端（Frontend）                          │
│            index.html + main.js + style.css                      │
│   (登入介面、大廳、對戰介面、商城、排行榜)                        │
└────────────────┬────────────────────────────┬────────────────────┘
                 │ HTTP(S)                    │ WebSocket
                 ↓                            ↓
    ┌────────────────────────┐    ┌────────────────────────┐
    │  🔐 後端（驗證系統）   │    │ 🎮 遊戲伺服器          │
    │   localhost:3000       │    │  localhost:4000        │
    │                        │    │                        │
    │ backend/              │    │ server/               │
    │ ├─ index.py (Flask)  │    │ ├─ app.py (WebSocket) │
    │ ├─ auth.py           │    │ ├─ match_manager.py   │
    │ └─ user.py           │    │ ├─ game_room.py       │
    │                        │    │ ├─ db.py             │
    │ 功能：                │    │ └─ questions.py      │
    │ • 註冊／登入／驗證      │    │                        │
    │ • 玩家數據管理        │    │ 功能：                │
    │ • 商城（裝扮／道具）   │    │ • 實時對戰            │
    │ • 暱稱修改            │    │ • 配對管理            │
    │ • 對戰結果同步        │    │ • 題目分配            │
    └────────────────────────┘    │ • 分數計算            │
             ↕ HTTP                 │ • 結果統計            │
             ↓                       └────────────────────────┘
    ┌────────────────────────┐
    │  🗄️ Supabase 雲資料庫  │
    │  (PostgreSQL)           │
    │                        │
    │ 表：                   │
    │ • users (玩家數據)     │
    │ • questions (題庫)    │
    │ • game_records (戰績) │
    └────────────────────────┘

    ┌────────────────────────┐
    │  🤖 題目生成服務       │
    │   localhost:5000       │
    │                        │
    │ generate/             │
    │ ├─ app.py             │
    │ ├─ services/          │
    │ │  ├─ gemini_service  │
    │ │  └─ supabase_service│
    │                        │
    │ 功能（僅管理員）：     │
    │ • 呼叫 Gemini API     │
    │ • 生成題目            │
    │ • 上傳到 Supabase    │
    └────────────────────────┘
```

---

## 📊 數據流總結

| 階段 | 參與者 | 操作 | 數據流 |
|------|--------|------|--------|
| **登入** | Frontend → Backend | 驗證郵箱密碼 | Email/PW → JWT Token |
| **加載數據** | Backend → Frontend | 取得玩家資訊 | 用戶 ID → 完整個人數據 |
| **大廳展示** | Frontend | 顯示選項 | 無網路通信 |
| **配對** | Frontend ↔ GameServer | 加入佇列 | join_random → 房間 ID |
| **遊戲進行** | GameServer ↔ Frontend | 題目／答案往返 | 實時 WebSocket 同步 |
| **結算結果** | GameServer → Backend | 上報對戰結果 | 分數、勝負、統計數據 |
| **更新檔案** | Backend → Frontend | 保存新數據 | 更新後的玩家資訊 |

---

## 🚀 快速啟動指南

### 前置需求
```bash
# Python 3.8+、Node.js 14+、PostgreSQL 資料庫

# 環境變數配置 (.env 檔案)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_key
GMAIL_USER=your_gmail@gmail.com
GMAIL_PASS=your_app_password
```

### 啟動服務
```bash
# 1. 驗證服務 (Backend)
cd backend
pip install -r requirements.txt
python index.py  # 運行在 http://localhost:3000

# 2. 遊戲服務 (Game Server)
cd server
pip install -r requirements.txt
python app.py  # 運行在 ws://localhost:4000

# 3. 前端
# 使用 Live Server 或其他 HTTP 服務器
# 訪問 http://localhost:5500/index.html
```

---

## 📝 要點總結

- **三層架構**：前端(HTML/JS) → 後端(Python/Flask) → 資料庫(Supabase)
- **實時通信**：WebSocket 實現毫秒級對戰同步
- **完整流程**：登入 → 大廳 → 配對 → 對戰 → 結算 → 更新數據
- **模組化設計**：驗證、遊戲、題目生成各自獨立服務
- **可擴展性**：支援 AI 對手、自訂題庫、裝扮系統等功能擴展

