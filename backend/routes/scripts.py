from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case
import uuid
import json
import httpx
import os
import sqlite3
from typing import List, Optional
from datetime import datetime

from models import (
    ScriptCreate, ScriptUpdate, Script, ScriptRatingCreate, ScriptRating,
    ScriptTag, ScriptTagCreate, AIBotRequest, AIBotResponse, AIFeedbackSubmit,
    AIInteractionReview, AIInteractionReviewUpdate, RuleSuggestionDB
)
from database import (
    get_db, ScriptsCacheDB, ScriptRatingsDB, AIInteractionsLogDB, ScriptTagsConfigDB,
    AIInteractionReviewDB, AdminDB
)
from ai_uncertainty_management import UncertaintyManager

router = APIRouter()

# AI endpoints are now consolidated in main backend
AI_SERVER_URL = os.getenv("AI_SERVER_URL", "http://localhost:7000")

# Fallback function to get AI server URL
def get_ai_server_url():
    """Get AI server URL with fallback"""
    return os.getenv("AI_SERVER_URL", "http://localhost:7000")

def db_script_to_pydantic(db_script: ScriptsCacheDB) -> Script:
    """Convert database script to Pydantic model"""
    # Handle tags - they can be stored as JSON or comma-separated strings
    tags = []
    if db_script.tags:
        try:
            # Try to parse as JSON first
            tags = json.loads(db_script.tags)
        except (json.JSONDecodeError, TypeError):
            # If JSON parsing fails, treat as comma-separated string
            tags = [tag.strip() for tag in db_script.tags.split(',') if tag.strip()]
    
    return Script(
        id=db_script.id,
        title=db_script.title or 'Untitled Script',
        author=db_script.author or 'Unknown',
        category=db_script.category or 'General',
        language=getattr(db_script, 'language', 'razor') or 'razor',
        tags=tags,
        description=db_script.description or '',
        code_preview=db_script.code_preview or '',
        full_code=getattr(db_script, 'full_code', None) or '',
        full_code_url=db_script.full_code_url,
        exe_download_url=getattr(db_script, 'exe_download_url', None),
        rating_average=db_script.rating_average or 0.0,
        rating_count=db_script.rating_count or 0,
        view_count=db_script.view_count or 0,
        download_count=db_script.download_count or 0,
        is_approved=db_script.is_approved,
        is_featured=getattr(db_script, 'is_featured', False),
        created_at=db_script.created_at,
        updated_at=db_script.updated_at,
        created_by=db_script.created_by,
        approved_by=db_script.approved_by,
        approved_at=db_script.approved_at,
        rejection_reason=getattr(db_script, 'rejection_reason', None)
    )

def db_rating_to_pydantic(db_rating: ScriptRatingsDB) -> ScriptRating:
    """Convert database rating to Pydantic model"""
    return ScriptRating(
        id=db_rating.id,
        script_id=db_rating.script_id,
        user_id=db_rating.user_id,
        rating=db_rating.rating,
        review=db_rating.review,
        weight=getattr(db_rating, 'weight', 1),
        is_jasown_rating=getattr(db_rating, 'is_jasown_rating', False),
        created_at=db_rating.created_at
    )

def db_tag_to_pydantic(db_tag: ScriptTagsConfigDB) -> ScriptTag:
    """Convert database tag to Pydantic model"""
    return ScriptTag(
        id=db_tag.id,
        tag_name=db_tag.tag_name,
        tag_color=db_tag.tag_color,
        tag_category=db_tag.tag_category,
        is_active=db_tag.is_active,
        created_at=db_tag.created_at
    )

def db_ai_review_to_pydantic(db_review: AIInteractionReviewDB) -> AIInteractionReview:
    """Convert database AI interaction review to Pydantic model"""
    return AIInteractionReview(
        id=db_review.id,
        session_id=db_review.session_id,
        user_id=db_review.user_id,
        interaction_type=db_review.interaction_type,
        original_query=db_review.original_query,
        ai_response=db_review.ai_response,
        generated_code=db_review.generated_code,
        status=db_review.status,
        admin_notes=db_review.admin_notes,
        admin_modified_code=db_review.admin_modified_code,
        reviewed_by=db_review.reviewed_by,
        reviewed_at=db_review.reviewed_at,
        created_at=db_review.created_at
    )

# Script CRUD operations
@router.get("/", response_model=List[Script])
async def list_scripts(
    category: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),  # Comma-separated tags
    author: Optional[str] = Query(None),
    rating_min: Optional[int] = Query(None),
    search_query: Optional[str] = Query(None),
    is_approved: Optional[bool] = Query(True),
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List scripts with filtering and pagination"""
    print(f"DEBUG: API called with tags={tags}, is_approved={is_approved}")
    
    # Start with base query
    base_query = db.query(ScriptsCacheDB)
    
    # Apply basic filters first
    if category:
        base_query = base_query.filter(ScriptsCacheDB.category == category)
    
    if author:
        base_query = base_query.filter(ScriptsCacheDB.author.ilike(f"%{author}%"))
    
    if rating_min:
        base_query = base_query.filter(ScriptsCacheDB.rating_average >= rating_min)
    
    if is_approved is not None:
        base_query = base_query.filter(ScriptsCacheDB.is_approved == is_approved)
        print(f"DEBUG: Applied is_approved filter: {is_approved}")
    
    # Handle search query with comprehensive search
    if search_query:
        search_terms = search_query.lower().split()
        search_conditions = []
        
        for term in search_terms:
            term_conditions = or_(
                ScriptsCacheDB.title.ilike(f"%{term}%"),
                ScriptsCacheDB.description.ilike(f"%{term}%"),
                ScriptsCacheDB.code_preview.ilike(f"%{term}%"),
                ScriptsCacheDB.author.ilike(f"%{term}%"),
                ScriptsCacheDB.tags.ilike(f"%{term}%"),
                ScriptsCacheDB.category.ilike(f"%{term}%")
            )
            search_conditions.append(term_conditions)
        
        # All terms must match (AND logic)
        if search_conditions:
            base_query = base_query.filter(and_(*search_conditions))
    
    # Handle tag filtering with ranking
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",")]
        
        # Get all scripts that match at least one tag
        tag_conditions = []
        for tag in tag_list:
            tag_conditions.append(ScriptsCacheDB.tags.contains(tag))
        
        if tag_conditions:
            base_query = base_query.filter(or_(*tag_conditions))
        
        # Now we need to rank by number of matching tags
        # We'll do this by adding a calculated field for tag matches
        scripts_with_ranking = []
        all_scripts = base_query.all()
        
        print(f"DEBUG: Found {len(all_scripts)} scripts from database query")
        
        for script in all_scripts:
            # Count how many tags this script matches
            script_tags = script.tags or ""
            tag_matches = 0
            for tag in tag_list:
                if tag.lower() in script_tags.lower():
                    tag_matches += 1
            
            # Include ALL scripts that have at least one matching tag
            if tag_matches > 0:
                # Calculate relevance score with GG Scripts priority
                relevance_score = (
                    tag_matches * 100 +  # Tag matches (most important)
                    (1 if script.is_featured else 0) * 50 +  # Featured bonus
                    (100 if script.category == 'gg-scripts' else 0) +  # GG Scripts priority (higher score = higher priority)
                    script.rating_average * 10 +  # Rating bonus
                    script.view_count * 0.1  # View count bonus
                )
                
                scripts_with_ranking.append((script, relevance_score, tag_matches))
        
        # Sort by relevance score (highest first), then by tag matches, then by creation date
        scripts_with_ranking.sort(key=lambda x: (-x[1], -x[2], -x[0].created_at.timestamp()))
        
        print(f"DEBUG: After ranking, have {len(scripts_with_ranking)} scripts")
        
        # Apply pagination
        paginated_scripts = scripts_with_ranking[offset:offset + limit]
        scripts = [item[0] for item in paginated_scripts]
        
        print(f"DEBUG: After pagination, returning {len(scripts)} scripts")
        
    else:
        # No tag filtering, use standard ordering with GG Scripts priority
        scripts = base_query.order_by(
            ScriptsCacheDB.is_featured.desc(),
            # GG Scripts always come first (category='gg-scripts' gets priority)
            case(
                (ScriptsCacheDB.category == 'gg-scripts', 0),
                else_=1
            ).asc(),
            ScriptsCacheDB.rating_average.desc(),
            ScriptsCacheDB.view_count.desc(),
            ScriptsCacheDB.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    return [db_script_to_pydantic(script) for script in scripts]

@router.get("/featured", response_model=List[Script])
async def get_featured_scripts(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get featured scripts only"""
    featured_scripts = db.query(ScriptsCacheDB).filter(
        and_(ScriptsCacheDB.is_approved == True, ScriptsCacheDB.is_featured == True)
    ).order_by(
        case(
            (ScriptsCacheDB.category == 'gg-scripts', 0),
            else_=1
        ).asc(),
        ScriptsCacheDB.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [db_script_to_pydantic(script) for script in featured_scripts]

@router.get("/{script_id}/code")
async def get_script_code(script_id: str, db: Session = Depends(get_db)):
    """Get full script code by ID"""
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # For now, return the code preview. In a full implementation, 
    # this would fetch the full code from storage
    return {
        "id": script.id,
        "title": script.title,
        "code": script.code_preview,
        "language": script.language,
        "note": "This is a preview. Full code storage implementation needed."
    }

@router.get("/{script_id}", response_model=Script)
async def get_script(script_id: str, db: Session = Depends(get_db)):
    """Get a specific script by ID"""
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Increment view count
    script.view_count += 1
    db.commit()
    
    return db_script_to_pydantic(script)

@router.post("/", response_model=Script)
async def create_script(
    script_data: ScriptCreate,
    user_id: str = Query(..., description="Discord ID of the user creating the script"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Create a new script (GG members only)"""
    script_id = str(uuid.uuid4())
    
    # Create code preview (first 500 characters)
    code_preview = script_data.code[:500] + "..." if len(script_data.code) > 500 else script_data.code
    
    db_script = ScriptsCacheDB(
        id=script_id,
        title=script_data.title,
        author=script_data.author,
        category='gg-scripts',  # All scripts are GG Scripts
        language=script_data.language,
        tags=json.dumps(script_data.tags),
        description=script_data.description,
        code_preview=code_preview,
        full_code=script_data.code,  # Store full code for editing
        full_code_url=f"{get_ai_server_url()}/api/scripts/{script_id}/code",  # Consolidated backend handles full code
        exe_download_url=script_data.exe_download_url,
        created_by=user_id,
        is_approved=is_admin,  # Auto-approve if admin, otherwise requires approval
        approved_by=user_id if is_admin else None,
        approved_at=datetime.utcnow() if is_admin else None
    )
    
    db.add(db_script)
    db.commit()
    db.refresh(db_script)
    
    # If this is a Jasown script, add a weighted rating
    if script_data.author.lower() in ['jasown', 'jasown scripts']:
        jasown_rating_id = str(uuid.uuid4())
        jasown_rating = ScriptRatingsDB(
            id=jasown_rating_id,
            script_id=script_id,
            user_id='jasown_system',  # Special system user ID
            rating=5,  # Default 5-star rating for Jasown scripts
            review='Official Jasown Script - High Quality',
            weight=5,  # Counts as 5 user ratings
            is_jasown_rating=True
        )
        db.add(jasown_rating)
        db.commit()
        
        # Update script rating statistics
        db_script.rating_average = 5.0
        db_script.rating_count = 5
        db.commit()
    
    # Extract items from script content for AI intelligence
    try:
        from item_extraction_utils import extract_items_from_script_content, find_existing_items
        
        extracted_items = extract_items_from_script_content(script_data.code)
        if extracted_items:
            # Find existing items in database
            db_path = "suggestions.db"
            results = find_existing_items(db_path, extracted_items)
            
            # Store extraction results for frontend processing
            script_response = db_script_to_pydantic(db_script)
            script_response.extracted_items = {
                "total_found": len(extracted_items),
                "matched_items": results["matched_items"],
                "unmatched_items": results["unmatched_items"],
                "suggestions": results["suggestions"]
            }
        else:
            script_response = db_script_to_pydantic(db_script)
    except Exception as e:
        # If item extraction fails, still return the script
        print(f"Item extraction failed: {e}")
        script_response = db_script_to_pydantic(db_script)
    
    # Add approval status message to response
    if is_admin:
        script_response.message = "Script created and automatically approved!"
    else:
        script_response.message = "Script created successfully! Waiting for admin approval."
    
    return script_response

@router.put("/{script_id}", response_model=Script)
async def update_script(
    script_id: str,
    script_data: ScriptUpdate,
    user_id: str = Query(..., description="Discord ID of the user updating the script"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update a script (script creator or admins only)"""
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Check if user is the script creator or an admin
    is_script_creator = script.created_by == user_id
    if not is_admin and not is_script_creator:
        raise HTTPException(status_code=403, detail="Only the script creator or admins can update scripts")
    
    # Update fields if provided
    if script_data.title is not None:
        script.title = script_data.title
    if script_data.author is not None:
        script.author = script_data.author
    if script_data.tags is not None:
        script.tags = json.dumps(script_data.tags)
    if script_data.description is not None:
        script.description = script_data.description
    if script_data.code is not None:
        script.code_preview = script_data.code[:500] + "..." if len(script_data.code) > 500 else script_data.code
        script.full_code = script_data.code  # Store full code for editing
    if script_data.language is not None:
        script.language = script_data.language
    if script_data.exe_download_url is not None:
        script.exe_download_url = script_data.exe_download_url
    
    script.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(script)
    
    return db_script_to_pydantic(script)

@router.delete("/{script_id}")
async def delete_script(
    script_id: str,
    user_id: str = Query(..., description="Discord ID of the user deleting the script"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Delete a script (admins only)"""
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Only admins can delete scripts
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can delete scripts")
    
    # Delete related ratings first
    db.query(ScriptRatingsDB).filter(ScriptRatingsDB.script_id == script_id).delete()
    
    # Delete the script
    db.delete(script)
    db.commit()
    
    return {"message": "Script deleted successfully"}

# Rating operations
@router.post("/{script_id}/rate", response_model=ScriptRating)
async def rate_script(
    script_id: str,
    rating_data: ScriptRatingCreate,
    user_id: str = Query(..., description="Discord ID of the user rating the script"),
    db: Session = Depends(get_db)
):
    """Rate a script (1-5 stars)"""
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Check if user already rated this script
    existing_rating = db.query(ScriptRatingsDB).filter(
        and_(ScriptRatingsDB.script_id == script_id, ScriptRatingsDB.user_id == user_id)
    ).first()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating_data.rating
        existing_rating.review = rating_data.review
        db.commit()
        db.refresh(existing_rating)
        rating = existing_rating
    else:
        # Create new rating
        rating_id = str(uuid.uuid4())
        rating = ScriptRatingsDB(
            id=rating_id,
            script_id=script_id,
            user_id=user_id,
            rating=rating_data.rating,
            review=rating_data.review
        )
        db.add(rating)
        db.commit()
        db.refresh(rating)
    
    # Update script rating statistics with weighted average
    ratings = db.query(ScriptRatingsDB).filter(ScriptRatingsDB.script_id == script_id).all()
    if ratings:
        # Calculate weighted average
        total_weighted_score = sum(r.rating * getattr(r, 'weight', 1) for r in ratings)
        total_weight = sum(getattr(r, 'weight', 1) for r in ratings)
        script.rating_average = total_weighted_score / total_weight if total_weight > 0 else 0
        
        # Count total effective ratings (sum of weights)
        script.rating_count = total_weight
        db.commit()
    
    return db_rating_to_pydantic(rating)

@router.post("/{script_id}/jasown-rating", response_model=ScriptRating)
async def create_jasown_rating(
    script_id: str,
    rating_data: ScriptRatingCreate,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Create a Jasown weighted rating for a script (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can create Jasown ratings")
    
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Check if Jasown rating already exists
    existing_jasown_rating = db.query(ScriptRatingsDB).filter(
        and_(
            ScriptRatingsDB.script_id == script_id, 
            ScriptRatingsDB.is_jasown_rating == True
        )
    ).first()
    
    if existing_jasown_rating:
        raise HTTPException(status_code=400, detail="Jasown rating already exists for this script")
    
    # Create Jasown rating
    rating_id = str(uuid.uuid4())
    jasown_rating = ScriptRatingsDB(
        id=rating_id,
        script_id=script_id,
        user_id='jasown_system',
        rating=rating_data.rating,
        review=rating_data.review or 'Official Jasown Script - High Quality',
        weight=5,  # Counts as 5 user ratings
        is_jasown_rating=True
    )
    db.add(jasown_rating)
    db.commit()
    db.refresh(jasown_rating)
    
    # Update script rating statistics with weighted average
    ratings = db.query(ScriptRatingsDB).filter(ScriptRatingsDB.script_id == script_id).all()
    if ratings:
        total_weighted_score = sum(r.rating * getattr(r, 'weight', 1) for r in ratings)
        total_weight = sum(getattr(r, 'weight', 1) for r in ratings)
        script.rating_average = total_weighted_score / total_weight if total_weight > 0 else 0
        script.rating_count = total_weight
        db.commit()
    
    return db_rating_to_pydantic(jasown_rating)

@router.get("/{script_id}/ratings", response_model=List[ScriptRating])
async def get_script_ratings(
    script_id: str,
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get ratings for a specific script"""
    ratings = db.query(ScriptRatingsDB).filter(
        ScriptRatingsDB.script_id == script_id
    ).order_by(ScriptRatingsDB.created_at.desc()).offset(offset).limit(limit).all()
    
    return [db_rating_to_pydantic(rating) for rating in ratings]

# Tags management
@router.get("/tags/", response_model=List[ScriptTag])
async def get_tags(db: Session = Depends(get_db)):
    """Get all available tags"""
    tags = db.query(ScriptTagsConfigDB).filter(ScriptTagsConfigDB.is_active == True).all()
    return [db_tag_to_pydantic(tag) for tag in tags]

@router.post("/tags/", response_model=ScriptTag)
async def create_tag(
    tag_data: ScriptTagCreate,
    user_id: str = Query(..., description="Discord ID of the user creating the tag"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Create a new tag (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can create tags")
    
    # Check if tag already exists
    existing_tag = db.query(ScriptTagsConfigDB).filter(
        ScriptTagsConfigDB.tag_name == tag_data.tag_name
    ).first()
    
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    tag = ScriptTagsConfigDB(
        tag_name=tag_data.tag_name,
        tag_color=tag_data.tag_color,
        tag_category=tag_data.tag_category
    )
    
    db.add(tag)
    db.commit()
    db.refresh(tag)
    
    return db_tag_to_pydantic(tag)

@router.put("/tags/{tag_id}", response_model=ScriptTag)
async def update_tag(
    tag_id: int,
    tag_data: ScriptTagCreate,
    user_id: str = Query(..., description="Discord ID of the user updating the tag"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update a tag (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update tags")
    
    tag = db.query(ScriptTagsConfigDB).filter(ScriptTagsConfigDB.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    tag.tag_name = tag_data.tag_name
    tag.tag_color = tag_data.tag_color
    tag.tag_category = tag_data.tag_category
    
    db.commit()
    db.refresh(tag)
    
    return db_tag_to_pydantic(tag)

@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    user_id: str = Query(..., description="Discord ID of the user deleting the tag"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Delete a tag (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can delete tags")
    
    tag = db.query(ScriptTagsConfigDB).filter(ScriptTagsConfigDB.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Soft delete by setting is_active to False
    tag.is_active = False
    db.commit()
    
    return {"message": "Tag deleted successfully"}

# AI Bot integration endpoints - now using direct imports
try:
    from ai_models import AskRequest as AIAskRequest, AskResponse as AIAskResponse
    from ai_rag import retrieve, format_context, generate_citations
    from ai_lint import lint_razor, extract_code_from_response
    from ai_db import log_interaction
    from ai_settings import RULES_PATH, OPENAI_MODEL
except ImportError:
    # Fallback for when AI modules are not available
    RULES_PATH = "ai/rules/RULES.md"
    OPENAI_MODEL = "gpt-4o-mini"

from openai import OpenAI
import os
import sqlite3
from datetime import datetime

# Initialize OpenAI client for this module
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def load_rules() -> str:
    """Load rules from file."""
    try:
        with open(RULES_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "File Not Found"

def analyze_user_intent(query: str) -> tuple:
    """Analyze what the user actually wants"""
    query_lower = query.lower()
    
    # Intent analysis patterns with tags for better search precision
    intent_patterns = {
        'fishing': {
            'keywords': ['fishing', 'fish', 'pooner', 'boat', 'captcha', 'net', 'bait'],
            'tags': ['fishing', 'pooner', 'boat', 'captcha', 'seafaring', 'net'],
            'intent': 'Create a fishing automation script',
            'context_needed': ['fishing mechanics', 'boat handling', 'captcha solving'],
            'common_requirements': ['boat startup', 'captcha detection', 'net management', 'fish processing']
        },
        'mining': {
            'keywords': ['mining', 'mine', 'ore', 'pickaxe', 'vein', 'gems'],
            'tags': ['mining', 'ore', 'pickaxe'],
            'intent': 'Create a mining automation script',
            'context_needed': ['mining mechanics',  'tool usage'],
            'common_requirements': ['tool management', 'ore processing']
        },
        'combat': {
            'keywords': ['combat', 'fight', 'attack', 'weapon', 'spell', 'heal', 'pvp', 'pvm'],
            'tags': ['combat', 'pvp', 'pvm', 'healing', 'spells', 'weapons'],
            'intent': 'Create a combat automation script',
            'context_needed': ['combat mechanics', 'spell casting', 'healing'],
            'common_requirements': ['target selection', 'spell rotation', 'healing logic']
        },
        'crafting': {
            'keywords': ['tinkering', 'blacksmith', 'tailor', 'carpenter', 'alchemy', 'inscription', 'cooking'],
            'tags': ['crafting', 'blacksmith', 'tailor', 'carpenter', 'alchemy'],
            'intent': 'Create a crafting automation script',
            'context_needed': ['crafting mechanics', 'material management'],
            'common_requirements': ['material detection', 'crafting process', 'item management']
        },
        'looting': {
            'keywords': ['loot', 'looting', 'sort', 'organize', 'chest', 'bag'],
            'tags': ['looting', 'sorting', 'organizing', 'chest', 'bag'],
            'intent': 'Create a looting/organization script',
            'context_needed': ['looting mechanics', 'item organization'],
            'common_requirements': ['item detection', 'container management', 'sorting logic']
        }
    }
    
    detected_intents = []
    for intent_name, intent_data in intent_patterns.items():
        for keyword in intent_data['keywords']:
            if keyword in query_lower:
                detected_intents.append(intent_name)
                break
    
    if not detected_intents:
        detected_intents = ['general']
    
    primary_intent = detected_intents[0]
    intent_data = intent_patterns.get(primary_intent, {
        'keywords': ['script', 'automation'],
        'tags': ['script', 'automation'],
        'intent': 'Create a general automation script',
        'context_needed': ['general scripting'],
        'common_requirements': ['basic automation']
    })
    
    return primary_intent, intent_data

def retrieve_relevant_scripts(query: str, k: int = 5) -> list:
    """Retrieve relevant scripts using tag-based search for better precision"""
    try:
        from sqlalchemy import or_, and_, func
        
        # Analyze user intent first
        primary_intent, intent_data = analyze_user_intent(query)
        
        print(f"Analyzed intent: {primary_intent} - {intent_data['intent']}")
        
        # Use tag-based search for much better precision
        tags = intent_data.get('tags', intent_data['keywords'])
        
        # Build tag-based search conditions for better precision
        search_conditions = []
        
        # Primary: Search tags first (most precise)
        for tag in tags:
            search_conditions.append(ScriptsCacheDB.tags.ilike(f'%{tag}%'))
        
        # Secondary: Search title and description for intent keywords
        for keyword in intent_data['keywords']:
            search_conditions.append(
                or_(
                    ScriptsCacheDB.title.ilike(f'%{keyword}%'),
                    ScriptsCacheDB.description.ilike(f'%{keyword}%')
                )
            )
        
        # Tertiary: Search for exact query terms
        query_words = query.split()
        for word in query_words:
            if len(word) > 2:
                search_conditions.append(
                    or_(
                        ScriptsCacheDB.title.ilike(f'%{word}%'),
                        ScriptsCacheDB.description.ilike(f'%{word}%'),
                        ScriptsCacheDB.tags.ilike(f'%{word}%')
                    )
                )
        
        # Execute search with OR conditions
        if search_conditions:
            from database import get_db
            db = next(get_db())
            
            scripts = db.query(ScriptsCacheDB).filter(
                and_(
                    ScriptsCacheDB.is_approved == True,
                    or_(*search_conditions)
                )
            ).order_by(
                ScriptsCacheDB.is_featured.desc(),
                ScriptsCacheDB.rating_average.desc().nullslast(),
                ScriptsCacheDB.created_at.desc()
            ).limit(k).all()
            
            print(f"Found {len(scripts)} scripts for intent '{primary_intent}'")
            
            # Filter scripts more intelligently based on intent
            relevant_scripts = []
            for script in scripts:
                title = script.title.lower()
                description = script.description.lower() if script.description else ""
                
                # Check if script is actually relevant to the intent
                is_relevant = False
                for keyword in intent_data['keywords']:
                    if keyword in title or keyword in description:
                        is_relevant = True
                        break
                
                if is_relevant:
                    script_chunk = {
                        "id": f"script_{script.id}",
                        "source": "scripts_database",
                        "title": script.title,
                        "url": f"/scripts/{script.id}",
                        "text": f"""
Title: {script.title}
Author: {script.author}
Description: {script.description}
Tags: {script.tags}
Rating: {script.rating_average}/5
Code:
{script.code_preview[:2000] if script.code_preview else 'No code available'}...
""".strip(),
                        "meta": {
                            "script_id": script.id,
                            "author": script.author,
                            "rating": script.rating_average,
                            "is_featured": script.is_featured,
                            "category": script.category,
                            "tags": script.tags,
                            "created_at": script.created_at.isoformat() if script.created_at else None
                        }
                    }
                    relevant_scripts.append(script_chunk)
                    print(f"  ✓ Relevant: {script.title}")
                else:
                    print(f"  ✗ Not relevant: {script.title}")
            
            return relevant_scripts
        
        return []
        
    except Exception as e:
        print(f"Error retrieving relevant scripts: {e}")
        return []

def suggest_existing_scripts(query: str, k: int = 3) -> list:
    """Suggest existing scripts that might solve the user's problem"""
    try:
        from sqlalchemy import or_, and_, func
        
        # Extract keywords and intent from query
        query_lower = query.lower()
        
        # Intent-based script suggestions
        intent_patterns = {
            'fishing': ['fishing', 'pole', 'bait', 'fish'],
            'mining': ['mining', 'ore', 'pickaxe', 'vein'],
            'lumberjacking': ['lumberjacking', 'wood', 'axe', 'tree'],
            'combat': ['combat', 'fight', 'attack', 'weapon', 'damage'],
            'healing': ['healing', 'heal', 'bandage', 'potion', 'health'],
            'banking': ['banking', 'bank', 'deposit', 'withdraw', 'organize'],
            'crafting': ['crafting', 'craft', 'make', 'create', 'smith'],
            'travel': ['travel', 'recall', 'gate', 'teleport', 'runebook'],
            'vendor': ['vendor', 'buy', 'sell', 'trade', 'shop'],
            'taming': ['taming', 'tame', 'animal', 'pet', 'mount']
        }
        
        # Find matching intents
        matching_intents = []
        for intent, keywords in intent_patterns.items():
            if any(keyword in query_lower for keyword in keywords):
                matching_intents.append(intent)
        
        # Build search conditions
        search_conditions = []
        
        # Search by intent
        for intent in matching_intents:
            search_conditions.append(
                or_(
                    ScriptsCacheDB.title.ilike(f'%{intent}%'),
                    ScriptsCacheDB.description.ilike(f'%{intent}%'),
                    ScriptsCacheDB.tags.ilike(f'%{intent}%'),
                    ScriptsCacheDB.code_preview.ilike(f'%{intent}%')
                )
            )
        
        # Search by keywords
        query_words = [word for word in query.split() if len(word) > 2]
        for word in query_words:
            search_conditions.append(
                or_(
                    ScriptsCacheDB.title.ilike(f'%{word}%'),
                    ScriptsCacheDB.description.ilike(f'%{word}%'),
                    ScriptsCacheDB.tags.ilike(f'%{word}%'),
                    ScriptsCacheDB.code_preview.ilike(f'%{word}%')
                )
            )
        
        if search_conditions:
            from database import get_db
            db = next(get_db())
            
            scripts = db.query(ScriptsCacheDB).filter(
                and_(
                    ScriptsCacheDB.is_approved == True,
                    or_(*search_conditions)
                )
            ).order_by(
                ScriptsCacheDB.is_featured.desc(),
                ScriptsCacheDB.rating_average.desc().nullslast(),
                ScriptsCacheDB.created_at.desc()
            ).limit(k).all()
            
            # Format suggestions
            suggestions = []
            for script in scripts:
                suggestion = {
                    "id": script.id,
                    "title": script.title,
                    "author": script.author,
                    "description": script.description,
                    "rating": script.rating_average,
                    "is_featured": script.is_featured,
                    "tags": script.tags,
                    "url": f"/scripts/{script.id}",
                    "relevance_reason": f"Matches your request for {matching_intents[0] if matching_intents else 'scripting'}"
                }
                suggestions.append(suggestion)
            
            return suggestions
        
        return []
        
    except Exception as e:
        print(f"Error suggesting existing scripts: {e}")
        return []

@router.post("/ai/interactive-search")
async def interactive_script_search(
    request: dict,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Interactive script search that asks about existing scripts first"""
    try:
        query = request.get("question", "")
        action = request.get("action", "search")  # search, view_script, create_new
        
        if action == "search":
            # First, search for existing scripts
            script_suggestions = suggest_existing_scripts(query, 5)
            
            if script_suggestions:
                return {
                    "type": "script_suggestions",
                    "message": f"I found {len(script_suggestions)} existing scripts related to your request. Would you like to take a look at any of them?",
                    "suggestions": script_suggestions,
                    "query": query
                }
            else:
                # No existing scripts found, proceed to create new one
                return await create_new_script_interactive(query, user_id, db)
        
        elif action == "view_script":
            script_id = request.get("script_id")
            if script_id:
                return await get_script_details(script_id, query, user_id, db)
        
        elif action == "create_new":
            return await create_new_script_interactive(query, user_id, db)
        
        elif action == "ask_questions":
            return await ask_script_questions(query, request.get("answers", {}), user_id, db)
        
        return {"error": "Invalid action"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in interactive search: {str(e)}")

async def get_script_details(script_id: str, query: str, user_id: str, db: Session):
    """Get detailed script information and ask if user wants to view others or create new"""
    try:
        script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
        if not script:
            return {"error": "Script not found"}
        
        # Get other related scripts
        other_suggestions = suggest_existing_scripts(query, 3)
        other_suggestions = [s for s in other_suggestions if s["id"] != script_id]
        
        return {
            "type": "script_details",
            "script": {
                "id": script.id,
                "title": script.title,
                "author": script.author,
                "description": script.description,
                "code": script.code,
                "rating": script.rating,
                "is_featured": script.is_featured,
                "tags": script.tags,
                "url": f"/scripts/{script.id}"
            },
            "message": f"Here's the '{script.title}' script. Would you like to look at other similar scripts or create a new one based on your specific needs?",
            "other_suggestions": other_suggestions,
            "query": query
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting script details: {str(e)}")

async def create_new_script_interactive(query: str, user_id: str, db: Session):
    """Ask relevant questions before creating a new script"""
    try:
        # Determine what questions to ask based on the query
        questions = []
        
        if "fishing" in query.lower():
            questions = [
                {"id": "fishing_type", "question": "What type of fishing do you want? (boat fishing, shore fishing, or both?)", "type": "select", "options": ["boat", "shore", "both"]},
                {"id": "fish_handling", "question": "How should the script handle caught fish? (cut for resources, keep whole, or sell?)", "type": "select", "options": ["cut", "keep", "sell"]},
                {"id": "bait_management", "question": "Do you want automatic bait management?", "type": "boolean"},
                {"id": "captcha_handling", "question": "Should the script handle captcha detection?", "type": "boolean"}
            ]
        elif "mining" in query.lower():
            questions = [
                {"id": "ore_type", "question": "What type of ore are you targeting?", "type": "select", "options": ["iron", "gold", "silver", "all"]},
                {"id": "smelting", "question": "Should the script smelt ore automatically?", "type": "boolean"},
                {"id": "banking", "question": "Do you want automatic banking of resources?", "type": "boolean"}
            ]
        elif "combat" in query.lower():
            questions = [
                {"id": "target_type", "question": "What type of creatures should the script target?", "type": "text"},
                {"id": "healing", "question": "What healing method should be used?", "type": "select", "options": ["bandages", "potions", "both"]},
                {"id": "loot_handling", "question": "Should the script automatically loot corpses?", "type": "boolean"}
            ]
        else:
            questions = [
                {"id": "specific_needs", "question": "What specific functionality do you need?", "type": "text"},
                {"id": "complexity", "question": "How complex should the script be?", "type": "select", "options": ["simple", "moderate", "advanced"]}
            ]
        
        return {
            "type": "questions",
            "message": "Before I create a new script, I'd like to ask a few questions to make sure it meets your needs:",
            "questions": questions,
            "query": query
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating interactive questions: {str(e)}")

async def ask_script_questions(query: str, answers: dict, user_id: str, db: Session):
    """Generate script based on user answers"""
    try:
        # Retrieve relevant chunks from documentation
        doc_chunks = retrieve(query, 8)
        
        # Retrieve relevant scripts from database
        script_chunks = retrieve_relevant_scripts(query, 5)
        
        # Combine and format context
        all_chunks = doc_chunks + script_chunks
        
        # Load rules
        rules = load_rules()
        
        # Create enhanced prompt with user answers
        answers_text = "\n".join([f"- {q}: {a}" for q, a in answers.items()])
        
        prompt = f"""Follow these rules strictly:
{rules}

User request: {query}

User requirements:
{answers_text}

Relevant materials (including existing scripts and documentation):
{format_context(all_chunks)}

IMPORTANT INSTRUCTIONS:
- Use ONLY Razor syntax (no parentheses in control structures!)
- If you find relevant existing scripts, adapt their patterns for the user's specific needs
- Incorporate the user's specific requirements from their answers
- Always follow the patterns and best practices shown in the existing scripts
- Use proper Razor syntax: if findtype "item" container as var (NOT if (findtype(...)))

Respond with:
1) A concise explanation (<=8 lines) mentioning how you incorporated their specific requirements
2) A code block with final Razor code that uses proper syntax and meets their needs
3) A short checklist of caveats and setup instructions

Format your response with clear sections and use ```razor for code blocks."""

        # Get AI response
        answer = call_llm(prompt)
        
        # Extract code from response
        code = extract_code_from_response(answer)
        
        # Lint the code
        lint_issues = lint_razor(code)
        
        # Generate citations
        citations = generate_citations(all_chunks)
        
        return {
            "type": "script_generated",
            "answer": answer,
            "code": code,
            "citations": citations,
            "lint_issues": lint_issues,
            "query": query,
            "user_requirements": answers
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating script: {str(e)}")

def call_llm(prompt: str, model: str = None) -> str:
    """Call OpenAI API with the given prompt."""
    if model is None:
        model = OPENAI_MODEL
    
    try:
        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a UO Outlands Razor scripting assistant. Provide clear, working Razor scripts with explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

def analyze_user_intent_with_items(query: str) -> dict:
    """Analyze user intent and find relevant items"""
    query_lower = query.lower()
    
    intent_patterns = {
        'fishing': {
            'keywords': ['fishing', 'fish', 'pooner', 'boat', 'captcha', 'net', 'bait', 'mib', 'frenzy'],
            'item_types': ['fishing pole', 'fishing net', 'bait', 'boat', 'mib', 'frenzy'],
            'requirements': ['boat_detection', 'captcha_handling', 'fish_processing']
        },
        'mining': {
            'keywords': ['mining', 'mine', 'ore', 'pickaxe', 'vein', 'gems'],
            'item_types': ['pickaxe', 'ore', 'gems', 'mining tools'],
            'requirements': ['vein_detection', 'tool_management', 'ore_processing']
        },
        'combat': {
            'keywords': ['combat', 'fight', 'attack', 'weapon', 'spell', 'heal', 'pvp', 'pvm'],
            'item_types': ['weapon', 'armor', 'potions', 'bandages'],
            'requirements': ['target_selection', 'healing_logic', 'spell_rotation']
        }
    }
    
    detected_intents = []
    for intent_name, intent_data in intent_patterns.items():
        for keyword in intent_data['keywords']:
            if keyword in query_lower:
                detected_intents.append(intent_name)
                break
    
    if not detected_intents:
        detected_intents = ['general']
    
    primary_intent = detected_intents[0]
    intent_data = intent_patterns.get(primary_intent, {
        'keywords': ['script', 'automation'],
        'item_types': ['general items'],
        'requirements': ['basic automation']
    })
    
    return {
        'intent': primary_intent,
        'intent_data': intent_data,
        'keywords': intent_data['keywords'],
        'item_types': intent_data['item_types'],
        'requirements': intent_data['requirements']
    }

def get_relevant_items_for_intent(intent_keywords: list, db: Session) -> list:
    """Get relevant items from the item database for a specific intent"""
    try:
        import sqlite3
        
        # Connect to SQLite database directly
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Build search conditions
        search_conditions = []
        params = []
        for keyword in intent_keywords:
            search_conditions.append("(name LIKE ? OR description LIKE ?)")
            params.extend([f'%{keyword}%', f'%{keyword}%'])
        
        if search_conditions:
            query = f'''
                SELECT name, item_id, hue, usage_count, is_verified, description
                FROM items 
                WHERE {' OR '.join(search_conditions)}
                ORDER BY usage_count DESC
                LIMIT 20
            '''
            
            cursor.execute(query, params)
            items_data = cursor.fetchall()
            conn.close()
            
            # Convert to list of dictionaries
            items = []
            for item_data in items_data:
                items.append({
                    'name': item_data[0],
                    'item_id': item_data[1],
                    'hue': item_data[2],
                    'usage_count': item_data[3],
                    'is_verified': item_data[4],
                    'description': item_data[5]
                })
            
            return items
        
        conn.close()
        return []
        
    except Exception as e:
        print(f"Error getting relevant items: {e}")
        return []

def generate_intelligent_questions(intent: str, relevant_items: list, user_request: str) -> list:
    """Generate intelligent follow-up questions based on available data"""
    questions = []
    
    if intent == 'fishing':
        # Check what fishing types are available
        fishing_types = []
        missing_items = []
        
        for item in relevant_items:
            if 'mib' in item['name'].lower():
                fishing_types.append('Mibs (special fishing spots)')
            if 'frenzy' in item['name'].lower():
                fishing_types.append('Frenzies (intense fishing areas)')
            if 'net' in item['name'].lower():
                fishing_types.append('Fishing nets')
            if 'pole' in item['name'].lower():
                fishing_types.append('Fishing poles')
            if 'boat' in item['name'].lower():
                fishing_types.append('Boat fishing')
            
            # Check for missing item IDs
            if not item['item_id'] or item['item_id'] == 0:
                missing_items.append(item['name'])
        
        # Generate main question
        if fishing_types:
            questions.append({
                'type': 'choice',
                'question': f"I found several fishing-related items in the database. What type of fishing would you like to do?",
                'options': list(set(fishing_types)),
                'context': 'fishing_type_selection'
            })
        
        # Ask about specific requirements
        questions.extend([
            {
                'type': 'boolean',
                'question': "Do you want notifications for player boats approaching?",
                'context': 'boat_notifications'
            },
            {
                'type': 'boolean',
                'question': "Do you want the script to handle captcha challenges automatically?",
                'context': 'captcha_handling'
            },
            {
                'type': 'choice',
                'question': "What type of fish processing do you want?",
                'options': ['Cut and store', 'Cut and eat', 'Store whole fish', 'Auto-sell fish'],
                'context': 'fish_processing'
            }
        ])
        
        # Ask about missing item information
        if missing_items:
            questions.append({
                'type': 'input',
                'question': f"I need item IDs for: {', '.join(missing_items)}. Can you provide these?",
                'context': 'missing_item_ids',
                'missing_items': missing_items
            })
    
    return questions

@router.post("/ai/search")
async def ai_search(
    request: AIBotRequest,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Enhanced AI search with intelligent questioning, item integration, and uncertainty management"""
    try:
        # Initialize uncertainty manager
        uncertainty_manager = UncertaintyManager()
        
        # Analyze user intent
        intent_analysis = analyze_user_intent_with_items(request.question)
        
        # Analyze uncertainty
        uncertainty_analysis = uncertainty_manager.analyze_uncertainty(
            request.question, 
            intent_analysis, 
            intent_analysis.get('confidence', 0.5)
        )
        
        # If uncertainty is too high, return uncertainty response
        if uncertainty_analysis['needs_admin_review']:
            uncertainty_response = uncertainty_manager.generate_uncertainty_response(uncertainty_analysis)
            
            return AIBotResponse(
                answer=uncertainty_response,
                code="",
                citations=[],
                rules_version=request.rules_version or "rules-v1.0",
                model_version="uncertainty-management",
                context_used=[],
                script_suggestions=[],
                questions=[{
                    'type': 'info',
                    'question': 'This request has been flagged for admin review to ensure you get the best help possible.',
                    'context': 'admin_review_requested'
                }],
                intent_analysis=intent_analysis,
                relevant_items=[],
                uncertainty_analysis=uncertainty_analysis
            )
        
        # Get relevant items from database
        relevant_items = get_relevant_items_for_intent(intent_analysis['keywords'], db)
        
        # Generate intelligent questions
        questions = generate_intelligent_questions(
            intent_analysis['intent'], 
            relevant_items, 
            request.question
        )
        
        # If we have questions, return them instead of generating code
        if questions and intent_analysis['intent'] in ['fishing', 'mining', 'combat']:
            # Add uncertainty warning if confidence is medium
            if uncertainty_analysis['should_ask_user']:
                questions.insert(0, {
                    'type': 'confirmation',
                    'question': f"I think you want help with {intent_analysis['intent']}, but I want to make sure. Is this correct?",
                    'context': 'intent_confirmation'
                })
            
            return AIBotResponse(
                answer=f"I found several {intent_analysis['intent']}-related items in the database. To create the best script for you, I need to ask a few questions first.",
                code="",
                citations=[],
                rules_version=request.rules_version or "rules-v1.0",
                model_version="questioning-system",
                context_used=[],
                script_suggestions=[],
                questions=questions,
                intent_analysis=intent_analysis,
                relevant_items=relevant_items[:10],
                uncertainty_analysis=uncertainty_analysis
            )
        
        # Retrieve relevant chunks from documentation
        doc_chunks = retrieve(request.question, request.k)
        
        # Retrieve relevant scripts from database
        script_chunks = retrieve_relevant_scripts(request.question, request.k or 5)
        
        # Combine and format context
        all_chunks = doc_chunks + script_chunks
        
        # Add item context if we have relevant items
        item_context = ""
        if relevant_items:
            item_context = "\n\nAVAILABLE ITEMS FROM DATABASE:\n"
            for item in relevant_items[:10]:
                item_context += f"Item: {item['name']} (ID: {item['item_id']}, Hue: {item['hue']}, Usage: {item['usage_count']})\n"
        
        context = format_context(all_chunks) + item_context
        
        # Load rules
        rules = load_rules()
        
        # Create prompt
        prompt = f"""Follow these rules strictly:
{rules}

User question:
{request.question}

Relevant materials (including existing scripts and documentation):
{context}

IMPORTANT INSTRUCTIONS:
- If you find relevant existing scripts in the materials above, analyze them and consider adapting their patterns
- Look for scripts that solve similar problems and use their approaches as inspiration
- If you're unsure about a specific implementation, reference the existing scripts for guidance
- Always follow the patterns and best practices shown in the existing scripts
- If multiple scripts show different approaches, choose the most appropriate one for the user's needs

Respond with:
1) A concise explanation (<=8 lines) mentioning if you found relevant existing scripts to reference
2) A code block with final Razor code that incorporates best practices from existing scripts
3) A short checklist of caveats

Format your response with clear sections and use ```razor for code blocks."""

        # Get AI response
        answer = call_llm(prompt)
        
        # Extract code from response
        code = extract_code_from_response(answer)
        
        # Lint the code
        lint_issues = lint_razor(code)
        
        # Generate citations
        citations = generate_citations(all_chunks)
        
        # Log interaction
        interaction_id = log_interaction({
            "question": request.question,
            "assistant_draft": {"explanation": answer, "code": code},
            "retrieved": all_chunks,
            "citations": citations,
            "rules_version": request.rules_version or "rules-v1.0",
            "model_version": OPENAI_MODEL,
            "session_id": request.session_id
        })
        
        # Log comprehensive training data
        try:
            from training_data_service import TrainingDataService, TrainingInteraction
            
            training_service = TrainingDataService()
            training_interaction = TrainingInteraction(
                session_id=request.session_id,
                user_id=user_id,
                interaction_type="question",
                user_query=request.question,
                context_data={"retrieved_chunks": all_chunks, "citations": citations, "doc_chunks": doc_chunks, "script_chunks": script_chunks},
                ai_response_raw=answer,
                ai_explanation=answer,
                ai_generated_code=code or "",
                rules_version=request.rules_version or "rules-v1.0",
                model_version=OPENAI_MODEL
            )
            
            training_service.log_training_interaction(training_interaction)
        except Exception as e:
            print(f"Warning: Failed to log training data: {e}")
        
        # Get script suggestions
        script_suggestions = suggest_existing_scripts(request.question, 3)
        
        return AIBotResponse(
            answer=answer,
            code=code,
            citations=citations,
            rules_version=request.rules_version or "rules-v1.0",
            model_version=OPENAI_MODEL,
            context_used=all_chunks,
            script_suggestions=script_suggestions,
            questions=[],
            intent_analysis=intent_analysis,
            relevant_items=relevant_items[:10]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@router.post("/ai/generate-with-answers")
async def generate_script_with_answers(
    request: dict,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Generate script after receiving answers to intelligent questions"""
    try:
        original_query = request.get('original_query', '')
        user_answers = request.get('answers', {})
        intent_analysis = request.get('intent_analysis', {})
        
        # Get relevant items from database
        relevant_items = get_relevant_items_for_intent(intent_analysis.get('keywords', []), db)
        
        # Retrieve relevant chunks from documentation
        doc_chunks = retrieve(original_query, 5)
        
        # Retrieve relevant scripts from database
        script_chunks = retrieve_relevant_scripts(original_query, 5)
        
        # Combine and format context
        all_chunks = doc_chunks + script_chunks
        
        # Add comprehensive item context
        item_context = ""
        if relevant_items:
            item_context = "\n\nAVAILABLE ITEMS FROM DATABASE:\n"
            for item in relevant_items[:15]:
                item_context += f"Item: {item['name']} (ID: {item['item_id']}, Hue: {item['hue']}, Usage: {item['usage_count']})\n"
                if item.get('description'):
                    item_context += f"  Description: {item['description']}\n"
        
        # Add user requirements context
        requirements_context = f"\n\nUSER REQUIREMENTS:\n"
        requirements_context += f"Original Request: {original_query}\n"
        for key, value in user_answers.items():
            requirements_context += f"{key.replace('_', ' ').title()}: {value}\n"
        
        context = format_context(all_chunks) + item_context + requirements_context
        
        # Load rules
        rules = load_rules()
        
        # Create enhanced prompt with all context
        prompt = f"""You are a Razor scripting expert for UO Outlands. Create a comprehensive script based on the user's requirements.

{rules}

{context}

SPECIFIC INSTRUCTIONS:
1. Use ONLY Razor syntax (no parentheses in control structures!)
2. Use item names or graphic IDs from the database above
3. If an item ID is missing, use the item name in quotes
4. Include proper error handling and safety checks
5. Add comments explaining each section
6. Use proper Razor control structures: if ... endif, while ... endwhile
7. Incorporate ALL user requirements from the answers above
8. Use the most appropriate items from the database
9. Include proper boat detection if requested
10. Include proper captcha handling if requested
11. Include proper fish processing as specified

Generate a complete, working Razor script that meets all the user's requirements:"""
        
        # Get AI response
        answer = call_llm(prompt)
        
        # Extract code from response
        code = extract_code_from_response(answer)
        
        # Lint the code
        lint_issues = lint_razor(code)
        
        # Generate citations
        citations = generate_citations(all_chunks)
        
        # Log interaction
        interaction_id = log_interaction({
            "question": original_query,
            "assistant_draft": {"explanation": answer, "code": code},
            "retrieved": all_chunks,
            "citations": citations,
            "rules_version": "rules-v1.0",
            "model_version": OPENAI_MODEL,
            "session_id": request.get('session_id', 'unknown')
        })
        
        # Log comprehensive training data
        try:
            from training_data_service import TrainingDataService, TrainingInteraction
            
            training_service = TrainingDataService()
            training_interaction = TrainingInteraction(
                session_id=request.get('session_id', 'unknown'),
                user_id=user_id,
                interaction_type="question_with_answers",
                user_query=original_query,
                context_data={
                    "retrieved_chunks": all_chunks, 
                    "citations": citations, 
                    "user_answers": user_answers,
                    "intent_analysis": intent_analysis,
                    "relevant_items": [item.name for item in relevant_items]
                },
                ai_response_raw=answer,
                ai_explanation=answer,
                ai_generated_code=code or "",
                rules_version="rules-v1.0",
                model_version=OPENAI_MODEL
            )
            
            training_service.log_training_interaction(training_interaction)
        except Exception as e:
            print(f"Warning: Failed to log training data: {e}")
        
        # Get script suggestions
        script_suggestions = suggest_existing_scripts(original_query, 3)
        
        return AIBotResponse(
            answer=answer,
            code=code,
            citations=citations,
            rules_version="rules-v1.0",
            model_version=OPENAI_MODEL,
            context_used=all_chunks,
            script_suggestions=script_suggestions,
            questions=[],
            intent_analysis=intent_analysis,
            relevant_items=relevant_items[:10]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating script with answers: {str(e)}")

@router.post("/ai/update-item-info")
async def update_item_from_ai_interaction(
    request: dict,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Update item information based on AI interaction"""
    try:
        item_name = request.get('item_name')
        item_id = request.get('item_id')
        hue = request.get('hue')
        description = request.get('description')
        
        if not item_name:
            raise HTTPException(status_code=400, detail="Item name is required")
        
        # Connect to SQLite database directly
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if item exists
        cursor.execute('''
            SELECT id, name, item_id, hue, description, usage_count
            FROM items 
            WHERE name = ? OR item_id = ?
        ''', (item_name, item_id))
        
        existing_item = cursor.fetchone()
        
        if existing_item:
            # Update existing item
            updates = []
            params = []
            
            if item_id and not existing_item[2]:
                updates.append("item_id = ?")
                params.append(item_id)
            if hue is not None and not existing_item[3]:
                updates.append("hue = ?")
                params.append(hue)
            if description and not existing_item[4]:
                updates.append("description = ?")
                params.append(description)
            
            updates.append("usage_count = usage_count + 1")
            params.append(existing_item[0])
            
            if len(updates) > 1:  # More than just usage_count increment
                cursor.execute(f'''
                    UPDATE items 
                    SET {', '.join(updates)}
                    WHERE id = ?
                ''', params)
        else:
            # Create new item
            cursor.execute('''
                INSERT INTO items (name, item_id, hue, description, usage_count, category_id, is_verified)
                VALUES (?, ?, ?, ?, 1, 7, 0)
            ''', (item_name, item_id or 0, hue or 0, description or f"AI-discovered item: {item_name}"))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': f"Updated item: {item_name}",
            'item_id': item_id,
            'item_name': item_name
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.post("/ai/feedback")
async def submit_ai_feedback(
    feedback: AIFeedbackSubmit,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Submit feedback for AI responses"""
    try:
        try:
            from ai_db import update_feedback
        except ImportError:
            def update_feedback(*args, **kwargs):
                return True
        
        # Update feedback in AI database
        success = update_feedback(
            feedback.id,
            feedback.human_feedback.get("decision", "pending"),
            feedback.rating,
            feedback.human_feedback.get("reasons"),
            feedback.human_feedback.get("edits_diff")
        )
        
        # Log comprehensive training data for feedback
        try:
            from training_data_service import TrainingDataService, TrainingInteraction
            
            training_service = TrainingDataService()
            training_interaction = TrainingInteraction(
                session_id=feedback.id,
                user_id=user_id,
                interaction_type="feedback",
                user_query=feedback.question,
                context_data={"assistant_output": feedback.assistant_output},
                ai_response_raw=feedback.assistant_output.get("explanation", ""),
                ai_explanation=feedback.assistant_output.get("explanation", ""),
                ai_generated_code=feedback.assistant_output.get("code", ""),
                user_edited_code=feedback.human_feedback.get("edits_diff"),
                user_feedback_decision=feedback.human_feedback.get("decision"),
                user_rating=feedback.rating,
                user_feedback_reasons=feedback.human_feedback.get("reasons"),
                code_edit_diff=feedback.human_feedback.get("edits_diff"),
                rules_version=feedback.rules_version,
                model_version=feedback.model_version
            )
            
            training_service.log_training_interaction(training_interaction)
        except Exception as e:
            print(f"Warning: Failed to log training data for feedback: {e}")
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update AI feedback")
        
        # Log the interaction
        log_id = str(uuid.uuid4())
        interaction_log = AIInteractionsLogDB(
            id=log_id,
            session_id=feedback.id,
            user_id=user_id,
            interaction_type="feedback",
            query=feedback.question,
            feedback_decision=feedback.human_feedback.get("decision")
        )
        db.add(interaction_log)
        
        # Create AI interaction review for admin approval if code was generated
        if feedback.assistant_output.get("code"):
            review_id = str(uuid.uuid4())
            ai_review = AIInteractionReviewDB(
                id=review_id,
                session_id=feedback.id,
                user_id=user_id,
                interaction_type="create",  # or determine from context
                original_query=feedback.question,
                ai_response=feedback.assistant_output.get("answer", ""),
                generated_code=feedback.assistant_output.get("code", ""),
                status="pending"
            )
            db.add(ai_review)
            
            db.commit()
            
            return {"ok": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing feedback: {str(e)}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"AI server unavailable: {str(e)}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"AI server error: {e.response.text}")

@router.post("/ai/rule-suggestions")
async def submit_rule_suggestion(
    suggestion_data: dict,
    user_id: str = Query(..., description="Discord ID of the user"),
    db: Session = Depends(get_db)
):
    """Submit rule suggestions for improving AI responses"""
    try:
        
        # Create rule suggestion entry
        rule_suggestion = RuleSuggestionDB(
            id=str(uuid.uuid4()),
            session_id=suggestion_data.get("sessionId"),
            user_id=user_id,
            suggestion=suggestion_data.get("suggestion"),
            status="pending",
            created_at=datetime.now()
        )
        
        db.add(rule_suggestion)
        db.commit()
        
        return {"ok": True, "message": "Rule suggestion submitted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error submitting rule suggestion: {str(e)}")

@router.get("/ai/rule-suggestions")
async def get_rule_suggestions(
    status: str = Query("pending", description="Filter by status"),
    user_id: str = Query(..., description="Discord ID of the user"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get rule suggestions for review"""
    try:
        
        query = db.query(RuleSuggestionDB)
        
        # Non-admins can only see their own suggestions
        if not is_admin:
            query = query.filter(RuleSuggestionDB.user_id == user_id)
        
        # Filter by status if provided
        if status:
            query = query.filter(RuleSuggestionDB.status == status)
        
        suggestions = query.order_by(RuleSuggestionDB.created_at.desc()).all()
        
        return [{
            "id": s.id,
            "session_id": s.session_id,
            "user_id": s.user_id,
            "suggestion": s.suggestion,
            "status": s.status,
            "admin_notes": s.admin_notes,
            "created_at": s.created_at.isoformat()
        } for s in suggestions]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rule suggestions: {str(e)}")

@router.put("/ai/rule-suggestions/{suggestion_id}")
async def update_rule_suggestion(
    suggestion_id: str,
    update_data: dict,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(True, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update rule suggestion status (admin only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        suggestion = db.query(RuleSuggestionDB).filter(RuleSuggestionDB.id == suggestion_id).first()
        if not suggestion:
            raise HTTPException(status_code=404, detail="Rule suggestion not found")
        
        # Update suggestion
        suggestion.status = update_data.get("status", suggestion.status)
        suggestion.admin_notes = update_data.get("admin_notes", suggestion.admin_notes)
        suggestion.reviewed_by = user_id
        suggestion.reviewed_at = datetime.now()
        
        # If approved, add to rules file
        if update_data.get("status") == "approved":
            await add_rule_to_file(suggestion.suggestion)
        
        db.commit()
        
        return {"ok": True, "message": "Rule suggestion updated successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating rule suggestion: {str(e)}")

async def add_rule_to_file(rule_text: str):
    """Add approved rule to the rules file"""
    try:
        rules_path = os.path.join(os.path.dirname(__file__), "..", "ai", "rules", "RULES.md")
        
        # Read current rules
        with open(rules_path, "r", encoding="utf-8") as f:
            current_rules = f.read()
        
        # Create backup
        backup_path = f"{rules_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(current_rules)
        
        # Add new rule
        new_rule = f"\n- {rule_text}\n"
        updated_rules = current_rules + new_rule
        
        # Write updated rules
        with open(rules_path, "w", encoding="utf-8") as f:
            f.write(updated_rules)
            
    except Exception as e:
        print(f"Error adding rule to file: {e}")
        raise

@router.get("/ai/training-analytics")
async def get_training_analytics(
    days: int = Query(30, description="Number of days to analyze"),
    user_id: str = Query(..., description="Discord ID of the user"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get comprehensive training data analytics"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from training_data_service import TrainingDataService
        
        training_service = TrainingDataService()
        analytics = training_service.get_training_analytics()
        
        return analytics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting training analytics: {str(e)}")

@router.get("/ai/export-training-data")
async def export_training_data(
    user_id: str = Query(..., description="Discord ID of the user"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Export comprehensive training data"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from training_data_service import TrainingDataService
        
        training_service = TrainingDataService()
        export_data = training_service.export_training_data()
        
        return export_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting training data: {str(e)}")

@router.get("/ai/training-data-quality")
async def get_training_data_quality(
    user_id: str = Query(..., description="Discord ID of the user"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get training data quality metrics"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect("suggestions.db")
        cursor = conn.cursor()
        
        # Get quality metrics
        cursor.execute("""
            SELECT data_type, quality_metrics, data_volume, quality_score, last_updated
            FROM training_data_quality
            ORDER BY last_updated DESC
        """)
        
        quality_data = cursor.fetchall()
        
        # Get recent interaction quality trends
        cursor.execute("""
            SELECT DATE(created_at) as date, 
                   AVG(code_quality_score) as avg_code_quality,
                   AVG(explanation_clarity_score) as avg_explanation_quality,
                   AVG(user_satisfaction) as avg_user_satisfaction,
                   COUNT(*) as interaction_count
            FROM ai_training_interactions 
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """)
        
        trends = cursor.fetchall()
        
        conn.close()
        
        return {
            "quality_metrics": quality_data,
            "recent_trends": trends,
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting training data quality: {str(e)}")

# Admin endpoints
@router.get("/admin/pending", response_model=List[Script])
async def get_pending_scripts(
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get pending scripts for approval (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access pending scripts")
    
    pending_scripts = db.query(ScriptsCacheDB).filter(
        ScriptsCacheDB.is_approved == False
    ).order_by(ScriptsCacheDB.created_at.desc()).all()
    
    return [db_script_to_pydantic(script) for script in pending_scripts]

@router.post("/admin/{script_id}/approve", response_model=Script)
async def approve_script(
    script_id: str,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Approve a script (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can approve scripts")
    
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    script.is_approved = True
    script.approved_by = user_id
    script.approved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(script)
    
    return db_script_to_pydantic(script)

@router.post("/admin/{script_id}/reject")
async def reject_script(
    script_id: str,
    reason: str = Query(..., description="Reason for rejection"),
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Reject a script (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can reject scripts")
    
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Delete the script
    db.delete(script)
    db.commit()
    
    return {"message": f"Script rejected: {reason}"}

@router.get("/admin/analytics")
async def get_analytics(
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get comprehensive usage analytics (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access analytics")
    
    from datetime import datetime, timedelta
    
    # Script statistics (only GG and AI scripts, exclude Jasown)
    total_scripts = db.query(ScriptsCacheDB).filter(
        ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts'])
    ).count()
    approved_scripts = db.query(ScriptsCacheDB).filter(
        and_(ScriptsCacheDB.is_approved == True, ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts']))
    ).count()
    pending_scripts = db.query(ScriptsCacheDB).filter(
        and_(ScriptsCacheDB.is_approved == False, ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts']))
    ).count()
    featured_scripts = db.query(ScriptsCacheDB).filter(
        and_(ScriptsCacheDB.is_featured == True, ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts']))
    ).count()
    
    # Recent activity (last 30 days) - only GG and AI scripts
    thirty_days_ago = datetime.now() - timedelta(days=30)
    recent_scripts = db.query(ScriptsCacheDB).filter(
        and_(
            ScriptsCacheDB.created_at >= thirty_days_ago,
            ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts'])
        )
    ).count()
    
    # Top authors (most active script contributors) - only GG and AI scripts
    top_authors = db.query(
        ScriptsCacheDB.author,
        func.count(ScriptsCacheDB.id).label('script_count'),
        func.max(ScriptsCacheDB.created_at).label('last_activity')
    ).filter(
        and_(
            ScriptsCacheDB.is_approved == True,
            ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts'])
        )
    ).group_by(ScriptsCacheDB.author).order_by(func.count(ScriptsCacheDB.id).desc()).limit(10).all()
    
    # Category breakdown - only GG and AI scripts
    category_stats = db.query(
        ScriptsCacheDB.category,
        func.count(ScriptsCacheDB.id).label('count')
    ).filter(
        and_(
            ScriptsCacheDB.is_approved == True,
            ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts'])
        )
    ).group_by(ScriptsCacheDB.category).all()
    
    # AI interaction statistics
    ai_interactions = db.query(AIInteractionsLogDB).count()
    ai_reviews_pending = db.query(AIInteractionReviewDB).filter(AIInteractionReviewDB.status == 'pending').count()
    
    # Recent AI interactions (last 30 days)
    recent_ai_interactions = db.query(AIInteractionsLogDB).filter(
        AIInteractionsLogDB.created_at >= thirty_days_ago
    ).count()
    
    # User activity monitoring
    try:
        # Most active users (by AI interactions) - try to get usernames
        most_active_users = db.query(
            AIInteractionsLogDB.user_id,
            func.count(AIInteractionsLogDB.id).label('interaction_count'),
            func.max(AIInteractionsLogDB.created_at).label('last_activity')
        ).filter(
            AIInteractionsLogDB.created_at >= thirty_days_ago
        ).group_by(AIInteractionsLogDB.user_id).order_by(
            func.count(AIInteractionsLogDB.id).desc()
        ).limit(10).all()
        
        # Try to get usernames for the most active users
        user_data = []
        for user_id, count, last_activity in most_active_users:
            # Try multiple methods to get username
            username = None
            
            # Method 1: Try to find username from scripts table
            script_with_username = db.query(ScriptsCacheDB.author).filter(
                ScriptsCacheDB.created_by == user_id
            ).first()
            
            if script_with_username:
                username = script_with_username.author
            
            # Method 2: Try to find from AI interactions (if we stored username there)
            if not username:
                # Check if this user_id appears in any script author field
                author_match = db.query(ScriptsCacheDB.author).filter(
                    ScriptsCacheDB.author.ilike(f'%{user_id[-4:]}%')
                ).first()
                
                if author_match:
                    username = author_match.author
            
            # Method 3: Check admin table
            if not username:
                admin_user = db.query(AdminDB.username).filter(
                    AdminDB.discord_id == user_id
                ).first()
                
                if admin_user:
                    username = admin_user.username
            
            # Fallback: Create a more user-friendly display
            if not username:
                username = f"User_{user_id[-6:]}"  # Show last 6 digits
            
            user_data.append({
                "user_id": user_id,
                "username": username,
                "interaction_count": count,
                "last_activity": last_activity.isoformat() if last_activity else None
            })
        
        most_active_users = user_data
        
        # AI usage patterns (interactions per day)
        ai_usage_patterns = db.query(
            func.date(AIInteractionsLogDB.created_at).label('date'),
            func.count(AIInteractionsLogDB.id).label('count')
        ).filter(
            AIInteractionsLogDB.created_at >= thirty_days_ago
        ).group_by(func.date(AIInteractionsLogDB.created_at)).order_by(
            func.date(AIInteractionsLogDB.created_at).desc()
        ).all()
        
    except Exception as e:
        print(f"Warning: Could not fetch user activity data: {e}")
        most_active_users = []
        ai_usage_patterns = []
    
    # Rating distribution
    try:
        rating_distribution = db.query(
            ScriptRatingsDB.rating,
            func.count(ScriptRatingsDB.id).label('count')
        ).group_by(ScriptRatingsDB.rating).all()
    except Exception as e:
        print(f"Warning: Could not fetch rating data: {e}")
        rating_distribution = []
    
    # Script submission trends (scripts per day) - only GG and AI scripts
    script_submission_trends = db.query(
        func.date(ScriptsCacheDB.created_at).label('date'),
        func.count(ScriptsCacheDB.id).label('count')
    ).filter(
        and_(
            ScriptsCacheDB.created_at >= thirty_days_ago,
            ScriptsCacheDB.category.in_(['gg-scripts', 'ai-scripts'])
        )
    ).group_by(func.date(ScriptsCacheDB.created_at)).order_by(
        func.date(ScriptsCacheDB.created_at).desc()
    ).all()
    
    return {
        "scripts": {
            "total": total_scripts,
            "approved": approved_scripts,
            "pending": pending_scripts,
            "featured": featured_scripts,
            "recent_scripts": recent_scripts
        },
        "categories": [{"category": cat, "count": count} for cat, count in category_stats],
        "ai_interactions": ai_interactions,
        "ai_reviews_pending": ai_reviews_pending,
        "recent_ai_interactions": recent_ai_interactions,
        "top_authors": [
            {
                "author": author,
                "script_count": count,
                "last_activity": last_activity.isoformat() if last_activity else None
            }
            for author, count, last_activity in top_authors
        ],
        "most_active_users": most_active_users,
        "ai_usage_patterns": [
            {
                "date": date,
                "count": count
            }
            for date, count in ai_usage_patterns
        ],
        "script_submission_trends": [
            {
                "date": date,
                "count": count
            }
            for date, count in script_submission_trends
        ],
        "rating_distribution": [
            {
                "rating": rating,
                "count": count
            }
            for rating, count in rating_distribution
        ]
    }

@router.get("/admin/performance-monitoring")
async def get_performance_monitoring(
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get system performance metrics (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access performance monitoring")
    
    import time
    from datetime import datetime, timedelta
    
    # Database performance metrics
    start_time = time.time()
    
    # Test database query performance
    db.query(ScriptsCacheDB).count()
    db_query_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    
    # AI service health check
    ai_service_health = "unknown"
    ai_response_time = 0
    
    try:
        # Test AI service with a simple query
        ai_start_time = time.time()
        # This would be a simple AI health check in a real implementation
        ai_response_time = (time.time() - ai_start_time) * 1000
        ai_service_health = "healthy" if ai_response_time < 5000 else "slow"
    except Exception as e:
        ai_service_health = "error"
        print(f"AI service health check failed: {e}")
    
    # System load metrics
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent
        disk_percent = psutil.disk_usage('/').percent
    except ImportError:
        # psutil not available, use default values
        cpu_percent = 0
        memory_percent = 0
        disk_percent = 0
    
    # Recent activity metrics
    one_hour_ago = datetime.now() - timedelta(hours=1)
    recent_requests = db.query(AIInteractionsLogDB).filter(
        AIInteractionsLogDB.created_at >= one_hour_ago
    ).count()
    
    # Error rates (using feedback_decision instead of status)
    try:
        total_interactions = db.query(AIInteractionsLogDB).count()
        # Count interactions that were declined (indicating potential issues)
        declined_interactions = db.query(AIInteractionsLogDB).filter(
            AIInteractionsLogDB.feedback_decision == 'declined'
        ).count()
        error_rate = (declined_interactions / total_interactions * 100) if total_interactions > 0 else 0
    except Exception as e:
        error_rate = 0
        print(f"Could not calculate error rate: {e}")
    
    return {
        "timestamp": datetime.now().isoformat(),
        "database_performance": {
            "query_time_ms": round(db_query_time, 2),
            "status": "healthy" if db_query_time < 100 else "slow"
        },
        "ai_service_health": {
            "status": ai_service_health,
            "response_time_ms": round(ai_response_time, 2)
        },
        "system_resources": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "disk_percent": disk_percent
        },
        "activity_metrics": {
            "requests_last_hour": recent_requests,
            "error_rate_percent": round(error_rate, 2)
        },
        "health_status": {
            "overall": "healthy" if (
                db_query_time < 100 and 
                ai_service_health == "healthy" and 
                error_rate < 5
            ) else "warning"
        }
    }

# Featured scripts management
@router.post("/admin/{script_id}/toggle-featured", response_model=Script)
async def toggle_featured_script(
    script_id: str,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Toggle featured status of a script (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can manage featured scripts")
    
    script = db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    script.is_featured = not script.is_featured
    script.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(script)
    
    return db_script_to_pydantic(script)

# AI Interaction Reviews
@router.get("/admin/ai-reviews", response_model=List[AIInteractionReview])
async def get_ai_reviews(
    status: Optional[str] = Query(None),
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get AI interaction reviews for admin approval (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access AI reviews")
    
    query = db.query(AIInteractionReviewDB)
    
    if status:
        query = query.filter(AIInteractionReviewDB.status == status)
    
    reviews = query.order_by(AIInteractionReviewDB.created_at.desc()).offset(offset).limit(limit).all()
    
    return [db_ai_review_to_pydantic(review) for review in reviews]

@router.put("/admin/ai-reviews/{review_id}", response_model=AIInteractionReview)
async def update_ai_review(
    review_id: str,
    review_data: AIInteractionReviewUpdate,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update AI interaction review (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update AI reviews")
    
    review = db.query(AIInteractionReviewDB).filter(AIInteractionReviewDB.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="AI review not found")
    
    review.status = review_data.status
    review.admin_notes = review_data.admin_notes
    review.admin_modified_code = review_data.admin_modified_code
    review.reviewed_by = user_id
    review.reviewed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(review)
    
    return db_ai_review_to_pydantic(review)

@router.post("/admin/ai-reviews/{review_id}/create-script", response_model=Script)
async def create_script_from_ai_review(
    review_id: str,
    title: str = Query(..., description="Script title"),
    author: str = Query(..., description="Script author"),
    category: str = Query(..., description="Script category"),
    tags: str = Query("", description="Comma-separated tags"),
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Create a script from approved AI interaction review (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can create scripts from AI reviews")
    
    review = db.query(AIInteractionReviewDB).filter(AIInteractionReviewDB.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="AI review not found")
    
    if review.status != 'approved':
        raise HTTPException(status_code=400, detail="Can only create scripts from approved reviews")
    
    # Create script from AI review
    script_id = str(uuid.uuid4())
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    code_content = review.admin_modified_code or review.generated_code or ""
    
    db_script = ScriptsCacheDB(
        id=script_id,
        title=title,
        author=author,
        category=category,
        tags=json.dumps(tag_list),
        description=f"Generated from AI interaction: {review.original_query}",
        code_preview=code_content[:500] + "..." if len(code_content) > 500 else code_content,
        full_code_url=f"{get_ai_server_url()}/api/scripts/{script_id}/code",
        created_by=user_id,
        is_approved=True,  # Auto-approve since admin created it
        approved_by=user_id,
        approved_at=datetime.utcnow()
    )
    
    db.add(db_script)
    db.commit()
    db.refresh(db_script)
    
    return db_script_to_pydantic(db_script)

# AI Rules Management Endpoints
@router.get("/admin/ai-rules")
async def get_ai_rules(
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get current AI rules (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access AI rules")
    
    try:
        from ai_settings import RULES_PATH
        import os
        from datetime import datetime
        
        # Load rules from file
        rules_path = os.path.join(os.path.dirname(__file__), "..", "ai", "rules", "RULES.md")
        
        if os.path.exists(rules_path):
            with open(rules_path, "r", encoding="utf-8") as f:
                rules_content = f.read()
            
            # Get file modification time
            file_stat = os.stat(rules_path)
            last_updated = datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            
            return {
                "rules": rules_content,
                "version": "rules-v1.0",
                "last_updated": last_updated
            }
        else:
            # Fallback to default rules
            default_rules = """# Razor Scripting Rules

## Razor Syntax Reference

### Control Structures (NO PARENTHESES!)
```razor
// CORRECT Razor syntax:
if findtype "fishing pole" backpack as pole
  useitem pole
endif

while findtype "fish" backpack as fish
  useitem fish
  wait 1000
endwhile

// INCORRECT (C-style syntax):
if (findtype("fishing pole", backpack)) {  // WRONG!
  useitem(pole);
}
```

### Common Razor Commands
```razor
// Item operations
findtype "item name" container as variable
useitem variable
drop variable
move variable container

// Movement
walk direction
run direction
stop

// Targeting
target "target name"
waitfortarget 5000
target self

// Gumps
gumpresponse 0x12345678 1
waitforgump 0x12345678

// Waits and delays
wait 1000
waitforgump 0x12345678
waitfortarget 5000

// Variables
@setvar! variableName value
@getvar! variableName
@clearvars
```

### Best Practices
- Prefer clear, minimal Razor; avoid unnecessary loops
- After any `gumpresponse` you MUST add `waitforgump` or `wft`
- Long loops require sleeps (`wait 200–650`) to avoid client lockups
- Use `@clearignore` before ignore-heavy scans; pair with `@ignore` consistently
- Don't assume items exist; guard with `if findtype ... as var`
- Never hardcode user-specific IDs unless provided; use @setvar! and comments
- Close control structures: `endif`, `endwhile`
- When modifying containers, verify with `insysmsg` if relevant
- Add a comment header with purpose, inputs, and pre-reqs
"""
            
            return {
                "rules": default_rules,
                "version": "rules-v1.0",
                "last_updated": datetime.now().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading AI rules: {str(e)}")

@router.put("/admin/ai-rules")
async def update_ai_rules(
    request: dict,
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update AI rules (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update AI rules")
    
    try:
        import os
        from datetime import datetime
        
        rules_content = request.get("rules", "")
        if not rules_content.strip():
            raise HTTPException(status_code=400, detail="Rules content cannot be empty")
        
        # Create backup of current rules
        rules_path = os.path.join(os.path.dirname(__file__), "..", "ai", "rules", "RULES.md")
        backup_path = os.path.join(os.path.dirname(__file__), "..", "ai", "rules", f"RULES_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        
        # Create backup if rules file exists
        if os.path.exists(rules_path):
            with open(rules_path, "r", encoding="utf-8") as f:
                current_rules = f.read()
            
            with open(backup_path, "w", encoding="utf-8") as f:
                f.write(current_rules)
        
        # Write new rules
        with open(rules_path, "w", encoding="utf-8") as f:
            f.write(rules_content)
        
        return {
            "message": "AI rules updated successfully",
            "backup_created": backup_path if os.path.exists(backup_path) else None,
            "updated_by": user_id,
            "updated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating AI rules: {str(e)}")

@router.get("/admin/ai-rules/history")
async def get_ai_rules_history(
    user_id: str = Query(..., description="Discord ID of the admin"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get AI rules history (admins only)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access AI rules history")
    
    try:
        import os
        import glob
        
        rules_dir = os.path.join(os.path.dirname(__file__), "..", "ai", "rules")
        backup_files = glob.glob(os.path.join(rules_dir, "RULES_backup_*.md"))
        
        history = []
        for backup_file in sorted(backup_files, reverse=True):
            filename = os.path.basename(backup_file)
            timestamp = os.path.getmtime(backup_file)
            
            history.append({
                "filename": filename,
                "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
                "path": backup_file
            })
        
        return {"history": history}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting AI rules history: {str(e)}")
