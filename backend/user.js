const express = require('express') // 用來建立伺服器和定義 API 路由的套件
const router = express.Router() // 子路由器，所有路徑前面會自動加上 /user
const { createClient } = require('@supabase/supabase-js') // 從套件取出 createClient 函式
const multer = require('multer') // 處理圖片上傳的套件

// 建立 Supabase 連線
const supabase = createClient(
  process.env.SUPABASE_URL, // 資料庫位置，從 .env 讀取
  process.env.SUPABASE_KEY  // API 金鑰，secret key 有最高權限可繞過 RLS
)

// 設定 multer，把圖片存在記憶體裡（不存到硬碟），之後再上傳到 Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(), // 存在記憶體，file.buffer 就是圖片的二進位資料
  limits: {
    fileSize: 2 * 1024 * 1024 // 限制 2MB，避免上傳太大的圖片
  },
  fileFilter: (req, file, cb) => { // 過濾檔案類型，只允許圖片
    // 允許的 MIME 類型
    const allowedMimeTypes = [
      'image/jpeg',               // JPEG 圖片
      'image/jpg',                // JPEG 圖片（另一種寫法）
      'image/png',                // PNG 圖片
      'image/gif',                // GIF 圖片
      'image/webp',               // WebP 圖片
      'image/bmp',                // BMP 圖片
      'image/x-bmp',              // BMP 圖片（另一種寫法）
      'image/tiff',               // TIFF 圖片
      'image/svg+xml',            // SVG 向量圖
      'image/x-icon',             // ICO 圖示
      'image/vnd.microsoft.icon', // ICO 圖示（另一種寫法）
      'image/psd',                // Photoshop 檔案
      'image/x-photoshop',        // Photoshop 檔案（另一種寫法）
      'image/x-tga',              // TGA 圖片
      'image/x-xpm',              // XPM 圖片
      'image/x-pcx',              // PCX 圖片
      'application/octet-stream'  // curl 上傳時有時會用這個通用類型
    ]
    // 允許的副檔名，作為備用判斷
    const allowedExtensions = [
      '.jpg', '.jpeg', // JPEG
      '.png',          // PNG
      '.gif',          // GIF
      '.webp',         // WebP
      '.bmp',          // BMP
      '.tiff', '.tif', // TIFF
      '.svg',          // SVG
      '.ico',          // ICO
      '.psd',          // Photoshop
      '.tga',          // TGA
      '.xpm',          // XPM
      '.pcx',          // PCX
      '.ppm'           // PPM
    ]
    const fileExt = '.' + file.originalname.split('.').pop().toLowerCase() // 取得副檔名並轉小寫
    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/') || allowedExtensions.includes(fileExt)) {
      cb(null, true) // 允許上傳
    } else {
      cb(new Error('只允許上傳圖片檔案')) // 拒絕上傳
    }
  }
})

// 每月免費修改暱稱次數上限
const FREE_NICKNAME_CHANGE_LIMIT = 3 // 每月免費 3 次
const NICKNAME_CHANGE_COST = 500      // 超過免費次數每次花 500 金幣

// 取得玩家資料 API
// 路徑：GET /user/profile/:user_id
// 傳入：URL 參數 user_id
router.get('/profile/:user_id', async (req, res) => {
  const { user_id } = req.params // req.params 是 URL 參數，例如 /profile/xxx 的 xxx

  // 防呆：user_id 必填
  if (!user_id) {
    return res.status(400).json({ error: '請填寫 user_id' }) // 400 客戶端錯誤：欄位未填寫
  }

  // 查詢玩家資料
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, custom_id, email, is_verified, coins, avatar_url, nickname, nickname_change_count, nickname_last_reset, created_at') // 取得所有需要的欄位，不包含 token 等敏感資料
    .eq('id', user_id) // 條件：找這個 id 的玩家
    .single() // 只取一筆

  if (error || !userData) {
    return res.status(400).json({ error: '找不到使用者' }) // 400 客戶端錯誤：找不到玩家
  }

  // 計算本月剩餘免費修改暱稱次數
  const lastReset = new Date(userData.nickname_last_reset) // 上次重置時間
  const now = new Date() // 現在時間
  const isNewMonth = now.getFullYear() > lastReset.getFullYear() ||
    now.getMonth() > lastReset.getMonth() // 判斷是否過了一個自然月

  // 如果過了一個月，剩餘次數重置為 3，否則用目前的次數計算
  const remainingFree = isNewMonth
    ? FREE_NICKNAME_CHANGE_LIMIT // 新的一個月，重置為 3 次
    : Math.max(0, FREE_NICKNAME_CHANGE_LIMIT - userData.nickname_change_count) // 3 - 已用次數

  res.json({
    id: userData.id,                          // 玩家唯一 ID
    custom_id: userData.custom_id,            // 玩家自訂 ID
    email: userData.email,                    // 玩家 email
    is_verified: userData.is_verified,        // 是否已驗證
    coins: userData.coins,                    // 金幣數量
    avatar_url: userData.avatar_url,          // 頭像網址
    nickname: userData.nickname,              // 遊戲暱稱
    nickname_remaining_free: remainingFree,   // 本月剩餘免費修改暱稱次數
    created_at: userData.created_at           // 帳號建立時間
  }) // 200 成功，回傳玩家資料
})

// 修改頭像 API
// 路徑：POST /user/avatar
// 傳入：multipart/form-data，包含 user_id 和 avatar（圖片檔案）或 avatar_url（網址）
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  const { user_id, avatar_url: urlFromBody } = req.body // 解構取出前端傳來的 user_id 和網址
  const file = req.file // multer 處理後的圖片檔案，如果沒有上傳就是 undefined

  // 防呆：user_id 必填
  if (!user_id) {
    return res.status(400).json({ error: '請填寫 user_id' }) // 400 客戶端錯誤：欄位未填寫
  }

  // 防呆：圖片檔案和網址至少要有一個
  if (!file && !urlFromBody) {
    return res.status(400).json({ error: '請上傳圖片或填寫頭像網址' }) // 400 客戶端錯誤：沒有圖片也沒有網址
  }

  let avatar_url // 最終要存進資料庫的頭像網址

  if (file) { // 如果有上傳圖片檔案，上傳到 Supabase Storage
    const fileExt = file.originalname.split('.').pop() // 取得副檔名，例如 jpg、png、webp
    const fileName = `${user_id}_${Date.now()}.${fileExt}` // 格式：玩家ID_時間戳記.副檔名

    // 上傳圖片到 Supabase Storage 的 avatars bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars') // 使用 avatars bucket
      .upload(fileName, file.buffer, { // file.buffer 是圖片的二進位資料
        contentType: file.mimetype, // 設定檔案類型，例如 image/jpeg、image/webp
        upsert: true                // 如果檔案已存在就覆蓋
      })

    if (uploadError) return res.status(400).json({ error: uploadError.message }) // 400 客戶端錯誤：上傳失敗

    // 取得圖片的公開網址
    const { data: urlData } = supabase.storage
      .from('avatars') // 使用 avatars bucket
      .getPublicUrl(fileName) // 取得公開網址

    avatar_url = urlData.publicUrl // 把公開網址存起來
  } else {
    // 如果沒有上傳圖片，直接用前端傳來的網址
    if (!urlFromBody.startsWith('http://') && !urlFromBody.startsWith('https://')) {
      return res.status(400).json({ error: '頭像網址格式不正確' }) // 400 客戶端錯誤：網址格式錯誤
    }
    avatar_url = urlFromBody // 使用前端傳來的網址
  }

  // 更新資料庫裡的頭像網址
  const { error } = await supabase
    .from('users')
    .update({ avatar_url }) // 更新 avatar_url 欄位
    .eq('id', user_id) // 條件：只更新這個玩家的資料

  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：更新失敗

  res.json({ message: '頭像更新成功', avatar_url }) // 200 成功，回傳新的頭像網址
})

// 修改暱稱 API
// 路徑：POST /user/nickname
// 傳入：{ user_id, new_nickname }
router.post('/nickname', async (req, res) => {
  const { user_id, new_nickname } = req.body // 解構取出前端傳來的兩個欄位

  // debug：確認 user_id 和查詢結果
  // console.log('user_id:', user_id) // 印出 user_id
  // const { data: debugData, error: debugError } = await supabase.from('users').select('*').eq('id', user_id).single()
  // console.log('data:', JSON.stringify(debugData)) // 印出查詢結果
  // console.log('error:', JSON.stringify(debugError)) // 印出錯誤訊息

  // 防呆：兩個欄位都必填
  if (!user_id || !new_nickname) {
    return res.status(400).json({ error: '請填寫所有欄位' }) // 400 客戶端錯誤：欄位未填寫
  }

  // 防呆：暱稱長度 2-20 字
  if (new_nickname.length < 2 || new_nickname.length > 20) {
    return res.status(400).json({ error: '暱稱長度需在 2-20 字之間' }) // 400 客戶端錯誤：暱稱長度不符
  }

  // 查詢玩家資料，取得目前的金幣、修改次數、上次重置時間
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('coins, nickname_change_count, nickname_last_reset') // 只需要這三個欄位
    .eq('id', user_id) // 條件：找這個玩家
    .single() // 只取一筆

  if (userError || !userData) {
    return res.status(400).json({ error: '找不到使用者' }) // 400 客戶端錯誤：找不到玩家
  }

  // 判斷是否需要重置修改次數
  const lastReset = new Date(userData.nickname_last_reset) // 上次重置時間，轉成日期物件
  const now = new Date() // 現在時間

  // 判斷是否過了一個自然月：年份不同，或月份不同
  const isNewMonth = now.getFullYear() > lastReset.getFullYear() ||
    now.getMonth() > lastReset.getMonth() // 月份不同代表過了一個自然月

  let currentCount = userData.nickname_change_count // 目前的修改次數
  let resetTime = userData.nickname_last_reset      // 上次重置時間

  // 如果過了一個自然月，重置修改次數
  if (isNewMonth) {
    currentCount = 0             // 重置次數為 0
    resetTime = now.toISOString() // 更新重置時間為現在
  }

  // 判斷是否需要花金幣，超過免費次數就需要花金幣
  const needCoins = currentCount >= FREE_NICKNAME_CHANGE_LIMIT

  // 如果需要花金幣，檢查金幣是否足夠
  if (needCoins) {
    if (userData.coins < NICKNAME_CHANGE_COST) {
      return res.status(400).json({
        error: `金幣不足，修改暱稱需要 ${NICKNAME_CHANGE_COST} 金幣，目前只有 ${userData.coins} 金幣` // 400 客戶端錯誤：金幣不足
      })
    }
  }

  // 準備要更新的資料
  const updateData = {
    nickname: new_nickname,                  // 新暱稱
    nickname_change_count: currentCount + 1, // 修改次數加 1
    nickname_last_reset: resetTime           // 重置時間
  }

  // 如果需要花金幣，扣除金幣
  if (needCoins) {
    updateData.coins = userData.coins - NICKNAME_CHANGE_COST // 扣除 500 金幣
  }

  // 更新資料庫
  const { error } = await supabase
    .from('users')
    .update(updateData) // 更新多個欄位
    .eq('id', user_id) // 條件：只更新這個玩家的資料

  if (error) return res.status(400).json({ error: error.message }) // 400 客戶端錯誤：更新失敗

  // 回傳成功訊息，包含是否花了金幣、剩餘免費次數、剩餘金幣
  res.json({
    message: '暱稱更新成功',
    cost_coins: needCoins ? NICKNAME_CHANGE_COST : 0,                                   // 花了多少金幣
    remaining_free: Math.max(0, FREE_NICKNAME_CHANGE_LIMIT - (currentCount + 1)),       // 剩餘免費次數
    remaining_coins: needCoins ? userData.coins - NICKNAME_CHANGE_COST : userData.coins // 剩餘金幣
  }) // 200 成功
})

// 匯出 router，讓 index.js 可以用 require('./user') 載入
module.exports = router