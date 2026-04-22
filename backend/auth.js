const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

const verificationCodes = {}

// 註冊
router.post('/register', async (req, res) => {
  const { custom_id, email, password } = req.body

  if (!custom_id || !email || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email 格式不正確' })
  }

  const idRegex = /^[a-zA-Z0-9]{4,20}$/
  if (!idRegex.test(custom_id)) {
    return res.status(400).json({ error: 'ID 只能使用英文和數字，長度 4-20 字' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密碼至少需要 6 位數' })
  }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message })

  const { error: dbError } = await supabase.from('users').insert({
    id: data.user.id,
    custom_id,
    email,
    is_verified: false
  })
  if (dbError) return res.status(400).json({ error: dbError.message })

  const code = Math.floor(100000 + Math.random() * 900000)
  verificationCodes[email] = code
  console.log(`驗證碼 for ${email}: ${code}`)

  res.json({ message: '註冊成功，請查收驗證碼' })
})

// 驗證碼確認
router.post('/verify', async (req, res) => {
  const { email, code } = req.body

  if (!email || !code) {
    return res.status(400).json({ error: '請填寫所有欄位' })
  }

  if (verificationCodes[email] != code) {
    return res.status(400).json({ error: '驗證碼錯誤' })
  }

  const { error } = await supabase
    .from('users')
    .update({ is_verified: true })
    .eq('email', email)

  if (error) return res.status(400).json({ error: error.message })

  // 自動確認 Supabase Auth 的 email
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
  res.json({ message: '驗證成功，帳號已開通' })
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