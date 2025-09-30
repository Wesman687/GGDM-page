#!/usr/bin/env python3
"""
Migration script to convert existing suggestions.json to SQLite database
Run this if you have existing suggestions in the old JSON format
"""

import json
import os
import sys
from datetime import datetime
from database import SessionLocal, SuggestionDB, create_tables

def migrate_json_to_db():
    """Migrate suggestions from JSON file to SQLite database"""
    
    # Check if suggestions.json exists
    json_file = "suggestions.json"
    if not os.path.exists(json_file):
        print("✅ No suggestions.json found - starting with clean database")
        return
    
    print(f"📁 Found {json_file}, migrating to database...")
    
    # Load existing JSON data
    try:
        with open(json_file, 'r') as f:
            suggestions = json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON file: {e}")
        return
    
    if not suggestions:
        print("✅ No suggestions to migrate")
        return
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Check if we already have data in the database
        existing_count = db.query(SuggestionDB).count()
        if existing_count > 0:
            print(f"⚠️  Database already has {existing_count} suggestions")
            response = input("Do you want to continue? This might create duplicates. (y/N): ")
            if response.lower() != 'y':
                print("❌ Migration cancelled")
                return
        
        # Migrate each suggestion
        migrated_count = 0
        for suggestion_data in suggestions:
            try:
                # Parse datetime fields
                created_at = None
                if suggestion_data.get("created_at"):
                    try:
                        created_at = datetime.fromisoformat(suggestion_data["created_at"].replace('Z', '+00:00'))
                    except:
                        created_at = datetime.utcnow()
                
                reviewed_at = None
                if suggestion_data.get("reviewed_at"):
                    try:
                        reviewed_at = datetime.fromisoformat(suggestion_data["reviewed_at"].replace('Z', '+00:00'))
                    except:
                        pass
                
                # Create database record
                db_suggestion = SuggestionDB(
                    id=suggestion_data.get("id"),
                    action=suggestion_data.get("action"),
                    zone_id=suggestion_data.get("zone_id"),
                    x=suggestion_data.get("x"),
                    y=suggestion_data.get("y"),
                    map=suggestion_data.get("map"),
                    enabled=suggestion_data.get("enabled", True),
                    reason=suggestion_data.get("reason", ""),
                    submitter_name=suggestion_data.get("submitter_name"),
                    submitter_discord=suggestion_data.get("submitter_discord"),
                    status=suggestion_data.get("status", "pending"),
                    created_at=created_at or datetime.utcnow(),
                    reviewed_at=reviewed_at,
                    reviewed_by=suggestion_data.get("reviewed_by"),
                    admin_notes=suggestion_data.get("admin_notes"),
                    pr_url=suggestion_data.get("pr_url"),
                    pr_number=suggestion_data.get("pr_number")
                )
                
                db.add(db_suggestion)
                migrated_count += 1
                
            except Exception as e:
                print(f"⚠️  Error migrating suggestion {suggestion_data.get('id', 'unknown')}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        print(f"✅ Successfully migrated {migrated_count} suggestions to database")
        
        # Backup the original JSON file
        backup_file = f"{json_file}.backup"
        try:
            os.rename(json_file, backup_file)
            print(f"📦 Original file backed up as {backup_file}")
        except Exception as e:
            print(f"⚠️  Could not backup original file: {e}")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Dockmaster Suggestion Portal - Database Migration")
    print("=" * 50)
    
    # Ensure tables exist
    create_tables()
    
    # Run migration
    migrate_json_to_db()
    
    print("✅ Migration complete!")
