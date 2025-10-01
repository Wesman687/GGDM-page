"""
AI Intent Management API Routes
Handles intent patterns, learning, and management
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from database import get_db
from typing import List, Dict, Optional
import sqlite3
import json
from datetime import datetime

router = APIRouter()

@router.get("/ai/intents/patterns")
async def get_intent_patterns(
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get all intent patterns for management"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Connect to SQLite database for intent patterns
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, intent_name, keywords, tags, context_needed, requirements,
                   confidence_score, usage_count, last_updated
            FROM intent_patterns
            ORDER BY usage_count DESC, confidence_score DESC
        ''')
        
        patterns = []
        for row in cursor.fetchall():
            patterns.append({
                'id': row[0],
                'intent_name': row[1],
                'keywords': json.loads(row[2]) if row[2] else [],
                'tags': json.loads(row[3]) if row[3] else [],
                'context_needed': json.loads(row[4]) if row[4] else [],
                'requirements': json.loads(row[5]) if row[5] else [],
                'confidence_score': row[6],
                'usage_count': row[7],
                'last_updated': row[8]
            })
        
        conn.close()
        
        return {
            'patterns': patterns,
            'count': len(patterns)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting intent patterns: {str(e)}")

@router.get("/ai/intents/patterns/{pattern_id}")
async def get_intent_pattern(
    pattern_id: int,
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get a specific intent pattern"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, intent_name, keywords, tags, context_needed, requirements,
                   confidence_score, usage_count, last_updated
            FROM intent_patterns
            WHERE id = ?
        ''', (pattern_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Intent pattern not found")
        
        return {
            'id': row[0],
            'intent_name': row[1],
            'keywords': json.loads(row[2]) if row[2] else [],
            'tags': json.loads(row[3]) if row[3] else [],
            'context_needed': json.loads(row[4]) if row[4] else [],
            'requirements': json.loads(row[5]) if row[5] else [],
            'confidence_score': row[6],
            'usage_count': row[7],
            'last_updated': row[8]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting intent pattern: {str(e)}")

@router.put("/ai/intents/patterns/{pattern_id}")
async def update_intent_pattern(
    pattern_id: int,
    update_data: Dict,
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Update an intent pattern"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Update the pattern
        cursor.execute('''
            UPDATE intent_patterns 
            SET keywords = ?, tags = ?, context_needed = ?, requirements = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            json.dumps(update_data.get('keywords', [])),
            json.dumps(update_data.get('tags', [])),
            json.dumps(update_data.get('context_needed', [])),
            json.dumps(update_data.get('requirements', [])),
            pattern_id
        ))
        
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Intent pattern not found")
        
        # Log the update
        cursor.execute('''
            INSERT INTO intent_learning_logs 
            (pattern_id, action, admin_user_id, details)
            VALUES (?, 'updated', ?, ?)
        ''', (
            pattern_id,
            admin_user_id,
            json.dumps({
                'updated_fields': list(update_data.keys()),
                'timestamp': datetime.now().isoformat()
            })
        ))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': f"Intent pattern {pattern_id} updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating intent pattern: {str(e)}")

@router.post("/ai/intents/patterns")
async def create_intent_pattern(
    pattern_data: Dict,
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Create a new intent pattern"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Insert new pattern
        cursor.execute('''
            INSERT INTO intent_patterns 
            (intent_name, keywords, tags, context_needed, requirements, 
             confidence_score, usage_count, created_at, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (
            pattern_data.get('intent_name'),
            json.dumps(pattern_data.get('keywords', [])),
            json.dumps(pattern_data.get('tags', [])),
            json.dumps(pattern_data.get('context_needed', [])),
            json.dumps(pattern_data.get('requirements', [])),
            pattern_data.get('confidence_score', 0.5),
            pattern_data.get('usage_count', 0)
        ))
        
        pattern_id = cursor.lastrowid
        
        # Log the creation
        cursor.execute('''
            INSERT INTO intent_learning_logs 
            (pattern_id, action, admin_user_id, details)
            VALUES (?, 'created', ?, ?)
        ''', (
            pattern_id,
            admin_user_id,
            json.dumps({
                'intent_name': pattern_data.get('intent_name'),
                'timestamp': datetime.now().isoformat()
            })
        ))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': f"Intent pattern '{pattern_data.get('intent_name')}' created successfully",
            'pattern_id': pattern_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating intent pattern: {str(e)}")

@router.delete("/ai/intents/patterns/{pattern_id}")
async def delete_intent_pattern(
    pattern_id: int,
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Delete an intent pattern"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Get pattern info before deletion
        cursor.execute('SELECT intent_name FROM intent_patterns WHERE id = ?', (pattern_id,))
        pattern_row = cursor.fetchone()
        
        if not pattern_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Intent pattern not found")
        
        # Delete the pattern
        cursor.execute('DELETE FROM intent_patterns WHERE id = ?', (pattern_id,))
        
        # Log the deletion
        cursor.execute('''
            INSERT INTO intent_learning_logs 
            (pattern_id, action, admin_user_id, details)
            VALUES (?, 'deleted', ?, ?)
        ''', (
            pattern_id,
            admin_user_id,
            json.dumps({
                'deleted_intent': pattern_row[0],
                'timestamp': datetime.now().isoformat()
            })
        ))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': f"Intent pattern '{pattern_row[0]}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting intent pattern: {str(e)}")

@router.get("/ai/intents/analytics")
async def get_intent_analytics(
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get intent analytics and statistics"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        # Get pattern counts
        cursor.execute('SELECT COUNT(*) FROM intent_patterns')
        total_patterns = cursor.fetchone()[0]
        
        # Get most used patterns
        cursor.execute('''
            SELECT intent_name, usage_count, confidence_score
            FROM intent_patterns
            ORDER BY usage_count DESC
            LIMIT 10
        ''')
        most_used = [{'name': row[0], 'usage': row[1], 'confidence': row[2]} for row in cursor.fetchall()]
        
        # Get recent activity
        cursor.execute('''
            SELECT DATE(last_updated) as date, COUNT(*) as count
            FROM intent_patterns
            WHERE last_updated >= datetime('now', '-30 days')
            GROUP BY DATE(last_updated)
            ORDER BY date DESC
        ''')
        recent_activity = [{'date': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        # Get learning logs count
        cursor.execute('SELECT COUNT(*) FROM intent_learning_logs')
        learning_logs = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'total_patterns': total_patterns,
            'most_used_patterns': most_used,
            'recent_activity': recent_activity,
            'learning_logs': learning_logs,
            'analytics_updated_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting intent analytics: {str(e)}")

@router.get("/ai/intents/learning-logs")
async def get_intent_learning_logs(
    limit: int = Query(50, description="Number of logs to return"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get intent learning logs"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT pattern_id, action, admin_user_id, details, created_at
            FROM intent_learning_logs
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        
        logs = []
        for row in cursor.fetchall():
            logs.append({
                'pattern_id': row[0],
                'action': row[1],
                'admin_user_id': row[2],
                'details': json.loads(row[3]) if row[3] else {},
                'created_at': row[4]
            })
        
        conn.close()
        
        return {
            'logs': logs,
            'count': len(logs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting learning logs: {str(e)}")
