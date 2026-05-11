/**
 * db.js - Supabase 資料庫連線模組
 *
 * 使用 @supabase/supabase-js 透過 REST API 連線
 * 環境變數（.env 或 Railway 環境變數）：
 *   SUPABASE_URL      Supabase 專案 URL
 *   SUPABASE_ANON_KEY Supabase 匿名金鑰
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('缺少 Supabase 環境變數：SUPABASE_URL 或 SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  const pageSize = 1000;
  let allRows = [];
  let start = 0;
  let totalCount = null;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .range(start, end);

    if (error) {
      throw new Error(`載入題庫失敗: ${error.message}`);
    }

    if (totalCount === null) {
      totalCount = count;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows = allRows.concat(data);
    if (data.length < pageSize) {
      break;
    }

    start += pageSize;
  }

  if (!allRows || allRows.length === 0) {
    throw new Error('questions 資料表為空，請確認 Supabase 資料');
  }

  // 將 DB 格式轉換為遊戲內部格式
  const questions = allRows.map(row => ({
    q: row.question,
    opts: [row.answer_a, row.answer_b, row.answer_c, row.answer_d],
    // correct_answer 為 'A'~'D'，轉成 0~3
    ans: 'ABCD'.indexOf(String(row.correct_answer || '').toUpperCase()),
    category: row.category || '一般',
  }));

  // 過濾掉 correct_answer 無效的題目（ans === -1）
  const valid = questions.filter(q => q.ans !== -1);

  // 隨機化題目順序（因為 id 不連續）
  const shuffled = valid.sort(() => Math.random() - 0.5);

  console.log(`[DB] 載入題目: ${shuffled.length} 題（共 ${totalCount ?? allRows.length} 筆，過濾 ${allRows.length - valid.length} 筆無效）`);
  return shuffled;
}

module.exports = { loadQuestions, supabase };
