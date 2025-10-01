#!/usr/bin/env python3
"""
AI Uncertainty Management System
Handles cases where the AI is unsure and needs admin input to learn
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

class UncertaintyLevel(Enum):
    HIGH_CONFIDENCE = 0.8  # Very sure, proceed normally
    MEDIUM_CONFIDENCE = 0.5  # Somewhat sure, proceed with caution
    LOW_CONFIDENCE = 0.3  # Not very sure, ask for confirmation
    VERY_LOW_CONFIDENCE = 0.1  # Very unsure, request admin review

class UncertaintyManager:
    def __init__(self, db_path="suggestions.db"):
        self.db_path = db_path
        self.confidence_thresholds = {
            'auto_proceed': UncertaintyLevel.HIGH_CONFIDENCE.value,
            'ask_user': UncertaintyLevel.MEDIUM_CONFIDENCE.value,
            'request_admin': UncertaintyLevel.LOW_CONFIDENCE.value,
            'manual_review': UncertaintyLevel.VERY_LOW_CONFIDENCE.value
        }
        
        self.init_uncertainty_tables()
    
    def init_uncertainty_tables(self):
        """Initialize tables for uncertainty management"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create uncertainty requests table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS uncertainty_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_query TEXT NOT NULL,
                detected_intent TEXT,
                confidence_score REAL NOT NULL,
                uncertainty_reason TEXT NOT NULL,
                suggested_action TEXT NOT NULL,
                user_context TEXT,  -- Additional context from user
                admin_response TEXT,  -- Admin's decision/guidance
                admin_notes TEXT,  -- Admin's notes about the decision
                status TEXT DEFAULT 'pending',  -- pending, resolved, dismissed
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                resolved_by TEXT,  -- Admin Discord ID
                priority INTEGER DEFAULT 1  -- 1=low, 2=medium, 3=high
            )
        ''')
        
        # Create admin review queue table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admin_review_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                request_type TEXT NOT NULL,  -- 'intent_clarification', 'item_verification', 'pattern_expansion'
                priority INTEGER DEFAULT 1,
                assigned_to TEXT,  -- Admin Discord ID
                status TEXT DEFAULT 'pending',  -- pending, in_review, completed
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES uncertainty_requests(id)
            )
        ''')
        
        # Create learning confirmations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS learning_confirmations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                confirmation_type TEXT NOT NULL,  -- 'intent_confirmed', 'intent_corrected', 'new_pattern'
                original_intent TEXT,
                confirmed_intent TEXT,
                admin_confidence REAL,
                learning_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES uncertainty_requests(id)
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uncertainty_requests_status ON uncertainty_requests(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uncertainty_requests_priority ON uncertainty_requests(priority DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uncertainty_requests_created ON uncertainty_requests(created_at DESC)')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_review_queue_status ON admin_review_queue(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_review_queue_priority ON admin_review_queue(priority DESC)')
        
        conn.commit()
        conn.close()
    
    def analyze_uncertainty(self, user_query: str, detected_intent: Dict, confidence_score: float) -> Dict:
        """Analyze the uncertainty level and determine appropriate action"""
        
        uncertainty_reason = self._determine_uncertainty_reason(detected_intent, confidence_score)
        suggested_action = self._determine_suggested_action(confidence_score)
        
        # Determine if we need admin review
        needs_admin_review = confidence_score < self.confidence_thresholds['auto_proceed']
        
        result = {
            'confidence_score': confidence_score,
            'uncertainty_level': self._get_uncertainty_level(confidence_score),
            'uncertainty_reason': uncertainty_reason,
            'suggested_action': suggested_action,
            'needs_admin_review': needs_admin_review,
            'can_proceed': confidence_score >= self.confidence_thresholds['auto_proceed'],
            'should_ask_user': confidence_score >= self.confidence_thresholds['ask_user'] and confidence_score < self.confidence_thresholds['auto_proceed']
        }
        
        # Create uncertainty request if needed
        if needs_admin_review:
            request_id = self._create_uncertainty_request(
                user_query, detected_intent, confidence_score, uncertainty_reason, suggested_action
            )
            result['request_id'] = request_id
            result['admin_review_required'] = True
        
        return result
    
    def _determine_uncertainty_reason(self, detected_intent: Dict, confidence_score: float) -> str:
        """Determine the specific reason for uncertainty"""
        if confidence_score < 0.2:
            return "Very low confidence - multiple possible intents detected"
        elif confidence_score < 0.4:
            return "Low confidence - intent unclear or ambiguous"
        elif confidence_score < 0.6:
            return "Medium confidence - some uncertainty about intent classification"
        elif confidence_score < 0.8:
            return "High confidence but not certain - minor uncertainty"
        else:
            return "High confidence - proceeding normally"
    
    def _determine_suggested_action(self, confidence_score: float) -> str:
        """Determine the suggested action based on confidence"""
        if confidence_score < 0.2:
            return "Request admin review for intent clarification"
        elif confidence_score < 0.4:
            return "Ask user for clarification and request admin review"
        elif confidence_score < 0.6:
            return "Ask user for confirmation before proceeding"
        elif confidence_score < 0.8:
            return "Proceed with caution, inform user of uncertainty"
        else:
            return "Proceed normally with high confidence"
    
    def _get_uncertainty_level(self, confidence_score: float) -> str:
        """Get the uncertainty level as a string"""
        if confidence_score >= UncertaintyLevel.HIGH_CONFIDENCE.value:
            return "HIGH_CONFIDENCE"
        elif confidence_score >= UncertaintyLevel.MEDIUM_CONFIDENCE.value:
            return "MEDIUM_CONFIDENCE"
        elif confidence_score >= UncertaintyLevel.LOW_CONFIDENCE.value:
            return "LOW_CONFIDENCE"
        else:
            return "VERY_LOW_CONFIDENCE"
    
    def _create_uncertainty_request(self, user_query: str, detected_intent: Dict, 
                                  confidence_score: float, uncertainty_reason: str, 
                                  suggested_action: str) -> int:
        """Create a new uncertainty request for admin review"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Determine priority based on confidence and context
        priority = 1  # Default low priority
        if confidence_score < 0.2:
            priority = 3  # High priority for very uncertain cases
        elif confidence_score < 0.4:
            priority = 2  # Medium priority
        
        cursor.execute('''
            INSERT INTO uncertainty_requests 
            (user_query, detected_intent, confidence_score, uncertainty_reason, 
             suggested_action, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user_query,
            json.dumps(detected_intent),
            confidence_score,
            uncertainty_reason,
            suggested_action,
            priority
        ))
        
        request_id = cursor.lastrowid
        
        # Add to admin review queue
        cursor.execute('''
            INSERT INTO admin_review_queue 
            (request_id, request_type, priority)
            VALUES (?, 'intent_clarification', ?)
        ''', (request_id, priority))
        
        conn.commit()
        conn.close()
        
        return request_id
    
    def get_pending_admin_reviews(self, limit: int = 10) -> List[Dict]:
        """Get pending admin review requests"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT ur.id, ur.user_query, ur.detected_intent, ur.confidence_score,
                   ur.uncertainty_reason, ur.suggested_action, ur.created_at, ur.priority,
                   arq.status as queue_status
            FROM uncertainty_requests ur
            JOIN admin_review_queue arq ON ur.id = arq.request_id
            WHERE ur.status = 'pending'
            ORDER BY ur.priority DESC, ur.created_at ASC
            LIMIT ?
        ''', (limit,))
        
        requests = []
        for row in cursor.fetchall():
            requests.append({
                'id': row[0],
                'user_query': row[1],
                'detected_intent': json.loads(row[2]) if row[2] else {},
                'confidence_score': row[3],
                'uncertainty_reason': row[4],
                'suggested_action': row[5],
                'created_at': row[6],
                'priority': row[7],
                'queue_status': row[8]
            })
        
        conn.close()
        return requests
    
    def resolve_uncertainty_request(self, request_id: int, admin_user_id: str, 
                                  resolution: Dict) -> bool:
        """Resolve an uncertainty request with admin input"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Update the uncertainty request
            cursor.execute('''
                UPDATE uncertainty_requests 
                SET status = 'resolved', admin_response = ?, admin_notes = ?,
                    resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
                WHERE id = ?
            ''', (
                json.dumps(resolution),
                resolution.get('notes', ''),
                admin_user_id,
                request_id
            ))
            
            # Update admin review queue
            cursor.execute('''
                UPDATE admin_review_queue 
                SET status = 'completed'
                WHERE request_id = ?
            ''', (request_id,))
            
            # Create learning confirmation
            if resolution.get('confirmed_intent'):
                cursor.execute('''
                    INSERT INTO learning_confirmations 
                    (request_id, confirmation_type, original_intent, confirmed_intent,
                     admin_confidence, learning_notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    request_id,
                    resolution.get('confirmation_type', 'intent_confirmed'),
                    resolution.get('original_intent', ''),
                    resolution.get('confirmed_intent', ''),
                    resolution.get('admin_confidence', 0.9),
                    resolution.get('learning_notes', '')
                ))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Error resolving uncertainty request: {e}")
            conn.rollback()
            return False
        
        finally:
            conn.close()
    
    def get_uncertainty_stats(self) -> Dict:
        """Get statistics about uncertainty requests"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get counts by status
        cursor.execute('''
            SELECT status, COUNT(*) 
            FROM uncertainty_requests 
            GROUP BY status
        ''')
        status_counts = dict(cursor.fetchall())
        
        # Get counts by priority
        cursor.execute('''
            SELECT priority, COUNT(*) 
            FROM uncertainty_requests 
            GROUP BY priority
        ''')
        priority_counts = dict(cursor.fetchall())
        
        # Get average confidence by status
        cursor.execute('''
            SELECT status, AVG(confidence_score) 
            FROM uncertainty_requests 
            GROUP BY status
        ''')
        avg_confidence = dict(cursor.fetchall())
        
        # Get recent activity
        cursor.execute('''
            SELECT COUNT(*) 
            FROM uncertainty_requests 
            WHERE created_at >= datetime('now', '-7 days')
        ''')
        recent_count = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'status_counts': status_counts,
            'priority_counts': priority_counts,
            'avg_confidence': avg_confidence,
            'recent_requests': recent_count,
            'total_requests': sum(status_counts.values())
        }
    
    def generate_uncertainty_response(self, uncertainty_analysis: Dict) -> str:
        """Generate an appropriate response based on uncertainty analysis"""
        
        if uncertainty_analysis['can_proceed']:
            if uncertainty_analysis['should_ask_user']:
                return f"I think you want help with {uncertainty_analysis.get('detected_intent', {}).get('intent', 'scripting')}, but I'm not 100% sure. Is this correct?"
            else:
                return f"I'll help you create a {uncertainty_analysis.get('detected_intent', {}).get('intent', 'scripting')} script."
        
        elif uncertainty_analysis['needs_admin_review']:
            return f"I'm not entirely sure what you're looking for. I've flagged this for admin review to get you the best help possible. In the meantime, could you provide more details about what you want to accomplish?"
        
        else:
            return f"I need a bit more information to help you effectively. Could you clarify what type of script you're looking for?"

    def learn_from_feedback(self, user_query: str, correct_intent: str, feedback_notes: str) -> bool:
        """Learn from admin feedback to improve intent detection"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Log the learning
            cursor.execute('''
                INSERT INTO learning_confirmations 
                (confirmation_type, original_intent, confirmed_intent, 
                 admin_confidence, learning_notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                'intent_confirmed',
                '',  # Will be filled from context
                correct_intent,
                0.9,
                feedback_notes
            ))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Error learning from feedback: {e}")
            conn.rollback()
            return False
        
        finally:
            conn.close()
