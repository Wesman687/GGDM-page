from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class DockmasterEntry(BaseModel):
    zone_id: str = Field(..., description="Unique zone ID, e.g., '1A-E'")
    x: int = Field(..., description="X-coordinate")
    y: int = Field(..., description="Y-coordinate") 
    map: int = Field(..., description="Map ID")
    enabled: bool = Field(default=True, description="Whether DM is active")

class SuggestionCreate(BaseModel):
    action: Literal["add", "remove"] = Field(..., description="Action to perform")
    zone_id: str = Field(..., description="Zone ID for the suggestion")
    x: Optional[int] = Field(None, description="X-coordinate (required for add)")
    y: Optional[int] = Field(None, description="Y-coordinate (required for add)")
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
