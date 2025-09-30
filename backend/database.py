from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment or default to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./suggestions.db")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Database Models
class SuggestionDB(Base):
    __tablename__ = "suggestions"
    
    id = Column(String, primary_key=True, index=True)
    action = Column(String, nullable=False)  # 'add' or 'remove'
    zone_id = Column(String, nullable=False)
    x = Column(Integer, nullable=True)
    y = Column(Integer, nullable=True)
    map = Column(Integer, nullable=True)
    enabled = Column(Boolean, default=True)
    reason = Column(Text, nullable=False)
    submitter_name = Column(String, nullable=True)
    submitter_discord = Column(String, nullable=True)
    status = Column(String, default="pending")  # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String, nullable=True)
    admin_notes = Column(Text, nullable=True)
    pr_url = Column(String, nullable=True)
    pr_number = Column(Integer, nullable=True)
    pr_error = Column(Text, nullable=True)  # Store PR creation error
    pr_retry_count = Column(Integer, default=0)  # Track retry attempts

class AdminDB(Base):
    __tablename__ = "admins"
    
    discord_id = Column(String, primary_key=True, index=True)
    username = Column(String, nullable=False)
    added_by = Column(String, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class DockmasterDB(Base):
    __tablename__ = "dockmasters"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    zone_id = Column(String, nullable=False, index=True)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    map = Column(Integer, nullable=False)
    enabled = Column(Boolean, default=True)
    is_reference_point = Column(Boolean, default=False)
    added_by = Column(String, nullable=False)  # Discord ID of who added this admin
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

# Scripts-related models
class ScriptsCacheDB(Base):
    __tablename__ = "scripts_cache"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    category = Column(String, nullable=False)  # 'gg-scripts', 'jasown-scripts', 'ai-scripts'
    language = Column(String, nullable=False)  # 'razor', 'python'
    tags = Column(Text)  # JSON array: ["fishing", "boating", "dungeon", "pvp"]
    description = Column(Text)
    code_preview = Column(Text)  # First 500 chars for listing
    full_code = Column(Text)  # Full script code for editing
    full_code_url = Column(String)  # URL to AI server for full code
    exe_download_url = Column(String)  # Optional .exe download URL
    rating_average = Column(Float, default=0)
    rating_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)
    is_approved = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)  # Admin can flag as featured/top script
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)  # Discord ID
    approved_by = Column(String)  # Admin Discord ID
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)  # Reason for rejection if rejected

class ScriptRatingsDB(Base):
    __tablename__ = "script_ratings"
    
    id = Column(String, primary_key=True, index=True)
    script_id = Column(String, ForeignKey("scripts_cache.id"), nullable=False)
    user_id = Column(String, nullable=False)  # Discord ID
    rating = Column(Integer, nullable=False)  # 1-5 stars
    review = Column(Text)
    weight = Column(Integer, default=1)  # Weight for this rating (1 for user ratings, 5 for Jasown)
    is_jasown_rating = Column(Boolean, default=False)  # Whether this is a Jasown pre-made rating
    created_at = Column(DateTime, default=datetime.utcnow)

class AIInteractionsLogDB(Base):
    __tablename__ = "ai_interactions_log"
    
    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    interaction_type = Column(String, nullable=False)  # 'search', 'create', 'modify', 'explain'
    query = Column(Text, nullable=False)
    response_length = Column(Integer)
    processing_time_ms = Column(Integer)
    feedback_decision = Column(String)  # 'approved', 'declined', 'edited'
    created_at = Column(DateTime, default=datetime.utcnow)

class ScriptTagsConfigDB(Base):
    __tablename__ = "script_tags_config"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tag_name = Column(String, nullable=False, unique=True)
    tag_color = Column(String, default='#3b82f6')  # Hex color
    tag_category = Column(String, default='general')  # 'activity', 'location', 'skill', 'general'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIInteractionReviewDB(Base):
    __tablename__ = "ai_interaction_reviews"
    
    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False)  # Links to AI interaction
    user_id = Column(String, nullable=False)  # Discord ID of user who made the request
    interaction_type = Column(String, nullable=False)  # 'create', 'edit', 'explain'
    original_query = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)  # Full AI response
    generated_code = Column(Text)  # Code generated by AI
    status = Column(String, default='pending')  # 'pending', 'approved', 'rejected', 'modified'
    admin_notes = Column(Text)  # Admin review notes
    admin_modified_code = Column(Text)  # Code after admin modifications
    reviewed_by = Column(String)  # Admin Discord ID
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

# AI System Tables
class RAGChunksDB(Base):
    __tablename__ = "rag_chunks"
    
    id = Column(String, primary_key=True)
    source = Column(String)  # 'script', 'docs', 'rules'
    title = Column(String)
    url = Column(String)
    text = Column(Text, nullable=False)
    meta = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

class InteractionsDB(Base):
    __tablename__ = "interactions"
    
    id = Column(String, primary_key=True)
    question = Column(Text, nullable=False)
    assistant_draft = Column(Text, nullable=False)
    retrieved = Column(Text, nullable=False)
    citations = Column(Text, nullable=False)
    decision = Column(String, default="pending")
    rating = Column(Integer)
    reasons = Column(Text)
    edits_diff = Column(Text)
    rules_version = Column(String, default="rules-v1.0")
    model_version = Column(String, default="gpt-4o-mini")
    session_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)
    initialize_default_tags()

def initialize_default_tags():
    """Initialize default tags if they don't exist"""
    db = SessionLocal()
    try:
        # Check if tags already exist
        existing_tags = db.query(ScriptTagsConfigDB).first()
        if existing_tags:
            return  # Tags already initialized
        
        # Insert default tags
        default_tags = [
            ('fishing', '#22c55e', 'activity'),
            ('boating', '#3b82f6', 'activity'),
            ('dungeon', '#ef4444', 'location'),
            ('pvp', '#f59e0b', 'activity'),
            ('mining', '#8b5cf6', 'activity'),
            ('healing', '#06b6d4', 'skill'),
            ('magery', '#ec4899', 'skill'),
            ('thieving', '#84cc16', 'skill'),
            ('taming', '#f97316', 'skill'),
            ('crafting', '#6366f1', 'skill'),
            ('snippet', '#10b981', 'general'),
            ('utility', '#8b5cf6', 'general'),
            ('automation', '#f59e0b', 'general'),
            ('wildlands', '#ef4444', 'location'),
            ('stream', '#06b6d4', 'general')
        ]
        
        for tag_name, tag_color, tag_category in default_tags:
            tag = ScriptTagsConfigDB(
                tag_name=tag_name,
                tag_color=tag_color,
                tag_category=tag_category
            )
            db.add(tag)
        
        db.commit()
    except Exception as e:
        print(f"Error initializing default tags: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database on import
create_tables()
