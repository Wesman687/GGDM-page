from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    k: Optional[int] = None
    rules_version: Optional[str] = "rules-v1.0"

class AskResponse(BaseModel):
    id: str
    answer: str
    code: Optional[str] = None
    lint_issues: List[str] = []
    citations: List[Dict[str, str]] = []
    rules_version: str
    model_version: str
    context_used: Optional[List[Dict[str, Any]]] = None

class FeedbackRequest(BaseModel):
    id: str
    decision: str  # 'approved', 'declined', 'edited'
    rating: Optional[int] = None
    reasons: Optional[List[str]] = None
    edits_diff: Optional[str] = None

class FeedbackResponse(BaseModel):
    ok: bool
    message: Optional[str] = None

class ChunkData(BaseModel):
    id: str
    source: str  # 'script', 'docs', 'rules'
    title: str
    url: str
    text: str
    meta: Dict[str, Any] = {}
    score: Optional[float] = None

class InteractionLog(BaseModel):
    id: str
    created_at: datetime
    question: str
    assistant_draft: Dict[str, Any]
    retrieved: List[ChunkData]
    citations: List[Dict[str, str]]
    decision: str = "pending"
    rating: Optional[int] = None
    reasons: Optional[List[str]] = None
    edits_diff: Optional[str] = None
    rules_version: str
    model_version: str
