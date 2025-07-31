from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text
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
    added_by = Column(String, nullable=False)  # Discord ID of who added this admin
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database on import
create_tables()
