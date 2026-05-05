/**
 * db.js - Supabase 資料庫連線模組
 *
 * 使用 node-postgres (pg) 透過 Supabase Transaction Pooler 連線
 * 環境變數（.env 或 Railway 環境變數）：
 *   SUPABASE_DB_URL  完整的 PostgreSQL 連線字串
 *
 * Supabase 連線字串格式（從 Dashboard → Connect → Transaction pooler 取得）：
 *   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 */

const { Pool } = require('pg');

// 建立連線池，搭配 SSL（Supabase 強制要求）
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // Supabase pooler 使用自簽憑證
  max: 5,           // 最多同時5條連線（Railway free tier 限制）
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] 連線池錯誤:', err.message);
});

/**
 * 從 questions 資料表載入所有題目，轉換為遊戲格式
 *
 * Supabase 欄位對應：
 *   id             → 忽略（題庫索引用）
 *   category       → 題目分類（目前保留，供未來篩選用）
 *   question       → 題目文字
 *   answer_a~d     → 四個選項
 *   correct_answer → 'A'~'D' → 轉換為 0~3 的數字索引
 *
 * @returns {Promise<Array>} [{ q, opts, ans, category }]
 */
async function loadQuestions() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, category, question, answer_a, answer_b, answer_c, answer_d, correct_answer
       FROM questions
       ORDER BY id`
    );

    if (result.rows.length === 0) {
      throw new Error('questions 資料表為空，請確認 Supabase 資料');
    }

    // 將 DB 格式轉換為遊戲內部格式
    const questions = result.rows.map(row => ({
      q: row.question,
      opts: [row.answer_a, row.answer_b, row.answer_c, row.answer_d],
      // correct_answer 為 'A'~'D'，轉成 0~3
      ans: 'ABCD'.indexOf(row.correct_answer.toUpperCase()),
      category: row.category || '一般',
    }));

    // 過濾掉 correct_answer 無效的題目（ans === -1）
    const valid = questions.filter(q => q.ans !== -1);
    console.log(`[DB] 載入題目: ${valid.length} 題（共 ${result.rows.length} 筆，過濾 ${result.rows.length - valid.length} 筆無效）`);
    return valid;

  } finally {
    client.release();
  }
}

module.exports = { loadQuestions };
