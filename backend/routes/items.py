"""
Items API Routes
Complete item management endpoints with proper separation of concerns
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Optional
import sqlite3
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# Pydantic models for request/response
class ItemCreate(BaseModel):
    name: str
    item_id: Optional[int] = None
    hue: int = 0
    category_id: int
    description: str

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    item_id: Optional[int] = None
    hue: Optional[int] = None
    category_id: Optional[int] = None
    description: Optional[str] = None

class ItemResponse(BaseModel):
    id: int
    name: str
    item_id: Optional[int]
    hue: int
    category_id: int
    category_name: str
    description: str
    usage_count: int
    is_verified: bool
    hues: List[Dict] = []
    script_examples: List[Dict] = []

class ItemCategory(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

class HueSet(BaseModel):
    id: int
    name: str
    hues: List[Dict]
    usage_count: int

class IndividualHue(BaseModel):
    hue: int
    description: str
    usage_count: int

class AddHueRequest(BaseModel):
    hue: int
    description: str

class MergeItemRequest(BaseModel):
    source_item_id: int
    target_item_id: int

@router.get("/items/health")
async def items_health():
    """Health check for items service"""
    return {"status": "healthy", "service": "items"}

@router.get("/items/categories", response_model=List[ItemCategory])
async def get_categories():
    """Get all item categories"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, description
            FROM item_categories
            ORDER BY sort_order, name
        ''')
        
        categories = []
        for row in cursor.fetchall():
            categories.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description']
            })
        
        conn.close()
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading categories: {str(e)}")

@router.get("/items/items")
async def get_items(
    search: str = Query("", description="Search term for name or item_id"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    matched_only: bool = Query(False, description="Show only matched items (have both name and ID)"),
    unmatched_only: bool = Query(False, description="Show only unmatched items"),
    limit: int = Query(100, description="Maximum number of items to return")
):
    """Get items with optional filtering"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Build query conditions
        conditions = []
        params = []
        
        if search:
            conditions.append("(name LIKE ? OR item_id = ?)")
            params.extend([f'%{search}%', search])
        
        if category_id is not None:
            conditions.append("category_id = ?")
            params.append(category_id)
        
        if matched_only:
            conditions.append("name IS NOT NULL AND name != '' AND item_id IS NOT NULL")
        
        if unmatched_only:
            conditions.append("(name IS NULL OR name = '' OR item_id IS NULL)")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = f'''
            SELECT id, name, item_id, hue, category_id, description, usage_count, is_verified
            FROM items
            {where_clause}
            ORDER BY usage_count DESC, name
            LIMIT ?
        '''
        params.append(limit)
        
        cursor.execute(query, params)
        
        items = []
        for row in cursor.fetchall():
            # Get category name
            cursor.execute('SELECT name FROM item_categories WHERE id = ?', (row['category_id'],))
            category_row = cursor.fetchone()
            category_name = category_row['name'] if category_row else 'Unknown'
            
            # Get hues for this item
            cursor.execute('''
                SELECT hue, description, usage_count
                FROM item_hues
                WHERE item_id = ?
                ORDER BY usage_count DESC
            ''', (row['id'],))
            
            hues = []
            for hue_row in cursor.fetchall():
                hues.append({
                    'hue': hue_row['hue'],
                    'description': hue_row['description'],
                    'usage_count': hue_row['usage_count']
                })
            
            # Get script examples for this item
            cursor.execute('''
                SELECT script_id, script_title, usage_context, line_number
                FROM item_script_usage
                WHERE item_id = ?
                ORDER BY created_at DESC
                LIMIT 10
            ''', (row['id'],))
            
            script_examples = []
            for script_row in cursor.fetchall():
                script_examples.append({
                    'script_id': script_row['script_id'],
                    'script_title': script_row['script_title'],
                    'context': script_row['usage_context'],
                    'line_number': script_row['line_number']
                })
            
            items.append({
                'id': row['id'],
                'name': row['name'],
                'item_id': row['item_id'],
                'hue': row['hue'],
                'category_id': row['category_id'],
                'category_name': category_name,
                'description': row['description'],
                'usage_count': row['usage_count'],
                'is_verified': bool(row['is_verified']),
                'hues': hues,
                'script_examples': script_examples
            })
        
        conn.close()
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading items: {str(e)}")

@router.post("/items/items", response_model=ItemResponse)
async def create_item(item_data: ItemCreate):
    """Create a new item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if item already exists
        cursor.execute('''
            SELECT id FROM items 
            WHERE name = ? OR (item_id = ? AND item_id IS NOT NULL)
        ''', (item_data.name, item_data.item_id))
        
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Item already exists")
        
        # Create the item
        cursor.execute('''
            INSERT INTO items (name, item_id, hue, category_id, description, usage_count, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
        ''', (item_data.name, item_data.item_id, item_data.hue, item_data.category_id, 
              item_data.description, datetime.utcnow(), datetime.utcnow()))
        
        item_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Return the created item
        return await get_item_by_id(item_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating item: {str(e)}")

@router.get("/items/items/search/{query}")
async def search_items_by_query(query: str, limit: int = Query(10, description="Maximum results")):
    """Search items by ID, item_id, or name with partial matching"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        results = []
        
        # Try to parse as integer first (for database id or item_id)
        try:
            numeric_id = int(query)
            cursor.execute('''
                SELECT i.id, i.name, i.item_id, i.hue, i.category_id, ic.name as category_name,
                       i.description, i.usage_count, i.is_verified
                FROM items i
                LEFT JOIN item_categories ic ON i.category_id = ic.id
                WHERE i.id = ? OR i.item_id = ?
                ORDER BY i.usage_count DESC
                LIMIT ?
            ''', (numeric_id, numeric_id, limit))
            
            for row in cursor.fetchall():
                # Get hues for this item
                cursor.execute('''
                    SELECT hue, description, usage_count
                    FROM item_hues
                    WHERE item_id = ?
                    ORDER BY usage_count DESC
                ''', (row['id'],))
                
                hues = []
                for hue_row in cursor.fetchall():
                    hues.append({
                        'hue': hue_row['hue'],
                        'description': hue_row['description'],
                        'usage_count': hue_row['usage_count']
                    })
                
                results.append({
                    'id': row['id'],
                    'name': row['name'],
                    'item_id': row['item_id'],
                    'hue': row['hue'],
                    'category_id': row['category_id'],
                    'category_name': row['category_name'],
                    'description': row['description'],
                    'usage_count': row['usage_count'],
                    'is_verified': row['is_verified'],
                    'hues': hues,
                    'script_examples': []  # Simplified for search results
                })
                
        except ValueError:
            # If not numeric, search by name with partial matching
            cursor.execute('''
                SELECT i.id, i.name, i.item_id, i.hue, i.category_id, ic.name as category_name,
                       i.description, i.usage_count, i.is_verified
                FROM items i
                LEFT JOIN item_categories ic ON i.category_id = ic.id
                WHERE i.name LIKE ? OR CAST(i.item_id AS TEXT) LIKE ?
                ORDER BY i.usage_count DESC, i.name
                LIMIT ?
            ''', (f'%{query}%', f'%{query}%', limit))
            
            for row in cursor.fetchall():
                # Get hues for this item
                cursor.execute('''
                    SELECT hue, description, usage_count
                    FROM item_hues
                    WHERE item_id = ?
                    ORDER BY usage_count DESC
                ''', (row['id'],))
                
                hues = []
                for hue_row in cursor.fetchall():
                    hues.append({
                        'hue': hue_row['hue'],
                        'description': hue_row['description'],
                        'usage_count': hue_row['usage_count']
                    })
                
                results.append({
                    'id': row['id'],
                    'name': row['name'],
                    'item_id': row['item_id'],
                    'hue': row['hue'],
                    'category_id': row['category_id'],
                    'category_name': row['category_name'],
                    'description': row['description'],
                    'usage_count': row['usage_count'],
                    'is_verified': row['is_verified'],
                    'hues': hues,
                    'script_examples': []  # Simplified for search results
                })
        
        conn.close()
        
        return {
            'items': results,
            'total': len(results),
            'query': query
        }
        
        # Get hues for this item
        cursor.execute('''
            SELECT hue, description, usage_count
            FROM item_hues
            WHERE item_id = ?
            ORDER BY usage_count DESC
        ''', (item_id,))
        
        hues = []
        for hue_row in cursor.fetchall():
            hues.append({
                'hue': hue_row['hue'],
                'description': hue_row['description'],
                'usage_count': hue_row['usage_count']
            })
        
        # Get script examples for this item
        cursor.execute('''
            SELECT script_id, script_title, usage_context, line_number
            FROM item_script_usage
            WHERE item_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ''', (item_id,))
        
        script_examples = []
        for script_row in cursor.fetchall():
            script_examples.append({
                'script_id': script_row['script_id'],
                'script_title': script_row['script_title'],
                'context': script_row['usage_context'],
                'line_number': script_row['line_number']
            })
        
        conn.close()
        
        return {
            'id': row['id'],
            'name': row['name'],
            'item_id': row['item_id'],
            'hue': row['hue'],
            'category_id': row['category_id'],
            'category_name': row['category_name'],
            'description': row['description'],
            'usage_count': row['usage_count'],
            'is_verified': bool(row['is_verified']),
            'hues': hues,
            'script_examples': script_examples
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading item: {str(e)}")

@router.put("/items/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item_data: ItemUpdate):
    """Update an existing item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if item exists
        cursor.execute('SELECT id FROM items WHERE id = ?', (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Build update query
        updates = []
        params = []
        
        if item_data.name is not None:
            updates.append("name = ?")
            params.append(item_data.name)
        
        if item_data.item_id is not None:
            updates.append("item_id = ?")
            params.append(item_data.item_id)
        
        if item_data.hue is not None:
            updates.append("hue = ?")
            params.append(item_data.hue)
        
        if item_data.category_id is not None:
            updates.append("category_id = ?")
            params.append(item_data.category_id)
        
        if item_data.description is not None:
            updates.append("description = ?")
            params.append(item_data.description)
        
        updates.append("updated_at = ?")
        params.append(datetime.utcnow())
        params.append(item_id)
        
        cursor.execute(f'''
            UPDATE items 
            SET {', '.join(updates)}
            WHERE id = ?
        ''', params)
        
        conn.commit()
        conn.close()
        
        # Return the updated item
        return await get_item_by_id(item_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.delete("/items/items/{item_id}")
async def delete_item(item_id: int):
    """Delete an item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if item exists
        cursor.execute('SELECT id FROM items WHERE id = ?', (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Delete related data first
        cursor.execute('DELETE FROM item_hues WHERE item_id = ?', (item_id,))
        cursor.execute('DELETE FROM item_script_usage WHERE item_id = ?', (item_id,))
        
        # Delete the item
        cursor.execute('DELETE FROM items WHERE id = ?', (item_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting item: {str(e)}")

@router.post("/items/merge")
async def merge_items(merge_data: MergeItemRequest):
    """Merge two items"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Get both items
        cursor.execute('SELECT * FROM items WHERE id IN (?, ?)', 
                      (merge_data.source_item_id, merge_data.target_item_id))
        items = cursor.fetchall()
        
        if len(items) != 2:
            raise HTTPException(status_code=404, detail="One or both items not found")
        
        source_item = items[0] if items[0][0] == merge_data.source_item_id else items[1]
        target_item = items[1] if items[0][0] == merge_data.source_item_id else items[0]
        
        # Merge the data - use target item as base, fill in missing data from source
        merged_name = target_item[1] if target_item[1] else source_item[1]
        merged_item_id = target_item[2] if target_item[2] else source_item[2]
        merged_hue = target_item[3] if target_item[3] else source_item[3]
        merged_category_id = target_item[4] if target_item[4] else source_item[4]
        merged_description = target_item[5] if target_item[5] else source_item[5]
        
        # Update target item with merged data
        cursor.execute('''
            UPDATE items 
            SET name = ?, item_id = ?, hue = ?, category_id = ?, description = ?, updated_at = ?
            WHERE id = ?
        ''', (merged_name, merged_item_id, merged_hue, merged_category_id, 
              merged_description, datetime.utcnow(), merge_data.target_item_id))
        
        # Move hues from source to target
        cursor.execute('UPDATE item_hues SET item_id = ? WHERE item_id = ?', 
                      (merge_data.target_item_id, merge_data.source_item_id))
        
        # Move script usage from source to target
        cursor.execute('UPDATE item_script_usage SET item_id = ? WHERE item_id = ?', 
                      (merge_data.target_item_id, merge_data.source_item_id))
        
        # Delete source item
        cursor.execute('DELETE FROM items WHERE id = ?', (merge_data.source_item_id,))
        
        conn.commit()
        conn.close()
        
        # Return the merged item
        return await get_item_by_id(merge_data.target_item_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error merging items: {str(e)}")

# Hue management endpoints
@router.get("/items/{item_id}/hues")
async def get_item_hues(item_id: int):
    """Get hues for a specific item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT hue, description, usage_count
            FROM item_hues
            WHERE item_id = ?
            ORDER BY usage_count DESC
        ''', (item_id,))
        
        hues = []
        for row in cursor.fetchall():
            hues.append({
                'hue': row['hue'],
                'description': row['description'],
                'usage_count': row['usage_count']
            })
        
        conn.close()
        return hues
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading item hues: {str(e)}")

@router.post("/items/{item_id}/hues")
async def add_item_hue(item_id: int, hue_data: AddHueRequest):
    """Add a hue to an item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if item exists
        cursor.execute('SELECT id FROM items WHERE id = ?', (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Check if hue already exists for this item
        cursor.execute('SELECT id FROM item_hues WHERE item_id = ? AND hue = ?', 
                      (item_id, hue_data.hue))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Hue already exists for this item")
        
        # Add the hue
        cursor.execute('''
            INSERT INTO item_hues (item_id, hue, description, usage_count, created_at)
            VALUES (?, ?, ?, 0, ?)
        ''', (item_id, hue_data.hue, hue_data.description, datetime.utcnow()))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Hue added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding hue: {str(e)}")

@router.put("/items/{item_id}/hues/{hue_value}")
async def update_item_hue(item_id: int, hue_value: int, hue_data: AddHueRequest):
    """Update a hue description"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if hue exists
        cursor.execute('SELECT id FROM item_hues WHERE item_id = ? AND hue = ?', 
                      (item_id, hue_value))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Hue not found")
        
        # Update the hue
        cursor.execute('''
            UPDATE item_hues 
            SET description = ?, updated_at = ?
            WHERE item_id = ? AND hue = ?
        ''', (hue_data.description, datetime.utcnow(), item_id, hue_value))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Hue updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating hue: {str(e)}")

@router.delete("/items/{item_id}/hues/{hue_value}")
async def delete_item_hue(item_id: int, hue_value: int):
    """Remove a hue from an item"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if hue exists
        cursor.execute('SELECT id FROM item_hues WHERE item_id = ? AND hue = ?', 
                      (item_id, hue_value))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Hue not found")
        
        # Delete the hue
        cursor.execute('DELETE FROM item_hues WHERE item_id = ? AND hue = ?', 
                      (item_id, hue_value))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Hue removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing hue: {str(e)}")

# Hue sets management
@router.get("/items/hue-sets", response_model=List[HueSet])
async def get_hue_sets():
    """Get all hue sets"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Try different possible column names
        try:
            cursor.execute('''
                SELECT id, name, description, hues, usage_count
                FROM hue_sets
                ORDER BY usage_count DESC, name
            ''')
        except sqlite3.OperationalError:
            # Fallback to basic columns
            cursor.execute('''
                SELECT id, name, description
                FROM hue_sets
                ORDER BY name
            ''')
        
        hue_sets = []
        for row in cursor.fetchall():
            # Handle different data formats for hues
            hues = []
            hues_data = row.get('hues') if 'hues' in row else None
            
            if hues_data:
                import json
                try:
                    # Try to parse as JSON first
                    parsed_hues = json.loads(hues_data)
                    if isinstance(parsed_hues, list):
                        hues = parsed_hues
                    else:
                        hues = []
                except (json.JSONDecodeError, TypeError):
                    try:
                        # Fallback: treat as comma-separated values and convert to dict format
                        hue_values = [h.strip() for h in str(hues_data).split(',') if h.strip()]
                        hues = [{'hue': int(h), 'description': f'Hue {h}'} for h in hue_values if h.isdigit()]
                    except (ValueError, AttributeError):
                        hues = []
            
            hue_sets.append({
                'id': row['id'],
                'name': row['name'],
                'hues': hues,
                'usage_count': row.get('usage_count', 0)
            })
        
        conn.close()
        return hue_sets
    except Exception as e:
        print(f"Error in get_hue_sets: {e}")
        # Return empty list instead of error to prevent crashes
        return []


@router.get("/items/individual-hues", response_model=List[IndividualHue])
async def get_individual_hues():
    """Get all individual hues"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT hue_value as hue, description, usage_count
            FROM individual_hues
            ORDER BY usage_count DESC, hue_value
        ''')
        
        hues = []
        for row in cursor.fetchall():
            hues.append({
                'hue': row['hue'],
                'description': row['description'],
                'usage_count': row['usage_count']
            })
        
        conn.close()
        return hues
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading individual hues: {str(e)}")

@router.get("/items/{item_id}/script-examples")
async def get_item_script_examples(
    item_id: int,
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page")
):
    """Get script examples for a specific item with pagination"""
    try:
        conn = sqlite3.connect('suggestions.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute('SELECT COUNT(*) FROM item_script_usage WHERE item_id = ?', (item_id,))
        total = cursor.fetchone()[0]
        
        # Calculate offset
        offset = (page - 1) * limit
        
        # Get script examples with pagination
        cursor.execute('''
            SELECT script_id, script_title, usage_context, line_number
            FROM item_script_usage
            WHERE item_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ''', (item_id, limit, offset))
        
        scripts = []
        for row in cursor.fetchall():
            scripts.append({
                'script_id': row['script_id'],
                'script_title': row['script_title'],
                'context': row['usage_context'],
                'line_number': row['line_number']
            })
        
        conn.close()
        
        return {
            'scripts': scripts,
            'total': total,
            'page': page,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading script examples: {str(e)}")

@router.post("/items/individual-hues")
async def create_individual_hue(hue_data: AddHueRequest):
    """Create or update an individual hue"""
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Check if hue already exists
        cursor.execute('SELECT id FROM individual_hues WHERE hue_value = ?', (hue_data.hue,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing hue
            cursor.execute('''
                UPDATE individual_hues 
                SET description = ?, updated_at = ?
                WHERE hue_value = ?
            ''', (hue_data.description, datetime.utcnow(), hue_data.hue))
        else:
            # Create new hue
            cursor.execute('''
                INSERT INTO individual_hues (hue_value, description, usage_count, created_at, updated_at)
                VALUES (?, ?, 0, ?, ?)
            ''', (hue_data.hue, hue_data.description, datetime.utcnow(), datetime.utcnow()))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Individual hue saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving individual hue: {str(e)}")