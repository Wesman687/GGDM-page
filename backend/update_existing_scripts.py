#!/usr/bin/env python3
"""
Update existing scripts to have proper categorization and cleaned up tags
"""

import asyncio
import sys
from pathlib import Path
from script_manager import ScriptManager, load_scripts_from_jsonl
from database import get_db, ScriptsCacheDB

async def main():
    # Get file path from command line or use default
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "new_scripts.jsonl"  # Default to new_scripts.jsonl
    
    # Check if file exists
    if not Path(file_path).exists():
        print(f"Error: File '{file_path}' not found")
        print("Usage: python update_existing_scripts.py [jsonl_file_path]")
        return
    
    print(f"Processing scripts from: {file_path}")
    
    # Load scripts from file
    scripts_data = load_scripts_from_jsonl(file_path)
    if not scripts_data:
        print("No scripts found in file")
        return
    
    print(f"Found {len(scripts_data)} scripts in file")
    
    # Get database session
    db = next(get_db())
    
    try:
        # Get existing scripts
        existing_scripts = db.query(ScriptsCacheDB).all()
        print(f"Found {len(existing_scripts)} existing scripts in database")
        
        # Create a mapping of URL to script data for quick lookup
        url_to_script_data = {}
        for script_data in scripts_data:
            url = script_data.get('url', '')
            if url:
                url_to_script_data[url] = script_data
        
        updated_count = 0
        
        # Update existing scripts
        for script in existing_scripts:
            if script.full_code_url in url_to_script_data:
                script_data = url_to_script_data[script.full_code_url]
                
                # Update category to Jasown Scripts
                script.category = 'Jasown Scripts'
                
                # Clean up tags - limit to essential ones
                tags_list = script_data.get('tags', [])
                if tags_list:
                    essential_tags = []
                    seen_tags = set()
                    for tag in tags_list:
                        tag_lower = tag.lower().strip()
                        if tag_lower not in seen_tags and len(essential_tags) < 3:  # Limit to 3 tags max
                            essential_tags.append(tag)
                            seen_tags.add(tag_lower)
                    script.tags = ','.join(essential_tags)
                else:
                    script.tags = ''
                
                updated_count += 1
        
        db.commit()
        print(f"\n✅ Successfully updated {updated_count} scripts")
        print(f"   - Category: Set to 'Jasown Scripts'")
        print(f"   - Tags: Cleaned up and limited to 3 essential tags")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
