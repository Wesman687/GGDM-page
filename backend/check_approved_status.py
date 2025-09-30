#!/usr/bin/env python3
"""
Check is_approved status for scripts
"""

from database import get_db, ScriptsCacheDB
from sqlalchemy import or_

def check_approved_status():
    db = next(get_db())
    
    try:
        # Get all scripts that match either fishing or harpoon
        tag_conditions = [
            ScriptsCacheDB.tags.contains('fishing'),
            ScriptsCacheDB.tags.contains('harpoon')
        ]
        
        query = db.query(ScriptsCacheDB).filter(or_(*tag_conditions))
        all_scripts = query.all()
        
        print(f"Total scripts matching either tag: {len(all_scripts)}")
        
        approved_count = 0
        not_approved_count = 0
        
        for script in all_scripts:
            if script.is_approved:
                approved_count += 1
            else:
                not_approved_count += 1
                print(f"NOT APPROVED: {script.title} - {script.tags}")
        
        print(f"Approved: {approved_count}")
        print(f"Not approved: {not_approved_count}")
        
        # Check if there are any scripts that are not approved
        if not_approved_count > 0:
            print("\nScripts that are not approved:")
            for script in all_scripts:
                if not script.is_approved:
                    print(f"  - {script.title}: {script.tags}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_approved_status()
