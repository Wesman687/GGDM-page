"""
Database Migration: Add Companion Scripts Support

Adds fields to support linking related scripts together:
- parent_script_id: Links companion script to its main script
- is_companion: Marks script as a companion (won't show in main listings)
- execution_order: Orders multiple companion scripts (1, 2, 3, etc.)
"""

import sqlite3
from datetime import datetime

def migrate():
    """Add companion scripts fields to scripts_cache table"""
    
    conn = sqlite3.connect('suggestions.db')
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(scripts_cache)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add parent_script_id if not exists
        if 'parent_script_id' not in columns:
            print("Adding parent_script_id column...")
            cursor.execute('''
                ALTER TABLE scripts_cache 
                ADD COLUMN parent_script_id VARCHAR
            ''')
            print("✓ Added parent_script_id column")
        else:
            print("⚠ parent_script_id column already exists")
        
        # Add is_companion if not exists
        if 'is_companion' not in columns:
            print("Adding is_companion column...")
            cursor.execute('''
                ALTER TABLE scripts_cache 
                ADD COLUMN is_companion BOOLEAN DEFAULT FALSE
            ''')
            print("✓ Added is_companion column")
        else:
            print("⚠ is_companion column already exists")
        
        # Add execution_order if not exists
        if 'execution_order' not in columns:
            print("Adding execution_order column...")
            cursor.execute('''
                ALTER TABLE scripts_cache 
                ADD COLUMN execution_order INTEGER
            ''')
            print("✓ Added execution_order column")
        else:
            print("⚠ execution_order column already exists")
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(scripts_cache)")
        all_columns = cursor.fetchall()
        
        print("\n✓ Migration complete!")
        print(f"\nTotal columns in scripts_cache: {len(all_columns)}")
        
        # Show new columns
        print("\nNew companion script columns:")
        for col in all_columns:
            if col[1] in ['parent_script_id', 'is_companion', 'execution_order']:
                print(f"  - {col[1]}: {col[2]}")
        
        conn.commit()
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("COMPANION SCRIPTS MIGRATION")
    print("=" * 60)
    print()
    migrate()
    print()
    print("=" * 60)

