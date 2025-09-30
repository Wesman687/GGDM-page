"""
AI Uncertainty Management API Routes
Handles admin review of uncertain AI interactions
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from database import get_db
from typing import List, Dict, Optional
import json

router = APIRouter()

# Import the uncertainty manager
from ai_uncertainty_management import UncertaintyManager

# Initialize uncertainty manager
uncertainty_manager = UncertaintyManager()

@router.get("/ai/uncertainty/pending-reviews")
async def get_pending_admin_reviews(
    limit: int = Query(10, description="Number of reviews to return"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get pending admin review requests"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        reviews = uncertainty_manager.get_pending_admin_reviews(limit)
        return {
            'reviews': reviews,
            'count': len(reviews),
            'total_pending': len(uncertainty_manager.get_pending_admin_reviews(1000))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting pending reviews: {str(e)}")

@router.get("/ai/uncertainty/stats")
async def get_uncertainty_statistics(
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get uncertainty management statistics"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        stats = uncertainty_manager.get_uncertainty_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting uncertainty stats: {str(e)}")

@router.post("/ai/uncertainty/resolve/{request_id}")
async def resolve_uncertainty_request(
    request_id: int,
    resolution: Dict,
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Resolve an uncertainty request with admin input"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        success = uncertainty_manager.resolve_uncertainty_request(
            request_id, admin_user_id, resolution
        )
        
        if success:
            return {
                'success': True,
                'message': f"Uncertainty request {request_id} resolved successfully"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to resolve uncertainty request")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resolving uncertainty request: {str(e)}")

@router.post("/ai/uncertainty/analyze")
async def analyze_uncertainty(
    request: Dict,
    db: Session = Depends(get_db)
):
    """Analyze uncertainty for a user query and detected intent"""
    try:
        user_query = request.get('query', '')
        detected_intent = request.get('detected_intent', {})
        confidence_score = request.get('confidence_score', 0.0)
        
        if not user_query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        uncertainty_analysis = uncertainty_manager.analyze_uncertainty(
            user_query, detected_intent, confidence_score
        )
        
        # Generate appropriate response
        response_message = uncertainty_manager.generate_uncertainty_response(uncertainty_analysis)
        
        return {
            'uncertainty_analysis': uncertainty_analysis,
            'response_message': response_message,
            'recommended_action': uncertainty_analysis['suggested_action']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing uncertainty: {str(e)}")

@router.get("/ai/uncertainty/review/{request_id}")
async def get_uncertainty_request_details(
    request_id: int,
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific uncertainty request"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        import sqlite3
        
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, user_query, detected_intent, confidence_score,
                   uncertainty_reason, suggested_action, user_context,
                   admin_response, admin_notes, status, created_at,
                   resolved_at, resolved_by, priority
            FROM uncertainty_requests
            WHERE id = ?
        ''', (request_id,))
        
        request_data = cursor.fetchone()
        conn.close()
        
        if not request_data:
            raise HTTPException(status_code=404, detail="Uncertainty request not found")
        
        return {
            'id': request_data[0],
            'user_query': request_data[1],
            'detected_intent': json.loads(request_data[2]) if request_data[2] else {},
            'confidence_score': request_data[3],
            'uncertainty_reason': request_data[4],
            'suggested_action': request_data[5],
            'user_context': request_data[6],
            'admin_response': json.loads(request_data[7]) if request_data[7] else None,
            'admin_notes': request_data[8],
            'status': request_data[9],
            'created_at': request_data[10],
            'resolved_at': request_data[11],
            'resolved_by': request_data[12],
            'priority': request_data[13]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting request details: {str(e)}")

@router.post("/ai/uncertainty/learn-from-feedback")
async def learn_from_admin_feedback(
    feedback: Dict,
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Learn from admin feedback to improve intent detection"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user_query = feedback.get('user_query')
        correct_intent = feedback.get('correct_intent')
        feedback_notes = feedback.get('feedback_notes', '')
        
        if not user_query or not correct_intent:
            raise HTTPException(status_code=400, detail="user_query and correct_intent are required")
        
        # Log the learning
        uncertainty_manager.learn_from_feedback(user_query, correct_intent, feedback_notes)
        
        return {
            'success': True,
            'message': f"Learning recorded for query: '{user_query}' -> {correct_intent}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error learning from feedback: {str(e)}")

@router.get("/ai/uncertainty/admin-dashboard")
async def get_admin_dashboard_data(
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Get comprehensive dashboard data for admin uncertainty management"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get pending reviews
        pending_reviews = uncertainty_manager.get_pending_admin_reviews(20)
        
        # Get statistics
        stats = uncertainty_manager.get_uncertainty_stats()
        
        # Get recent activity (last 7 days)
        import sqlite3
        conn = sqlite3.connect('suggestions.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM uncertainty_requests
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ''')
        
        recent_activity = [{'date': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        # Get top uncertainty reasons
        cursor.execute('''
            SELECT uncertainty_reason, COUNT(*) as count
            FROM uncertainty_requests
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY uncertainty_reason
            ORDER BY count DESC
            LIMIT 10
        ''')
        
        top_reasons = [{'reason': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            'pending_reviews': pending_reviews,
            'statistics': stats,
            'recent_activity': recent_activity,
            'top_uncertainty_reasons': top_reasons,
            'dashboard_updated_at': '2024-01-01T00:00:00Z'  # Would be datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting dashboard data: {str(e)}")

@router.post("/ai/uncertainty/bulk-resolve")
async def bulk_resolve_uncertainty_requests(
    resolutions: List[Dict],
    admin_user_id: str = Query(..., description="Admin Discord ID"),
    is_admin: bool = Query(False, description="Whether user is admin"),
    db: Session = Depends(get_db)
):
    """Bulk resolve multiple uncertainty requests"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        results = []
        
        for resolution in resolutions:
            request_id = resolution.get('request_id')
            resolution_data = resolution.get('resolution', {})
            
            if not request_id:
                results.append({'request_id': None, 'success': False, 'error': 'Missing request_id'})
                continue
            
            try:
                success = uncertainty_manager.resolve_uncertainty_request(
                    request_id, admin_user_id, resolution_data
                )
                results.append({'request_id': request_id, 'success': success})
            except Exception as e:
                results.append({'request_id': request_id, 'success': False, 'error': str(e)})
        
        successful_count = sum(1 for r in results if r['success'])
        
        return {
            'success': True,
            'message': f"Bulk resolution completed: {successful_count}/{len(results)} successful",
            'results': results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in bulk resolution: {str(e)}")
