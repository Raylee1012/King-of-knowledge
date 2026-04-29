from pydantic import BaseModel, Field, validator
from typing import List

VALID_ANSWERS = {"A", "B", "C", "D"}
VALID_CATEGORIES = [
    '體育', '美術', '國文', '英文', '數學', '歷史', '地理', '公民',
    '自然', '物理', '化學', '生物', '地科', '程式', '健教', '家政',
    '軍教', '人文', '常識', '新聞', '其他'
]


class Question(BaseModel):
    category: str
    question: str
    answer_a: str
    answer_b: str
    answer_c: str
    answer_d: str
    correct_answer: str

    @validator("correct_answer")
    def validate_answer(cls, v):
        if v.upper() not in VALID_ANSWERS:
            raise ValueError(f"correct_answer must be A/B/C/D, got: {v}")
        return v.upper()

    @validator("category")
    def validate_category(cls, v):
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {v}")
        return v

    @validator("question", "answer_a", "answer_b", "answer_c", "answer_d")
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class GenerateRequest(BaseModel):
    # 修正：Pydantic v1 用 min_items，v2 用 min_length
    categories: List[str] = Field(..., min_items=1)
    count: int = Field(..., ge=1, le=50)
