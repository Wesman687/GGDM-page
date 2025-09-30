#!/usr/bin/env python3
"""
AI Training Data Collection Service

This service collects and manages comprehensive training data for AI model improvement.
It captures user interactions, corrections, feedback, and behavioral patterns.
"""

import json
import sqlite3
import uuid
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import re
import os

@dataclass
class TrainingInteraction:
    """Data class for a training interaction"""
    session_id: str
    user_id: str
    interaction_type: str
    user_query: str
    context_data: Dict[str, Any]
    ai_response_raw: str
    ai_explanation: str
    ai_generated_code: str
    user_edited_code: Optional[str] = None
    user_feedback_decision: Optional[str] = None
    user_rating: Optional[int] = None
    user_feedback_reasons: Optional[List[str]] = None
    code_edit_diff: Optional[str] = None
    rule_suggestions_generated: Optional[List[str]] = None
    rule_suggestions_submitted: Optional[List[str]] = None
    response_time_ms: Optional[int] = None
    rules_version: str = "rules-v1.0"
    model_version: str = "gpt-4o-mini"

@dataclass
class CodeCorrectionPattern:
    """Data class for code correction patterns"""
    pattern_type: str
    original_code: str
    corrected_code: str
    correction_reason: str
    frequency_score: int = 1

class TrainingDataService:
    """Service for collecting and managing AI training data"""
    
    def __init__(self, db_path: str = "suggestions.db"):
        self.db_path = db_path
        
    def log_training_interaction(self, interaction: TrainingInteraction) -> str:
        """Log a comprehensive training interaction"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            interaction_id = str(uuid.uuid4())
            
            # Calculate quality scores
            quality_scores = self._calculate_quality_scores(interaction)
            
            # Extract script metadata
            script_metadata = self._extract_script_metadata(interaction.user_query, interaction.ai_generated_code)
            
            # Insert into training interactions table
            cursor.execute("""
                INSERT INTO ai_training_interactions (
                    id, session_id, user_id, interaction_type, timestamp,
                    user_query, context_data, rules_version, model_version,
                    ai_response_raw, ai_explanation, ai_generated_code,
                    user_edited_code, user_feedback_decision, user_rating,
                    user_feedback_reasons, code_edit_diff, rule_suggestions_generated,
                    rule_suggestions_submitted, response_time_ms,
                    code_quality_score, explanation_clarity_score, user_satisfaction,
                    correction_necessity_score, script_category, script_complexity,
                    tags, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                interaction_id,
                interaction.session_id,
                interaction.user_id,
                interaction.interaction_type,
                datetime.now(),
                interaction.user_query,
                json.dumps(interaction.context_data),
                interaction.rules_version,
                interaction.model_version,
                interaction.ai_response_raw,
                interaction.ai_explanation,
                interaction.ai_generated_code,
                interaction.user_edited_code,
                interaction.user_feedback_decision,
                interaction.user_rating,
                json.dumps(interaction.user_feedback_reasons) if interaction.user_feedback_reasons else None,
                interaction.code_edit_diff,
                json.dumps(interaction.rule_suggestions_generated) if interaction.rule_suggestions_generated else None,
                json.dumps(interaction.rule_suggestions_submitted) if interaction.rule_suggestions_submitted else None,
                interaction.response_time_ms,
                quality_scores.get('code_quality_score'),
                quality_scores.get('explanation_clarity_score'),
                quality_scores.get('user_satisfaction'),
                quality_scores.get('correction_necessity_score'),
                script_metadata.get('category'),
                script_metadata.get('complexity'),
                json.dumps(script_metadata.get('tags', [])),
                datetime.now()
            ))
            
            # Log correction patterns if code was edited
            if interaction.user_edited_code and interaction.code_edit_diff:
                self._log_correction_patterns(cursor, interaction_id, interaction)
            
            # Update session tracking
            self._update_session_tracking(cursor, interaction)
            
            conn.commit()
            conn.close()
            
            return interaction_id
            
        except Exception as e:
            print(f"Error logging training interaction: {e}")
            if 'conn' in locals():
                conn.rollback()
                conn.close()
            raise
    
    def _calculate_quality_scores(self, interaction: TrainingInteraction) -> Dict[str, float]:
        """Calculate various quality scores for the interaction"""
        scores = {}
        
        # Code quality score (0-1)
        if interaction.ai_generated_code:
            scores['code_quality_score'] = self._assess_code_quality(interaction.ai_generated_code)
        else:
            scores['code_quality_score'] = 0.0
        
        # Explanation clarity score (0-1)
        scores['explanation_clarity_score'] = self._assess_explanation_clarity(interaction.ai_explanation)
        
        # User satisfaction (0-1, based on rating and feedback)
        scores['user_satisfaction'] = self._calculate_user_satisfaction(interaction)
        
        # Correction necessity score (0-1, higher if more correction was needed)
        scores['correction_necessity_score'] = self._assess_correction_necessity(interaction)
        
        return scores
    
    def _assess_code_quality(self, code: str) -> float:
        """Assess the quality of generated code"""
        score = 0.5  # Base score
        
        # Check for good practices
        if 'if findtype' in code and 'as ' in code:
            score += 0.1  # Good variable capture
        if 'waitforgump' in code and 'gumpresponse' in code:
            score += 0.1  # Proper gump handling
        if '@clearignore' in code and 'findtype' in code:
            score += 0.1  # Proper ignore management
        if not re.search(r'0x[0-9a-fA-F]{8}', code):
            score += 0.1  # No serial numbers
        if '//' in code or '#' in code:
            score += 0.05  # Has comments
        
        # Check for bad practices
        if re.search(r'0x[0-9a-fA-F]{8}', code):
            score -= 0.2  # Uses serial numbers
        if 'while true' in code and 'wait' not in code:
            score -= 0.2  # Infinite loop without waits
        if 'gumpresponse' in code and 'waitforgump' not in code:
            score -= 0.15  # Missing waitforgump
        
        return max(0.0, min(1.0, score))
    
    def _assess_explanation_clarity(self, explanation: str) -> float:
        """Assess the clarity of the AI explanation"""
        if not explanation:
            return 0.0
        
        score = 0.5  # Base score
        
        # Check for clarity indicators
        if len(explanation.split()) > 10:
            score += 0.1  # Adequate length
        if any(word in explanation.lower() for word in ['purpose', 'function', 'what', 'how']):
            score += 0.1  # Explains purpose
        if explanation.count('.') > 1:
            score += 0.1  # Multiple sentences
        if not any(word in explanation.lower() for word in ['error', 'wrong', 'incorrect']):
            score += 0.05  # No obvious errors
        
        return max(0.0, min(1.0, score))
    
    def _calculate_user_satisfaction(self, interaction: TrainingInteraction) -> float:
        """Calculate user satisfaction score"""
        if interaction.user_rating:
            return interaction.user_rating / 5.0  # Convert 1-5 to 0-1
        
        # Infer from feedback decision
        if interaction.user_feedback_decision == 'approved':
            return 0.8
        elif interaction.user_feedback_decision == 'edited':
            return 0.6
        elif interaction.user_feedback_decision == 'declined':
            return 0.2
        
        return 0.5  # Default neutral
    
    def _assess_correction_necessity(self, interaction: TrainingInteraction) -> float:
        """Assess how much correction was necessary"""
        if not interaction.user_edited_code or not interaction.ai_generated_code:
            return 0.0
        
        # Simple diff-based assessment
        original_lines = interaction.ai_generated_code.split('\n')
        edited_lines = interaction.user_edited_code.split('\n')
        
        if len(original_lines) == 0:
            return 0.0
        
        # Calculate similarity (simple approach)
        changes = abs(len(original_lines) - len(edited_lines))
        for i, (orig, edit) in enumerate(zip(original_lines, edited_lines)):
            if orig.strip() != edit.strip():
                changes += 1
        
        # Normalize to 0-1 scale
        necessity_score = min(1.0, changes / len(original_lines))
        
        return necessity_score
    
    def _extract_script_metadata(self, query: str, code: str) -> Dict[str, Any]:
        """Extract metadata about the script from query and code"""
        metadata = {
            'category': 'general',
            'complexity': 'medium',
            'tags': []
        }
        
        query_lower = query.lower()
        code_lower = code.lower() if code else ''
        
        # Determine category
        if any(word in query_lower for word in ['fishing', 'fish', 'pole']):
            metadata['category'] = 'fishing'
        elif any(word in query_lower for word in ['heal', 'bandage', 'health']):
            metadata['category'] = 'healing'
        elif any(word in query_lower for word in ['tame', 'animal', 'pet']):
            metadata['category'] = 'taming'
        elif any(word in query_lower for word in ['craft', 'smith', 'carpenter']):
            metadata['category'] = 'crafting'
        elif any(word in query_lower for word in ['pvp', 'combat', 'attack']):
            metadata['category'] = 'combat'
        
        # Determine complexity
        if code:
            lines = code.split('\n')
            if len(lines) < 10:
                metadata['complexity'] = 'simple'
            elif len(lines) > 30:
                metadata['complexity'] = 'complex'
            else:
                metadata['complexity'] = 'medium'
        
        # Extract tags
        tags = []
        if 'findtype' in code_lower:
            tags.append('item_finding')
        if 'while' in code_lower:
            tags.append('loops')
        if 'gumpresponse' in code_lower:
            tags.append('gump_interaction')
        if 'wait' in code_lower:
            tags.append('timing')
        
        metadata['tags'] = tags
        
        return metadata
    
    def _log_correction_patterns(self, cursor, interaction_id: str, interaction: TrainingInteraction):
        """Log code correction patterns"""
        patterns = self._identify_correction_patterns(
            interaction.ai_generated_code,
            interaction.user_edited_code
        )
        
        for pattern in patterns:
            pattern_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO code_correction_patterns (
                    id, interaction_id, pattern_type, original_code,
                    corrected_code, correction_reason, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                pattern_id,
                interaction_id,
                pattern.pattern_type,
                pattern.original_code,
                pattern.corrected_code,
                pattern.correction_reason,
                datetime.now()
            ))
    
    def _identify_correction_patterns(self, original_code: str, edited_code: str) -> List[CodeCorrectionPattern]:
        """Identify specific correction patterns"""
        patterns = []
        
        if not original_code or not edited_code:
            return patterns
        
        # Pattern: Serial number to item name
        serial_match = re.search(r'findtype\s+(0x[0-9a-fA-F]{8})', original_code)
        name_match = re.search(r'findtype\s+"([^"]+)"', edited_code)
        
        if serial_match and name_match:
            patterns.append(CodeCorrectionPattern(
                pattern_type='serial_to_name',
                original_code=serial_match.group(0),
                corrected_code=name_match.group(0),
                correction_reason='Replace serial number with item name for better readability'
            ))
        
        # Pattern: Missing waitforgump
        if 'gumpresponse' in original_code and 'waitforgump' not in original_code:
            if 'waitforgump' in edited_code:
                patterns.append(CodeCorrectionPattern(
                    pattern_type='missing_waitforgump',
                    original_code='gumpresponse without waitforgump',
                    corrected_code='gumpresponse with waitforgump',
                    correction_reason='Add waitforgump after gumpresponse for proper gump handling'
                ))
        
        # Pattern: Missing @clearignore
        if 'findtype' in original_code and '@clearignore' not in original_code:
            if '@clearignore' in edited_code:
                patterns.append(CodeCorrectionPattern(
                    pattern_type='missing_clearignore',
                    original_code='findtype without @clearignore',
                    corrected_code='@clearignore before findtype',
                    correction_reason='Add @clearignore before ignore-heavy scans'
                ))
        
        return patterns
    
    def _update_session_tracking(self, cursor, interaction: TrainingInteraction):
        """Update session tracking information"""
        # Check if session exists
        cursor.execute("""
            SELECT id FROM ai_training_sessions WHERE session_id = ?
        """, (interaction.session_id,))
        
        session_exists = cursor.fetchone()
        
        if session_exists:
            # Update existing session
            cursor.execute("""
                UPDATE ai_training_sessions 
                SET total_interactions = total_interactions + 1,
                    successful_interactions = CASE WHEN ? = 'approved' THEN successful_interactions + 1 ELSE successful_interactions END,
                    end_time = ?
                WHERE session_id = ?
            """, (
                interaction.user_feedback_decision,
                datetime.now(),
                interaction.session_id
            ))
        else:
            # Create new session
            cursor.execute("""
                INSERT INTO ai_training_sessions (
                    id, session_id, user_id, start_time, end_time,
                    total_interactions, successful_interactions, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                interaction.session_id,
                interaction.user_id,
                datetime.now(),
                datetime.now(),
                1,
                1 if interaction.user_feedback_decision == 'approved' else 0,
                datetime.now()
            ))
    
    def export_training_data(self, format: str = 'json', include_user_data: bool = False) -> Dict[str, Any]:
        """Export training data in various formats"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get all training interactions
            cursor.execute("""
                SELECT * FROM ai_training_interactions 
                ORDER BY timestamp DESC
            """)
            
            interactions = cursor.fetchall()
            
            # Get correction patterns
            cursor.execute("""
                SELECT * FROM code_correction_patterns 
                ORDER BY created_at DESC
            """)
            
            patterns = cursor.fetchall()
            
            # Get user behavior patterns
            cursor.execute("""
                SELECT * FROM user_behavior_patterns 
                ORDER BY last_seen DESC
            """)
            
            behaviors = cursor.fetchall()
            
            conn.close()
            
            # Prepare export data
            export_data = {
                'export_timestamp': datetime.now().isoformat(),
                'total_interactions': len(interactions),
                'total_patterns': len(patterns),
                'total_behaviors': len(behaviors),
                'interactions': interactions,
                'correction_patterns': patterns,
                'behavior_patterns': behaviors
            }
            
            return export_data
            
        except Exception as e:
            print(f"Error exporting training data: {e}")
            raise
    
    def get_training_analytics(self) -> Dict[str, Any]:
        """Get analytics about the training data"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Basic statistics
            cursor.execute("SELECT COUNT(*) FROM ai_training_interactions")
            total_interactions = cursor.fetchone()[0]
            
            cursor.execute("SELECT AVG(user_rating) FROM ai_training_interactions WHERE user_rating IS NOT NULL")
            avg_rating = cursor.fetchone()[0] or 0
            
            cursor.execute("SELECT COUNT(*) FROM ai_training_interactions WHERE user_feedback_decision = 'approved'")
            approved_count = cursor.fetchone()[0]
            
            # Correction patterns analysis
            cursor.execute("""
                SELECT pattern_type, COUNT(*) as frequency 
                FROM code_correction_patterns 
                GROUP BY pattern_type 
                ORDER BY frequency DESC
            """)
            pattern_frequency = dict(cursor.fetchall())
            
            # Quality trends
            cursor.execute("""
                SELECT DATE(created_at) as date, AVG(code_quality_score) as avg_quality
                FROM ai_training_interactions 
                WHERE code_quality_score IS NOT NULL
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            """)
            quality_trends = cursor.fetchall()
            
            conn.close()
            
            return {
                'total_interactions': total_interactions,
                'average_user_rating': round(avg_rating, 2),
                'approval_rate': round((approved_count / total_interactions * 100) if total_interactions > 0 else 0, 2),
                'correction_patterns': pattern_frequency,
                'quality_trends': quality_trends,
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error getting training analytics: {e}")
            return {}

if __name__ == "__main__":
    # Example usage
    service = TrainingDataService()
    
    # Example interaction
    interaction = TrainingInteraction(
        session_id="test-session-123",
        user_id="test-user-456",
        interaction_type="question",
        user_query="Create a fishing script",
        context_data={"retrieved_chunks": []},
        ai_response_raw="Here's a fishing script...",
        ai_explanation="This script helps you fish automatically",
        ai_generated_code="if findtype 0x0E7D backpack as pole\ndclick pole\nendif"
    )
    
    # Log the interaction
    interaction_id = service.log_training_interaction(interaction)
    print(f"Logged interaction: {interaction_id}")
    
    # Get analytics
    analytics = service.get_training_analytics()
    print(f"Analytics: {analytics}")
    
    print("Service test completed. Waiting 2 seconds before exit...")
    time.sleep(2)
