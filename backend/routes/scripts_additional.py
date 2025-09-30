"""
Additional Script Routes
Bulk update and AI reindexing endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, ScriptsCacheDB
from datetime import datetime
from typing import List, Dict, Any
import httpx

router = APIRouter()
# AI endpoints are now consolidated in main backend


@router.post("/bulk-update")
async def bulk_update_scripts(
    scripts_data: List[Dict[str, Any]],
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Bulk update/add scripts from scraper data"""
    try:
        updated_count = 0
        added_count = 0
        
        for script_data in scripts_data:
            # Extract script information
            script_id = script_data.get('id') or script_data.get('url', '').split('/')[-1]
            title = script_data.get('title', 'Untitled Script')
            author = script_data.get('author', 'Unknown')
            category = script_data.get('category', 'General')
            tags = ','.join(script_data.get('tags', [])) if script_data.get('tags') else ''
            description = script_data.get('description', '')
            code = script_data.get('code', '')
            url = script_data.get('url', '')
            
            # Check if script already exists
            existing_script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
            
            if existing_script:
                # Update existing script
                existing_script.title = title
                existing_script.author = author
                existing_script.category = category
                existing_script.tags = tags
                existing_script.description = description
                existing_script.code_preview = code[:500] if code else ''
                existing_script.full_code_url = url
                existing_script.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # Add new script
                new_script = ScriptsCacheDB(
                    id=script_id,
                    title=title,
                    author=author,
                    category=category,
                    tags=tags,
                    description=description,
                    code_preview=code[:500] if code else '',
                    full_code_url=url,
                    is_approved=True,  # Auto-approve scraped scripts
                    created_by=user_id,
                    approved_by=user_id,
                    approved_at=datetime.utcnow()
                )
                db.add(new_script)
                added_count += 1
        
        db.commit()
        
        return {
            "message": "Bulk update completed",
            "added": added_count,
            "updated": updated_count,
            "total_processed": len(scripts_data)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")


@router.post("/reindex-ai")
async def reindex_ai_scripts(
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Trigger AI service to reindex all scripts"""
    try:
        # TODO: Implement direct AI reindexing
        # For now, return a placeholder message
        return {"message": "AI reindexing feature will be implemented directly in the consolidated backend"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering AI reindexing: {str(e)}")


@router.get("/stats")
async def get_script_stats(db: Session = Depends(get_db)):
    """Get statistics about scripts in the database"""
    try:
        total_scripts = db.query(ScriptsCacheDB).count()
        approved_scripts = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.is_approved == True).count()
        pending_scripts = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.is_approved == False).count()
        
        return {
            "total": total_scripts,
            "approved": approved_scripts,
            "pending": pending_scripts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
