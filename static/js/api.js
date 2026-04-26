const CATEGORIES = [
    '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
    '物理', '化學', '生物', '地科', '程式', '健教', '家政',
    '軍教', '人文', '常識', '新聞', '其他'
];

const API_BASE = window.location.origin;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
//替換用的連結，要是額度不足可以換
//https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent
//10條左右
//https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
//100條左右
//https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent
//300條左右
//https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent
//10條左右

let CONFIG = null;

function cleanAndParseJSON(raw) {
    // 第一步：去掉 markdown
    let clean = raw.replace(/```json|```/g, '').trim();

    // 第二步：找出 JSON 陣列的範圍（從第一個 [ 到最後一個 ]）
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('找不到 JSON 陣列');
    clean = clean.slice(start, end + 1);

    // 第三步：嘗試直接解析
    try {
        return JSON.parse(clean);
    } catch (e) {
        // 第四步：修復常見問題
        clean = clean
            .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')  // 修復非法的反斜線
            .replace(/[\u0000-\u001F]/g, ' ')          // 移除控制字元
            .replace(/,\s*]/g, ']')                    // 移除尾部多餘逗號
            .replace(/,\s*}/g, '}');                   // 移除物件尾部多餘逗號

        try {
            return JSON.parse(clean);
        } catch (e2) {
            throw new Error('JSON 解析失敗，AI 輸出格式錯誤');
        }
    }
}

// 啟動時先從後端拿 KEY
async function loadConfig() {
    const res = await fetch(`${API_BASE}/config`);
    CONFIG = await res.json();
}

async function generateQuestions(categories, count) {
    if (!CONFIG) await loadConfig();

    const catList = categories.join("、");
    const prompt = `你是一位嚴謹的知識王問答出題專家，請生成 ${count} 題繁體中文單選題，生成的分類題目務必從以下選擇：${catList}。

【各分類出題方向】
- 國文：生僻字與成語、文法、語意辨識、古文今譯。高中三年級難度，加深加廣。
- 英文：文法與片語、日常會話時態、國中程度但避免過於簡單（不出純詞性變換題）。
- 數學：機率統計、解一元方程、數學性質、特殊數列規律(三角函數、複數、共軛...)。國中程度。
- 物理／化學／生物／地科：高中三年級難度，強調生活實例與各種特殊的性質與定理，避免純背誦。
- 歷史／地理／公民：高中三年級難度，著重台灣視角與全球接軌，時事結合。
- 程式：資料結構、作業系統、演算法複雜度、邏輯悖論、AI 常識、程式語言特性。
- 常識：各國風俗習慣與地方特色、生活用品安全使用、同一事物在不同語言的特殊稱呼。
- 人文：基本尊重、性別議題、關懷弱勢、倫理與法律結合，出有明確對錯的情境題。
- 新聞：2020到2026年間幾乎人人知曉的國際重大事件。
- 健教：男女身體認識、青春期、吸菸飲酒毒品危害、心理健康。
- 軍教：繩結運用、急救步驟、軍隊基本知識、持槍安全規範。
- 美術：藝術流派、著名畫作、色彩學、台灣與國際藝術家。
- 體育：運動規則、奧運知識、知名運動員成就、運動生理。
- 家政：烹飪技巧、家庭財務管理、食品安全。
- 其他：音樂知識、二次元文化、電影知識、遊戲知識、其他。

【嚴格規則】
1. 只輸出 JSON 陣列，絕對不要有 markdown、解釋或任何多餘文字
2. correct_answer 只能是 A、B、C、D 其中一個
3. 每題知識點必須完全不同，禁止語意相近或換句話說的重複題
4. 四個選項都要合理，錯誤選項不能太明顯，要有混淆性
5. 題目敘述清楚完整，不能有歧義
6. 禁止出現「以上皆是」或「以上皆非」選項
7. 盡量出純記憶背誦題
8. 分類要照 ${catList} 均勻分配，不能集中在同一個分類
9. 題目需要排除說明也可以成立的題目，題目在40字以內，每個答案最多15字，一次只問一件事。

【輸出格式】
[{"category":"分類","question":"題目","answer_a":"A選項內容","answer_b":"B選項內容","answer_c":"C選項內容","answer_d":"D選項內容","correct_answer":"正確答案"}]`;

    // 1. 前端呼叫 Gemini（瀏覽器可以連外網）
    const geminiRes = await fetch(`${GEMINI_URL}?key=${CONFIG.gemini_key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
        })
    });

    if (!geminiRes.ok) throw new Error("Gemini API 錯誤: " + await geminiRes.text());

    const geminiData = await geminiRes.json();
    const raw = geminiData.candidates[0].content.parts[0].text;
    const questions = cleanAndParseJSON(raw);

    // 2. 前端直接存入 Supabase
    const saveRes = await fetch(`${CONFIG.supabase_url}/rest/v1/questions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": CONFIG.supabase_key,
            "Authorization": `Bearer ${CONFIG.supabase_key}`,
            "Prefer": "return=minimal"
        },
        body: JSON.stringify(questions)
    });

    if (!saveRes.ok) throw new Error("Supabase 存入失敗: " + await saveRes.text());

    return questions;
}

window.API = {
    generateQuestions,
    CATEGORIES
};