"""
AI Items Integration Routes
Handles intelligent questioning and item database integration for the AI agent
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from sqlalchemy import or_, and_, func
from typing import List, Dict, Optional
import json
import sqlite3

router = APIRouter()

def analyze_user_intent_with_items(query: str) -> Dict:
    """Analyze user intent and find relevant items"""
    query_lower = query.lower()
    
    intent_patterns = {
        'fishing': {
            'keywords': ['fishing', 'fish', 'pooner', 'boat', 'captcha', 'net', 'bait', 'mib', 'frenzy'],
            'item_types': ['fishing pole', 'fishing net', 'bait', 'boat', 'mib', 'frenzy'],
            'requirements': ['boat_detection', 'captcha_handling', 'fish_processing']
        },
        'mining': {
            'keywords': ['mining', 'mine', 'ore', 'pickaxe', 'vein', 'gems'],
            'item_types': ['pickaxe', 'ore', 'gems', 'mining tools'],
            'requirements': ['vein_detection', 'tool_management', 'ore_processing']
        },
        'combat': {
            'keywords': ['combat', 'fight', 'attack', 'weapon', 'spell', 'heal', 'pvp', 'pvm'],
            'item_types': ['weapon', 'armor', 'potions', 'bandages'],
            'requirements': ['target_selection', 'healing_logic', 'spell_rotation']
        }
    }
    
    detected_intents = []
    for intent_name, intent_data in intent_patterns.items():
        for keyword in intent_data['keywords']:
            if keyword in query_lower:
                detected_intents.append(intent_name)
                break
    
    if not detected_intents:
        detected_intents = ['general']
    
    primary_intent = detected_intents[0]
    intent_data = intent_patterns.get(primary_intent, {
        'keywords': ['script', 'automation'],
        'item_types': ['general items'],
        'requirements': ['basic automation']
    })
    
    return {
        'intent': primary_intent,
        'intent_data': intent_data,
        'keywords': intent_data['keywords'],
        'item_types': intent_data['item_types'],
        'requirements': intent_data['requirements']
    }

@router.get("/ai/items/suggestions")
async def get_item_suggestions(
    query: str = Query(..., description="Search query for items"),
    db: Session = Depends(get_db)
):
    """Get item suggestions based on query"""
    try:
        # Connect to SQLite database directly
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Search items database
        cursor.execute('''
            SELECT name, item_id, hue, category_id, description, usage_count, is_verified
            FROM items 
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY usage_count DESC
            LIMIT 10
        ''', (f'%{query}%', f'%{query}%'))
        
        items = cursor.fetchall()
        conn.close()
        
        suggestions = []
        for item in items:
            suggestions.append({
                'name': item[0],
                'item_id': item[1],
                'hue': item[2],
                'category': item[3],
                'usage_count': item[4],
                'is_verified': item[6],
                'description': item[5]
            })
        
        return {
            'query': query,
            'suggestions': suggestions,
            'count': len(suggestions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting item suggestions: {str(e)}")

@router.get("/ai/items/context/{item_name}")
async def get_item_context_for_ai(
    item_name: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive item context for AI"""
    try:
        # Connect to SQLite database directly
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Get item details
        cursor.execute('''
            SELECT id, name, item_id, hue, category_id, description, usage_count, is_verified
            FROM items 
            WHERE name = ?
        ''', (item_name,))
        
        item = cursor.fetchone()
        if not item:
            conn.close()
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Get hues for this item
        cursor.execute('''
            SELECT hue, description
            FROM item_hues 
            WHERE item_id = ?
        ''', (item[0],))
        
        hues = cursor.fetchall()
        
        # Get script usage examples
        cursor.execute('''
            SELECT script_title, usage_context, line_number
            FROM item_script_usage 
            WHERE item_id = ?
            LIMIT 5
        ''', (item[0],))
        
        script_usage = cursor.fetchall()
        conn.close()
        
        context = {
            'item_name': item[1],
            'item_id': item[2],
            'hue': item[3],
            'category': item[4],
            'description': item[5],
            'usage_count': item[6],
            'is_verified': item[7],
            'hues': [{'hue': h[0], 'description': h[1]} for h in hues],
            'script_examples': [
                {
                    'script_title': s[0],
                    'context': s[1],
                    'line': s[2]
                } for s in script_usage
            ]
        }
        
        return context
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting item context: {str(e)}")

@router.post("/ai/items/analyze-request")
async def analyze_user_request(
    request: Dict,
    db: Session = Depends(get_db)
):
    """Analyze user request and generate intelligent questions"""
    try:
        user_query = request.get('query', '')
        
        # Analyze intent
        intent_analysis = analyze_user_intent_with_items(user_query)
        
        # Get relevant items using direct SQLite queries
        relevant_items = []
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        for keyword in intent_analysis['keywords']:
            cursor.execute('''
                SELECT id, name, item_id, description, category, usage_count
                FROM items
                WHERE name LIKE ? OR description LIKE ?
                LIMIT 5
            ''', (f'%{keyword}%', f'%{keyword}%'))
            
            items = cursor.fetchall()
            relevant_items.extend(items)
        
        conn.close()
        
        # Remove duplicates
        seen = set()
        unique_items = []
        for item in relevant_items:
            item_id = item[0]  # First element is the id
            if item_id not in seen:
                seen.add(item_id)
                unique_items.append(item)
        
        # Analyze missing information
        missing_info = {
            'missing_ids': [],
            'missing_names': [],
            'incomplete_items': []
        }
        
        for item in unique_items:
            # item is a tuple: (id, name, item_id, description, category, usage_count)
            item_id, name, item_id_val, description, category, usage_count = item
            
            if not item_id_val or item_id_val == 0:
                missing_info['missing_ids'].append(name)
            if not name or name.startswith('item_'):
                missing_info['missing_names'].append(f"ID {item_id_val}")
            if not item_id_val or not name or name.startswith('item_'):
                missing_info['incomplete_items'].append(item)
        
        # Generate intelligent questions
        questions = []
        
        if intent_analysis['intent'] == 'fishing':
            # Fishing-specific questions
            fishing_types = []
            for item in unique_items:
                if 'mib' in item.name.lower():
                    fishing_types.append('Mibs (special fishing spots)')
                if 'frenzy' in item.name.lower():
                    fishing_types.append('Frenzies (intense fishing areas)')
                if 'net' in item.name.lower():
                    fishing_types.append('Fishing nets')
                if 'boat' in item.name.lower():
                    fishing_types.append('Boat fishing')
            
            if fishing_types:
                questions.append({
                    'type': 'choice',
                    'question': f"I found several fishing-related items. What type of fishing would you like to do?",
                    'options': list(set(fishing_types)),
                    'context': 'fishing_type_selection'
                })
            
            questions.extend([
                {
                    'type': 'boolean',
                    'question': "Do you want notifications for player boats approaching?",
                    'context': 'boat_notifications'
                },
                {
                    'type': 'boolean',
                    'question': "Do you want the script to handle captcha challenges automatically?",
                    'context': 'captcha_handling'
                },
                {
                    'type': 'choice',
                    'question': "What type of fish processing do you want?",
                    'options': ['Cut and store', 'Cut and eat', 'Store whole fish', 'Auto-sell fish'],
                    'context': 'fish_processing'
                }
            ])
        
        # Add questions about missing information
        if missing_info['missing_ids']:
            questions.append({
                'type': 'input',
                'question': f"I need item IDs for: {', '.join(missing_info['missing_ids'])}. Can you provide these?",
                'context': 'missing_item_ids',
                'missing_items': missing_info['missing_ids']
            })
        
        if missing_info['missing_names']:
            questions.append({
                'type': 'input',
                'question': f"I have item IDs but need names for: {', '.join(missing_info['missing_names'])}. What are these items called?",
                'context': 'missing_item_names',
                'missing_items': missing_info['missing_names']
            })
        
        return {
            'intent_analysis': intent_analysis,
            'relevant_items': [
                {
                    'name': item.name,
                    'item_id': item.item_id,
                    'hue': item.hue,
                    'usage_count': item.usage_count,
                    'is_verified': item.is_verified
                } for item in unique_items[:10]
            ],
            'missing_information': missing_info,
            'questions': questions,
            'ready_to_generate': len(questions) == 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing request: {str(e)}")

@router.post("/ai/items/update-item")
async def update_item_from_ai(
    request: Dict,
    db: Session = Depends(get_db)
):
    """Update item information based on AI interaction"""
    try:
        item_name = request.get('item_name')
        item_id = request.get('item_id')
        hue = request.get('hue')
        description = request.get('description')
        
        if not item_name:
            raise HTTPException(status_code=400, detail="Item name is required")
        
        # Check if item exists using direct SQLite query
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, item_id, hue, description, category, usage_count
            FROM items
            WHERE name = ? OR item_id = ?
        ''', (item_name, item_id))
        
        existing_item = cursor.fetchone()
        
        if existing_item:
            # Update existing item
            item_id_val, name, existing_item_id, existing_hue, existing_desc, category, usage_count = existing_item
            
            update_fields = []
            update_values = []
            
            if item_id and not existing_item_id:
                update_fields.append('item_id = ?')
                update_values.append(item_id)
            if hue is not None and not existing_hue:
                update_fields.append('hue = ?')
                update_values.append(hue)
            if description and not existing_desc:
                update_fields.append('description = ?')
                update_values.append(description)
            
            # Always increment usage count
            update_fields.append('usage_count = ?')
            update_values.append(usage_count + 1)
            update_values.append(item_id_val)  # For WHERE clause
            
            if update_fields:
                cursor.execute(f'''
                    UPDATE items 
                    SET {', '.join(update_fields)}
                    WHERE id = ?
                ''', update_values)
        else:
            # Create new item
            cursor.execute('''
                INSERT INTO items (name, item_id, hue, description, category, usage_count)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (item_name, item_id or 0, hue or 0, description or f"AI-discovered item: {item_name}", 'unknown', 1))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': f"Updated item: {item_name}",
            'item_id': item_id,
            'item_name': item_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")

@router.get("/ai/items/context-for-generation")
async def get_context_for_script_generation(
    intent: str = Query(..., description="The detected intent"),
    requirements: str = Query(..., description="JSON string of user requirements"),
    db: Session = Depends(get_db)
):
    """Get comprehensive context for AI script generation"""
    try:
        # Parse requirements
        try:
            user_requirements = json.loads(requirements)
        except:
            user_requirements = {}
        
        # Get relevant items for intent
        intent_keywords = []
        if intent == 'fishing':
            intent_keywords = ['fishing', 'fish', 'net', 'pole', 'boat', 'mib', 'frenzy', 'bait']
        elif intent == 'mining':
            intent_keywords = ['mining', 'mine', 'ore', 'pickaxe', 'ignots']
        elif intent == 'combat':
            intent_keywords = ['combat', 'weapon', 'armor', 'potion', 'bandage']
        
        # Get relevant items using direct SQLite queries
        relevant_items = []
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        for keyword in intent_keywords:
            cursor.execute('''
                SELECT id, name, item_id, hue, description, category, usage_count
                FROM items
                WHERE name LIKE ? OR description LIKE ?
                ORDER BY usage_count DESC
                LIMIT 5
            ''', (f'%{keyword}%', f'%{keyword}%'))
            
            items = cursor.fetchall()
            relevant_items.extend(items)
        
        conn.close()
        
        # Remove duplicates
        seen = set()
        unique_items = []
        for item in relevant_items:
            item_id = item[0]  # First element is the id
            if item_id not in seen:
                seen.add(item_id)
                unique_items.append(item)
        
        # Build context
        context = {
            'intent': intent,
            'user_requirements': user_requirements,
            'available_items': [
                {
                    'name': item[1],  # name
                    'item_id': item[2],  # item_id
                    'hue': item[3],  # hue
                    'description': item[4],  # description
                    'usage_count': item[6],  # usage_count
                    'is_verified': True  # Default to verified for now
                } for item in unique_items[:15]
            ],
            'item_count': len(unique_items),
            'context_generated_at': '2024-01-01T00:00:00Z'  # Would be datetime.now().isoformat()
        }
        
        return context
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating context: {str(e)}")

@router.get("/ai/items/validate-reference")
async def validate_item_reference(
    name: str = Query(..., description="Item name"),
    item_id: int = Query(None, description="Item ID"),
    db: Session = Depends(get_db)
):
    """Validate item name/ID combination"""
    try:
        # Search for item using direct SQLite query
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        if item_id and name:
            cursor.execute('''
                SELECT id, name, item_id, hue, description, category, usage_count
                FROM items
                WHERE item_id = ? AND name LIKE ?
                LIMIT 5
            ''', (item_id, f'%{name}%'))
        elif item_id:
            cursor.execute('''
                SELECT id, name, item_id, hue, description, category, usage_count
                FROM items
                WHERE item_id = ?
                LIMIT 5
            ''', (item_id,))
        elif name:
            cursor.execute('''
                SELECT id, name, item_id, hue, description, category, usage_count
                FROM items
                WHERE name LIKE ?
                LIMIT 5
            ''', (f'%{name}%',))
        else:
            conn.close()
            return {
                'valid': False,
                'message': 'Either name or item_id must be provided',
                'suggestions': []
            }
        
        items = cursor.fetchall()
        conn.close()
        
        if not items:
            return {
                'valid': False,
                'message': 'Item not found in database',
                'suggestions': []
            }
        
        # Check for exact match
        exact_match = None
        for item in items:
            # item is a tuple: (id, name, item_id, hue, description, category, usage_count)
            if item[1].lower() == name.lower() and item[2] == item_id:
                exact_match = item
                break
        
        if exact_match:
            return {
                'valid': True,
                'item': {
                    'name': exact_match[1],  # name
                    'item_id': exact_match[2],  # item_id
                    'hue': exact_match[3],  # hue
                    'category': exact_match[5],  # category
                    'is_verified': True  # Default to verified
                },
                'suggestions': []
            }
        
        # Return suggestions
        suggestions = []
        for item in items:
            suggestions.append({
                'name': item[1],  # name
                'item_id': item[2],  # item_id
                'hue': item[3],  # hue
                'is_verified': True,  # Default to verified
                'match_type': 'exact_id' if item[2] == item_id else 'name_match'
            })
        
        return {
            'valid': False,
            'message': 'No exact match found',
            'suggestions': suggestions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating item: {str(e)}")
