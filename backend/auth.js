const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')
const crypto = require('crypto')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

const verificationCodes = {}

// 建立寄信器
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

// 註冊
router.post('/register', async (req, res) => {
  const { custom_id, email, password } = req.body

  if (!custom_id || !email || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email格式不正確' })
  }

  const idRegex = /^[a-zA-Z0-9]{4,20}$/
  if (!idRegex.test(custom_id)) {
    return res.status(400).json({ error: 'ID只能使用英文和數字，長度4-20字' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密碼至少需要6位數' })
  }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message })

  // 產生驗證 token（帶過期時間）
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
  if (dbError) return res.status(400).json({ error: dbError.message })

  const code = Math.floor(100000 + Math.random() * 900000)
  verificationCodes[email] = {
    code,
    expireAt: Date.now() + 5 * 60 * 1000
  }

  const verifyLink = `${process.env.BACKEND_URL}/auth/verify-link?token=${token}`

  // TODO: 替換 - 等第三組設計好 Email 模板後，替換這裡的 html 內容
  await transporter.sendMail({
    from: `知識王 <${process.env.MAIL_USER}>`,
    to: email,
    subject: '知識王 - 帳號驗證',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:30px;border-radius:10px;">
        
        <!-- 標題 -->
        <div style="background:#4CAF50;padding:20px;border-radius:8px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;">👑 知識王</h1>
          <p style="color:white;margin:5px 0 0;">歡迎加入！請完成帳號驗證</p>
        </div>

        <!-- 內容 -->
        <div style="background:white;padding:30px;border-radius:8px;margin-top:20px;">
          
          <!-- 方式一：驗證連結 -->
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

          <!-- 方式二：驗證碼 -->
          <h2 style="color:#333;">方式二：輸入驗證碼</h2>
          <p style="color:#666;">在遊戲的驗證頁面輸入以下驗證碼：</p>
          <div style="background:#f0f0f0;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
            <span style="font-size:36px;font-weight:bold;color:#4CAF50;letter-spacing:10px;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;">驗證碼有效期間為 5 分鐘，請盡快輸入</p>

        </div>

        <!-- 底部 -->
        <div style="text-align:center;margin-top:20px;">
          <p style="color:#999;font-size:12px;">
            此信件為系統自動發送，請勿直接回覆。<br/>
            如果你沒有申請知識王帳號，請忽略此信件。
          </p>
        </div>

      </div>
    `
  })

  res.json({ message: '註冊成功，請查收驗證信' })
})

// 驗證碼確認
router.post('/verify', async (req, res) => {
  const { email, code } = req.body

  if (!email || !code) {
    return res.status(400).json({ error: '請填寫所有欄位' })
  }

  const record = verificationCodes[email]

  if (!record) {
    return res.status(400).json({ error: '驗證碼不存在' })
  }

  if (Date.now() > record.expireAt) {
    delete verificationCodes[email]
    return res.status(400).json({ error: '驗證碼已過期，請重新註冊' })
  }

  if (record.code != code) {
    return res.status(400).json({ error: '驗證碼錯誤' })
  }

  const { error } = await supabase
    .from('users')
    .update({ is_verified: true, verify_token: null })
    .eq('email', email)

  if (error) return res.status(400).json({ error: error.message })

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
  res.json({ message: '驗證成功，帳號已開通', redirect: `${process.env.FRONTEND_URL}/verified` })
})

// 驗證連結
router.get('/verify-link', async (req, res) => {
  const { token } = req.query

  if (!token) {
    return res.status(400).json({ error: '無效的驗證連結' })
  }

  // 拆開 token 和過期時間
  const [rawToken, expireAt] = token.split('.')

  // 檢查是否過期
  if (Date.now() > parseInt(expireAt)) {
    return res.status(400).json({ error: '驗證連結已過期，請重新註冊' })
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('id, email, is_verified')
    .eq('verify_token', token)
    .single()

  if (error || !userData) {
    return res.status(400).json({ error: '驗證連結無效' })
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

// 登入
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' })
  }

  let email = identifier

  if (!identifier.includes('@')) {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('custom_id', identifier)
      .single()

    if (error || !data) return res.status(400).json({ error: '找不到使用者' })
    email = data.email
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(400).json({ error: error.message })

  res.json({ message: '登入成功', user: data.user })
})

module.exports = router