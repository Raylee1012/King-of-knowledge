require('dotenv').config()
const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
const authRouter = require('./auth')
app.use('/auth', authRouter)
app.get('/', (req, res) => {
  res.send('知識王後端運作中')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`伺服器啟動在 port ${PORT}`)
})