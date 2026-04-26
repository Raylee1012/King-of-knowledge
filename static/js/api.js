const CATEGORIES = [
    '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
    '自然', '物理', '化學', '生物', '地科', '程式', '健教', '家政',
    '軍教', '人文', '常識', '新聞', '其他'
];

const API_BASE = window.location.origin;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

let CONFIG = null;

// 啟動時先從後端拿 KEY
async function loadConfig() {
    const res = await fetch(`${API_BASE}/config`);
    CONFIG = await res.json();
}

async function generateQuestions(categories, count) {
    if (!CONFIG) await loadConfig();

    const catList = categories.join("、");
    const prompt = `你是知識問答出題專家，請生成 ${count} 題繁體中文單選題。
分類：${catList}
⚠️ 嚴格規則：只輸出 JSON 陣列，不要 markdown，不要解釋。
correct_answer 只能是 A、B、C、D其中之一。
格式：[{"category":"分類","question":"題目","answer_a":"A","answer_b":"B","answer_c":"C","answer_d":"D","correct_answer":"A"}]`;

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
    const clean = raw.replace(/```json|```/g, "").trim();
    const questions = JSON.parse(clean);

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