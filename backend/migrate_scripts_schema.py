#!/usr/bin/env python3
"""
Migration script to add new columns to existing scripts_cache table
"""

import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment or default to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./suggestions.db")

# Extract SQLite file path from URL
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
else:
    print("This migration script only works with SQLite databases")
    exit(1)

def migrate_database():
    """Add new columns to existing tables"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if new columns already exist
        cursor.execute("PRAGMA table_info(scripts_cache)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add is_featured column if it doesn't exist
        if 'is_featured' not in columns:
            print("Adding is_featured column to scripts_cache table...")
            cursor.execute("ALTER TABLE scripts_cache ADD COLUMN is_featured BOOLEAN DEFAULT FALSE")
            print("✓ Added is_featured column")
        else:
            print("✓ is_featured column already exists")
        
        # Add rejection_reason column if it doesn't exist
        if 'rejection_reason' not in columns:
            print("Adding rejection_reason column to scripts_cache table...")
            cursor.execute("ALTER TABLE scripts_cache ADD COLUMN rejection_reason TEXT")
            print("✓ Added rejection_reason column")
        else:
            print("✓ rejection_reason column already exists")
        
        # Create ai_interaction_reviews table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_interaction_reviews (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                interaction_type TEXT NOT NULL,
                original_query TEXT NOT NULL,
                ai_response TEXT NOT NULL,
                generated_code TEXT,
                status TEXT DEFAULT 'pending',
                admin_notes TEXT,
                admin_modified_code TEXT,
                reviewed_by TEXT,
                reviewed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✓ Created ai_interaction_reviews table")
        
        conn.commit()
        print("\n🎉 Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting database migration...")
    migrate_database()
