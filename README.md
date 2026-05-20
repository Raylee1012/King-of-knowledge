# 知識王 King of Knowledge

多人問答對戰遊戲，六週專題專案。

## 專案架構

| 組別 | 負責項目 |
|------|---------|
| 第一組 | 帳號系統、題庫灌錄 |
| 第二組 | 對戰核心、題庫 API、機器人練習模式 |
| 第三組 | 網頁視覺、商店系統、數據分析 |

## 技術架構

| 項目 | 技術 |
|------|------|
| 後端 | Node.js + Express |
| 資料庫 | Supabase（Tokyo） |
| 寄信 | Gmail 應用程式密碼 |
| 圖片儲存 | Supabase Storage |

## 後端網址

```
http://localhost:3000
```

## 環境變數

在 `backend/.env` 設定以下變數：

```
# Supabase 資料庫位置
SUPABASE_URL=https://ixxwtzkdbygjxabxhtpq.supabase.co

# Supabase secret key，有最高權限可以繞過 RLS
SUPABASE_KEY=你的secret_key

# 伺服器 port，本地用 3000
PORT=3000

# 前端網址，驗證完後跳轉用
FRONTEND_URL=http://localhost:3000

# 後端網址，驗證連結裡會用到這個網址
BACKEND_URL=http://localhost:3000

# Gmail 寄件人帳號
GMAIL_USER=king.of.knowledge.game@gmail.com

# Gmail 應用程式密碼
GMAIL_PASS=你的應用程式密碼
```

## 如何啟動

```bash
cd backend
node index.js
```

## API 文件

### 帳號系統（auth.js）

#### POST /auth/register
註冊新帳號，新玩家初始獲得 500 金幣。

**傳入：**
```json
{
  "custom_id": "xyz123",
  "email": "xxx@gmail.com",
  "password": "123456"
}
```

**回傳：**
```json
{ "message": "註冊成功，請查收驗證信" }
```

---

#### POST /auth/verify
驗證碼確認，輸入信裡的 6 位數驗證碼。

**傳入：**
```json
{
  "email": "xxx@gmail.com",
  "code": "123456"
}
```

**回傳：**
```json
{ "message": "驗證成功，帳號已開通", "redirect": "/verified" }
```

---

#### GET /auth/verify-link?token=xxx
玩家點 Email 裡的驗證連結時呼叫，自動跳轉到前端。

---

#### POST /auth/login
登入，identifier 可以是 email 或 custom_id。

**傳入：**
```json
{
  "identifier": "abc123",
  "password": "123456"
}
```

**回傳：**
```json
{ "message": "登入成功", "user": { "id": "...", "email": "..." } }
```

---

#### POST /auth/forgot-password
忘記密碼，寄重設密碼信。

**傳入：**
```json
{ "email": "xxx@gmail.com" }
```

**回傳：**
```json
{ "message": "重設密碼信已寄出，請查收信箱" }
```

---

#### POST /auth/reset-password
重設密碼，使用信裡的 token。

**傳入：**
```json
{
  "token": "信裡連結的 token",
  "new_password": "newpass123"
}
```

**回傳：**
```json
{ "message": "密碼重設成功，請重新登入" }
```

---

#### POST /auth/change-password
修改密碼，需要輸入舊密碼確認。

**傳入：**
```json
{
  "user_id": "玩家的 id",
  "old_password": "123456",
  "new_password": "newpass123"
}
```

**回傳：**
```json
{ "message": "密碼修改成功" }
```

---

### 玩家系統（user.js）

#### GET /user/profile/:user_id
取得玩家資料。

**回傳：**
```json
{
  "id": "玩家唯一 ID",
  "custom_id": "xyz123",
  "email": "xxx@gmail.com",
  "is_verified": true,
  "coins": 500,
  "avatar_url": null,
  "nickname": null,
  "nickname_remaining_free": 3,
  "created_at": "2026-05-18T16:02:50.980301+00:00"
}
```

---

#### POST /user/avatar
修改頭像，支援上傳圖片檔案或直接填網址。

**傳入（上傳圖片）：**
```
multipart/form-data
  user_id: 玩家的 id
  avatar: 圖片檔案（最大 2MB）
```

**傳入（填網址）：**
```
multipart/form-data
  user_id: 玩家的 id
  avatar_url: https://example.com/avatar.png
```

**回傳：**
```json
{ "message": "頭像更新成功", "avatar_url": "https://..." }
```

---

#### POST /user/nickname
修改遊戲暱稱，每月免費 3 次，超過每次花 500 金幣。

**傳入：**
```json
{
  "user_id": "玩家的 id",
  "new_nickname": "新暱稱"
}
```

**回傳：**
```json
{
  "message": "暱稱更新成功",
  "cost_coins": 0,
  "remaining_free": 2,
  "remaining_coins": 500
}
```

---

#### DELETE /user/delete
刪除帳號，需要輸入密碼確認。

**傳入：**
```json
{
  "user_id": "玩家的 id",
  "password": "123456"
}
```

**回傳：**
```json
{ "message": "帳號已刪除" }
```

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

---

## 給其他組的注意事項

### 登出
登出不需要呼叫後端 API，前端直接呼叫 Supabase SDK：
```javascript
const { error } = await supabase.auth.signOut()
```

### 頭像
`avatar_url` 是 `null` 時，顯示預設頭像：
```javascript
const avatarSrc = user.avatar_url || '/images/default-avatar.png'
```

### 存取 Supabase 資料
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ixxwtzkdbygjxabxhtpq.supabase.co',
  'anon key' // Supabase → Settings → API 找
)

// 查詢玩家資料
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single()
```

### 新增自己的資料表
設計資料表時記得加 `user_id` 欄位，對應到 `users` 資料表的 `id`：
```sql
user_id uuid REFERENCES users(id)
```