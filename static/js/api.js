const CATEGORIES = [
    '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
    '自然', '物理', '化學', '生物', '地科', '程式', '健教', '家政',
    '軍教', '人文', '常識', '新聞', '其他'
];

// 修正：自動偵測 API 位置，本地和部署都能用
const API_BASE = window.location.origin;


/**
 * 呼叫 backend 生成題目並存入資料庫
 */
async function generateQuestions(categories, count) {
    const response = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ categories, count })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || "Unknown error");
    }

    return data.questions;
}


/**
 * 對外 API
 */
window.API = {
    generateQuestions,
    CATEGORIES
};
