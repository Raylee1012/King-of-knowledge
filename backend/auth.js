const express = require('express') // 用來建立伺服器和定義 API 路由的套件，去 node_modules 找 express 並載入
const router = express.Router() // 子路由器，所有路徑前面會自動加上 /auth，例如 /auth/register
const { createClient } = require('@supabase/supabase-js') // 從套件取出 createClient 函式
const nodemailer = require('nodemailer') // 寄 Email 的套件
const crypto = require('crypto') // Node.js 內建加密套件，不需要安裝，用來產生隨機 token

// 建立 Supabase 連線，之後用 supabase.from() 或 supabase.auth 操作資料庫
const supabase = createClient(
  process.env.SUPABASE_URL, // 資料庫位置，從 .env 讀取
  process.env.SUPABASE_KEY  // API 金鑰，secret key 有最高權限可繞過 RLS
)

// 暫存驗證碼的物件，伺服器重啟後會消失
// 格式：{ 'email': { code: 123456, expireAt: 1234567890 } }
const verificationCodes = {}

// 建立 Gmail 寄信器，之後用 transporter.sendMail() 寄信
const transporter = nodemailer.createTransport({
  service: 'gmail', // 使用 Gmail 服務
  auth: {
    user: process.env.MAIL_USER, // 寄件人 Gmail，從 .env 讀取
    pass: process.env.MAIL_PASS  // Gmail 應用程式密碼，從 .env 讀取
  }
})

// 註冊 API
// 路徑：POST /auth/register
// 傳入：{ custom_id, email, password }
router.post('/register', async (req, res) => {
  const { custom_id, email, password } = req.body // 解構取出前端傳來的三個欄位

  // 防呆一：三個欄位都必填，任何一個空就回傳錯誤
  if (!custom_id || !email || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' }) // 400 客戶端錯誤：欄位未填寫
  }

  // 防呆二：用正規表達式驗證 Email 格式，必須是 xxx@xxx.xxx 格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) { // .test() 測試字串是否符合格式
    return res.status(400).json({ error: 'Email格式不正確' }) // 400 客戶端錯誤：Email 格式錯誤
  }

  // 防呆三：ID 只能英文和數字，長度 4-20 字
  const idRegex = /^[a-zA-Z0-9]{4,20}$/
  if (!idRegex.test(custom_id)) {
    return res.status(400).json({ error: 'ID只能使用英文和數字，長度4-20字' }) // 400 客戶端錯誤：ID 格式錯誤
  }

  // 防呆四：密碼至少 6 位數
  if (password.length < 6) {
    return res.status(400).json({ error: '密碼至少需要6位數' }) // 400 客戶端錯誤：密碼太短
  }

  // 用 Supabase Auth 建立帳號，密碼會自動加密（hash）後存入
  // 回傳 { data, error }，成功時 data.user.id 是新使用者的 id
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：例如 Email 已存在

  // 產生驗證 token
  // Date.now() 是現在的時間戳記（毫秒），加上 5分鐘 = 5 * 60 * 1000 毫秒
  const expireAt = Date.now() + 5 * 60 * 1000
  // crypto.randomBytes(32) 產生 32 bytes 的隨機亂碼，.toString('hex') 轉成 64 字元字串
  const rawToken = crypto.randomBytes(32).toString('hex')
  // 組合成 token，用 . 分隔，例如：a3f8c2d1....1776856823200
  const token = `${rawToken}.${expireAt}`

  // 把玩家資料存進 users 資料表
  const { error: dbError } = await supabase.from('users').insert({
    id: data.user.id,   // 用 Supabase Auth 產生的同一個 id，讓兩邊資料可以對應
    custom_id,          // 簡寫，等於 custom_id: custom_id
    email,
    is_verified: false, // 預設尚未驗證
    verify_token: token // 存入驗證 token，玩家點連結時用來查詢
  })
  // error 改名為 dbError，因為上面已經用過 error 這個變數名稱
  if (dbError) return res.status(400).json({ error: dbError.message }) // 400 客戶端錯誤：例如 ID 已存在

  // 產生 6 位數驗證碼
  // Math.random() 產生 0~0.999 的小數 → *900000 → +100000 → Math.floor() 去小數
  const code = Math.floor(100000 + Math.random() * 900000)
  // 把驗證碼和過期時間存入暫存物件，用 email 當 key
  verificationCodes[email] = {
    code,
    expireAt: Date.now() + 5 * 60 * 1000
  }

  // 組合驗證連結，token 帶在 URL 參數裡
  const verifyLink = `${process.env.BACKEND_URL}/auth/verify-link?token=${token}`

  // TODO: 替換 - 等第三組設計好 Email 模板後，替換這裡的 html 內容
  await transporter.sendMail({
    from: `知識王 <${process.env.MAIL_USER}>`, // 寄件人顯示名稱和地址
    to: email,                                  // 收件人
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

  const record = verificationCodes[email] // 取出該 email 的驗證碼記錄

  if (!record) { // 找不到記錄，代表沒有發送過驗證碼或已被刪除
    return res.status(400).json({ error: '驗證碼不存在' }) // 400 客戶端錯誤：找不到驗證碼
  }

  if (Date.now() > record.expireAt) { // 現在時間 > 過期時間，代表已過期
    delete verificationCodes[email] // 刪除過期記錄，釋放記憶體
    return res.status(400).json({ error: '驗證碼已過期，請重新註冊' }) // 400 客戶端錯誤：驗證碼過期
  }

  // 用 != 而不是 !==，因為前端傳來的 code 是字串，暫存的是數字，自動轉型比對
  if (record.code != code) {
    return res.status(400).json({ error: '驗證碼錯誤' }) // 400 客戶端錯誤：驗證碼不正確
  }

  // 驗證成功，開通帳號並清空 verify_token
  const { error } = await supabase
    .from('users')
    .update({ is_verified: true, verify_token: null })
    .eq('email', email) // 條件：只更新這個 email 的那一筆資料

  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：資料庫更新失敗

  // 查詢玩家的 id，用來確認 Supabase Auth 的 email
  const { data: userData } = await supabase
    .from('users')
    .select('id') // 只需要 id 欄位
    .eq('email', email)
    .single() // 只取一筆

  // 確認 Supabase Auth 的 email，這樣玩家才能用 signInWithPassword 登入
  // 需要 secret key 才能使用 auth.admin
  await supabase.auth.admin.updateUserById(
    userData.id,
    { email_confirm: true }
  )

  delete verificationCodes[email] // 驗證完刪除暫存碼，避免重複使用

  // 回傳跳轉網址，前端收到後執行 window.location.href = data.redirect
  res.json({ message: '驗證成功，帳號已開通', redirect: `${process.env.FRONTEND_URL}/verified` }) // 200 成功
})

// 驗證連結 API
// 路徑：GET /auth/verify-link?token=xxx
// 玩家點 Email 裡的連結時呼叫，瀏覽器自動帶 token 來
router.get('/verify-link', async (req, res) => {
  const { token } = req.query // req.query 是 URL 參數，例如 ?token=xxx 的 token

  if (!token) {
    return res.status(400).json({ error: '無效的驗證連結' }) // 400 客戶端錯誤：沒有帶 token
  }

  // 拆開 token，用 . 分隔成兩個部分
  // 例如：['a3f8c2d1...', '1776856823200']
  const [rawToken, expireAt] = token.split('.')

  // parseInt() 把字串轉成數字再比對
  if (Date.now() > parseInt(expireAt)) {
    return res.status(400).json({ error: '驗證連結已過期，請重新註冊' }) // 400 客戶端錯誤：連結過期
  }

  // 用 token 查詢資料庫，找到對應的玩家
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, email, is_verified')
    .eq('verify_token', token) // 找 verify_token 等於這個 token 的玩家
    .single()

  if (error || !userData) { // 找不到代表 token 無效或已被清空
    return res.status(400).json({ error: '驗證連結無效' }) // 400 客戶端錯誤：token 無效
  }

  if (userData.is_verified) { // 已驗證過，不需要再驗證，直接跳轉登入
    return res.redirect(`${process.env.FRONTEND_URL}/login`) // 跳轉到登入頁面
  }

  // 開通帳號並清空 verify_token
  await supabase
    .from('users')
    .update({ is_verified: true, verify_token: null })
    .eq('id', userData.id)

  // 確認 Supabase Auth 的 email
  await supabase.auth.admin.updateUserById(
    userData.id,
    { email_confirm: true }
  )

  // res.redirect() 讓瀏覽器自動跳轉到指定網址（第三組設計的驗證成功頁面）
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

  let email = identifier // 用 let 因為之後可能需要更新這個值

  // email 一定包含 @，custom_id 不包含 @
  // 如果不包含 @，代表是 custom_id，需要先查詢對應的 email
  if (!identifier.includes('@')) {
    const { data, error } = await supabase
      .from('users')
      .select('email') // 只需要 email 欄位
      .eq('custom_id', identifier)
      .single()

    if (error || !data) return res.status(400).json({ error: '找不到使用者' }) // 400 客戶端錯誤：找不到玩家
    email = data.email // 把 email 更新為查詢到的值
  }

  // 用 email 和密碼登入 Supabase Auth
  const { data, error } = await supabase.signInWithPassword({ email, password })
  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：例如密碼錯誤

  res.json({ message: '登入成功', user: data.user }) // 200 成功，回傳玩家資料
})

// 匯出 router，讓 index.js 可以用 require('./auth') 載入
module.exports = router