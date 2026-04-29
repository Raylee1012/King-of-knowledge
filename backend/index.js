require('dotenv').config() // 讀取 .env 檔案，讓程式可以用 process.env 取得環境變數
const express = require('express') // 用來建立伺服器和定義 API 路由的套件，去 node_modules 找 express 並載入
const { createClient } = require('@supabase/supabase-js') // 從套件取出 createClient 函式

const app = express() // 建立 express 伺服器實體，之後用 app.get()、app.post() 定義路由
app.use(express.json()) // 讓伺服器看得懂前端傳來的 JSON 格式資料，沒有這行 req.body 會是 undefined

// 建立 Supabase 連線，之後用 supabase.from() 或 supabase.auth 操作資料庫
const supabase = createClient(
  process.env.SUPABASE_URL, // 資料庫位置，從 .env 讀取
  process.env.SUPABASE_KEY  // API 金鑰，secret key 有最高權限可繞過 RLS
)

// 載入帳號路由，所有 /auth 開頭的請求都交給 auth.js 處理
const authRouter = require('./auth')
app.use('/auth', authRouter)

// TODO: 刪除 - 測試用首頁，正式上線後刪除
app.get('/', (req, res) => {
  res.send('知識王後端運作中')
})

// TODO: 替換 - 等第三組前端做好後，這個頁面由前端負責
// 玩家驗證成功後會跳轉到這裡，5 秒後自動跳轉到登入頁面
app.get('/verified', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>知識王 - 帳號開通</title>
      </head>
      <body>
        <h2>✅ 帳號開通成功！</h2>
        <p id="countdown">5 秒後自動跳轉到登入頁面...</p>
        <a href="/">立即前往登入頁面</a>
        <script>
          let seconds = 5
          const el = document.getElementById('countdown') // 取得倒數顯示的元素
          const timer = setInterval(() => { // 每 1000 毫秒（1秒）執行一次
            seconds--
            el.textContent = seconds + ' 秒後自動跳轉到登入頁面...'
            if (seconds <= 0) { // 倒數結束
              clearInterval(timer) // 停止計時器
              window.location.href = '/' // 跳轉到登入頁面
            }
          }, 1000)
        </script>
      </body>
    </html>
  `)
})

// 如果 .env 有設定 PORT 就用那個，沒有的話預設用 3000
const PORT = process.env.PORT || 3000
app.listen(PORT, () => { // 讓伺服器開始監聽，有請求進來就處理
  console.log(`伺服器啟動在 port ${PORT}`)
})