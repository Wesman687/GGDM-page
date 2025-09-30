#!/usr/bin/env python3
"""
Script to add new scripts from your scraper with duplicate checking
Usage: python add_new_scripts.py [jsonl_file_path]
"""

import asyncio
import sys
import json
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
        print("Usage: python add_new_scripts.py [jsonl_file_path]")
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
    script_manager = ScriptManager(db)
    
    try:
        # Get existing scripts for duplicate checking
        existing_scripts = db.query(ScriptsCacheDB).all()
        existing_urls = {script.full_code_url for script in existing_scripts if script.full_code_url}
        existing_titles = {script.title.lower().strip() for script in existing_scripts if script.title}
        
        print(f"Found {len(existing_scripts)} existing scripts in database")
        
        # Filter out duplicates
        new_scripts = []
        duplicates = []
        
        for script_data in scripts_data:
            url = script_data.get('url', '')
            title = script_data.get('title', '').lower().strip()
            
            # Skip invalid scripts
            if not url or not title or url == 'https://outlands.uorazorscripts.com/script/new':
                continue
            
            # Check for duplicates by URL or title
            is_duplicate = False
            if url in existing_urls:
                is_duplicate = True
                duplicates.append(f"URL: {url}")
            elif title in existing_titles:
                is_duplicate = True
                duplicates.append(f"Title: {script_data.get('title', '')}")
            
            if not is_duplicate:
                # Ensure required fields have default values
                if not script_data.get('category'):
                    script_data['category'] = 'jasown-scripts'  # Default to jasown-scripts for scraped scripts
                if not script_data.get('author'):
                    script_data['author'] = 'Unknown'
                if not script_data.get('description'):
                    script_data['description'] = ''
                if not script_data.get('tags'):
                    script_data['tags'] = []
                
                # Clean up tags - limit to essential ones and remove duplicates
                if script_data.get('tags'):
                    # Keep only essential tags, remove duplicates
                    essential_tags = []
                    seen_tags = set()
                    for tag in script_data['tags']:
                        tag_lower = tag.lower().strip()
                        if tag_lower not in seen_tags and len(essential_tags) < 3:  # Limit to 3 tags max
                            essential_tags.append(tag)
                            seen_tags.add(tag_lower)
                    script_data['tags'] = essential_tags
                
                new_scripts.append(script_data)
        
        print(f"Found {len(duplicates)} duplicate scripts (skipping)")
        print(f"Found {len(new_scripts)} new scripts to add")
        
        if duplicates:
            print("\nDuplicate examples:")
            for i, dup in enumerate(duplicates[:5]):  # Show first 5 duplicates
                print(f"  - {dup}")
            if len(duplicates) > 5:
                print(f"  ... and {len(duplicates) - 5} more")
        
        if new_scripts:
            # Update scripts in database
            result = await script_manager.bulk_update_scripts(new_scripts, "scraper")
            
            print(f"\n✅ Successfully processed {result['total_processed']} scripts")
            print(f"   - Added: {result['added']} new scripts")
            print(f"   - Updated: {result['updated']} existing scripts")
            
            # Show some stats
            if result['total_processed'] > 0:
                print(f"\n📊 Processing complete!")
                print(f"   Total scripts processed: {result['total_processed']}")
                print(f"   New scripts added: {result['added']}")
                print(f"   Existing scripts updated: {result['updated']}")
                print(f"   Duplicates skipped: {len(duplicates)}")
        else:
            print("\n⚠️  No new scripts to add - all scripts are duplicates")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
