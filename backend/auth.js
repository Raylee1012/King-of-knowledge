const express = require('express') // 用來建立伺服器和定義 API 路由的套件，去 node_modules 找 express 並載入
const router = express.Router() // 子路由器，所有路徑前面會自動加上 /auth，例如 /auth/register
const { createClient } = require('@supabase/supabase-js') // 從套件取出 createClient 函式
const { Resend } = require('resend') // 寄信套件，用 HTTP API 不會被雲端平台封鎖
const crypto = require('crypto') // Node.js 內建加密套件，不需要安裝，用來產生隨機 token

// 建立 Supabase 連線，之後用 supabase.from() 或 supabase.auth 操作資料庫
const supabase = createClient(
  process.env.SUPABASE_URL, // 資料庫位置，從 .env 讀取
  process.env.SUPABASE_KEY  // API 金鑰，secret key 有最高權限可繞過 RLS
)

// 建立 Resend 連線，用 HTTP API 寄信，不會被雲端平台的 SMTP 封鎖影響
const resend = new Resend(process.env.RESEND_API_KEY)

// 暫存驗證碼的物件，伺服器重啟後會消失
// 格式：{ 'email': { code: 123456, expireAt: 1234567890 } }
const verificationCodes = {}

// 註冊 API
// 路徑：POST /auth/register
// 傳入：{ custom_id, email, password }
router.post('/register', async (req, res) => {
  const { custom_id, email, password } = req.body

  if (!custom_id || !email || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' }) // 400 客戶端錯誤：欄位未填寫
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email格式不正確' }) // 400 客戶端錯誤：Email 格式錯誤
  }

  const idRegex = /^[a-zA-Z0-9]{4,20}$/
  if (!idRegex.test(custom_id)) {
    return res.status(400).json({ error: 'ID只能使用英文和數字，長度4-20字' }) // 400 客戶端錯誤：ID 格式錯誤
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密碼至少需要6位數' }) // 400 客戶端錯誤：密碼太短
  }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：例如 Email 已存在

  const expireAt = Date.now() + 5 * 60 * 1000
  const rawToken = crypto.randomBytes(32).toString('hex')
  const token = `${rawToken}.${expireAt}`

  const { error: dbError } = await supabase.from('users').insert({
    id: data.user.id,
    custom_id,
    email,
    is_verified: false,
    verify_token: token
  })
  if (dbError) return res.status(400).json({ error: dbError.message }) // 400 客戶端錯誤：例如 ID 已存在

  const code = Math.floor(100000 + Math.random() * 900000)
  verificationCodes[email] = {
    code,
    expireAt: Date.now() + 5 * 60 * 1000
  }

  const verifyLink = `${process.env.BACKEND_URL}/auth/verify-link?token=${token}`

  // TODO: 替換 - 等第三組設計好 Email 模板後，替換這裡的 html 內容
  await resend.emails.send({
    from: '知識王 <onboarding@resend.dev>', // 寄件人，免費版只能用 resend.dev 網域
    to: email,                               // 收件人
    subject: '知識王 - 帳號驗證',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:30px;border-radius:10px;">
        <div style="background:#4CAF50;padding:20px;border-radius:8px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;">👑 知識王</h1>
          <p style="color:white;margin:5px 0 0;">歡迎加入！請完成帳號驗證</p>
        </div>
        <div style="background:white;padding:30px;border-radius:8px;margin-top:20px;">
          <h2 style="color:#333;">方式一：點擊驗證連結</h2>
          <p style="color:#666;">點擊下方按鈕，一鍵開通你的帳號：</p>
          <div style="text-align:center;margin:20px 0;">
            <a href="${verifyLink}" 
               style="background:#4CAF50;color:white;padding:14px 40px;text-decoration:none;border-radius:25px;font-size:16px;font-weight:bold;">
              ✅ 點我開通帳號
            </a>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;">連結有效期間為 5 分鐘</p>
          <hr style="border:none;border-top:1px solid #eee;margin:30px 0;"/>
          <h2 style="color:#333;">方式二：輸入驗證碼</h2>
          <p style="color:#666;">在遊戲的驗證頁面輸入以下驗證碼：</p>
          <div style="background:#f0f0f0;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
            <span style="font-size:36px;font-weight:bold;color:#4CAF50;letter-spacing:10px;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;">驗證碼有效期間為 5 分鐘，請盡快輸入</p>
        </div>
        <div style="text-align:center;margin-top:20px;">
          <p style="color:#999;font-size:12px;">
            此信件為系統自動發送，請勿直接回覆。<br/>
            如果你沒有申請知識王帳號，請忽略此信件。
          </p>
        </div>
      </div>
    `
  })

  res.json({ message: '註冊成功，請查收驗證信' }) // 200 成功
})

// 驗證碼確認 API
// 路徑：POST /auth/verify
// 傳入：{ email, code }
router.post('/verify', async (req, res) => {
  const { email, code } = req.body

  if (!email || !code) {
    return res.status(400).json({ error: '請填寫所有欄位' }) // 400 客戶端錯誤：欄位未填寫
  }

  const record = verificationCodes[email]

  if (!record) {
    return res.status(400).json({ error: '驗證碼不存在' }) // 400 客戶端錯誤：找不到驗證碼
  }

  if (Date.now() > record.expireAt) {
    delete verificationCodes[email]
    return res.status(400).json({ error: '驗證碼已過期，請重新註冊' }) // 400 客戶端錯誤：驗證碼過期
  }

  if (record.code != code) {
    return res.status(400).json({ error: '驗證碼錯誤' }) // 400 客戶端錯誤：驗證碼不正確
  }

  const { error } = await supabase
    .from('users')
    .update({ is_verified: true, verify_token: null })
    .eq('email', email)

  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：資料庫更新失敗

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  await supabase.auth.admin.updateUserById(
    userData.id,
    { email_confirm: true }
  )

  delete verificationCodes[email]

  res.json({ message: '驗證成功，帳號已開通', redirect: `${process.env.FRONTEND_URL}/verified` }) // 200 成功
})

// 驗證連結 API
// 路徑：GET /auth/verify-link?token=xxx
// 玩家點 Email 裡的連結時呼叫，瀏覽器自動帶 token 來
router.get('/verify-link', async (req, res) => {
  const { token } = req.query

  if (!token) {
    return res.status(400).json({ error: '無效的驗證連結' }) // 400 客戶端錯誤：沒有帶 token
  }

  const [rawToken, expireAt] = token.split('.')

  if (Date.now() > parseInt(expireAt)) {
    return res.status(400).json({ error: '驗證連結已過期，請重新註冊' }) // 400 客戶端錯誤：連結過期
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('id, email, is_verified')
    .eq('verify_token', token)
    .single()

  if (error || !userData) {
    return res.status(400).json({ error: '驗證連結無效' }) // 400 客戶端錯誤：token 無效
  }

  if (userData.is_verified) {
    return res.redirect(`${process.env.FRONTEND_URL}/login`)
  }

  await supabase
    .from('users')
    .update({ is_verified: true, verify_token: null })
    .eq('id', userData.id)

  await supabase.auth.admin.updateUserById(
    userData.id,
    { email_confirm: true }
  )

  res.redirect(`${process.env.FRONTEND_URL}/verified`)
})

// 登入 API
// 路徑：POST /auth/login
// 傳入：{ identifier, password }，identifier 可以是 email 或 custom_id
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' }) // 400 客戶端錯誤：欄位未填寫
  }

  let email = identifier

  if (!identifier.includes('@')) {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('custom_id', identifier)
      .single()

    if (error || !data) return res.status(400).json({ error: '找不到使用者' }) // 400 客戶端錯誤：找不到玩家
    email = data.email
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：例如密碼錯誤

  res.json({ message: '登入成功', user: data.user }) // 200 成功，回傳玩家資料
})

// 匯出 router，讓 index.js 可以用 require('./auth') 載入
module.exports = router