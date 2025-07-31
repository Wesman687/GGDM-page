from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
from typing import List
from datetime import datetime
from models import SuggestionCreate, Suggestion
from database import get_db, SuggestionDB

router = APIRouter()

def db_suggestion_to_pydantic(db_suggestion: SuggestionDB) -> Suggestion:
    """Convert database suggestion to Pydantic model"""
    return Suggestion(
        id=db_suggestion.id,
        action=db_suggestion.action,
        zone_id=db_suggestion.zone_id,
        x=db_suggestion.x,
        y=db_suggestion.y,
        map=db_suggestion.map,
        enabled=db_suggestion.enabled,
        reason=db_suggestion.reason,
        submitter_name=db_suggestion.submitter_name,
        submitter_discord=db_suggestion.submitter_discord,
        status=db_suggestion.status,
        created_at=db_suggestion.created_at.isoformat() if db_suggestion.created_at else None,
        reviewed_at=db_suggestion.reviewed_at.isoformat() if db_suggestion.reviewed_at else None,
        reviewed_by=db_suggestion.reviewed_by,
        admin_notes=db_suggestion.admin_notes,
        pr_url=db_suggestion.pr_url,
        pr_number=db_suggestion.pr_number,
        pr_error=db_suggestion.pr_error,
        pr_retry_count=db_suggestion.pr_retry_count or 0
    )

@router.post("/", response_model=Suggestion)
async def create_suggestion(suggestion_data: SuggestionCreate, db: Session = Depends(get_db)):
    """Create a new suggestion"""
    
    # Validate required fields for add action
    if suggestion_data.action == "add":
        if not all([suggestion_data.x is not None, 
                   suggestion_data.y is not None]):
            raise HTTPException(
                status_code=400, 
                detail="X and Y coordinates are required for 'add' action"
            )
    
    # Create suggestion in database
    db_suggestion = SuggestionDB(
        id=str(uuid.uuid4()),
        action=suggestion_data.action,
        zone_id=suggestion_data.zone_id,
        x=suggestion_data.x,
        y=suggestion_data.y,
        map=7,  # Always use default map value
        enabled=True,  # Always use default enabled value
        reason=suggestion_data.reason,
        submitter_name=suggestion_data.submitter_name,
        submitter_discord=suggestion_data.submitter_discord,
        status="pending",
        created_at=datetime.utcnow()
    )
    
    db.add(db_suggestion)
    db.commit()
    db.refresh(db_suggestion)
    
    return db_suggestion_to_pydantic(db_suggestion)

@router.get("/", response_model=List[Suggestion])
async def get_suggestions(status: str = None, db: Session = Depends(get_db)):
    """Get all suggestions, optionally filtered by status"""
    query = db.query(SuggestionDB)
    
    if status:
        query = query.filter(SuggestionDB.status == status)
    
    suggestions = query.order_by(SuggestionDB.created_at.desc()).all()
    
    return [db_suggestion_to_pydantic(s) for s in suggestions]

@router.get("/{suggestion_id}", response_model=Suggestion)
async def get_suggestion(suggestion_id: str, db: Session = Depends(get_db)):
    """Get a specific suggestion by ID"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    return db_suggestion_to_pydantic(db_suggestion)

@router.get("/pending/count")
async def get_pending_count(db: Session = Depends(get_db)):
    """Get count of pending suggestions"""
    pending_count = db.query(SuggestionDB).filter(SuggestionDB.status == "pending").count()
    
    return {"pending_count": pending_count}

@router.put("/{suggestion_id}", response_model=Suggestion)
async def update_suggestion(suggestion_id: str, suggestion_data: SuggestionCreate, db: Session = Depends(get_db)):
    """Update a suggestion (admin only - for editing before approval)"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Only allow editing pending suggestions
    if db_suggestion.status != "pending":
        raise HTTPException(status_code=400, detail="Can only edit pending suggestions")
    
    # Validate required fields for add action
    if suggestion_data.action == "add":
        if not all([suggestion_data.x is not None, 
                   suggestion_data.y is not None]):
            raise HTTPException(
                status_code=400, 
                detail="X and Y coordinates are required for 'add' action"
            )
    
    # Update the suggestion fields
    db_suggestion.action = suggestion_data.action
    db_suggestion.zone_id = suggestion_data.zone_id
    db_suggestion.reason = suggestion_data.reason
    
    # Only update coordinates for add actions
    if suggestion_data.action == "add":
        db_suggestion.x = suggestion_data.x
        db_suggestion.y = suggestion_data.y
    
    # Keep original submitter info
    if suggestion_data.submitter_name:
        db_suggestion.submitter_name = suggestion_data.submitter_name
    if suggestion_data.submitter_discord:
        db_suggestion.submitter_discord = suggestion_data.submitter_discord
    
    db.commit()
    db.refresh(db_suggestion)
    
    return db_suggestion_to_pydantic(db_suggestion)

@router.delete("/{suggestion_id}")
async def delete_suggestion(suggestion_id: str, db: Session = Depends(get_db)):
    """Delete a suggestion (admin only)"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    db.delete(db_suggestion)
    db.commit()
    
    return {"message": "Suggestion deleted successfully"}
