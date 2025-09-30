"""
Script Management Utilities
Handles bulk script updates, scraping, and AI reindexing
"""

import json
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from database import ScriptsCacheDB, get_db
from typing import List, Dict, Any


class ScriptManager:
    def __init__(self, db: Session):
        self.db = db
        self.ai_server_url = "http://localhost:7001"
    
    async def bulk_update_scripts(self, scripts_data: List[Dict[str, Any]], user_id: str) -> Dict[str, int]:
        """Bulk update/add scripts from scraper data"""
        try:
            updated_count = 0
            added_count = 0
            
            for script_data in scripts_data:
                # Extract script information
                script_id = script_data.get('id') or script_data.get('url', '').split('/')[-1]
                title = script_data.get('title', 'Untitled Script')
                author = script_data.get('author', 'Unknown')
                category = script_data.get('category') or 'jasown-scripts'  # Default to jasown-scripts for scraped scripts
                
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
                    tags = ','.join(essential_tags)
                else:
                    tags = ''
                
                description = script_data.get('description', '')
                code = script_data.get('code', '')
                url = script_data.get('url', '')
                
                # Check if script already exists
                existing_script = self.db.query(ScriptsCacheDB).filter(ScriptsCacheDB.id == script_id).first()
                
                if existing_script:
                    # Update existing script
                    existing_script.title = title
                    existing_script.author = author
                    existing_script.category = category
                    existing_script.tags = tags
                    existing_script.description = description
                    existing_script.code_preview = code[:500] if code else ''
                    existing_script.full_code_url = url
                    existing_script.updated_at = datetime.utcnow()
                    updated_count += 1
                else:
                    # Add new script
                    new_script = ScriptsCacheDB(
                        id=script_id,
                        title=title,
                        author=author,
                        category=category,
                        tags=tags,
                        description=description,
                        code_preview=code[:500] if code else '',
                        full_code_url=url,
                        is_approved=True,  # Auto-approve scraped scripts
                        created_by=user_id,
                        approved_by=user_id,
                        approved_at=datetime.utcnow()
                    )
                    self.db.add(new_script)
                    added_count += 1
            
            self.db.commit()
            
            return {
                "added": added_count,
                "updated": updated_count,
                "total_processed": len(scripts_data)
            }
            
        except Exception as e:
            self.db.rollback()
            raise Exception(f"Bulk update failed: {str(e)}")
    
    async def reindex_ai_scripts(self) -> str:
        """Trigger AI service to reindex all scripts"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ai_server_url}/ingest/reindex",
                    timeout=60.0
                )
                response.raise_for_status()
                return "AI reindexing started successfully"
        except httpx.RequestError as e:
            raise Exception(f"AI server unavailable: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise Exception(f"AI server error: {e.response.text}")
    
    def get_script_stats(self) -> Dict[str, int]:
        """Get statistics about scripts in the database"""
        total_scripts = self.db.query(ScriptsCacheDB).count()
        approved_scripts = self.db.query(ScriptsCacheDB).filter(ScriptsCacheDB.is_approved == True).count()
        pending_scripts = self.db.query(ScriptsCacheDB).filter(ScriptsCacheDB.is_approved == False).count()
        
        return {
            "total": total_scripts,
            "approved": approved_scripts,
            "pending": pending_scripts
        }


def load_scripts_from_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load scripts from JSONL file"""
    scripts = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                line = line.strip()
                if line:
                    try:
                        script_data = json.loads(line)
                        scripts.append(script_data)
                    except json.JSONDecodeError as e:
                        print(f"Error parsing line: {line[:100]}... Error: {e}")
                        continue
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return []
    except Exception as e:
        print(f"Error reading file: {e}")
        return []
    
    return scripts


async def update_scripts_from_file(file_path: str, user_id: str = "scraper") -> Dict[str, int]:
    """Update scripts from a JSONL file"""
    scripts_data = load_scripts_from_jsonl(file_path)
    if not scripts_data:
        return {"error": "No scripts found in file"}
    
    db = next(get_db())
    script_manager = ScriptManager(db)
    
    try:
        result = await script_manager.bulk_update_scripts(scripts_data, user_id)
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Example usage
        result = await update_scripts_from_file("frontend/outlands.jsonl", "scraper")
        print(f"Update result: {result}")
    
    asyncio.run(main())
