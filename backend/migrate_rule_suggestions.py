#!/usr/bin/env python3
"""
Migration script to add rule_suggestions table
"""

import sqlite3
import os
from datetime import datetime

def migrate_rule_suggestions():
    """Add rule_suggestions table to the database"""
    
    # Database path
    db_path = "suggestions.db"
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found. Please run the main application first.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='rule_suggestions'
        """)
        
        if cursor.fetchone():
            print("rule_suggestions table already exists. Skipping migration.")
            return
        
        # Create rule_suggestions table
        cursor.execute("""
            CREATE TABLE rule_suggestions (
                id VARCHAR PRIMARY KEY,
                session_id VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL,
                suggestion TEXT NOT NULL,
                status VARCHAR DEFAULT 'pending',
                admin_notes TEXT,
                reviewed_by VARCHAR,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("CREATE INDEX idx_rule_suggestions_status ON rule_suggestions(status)")
        cursor.execute("CREATE INDEX idx_rule_suggestions_user_id ON rule_suggestions(user_id)")
        cursor.execute("CREATE INDEX idx_rule_suggestions_created_at ON rule_suggestions(created_at)")
        
        conn.commit()
        print("✅ Successfully created rule_suggestions table with indexes")
        
    except Exception as e:
        print(f"❌ Error creating rule_suggestions table: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_rule_suggestions()
