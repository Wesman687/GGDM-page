#!/usr/bin/env python3
"""
Migration script to add comprehensive AI training data tables
"""

import sqlite3
import os
import time
from datetime import datetime

def migrate_training_data():
    """Add comprehensive training data tables to the database"""
    
    # Database path
    db_path = "suggestions.db"
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found. Please run the main application first.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. AI Training Sessions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_training_sessions (
                id VARCHAR PRIMARY KEY,
                session_id VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                total_interactions INTEGER DEFAULT 0,
                successful_interactions INTEGER DEFAULT 0,
                user_satisfaction_score REAL,
                session_quality_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. AI Training Interactions Table (Enhanced)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_training_interactions (
                id VARCHAR PRIMARY KEY,
                session_id VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL,
                interaction_type VARCHAR NOT NULL,  -- 'question', 'edit', 'feedback', 'rule_suggestion'
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Input data
                user_query TEXT,
                context_data TEXT,  -- JSON of retrieved context
                rules_version VARCHAR,
                model_version VARCHAR,
                
                -- AI response data
                ai_response_raw TEXT,  -- Full AI response
                ai_explanation TEXT,   -- Extracted explanation
                ai_generated_code TEXT, -- Extracted code
                ai_confidence_score REAL,
                response_time_ms INTEGER,
                
                -- User interaction data
                user_edited_code TEXT,  -- If user edited the code
                user_feedback_decision VARCHAR,  -- approved, declined, edited
                user_rating INTEGER,    -- 1-5 rating
                user_feedback_reasons TEXT,  -- JSON array of reasons
                code_edit_diff TEXT,    -- Diff between original and edited
                
                -- Learning data
                rule_suggestions_generated TEXT,  -- JSON array of suggestions
                rule_suggestions_submitted TEXT,  -- JSON array of submitted rules
                learning_insights TEXT,  -- JSON of insights extracted
                
                -- Quality metrics
                code_quality_score REAL,  -- Automated quality assessment
                explanation_clarity_score REAL,
                user_satisfaction REAL,
                correction_necessity_score REAL,  -- How much correction was needed
                
                -- Metadata
                script_category VARCHAR,  -- Extracted from query/context
                script_complexity VARCHAR,  -- simple, medium, complex
                tags TEXT,  -- JSON array of tags
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 3. Code Correction Patterns Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS code_correction_patterns (
                id VARCHAR PRIMARY KEY,
                interaction_id VARCHAR NOT NULL,
                pattern_type VARCHAR NOT NULL,  -- 'serial_to_name', 'missing_waitforgump', etc.
                original_code TEXT NOT NULL,
                corrected_code TEXT NOT NULL,
                correction_reason TEXT,
                frequency_score INTEGER DEFAULT 1,
                success_rate REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (interaction_id) REFERENCES ai_training_interactions(id)
            )
        """)
        
        # 4. User Behavior Patterns Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_behavior_patterns (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL,
                session_id VARCHAR NOT NULL,
                behavior_type VARCHAR NOT NULL,  -- 'edit_frequency', 'feedback_pattern', 'preference'
                behavior_data TEXT,  -- JSON of behavior data
                frequency INTEGER DEFAULT 1,
                confidence_score REAL,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 5. Training Data Quality Metrics Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_data_quality (
                id VARCHAR PRIMARY KEY,
                data_type VARCHAR NOT NULL,  -- 'interaction', 'correction', 'feedback'
                quality_metrics TEXT,  -- JSON of quality scores
                data_volume INTEGER,
                quality_score REAL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 6. AI Model Performance Tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_model_performance (
                id VARCHAR PRIMARY KEY,
                model_version VARCHAR NOT NULL,
                rules_version VARCHAR NOT NULL,
                metric_name VARCHAR NOT NULL,  -- 'accuracy', 'user_satisfaction', 'code_quality'
                metric_value REAL NOT NULL,
                sample_size INTEGER,
                measurement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes for better performance
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_training_sessions_user_id ON ai_training_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_training_sessions_created_at ON ai_training_sessions(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_training_interactions_session_id ON ai_training_interactions(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_training_interactions_user_id ON ai_training_interactions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_training_interactions_type ON ai_training_interactions(interaction_type)",
            "CREATE INDEX IF NOT EXISTS idx_training_interactions_timestamp ON ai_training_interactions(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_correction_patterns_type ON code_correction_patterns(pattern_type)",
            "CREATE INDEX IF NOT EXISTS idx_correction_patterns_frequency ON code_correction_patterns(frequency_score)",
            "CREATE INDEX IF NOT EXISTS idx_behavior_patterns_user_id ON user_behavior_patterns(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_behavior_patterns_type ON user_behavior_patterns(behavior_type)",
            "CREATE INDEX IF NOT EXISTS idx_model_performance_version ON ai_model_performance(model_version)",
            "CREATE INDEX IF NOT EXISTS idx_model_performance_date ON ai_model_performance(measurement_date)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        conn.commit()
        print("✅ Successfully created comprehensive AI training data tables with indexes")
        
        # Create initial quality metrics entry
        cursor.execute("""
            INSERT OR IGNORE INTO training_data_quality 
            (id, data_type, quality_metrics, data_volume, quality_score)
            VALUES ('initial', 'system', '{"status": "initialized"}', 0, 0.0)
        """)
        
        conn.commit()
        print("✅ Initialized training data quality tracking")
        
    except Exception as e:
        print(f"❌ Error creating training data tables: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_training_data()
    print("Migration completed. Waiting 2 seconds before exit...")
    time.sleep(2)
