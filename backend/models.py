from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class DockmasterEntry(BaseModel):
    zone_id: str = Field(..., description="Unique zone ID, e.g., '1A-E' or 'XD-1'")
    x: int = Field(..., description="X-coordinate")
    y: int = Field(..., description="Y-coordinate") 
    map: int = Field(..., description="Map ID")
    enabled: bool = Field(default=True, description="Whether DM is active")
    is_reference_point: bool = Field(default=False, description="If true, this is a map-only reference point (e.g., 6142)")
    transition_zone: Optional[str] = Field(None, description="Identifier for transition zone if this is part of one")
    confidence: Optional[float] = Field(None, description="AI confidence score for this match")

class SuggestionCreate(BaseModel):
    action: Literal["add", "remove"] = Field(..., description="Action to perform")
    zone_id: str = Field(..., description="Zone ID for the suggestion")
    x: Optional[int] = Field(None, description="X-coordinate (required for add)")
    y: Optional[int] = Field(None, description="Y-coordinate (required for add)")
    map: Optional[int] = Field(7, description="Map ID (defaults to 7)")
    enabled: bool = Field(True, description="Whether DM is active (defaults to True)")
    reason: str = Field(..., description="Reason for the suggestion")
    submitter_name: Optional[str] = Field(None, description="Name of person making suggestion")
    submitter_discord: Optional[str] = Field(None, description="Discord ID of submitter")

class Suggestion(SuggestionCreate):
    id: str = Field(..., description="Unique suggestion ID")
    status: Literal["pending", "approved", "rejected"] = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = Field(None)
    reviewed_by: Optional[str] = Field(None)
    admin_notes: Optional[str] = Field(None)
    pr_url: Optional[str] = Field(None, description="GitHub Pull Request URL")
    pr_number: Optional[int] = Field(None, description="GitHub Pull Request number")
    pr_error: Optional[str] = Field(None, description="PR creation error message")
    pr_retry_count: Optional[int] = Field(0, description="Number of PR creation retry attempts")

class SuggestionUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    admin_notes: Optional[str] = Field(None)

class GitHubPRResponse(BaseModel):
    pr_url: str
    pr_number: int
    branch_name: str

class AdminCreate(BaseModel):
    discord_id: str = Field(..., description="Discord ID of the user to make admin")
    username: str = Field(..., description="Discord username for reference")

class Admin(BaseModel):
    discord_id: str
    username: str
    added_by: str
    added_at: datetime
    is_active: bool

# Scripts-related models
class ScriptCreate(BaseModel):
    title: str = Field(..., description="Script title")
    author: str = Field(..., description="Script author")
    language: Literal["razor", "python"] = Field(..., description="Script language")
    tags: List[str] = Field(default=[], description="Script tags")
    description: Optional[str] = Field(None, description="Script description")
    code: str = Field(..., description="Script code content")
    exe_download_url: Optional[str] = Field(None, description="Optional .exe download URL for Python scripts")

class ScriptUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    language: Optional[Literal["razor", "python"]] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    code: Optional[str] = None
    exe_download_url: Optional[str] = None

class Script(BaseModel):
    id: str
    title: str
    author: str
    category: str
    language: str
    tags: List[str]
    description: Optional[str]
    code_preview: Optional[str]
    full_code: Optional[str]
    full_code_url: Optional[str]
    exe_download_url: Optional[str]
    rating_average: float
    rating_count: int
    view_count: int
    download_count: int
    is_approved: bool
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    message: Optional[str] = Field(None, description="Status message for script operations")

class ScriptRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    review: Optional[str] = Field(None, description="Optional review text")

class ScriptRating(BaseModel):
    id: str
    script_id: str
    user_id: str
    rating: int
    review: Optional[str]
    weight: int = 1
    is_jasown_rating: bool = False
    created_at: datetime

class ScriptSearchFilters(BaseModel):
    category: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    rating_min: Optional[int] = Field(None, ge=1, le=5)
    search_query: Optional[str] = None
    is_approved: Optional[bool] = None

class ScriptTag(BaseModel):
    id: int
    tag_name: str
    tag_color: str
    tag_category: str
    is_active: bool
    created_at: datetime

class ScriptTagCreate(BaseModel):
    tag_name: str = Field(..., description="Tag name")
    tag_color: str = Field(default="#3b82f6", description="Hex color code")
    tag_category: str = Field(default="general", description="Tag category")

class AIInteractionLog(BaseModel):
    id: str
    session_id: str
    user_id: str
    interaction_type: str
    query: str
    response_length: Optional[int]
    processing_time_ms: Optional[int]
    feedback_decision: Optional[str]
    created_at: datetime

class AIBotRequest(BaseModel):
    question: str = Field(..., description="User question/query")
    session_id: str = Field(..., description="Session ID for tracking")
    k: Optional[int] = Field(8, description="Number of results to retrieve")
    rules_version: Optional[str] = Field("rules-v1.0", description="Rules version")

class AIBotResponse(BaseModel):
    answer: str = Field(..., description="AI explanation")
    code: Optional[str] = Field(None, description="Generated code")
    citations: List[dict] = Field(default=[], description="Source citations")
    rules_version: str
    model_version: str
    context_used: Optional[List[dict]] = Field(None, description="Context used for generation")
    script_suggestions: Optional[List[dict]] = Field(default=[], description="Suggested existing scripts")
    questions: Optional[List[dict]] = Field(default=[], description="Intelligent follow-up questions")
    intent_analysis: Optional[dict] = Field(default=None, description="User intent analysis")
    relevant_items: Optional[List[dict]] = Field(default=[], description="Relevant items from database")
    uncertainty_analysis: Optional[dict] = Field(default=None, description="Uncertainty analysis and confidence metrics")

class AIFeedbackSubmit(BaseModel):
    id: str = Field(..., description="Session ID")
    question: str
    context_used: Optional[List[dict]] = None
    assistant_output: dict = Field(..., description="AI response")
    human_feedback: dict = Field(..., description="User feedback")
    rules_version: str
    model_version: str
    rating: Optional[int] = Field(None, ge=1, le=5)

class AIInteractionReview(BaseModel):
    id: str
    session_id: str
    user_id: str
    interaction_type: str
    original_query: str
    ai_response: str
    generated_code: Optional[str]
    status: str
    admin_notes: Optional[str]
    admin_modified_code: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

class AIInteractionReviewUpdate(BaseModel):
    status: Literal["approved", "rejected", "modified"]
    admin_notes: Optional[str] = None
    admin_modified_code: Optional[str] = None

# Database Models
class RuleSuggestionDB(Base):
    __tablename__ = "rule_suggestions"
    
    id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    suggestion = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    admin_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)