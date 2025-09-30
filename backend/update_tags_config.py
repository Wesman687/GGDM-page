#!/usr/bin/env python3
"""
Update the script_tags_config table with all unique tags found in scripts
"""

import asyncio
import sys
from pathlib import Path
from database import get_db, ScriptsCacheDB, ScriptTagsConfigDB

async def main():
    print("Updating script tags configuration...")
    
    # Get database session
    db = next(get_db())
    
    try:
        # Get all scripts and collect unique tags
        scripts = db.query(ScriptsCacheDB).all()
        all_tags = set()
        
        for script in scripts:
            if script.tags:
                # Split tags by comma and clean them
                tags = [tag.strip() for tag in script.tags.split(',') if tag.strip()]
                all_tags.update(tags)
        
        print(f"Found {len(all_tags)} unique tags in scripts")
        
        # Get existing tags in config
        existing_tags = {tag.tag_name for tag in db.query(ScriptTagsConfigDB).all()}
        
        # Add new tags to config
        new_tags_added = 0
        for tag_name in sorted(all_tags):
            if tag_name not in existing_tags:
                # Determine category based on tag content
                tag_lower = tag_name.lower()
                if any(word in tag_lower for word in ['fishing', 'mining', 'lumber', 'gardening', 'farming']):
                    category = 'activity'
                elif any(word in tag_lower for word in ['dungeon', 'wildlands', 'ocean', 'house']):
                    category = 'location'
                elif any(word in tag_lower for word in ['magery', 'healing', 'taming', 'stealth', 'thieving']):
                    category = 'skill'
                elif any(word in tag_lower for word in ['snippet', 'utility', 'automation', 'bot']):
                    category = 'general'
                else:
                    category = 'general'
                
                # Assign colors based on category
                color_map = {
                    'activity': '#22c55e',  # green
                    'location': '#ef4444',  # red
                    'skill': '#3b82f6',    # blue
                    'general': '#8b5cf6'   # purple
                }
                
                tag = ScriptTagsConfigDB(
                    tag_name=tag_name,
                    tag_color=color_map.get(category, '#8b5cf6'),
                    tag_category=category,
                    is_active=True
                )
                
                db.add(tag)
                new_tags_added += 1
        
        db.commit()
        print(f"✅ Successfully added {new_tags_added} new tags to configuration")
        print(f"   Total tags in config: {len(existing_tags) + new_tags_added}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
