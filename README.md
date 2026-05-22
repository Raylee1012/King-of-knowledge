# 第一組 README

## 負責項目

- 帳號系統（註冊、登入、驗證、密碼管理）
- 玩家資料管理（頭像、暱稱）
- 題庫灌錄工具

---

## 帳號系統

### 如何啟動

```bash
# 建立虛擬環境（第一次）
python -m venv .venv
.venv\Scripts\pip install -r backend/requirements.txt

# 啟動伺服器
.venv\Scripts\python.exe backend/index.py
```

或在 VS Code 按 `F5`。

後端網址：`http://localhost:3000`

### 環境變數

在 `backend/.env` 設定：

```
SUPABASE_URL=https://ixxwtzkdbygjxabxhtpq.supabase.co
SUPABASE_KEY=你的secret_key
PORT=3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
GMAIL_USER=king.of.knowledge.game@gmail.com
GMAIL_PASS=你的應用程式密碼
```

---

## API 使用說明

### 註冊

```javascript
const res = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    custom_id: 'Ray1012',   // 英數 4-20 字
    email: 'xxx@gmail.com',
    password: '123456'      // 至少 6 位
  })
})
const data = await res.json()
// { "message": "註冊成功，請查收驗證信" }
```

### 驗證碼確認

```javascript
const res = await fetch('http://localhost:3000/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'xxx@gmail.com',
    code: '123456'   // 信裡的 6 位數驗證碼，5 分鐘內有效
  })
})
// 驗證碼過期會自動刪除帳號，玩家需要重新註冊
```

### 登入

```javascript
const res = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'Ray1012',  // 可以是 custom_id 或 email
    password: '123456'
  })
})
const data = await res.json()
// data.user.id 是玩家的 uuid，之後其他 API 都需要這個
```

### 登出

登出不需要呼叫後端 API，前端直接呼叫 Supabase SDK：

```javascript
const { error } = await supabase.auth.signOut()
```

### 忘記密碼

```javascript
const res = await fetch('http://localhost:3000/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'xxx@gmail.com' })
})
// 玩家會收到重設密碼信，連結 5 分鐘內有效
```

### 重設密碼（用信裡的連結）

```javascript
// 前端從 URL 取得 token：/reset-password?token=xxx
const token = new URLSearchParams(window.location.search).get('token')

const res = await fetch('http://localhost:3000/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: token,
    new_password: 'newpass123'
  })
})
```

### 修改密碼（登入後）

```javascript
const res = await fetch('http://localhost:3000/auth/change-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: '玩家的 uuid',
    old_password: '123456',
    new_password: 'newpass123'
  })
})
```

### 取得玩家資料

```javascript
const res = await fetch(`http://localhost:3000/user/profile/${userId}`)
const data = await res.json()
// {
//   id, custom_id, email, is_verified,
//   coins,           // 金幣數量
//   avatar_url,      // 頭像網址，null 代表預設頭像
//   nickname,        // 遊戲暱稱
//   nickname_remaining_free,  // 本月剩餘免費改名次數
//   created_at
// }
```

頭像顯示方式：

```javascript
const avatarSrc = data.avatar_url || '/images/default-avatar.png'
```

### 修改頭像

```javascript
// 上傳圖片檔案
const formData = new FormData()
formData.append('user_id', userId)
formData.append('avatar', fileInput.files[0])  // 最大 2MB

const res = await fetch('http://localhost:3000/user/avatar', {
  method: 'POST',
  body: formData
})
const data = await res.json()
// data.avatar_url 是新的頭像網址

// 或直接填網址
const formData = new FormData()
formData.append('user_id', userId)
formData.append('avatar_url', 'https://example.com/avatar.png')
```

### 修改暱稱

每自然月免費 3 次，超過每次花 500 金幣。

```javascript
const res = await fetch('http://localhost:3000/user/nickname', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    new_nickname: '新暱稱'  // 2-20 字
  })
})
const data = await res.json()
// {
//   message: '暱稱更新成功',
//   cost_coins: 0,        // 花了多少金幣
//   remaining_free: 2,    // 剩餘免費次數
//   remaining_coins: 500  // 剩餘金幣
// }
```

### 刪除帳號

```javascript
const res = await fetch('http://localhost:3000/user/delete', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    password: '123456'  // 需要輸入密碼確認
  })
})
```

---

## 題庫灌錄工具

### 如何啟動

```bash
cd generate
pip install -r requirements.txt
python app.py
```

打開 `http://localhost:5000` 使用。

### 環境變數

在 `generate/.env` 設定：

```
GEMINI_API_KEY=你的Gemini金鑰
SUPABASE_URL=https://ixxwtzkdbygjxabxhtpq.supabase.co
SUPABASE_KEY=你的secret_key
```

### 使用方式

1. 選擇要生成的分類
2. 輸入要生成的題目數量
3. 點擊生成，AI 自動生成題目並存入 Supabase

Gemini 模型額度說明（額度不足時可在 `api.js` 換用其他模型）：

| 模型 | 每日大約可生成題數 |
|------|----------------|
| gemini-2.5-flash-lite（預設） | 約 300 題 |
| gemini-2.5-flash | 約 100 題 |
| gemini-2.5-pro | 約 10 題 |

---

## 資料庫結構

### users 資料表

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 玩家唯一 ID |
| custom_id | text | 玩家自訂 ID，只能英數 4-20 字 |
| email | text | 玩家 email |
| is_verified | bool | 是否已驗證 |
| coins | integer | 金幣數量，初始 500 |
| verify_token | text | 驗證用 token |
| reset_token | text | 重設密碼用 token |
| avatar_url | text | 頭像網址，null 代表預設頭像 |
| nickname | text | 遊戲暱稱 |
| nickname_change_count | integer | 本月已修改暱稱次數 |
| nickname_last_reset | timestamptz | 上次重置暱稱次數的時間 |
| created_at | timestamptz | 帳號建立時間 |

### questions 資料表

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | integer | 題目唯一 ID |
| category | text | 題目分類 |
| question | text | 題目內容 |
| answer_a | text | A 選項 |
| answer_b | text | B 選項 |
| answer_c | text | C 選項 |
| answer_d | text | D 選項 |
| correct_answer | text | 正確答案（A/B/C/D） |

---

## 給其他組的注意事項

### 讀取題目

前端直接用 Supabase SDK 讀取，不需要透過後端：

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 隨機抽 10 題
const { data: questions } = await supabase
  .from('questions')
  .select('*')
  .limit(10)

// 依分類抽題
const { data: questions } = await supabase
  .from('questions')
  .select('*')
  .eq('category', '程式')
  .limit(10)
```

### 新增自己的資料表

設計資料表時記得加 `user_id` 欄位，對應到 `users` 資料表的 `id`：

```sql
user_id uuid REFERENCES users(id)
```

### RLS 設定

- `users`：前端只能讀自己的資料，後端 secret key 可以讀所有資料
- `questions`：所有人都可以讀題目，新增修改刪除只有後端可以做