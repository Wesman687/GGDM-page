#!/usr/bin/env python3
"""
Debug tag query to see what's happening
"""

from database import get_db, ScriptsCacheDB
from sqlalchemy import or_

def debug_tag_query():
    db = next(get_db())
    
    try:
        # Test the exact same query as the API
        tag_list = ['fishing', 'harpoon']
        
        # Get all scripts that match at least one tag
        tag_conditions = []
        for tag in tag_list:
            tag_conditions.append(ScriptsCacheDB.tags.contains(tag))
        
        print(f"Tag conditions: {tag_conditions}")
        
        # Apply the OR filter
        query = db.query(ScriptsCacheDB).filter(or_(*tag_conditions))
        
        # Count results
        count = query.count()
        print(f"Total scripts matching either tag: {count}")
        
        # Get all results
        all_scripts = query.all()
        
        print(f"\nAll scripts that match either 'fishing' or 'harpoon':")
        for i, script in enumerate(all_scripts):
            script_tags = script.tags or ""
            fishing_match = 'fishing' in script_tags.lower()
            harpoon_match = 'harpoon' in script_tags.lower()
            match_count = sum([fishing_match, harpoon_match])
            print(f"  {i+1}. {script.title}: {script_tags} (fishing: {fishing_match}, harpoon: {harpoon_match}, matches: {match_count})")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_tag_query()
