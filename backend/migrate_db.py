"""
Database migration script to add new PR tracking fields and admins table
"""
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./suggestions.db")

def migrate_database():
    # Extract the SQLite file path from the URL
    db_path = DATABASE_URL.replace("sqlite:///", "")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if the new columns already exist in suggestions table
        cursor.execute("PRAGMA table_info(suggestions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'pr_error' not in columns:
            print("Adding pr_error column...")
            cursor.execute("ALTER TABLE suggestions ADD COLUMN pr_error TEXT")
        
        if 'pr_retry_count' not in columns:
            print("Adding pr_retry_count column...")
            cursor.execute("ALTER TABLE suggestions ADD COLUMN pr_retry_count INTEGER DEFAULT 0")
        
        # Check if admins table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'")
        if not cursor.fetchone():
            print("Creating admins table...")
            cursor.execute("""
                CREATE TABLE admins (
                    discord_id VARCHAR PRIMARY KEY,
                    username VARCHAR NOT NULL,
                    added_by VARCHAR NOT NULL,
                    added_at DATETIME NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1
                )
            """)
            cursor.execute("CREATE INDEX ix_admins_discord_id ON admins (discord_id)")
        
        conn.commit()
        print("Database migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
