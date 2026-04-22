require('dotenv').config()
const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())

// 建立 Supabase 連線
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// 載入帳號路由
const authRouter = require('./auth')
app.use('/auth', authRouter)

// TODO: 刪除 - 測試用首頁，正式上線後刪除
app.get('/', (req, res) => {
  res.send('知識王後端運作中')
})

// TODO: 替換 - 等第三組前端做好後，這個頁面由前端負責
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
          const el = document.getElementById('countdown')
          const timer = setInterval(() => {
            seconds--
            el.textContent = seconds + ' 秒後自動跳轉到登入頁面...'
            if (seconds <= 0) {
              clearInterval(timer)
              window.location.href = '/'
            }
          }, 1000)
        </script>
      </body>
    </html>
  `)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`伺服器啟動在 port ${PORT}`)
})