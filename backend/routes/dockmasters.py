from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db, AdminDB

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_dockmasters(db: Session = Depends(get_db)):
    """Fetch all dockmasters."""
    dockmasters = db.query(AdminDB).filter(AdminDB.is_active == True).all()
    return [
        {
            "discord_id": dockmaster.discord_id,
            "username": dockmaster.username,
            "added_by": dockmaster.added_by,
            "added_at": dockmaster.added_at.isoformat() if dockmaster.added_at else None
        }
        for dockmaster in dockmasters
    ]
