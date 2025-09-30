# DM Portal Database Documentation

## Overview

The DM Portal uses a consolidated SQLite database (`suggestions.db`) that combines all functionality into a single database file. This database supports the DM Portal's core features including dockmaster suggestions, script management, AI interactions, and comprehensive training data collection.

## Database Architecture

### Technology Stack
- **Database**: SQLite 3
- **ORM**: SQLAlchemy
- **Location**: `backend/suggestions.db`
- **Connection**: `sqlite:///./suggestions.db`

### Key Features
- **Consolidated Design**: Single database file for all functionality
- **FAISS Integration**: Vector embeddings stored alongside traditional data
- **Comprehensive Logging**: Detailed tracking of all user interactions
- **Training Data Collection**: Advanced AI learning and improvement systems
- **Admin Management**: Complete admin workflow support

## Table Structure

### Core Portal Tables

#### 1. suggestions
**Purpose**: Main table for dockmaster suggestions
```sql
CREATE TABLE suggestions (
    id VARCHAR PRIMARY KEY,
    action VARCHAR NOT NULL,           -- 'add' or 'remove'
    zone_id VARCHAR NOT NULL,
    x INTEGER,
    y INTEGER,
    map INTEGER,
    enabled BOOLEAN DEFAULT TRUE,
    reason TEXT NOT NULL,
    submitter_name VARCHAR,
    submitter_discord VARCHAR,
    status VARCHAR DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    created_at DATETIME DEFAULT NOW(),
    reviewed_at DATETIME,
    reviewed_by VARCHAR,
    admin_notes TEXT,
    pr_url VARCHAR,                    -- GitHub Pull Request URL
    pr_number INTEGER,                 -- GitHub PR number
    pr_error TEXT,                     -- PR creation error message
    pr_retry_count INTEGER DEFAULT 0  -- Retry attempts
);
```

**Usage**: Stores user-submitted dockmaster location suggestions with full approval workflow and GitHub integration.

#### 2. admins
**Purpose**: Admin user management
```sql
CREATE TABLE admins (
    discord_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    added_by VARCHAR NOT NULL,
    added_at DATETIME DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

**Usage**: Manages admin users with Discord integration.

#### 3. dockmasters
**Purpose**: Reference dockmaster locations
```sql
CREATE TABLE dockmasters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id VARCHAR NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    map INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    is_reference_point BOOLEAN DEFAULT FALSE,
    added_by VARCHAR NOT NULL,
    added_at DATETIME DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

**Usage**: Stores current dockmaster locations for validation and reference.

### Script Management Tables

#### 4. scripts_cache
**Purpose**: Razor script storage and metadata
```sql
CREATE TABLE scripts_cache (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    author VARCHAR NOT NULL,
    category VARCHAR NOT NULL,         -- 'gg-scripts', 'jasown-scripts', 'ai-scripts'
    language VARCHAR NOT NULL,         -- 'razor', 'python'
    tags TEXT,                         -- JSON array of tags
    description TEXT,
    code_preview TEXT,                 -- First 500 chars for listing
    full_code TEXT,                    -- Full script code
    full_code_url VARCHAR,             -- URL to AI server for full code
    exe_download_url VARCHAR,          -- Optional .exe download URL
    rating_average FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    created_by VARCHAR,                -- Discord ID
    approved_by VARCHAR,               -- Admin Discord ID
    approved_at DATETIME,
    rejection_reason TEXT
);
```

**Usage**: Stores all Razor scripts with metadata, ratings, and approval workflow.

#### 5. script_ratings
**Purpose**: User ratings for scripts
```sql
CREATE TABLE script_ratings (
    id VARCHAR PRIMARY KEY,
    script_id VARCHAR NOT NULL,        -- Foreign key to scripts_cache
    user_id VARCHAR NOT NULL,          -- Discord ID
    rating INTEGER NOT NULL,           -- 1-5 stars
    review TEXT,
    weight INTEGER DEFAULT 1,          -- 1 for user ratings, 5 for Jasown
    is_jasown_rating BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT NOW()
);
```

**Usage**: Weighted rating system where Jasown scripts automatically get 5-star weighted ratings.

#### 6. script_tags_config
**Purpose**: Tag configuration for scripts
```sql
CREATE TABLE script_tags_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR NOT NULL UNIQUE,
    tag_color VARCHAR DEFAULT '#3b82f6',
    tag_category VARCHAR DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT NOW()
);
```

**Usage**: Manages available tags for script categorization with colors and categories.

### AI System Tables

#### 7. rag_chunks
**Purpose**: Vector embeddings for RAG (Retrieval-Augmented Generation)
```sql
CREATE TABLE rag_chunks (
    id TEXT PRIMARY KEY,
    source TEXT CHECK (source IN ('script','docs','rules')),
    title TEXT,
    url TEXT,
    text TEXT NOT NULL,
    meta TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Stores text chunks with embeddings for AI context retrieval. Works with FAISS for vector similarity search.

#### 8. interactions
**Purpose**: Basic AI interaction logging
```sql
CREATE TABLE interactions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    assistant_draft TEXT NOT NULL,
    retrieved TEXT NOT NULL,
    citations TEXT NOT NULL,
    decision TEXT DEFAULT 'pending',
    rating INTEGER,
    reasons TEXT,
    edits_diff TEXT,
    rules_version TEXT DEFAULT 'rules-v1.0',
    model_version TEXT DEFAULT 'gpt-4o-mini',
    session_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Logs AI interactions with feedback and decision tracking.

#### 9. ai_interactions_log
**Purpose**: Enhanced AI interaction logging
```sql
CREATE TABLE ai_interactions_log (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    interaction_type VARCHAR NOT NULL,  -- 'search', 'create', 'modify', 'explain'
    query TEXT NOT NULL,
    response_length INTEGER,
    processing_time_ms INTEGER,
    feedback_decision VARCHAR,          -- 'approved', 'declined', 'edited'
    created_at DATETIME DEFAULT NOW()
);
```

**Usage**: Detailed logging of AI interactions with performance metrics.

#### 10. ai_interaction_reviews
**Purpose**: Admin review system for AI interactions
```sql
CREATE TABLE ai_interaction_reviews (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,          -- Discord ID
    interaction_type VARCHAR NOT NULL, -- 'create', 'edit', 'explain'
    original_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    generated_code TEXT,
    status VARCHAR DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'modified'
    admin_notes TEXT,
    admin_modified_code TEXT,
    reviewed_by VARCHAR,               -- Admin Discord ID
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT NOW()
);
```

**Usage**: Admin review workflow for AI-generated code with approval/rejection system.

#### 11. rule_suggestions
**Purpose**: AI rule improvement suggestions
```sql
CREATE TABLE rule_suggestions (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    suggestion TEXT NOT NULL,
    status VARCHAR DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    admin_notes TEXT,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: User-submitted suggestions for improving AI rules with admin approval workflow.

### Advanced Training Data Tables

#### 12. ai_training_sessions
**Purpose**: AI training session tracking
```sql
CREATE TABLE ai_training_sessions (
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
);
```

**Usage**: Tracks complete user sessions for training data analysis.

#### 13. ai_training_interactions
**Purpose**: Comprehensive AI interaction data collection
```sql
CREATE TABLE ai_training_interactions (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    interaction_type VARCHAR NOT NULL,  -- 'question', 'edit', 'feedback', 'rule_suggestion'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Input data
    user_query TEXT,
    context_data TEXT,                  -- JSON of retrieved context
    rules_version VARCHAR,
    model_version VARCHAR,
    
    -- AI response data
    ai_response_raw TEXT,               -- Full AI response
    ai_explanation TEXT,                -- Extracted explanation
    ai_generated_code TEXT,             -- Extracted code
    ai_confidence_score REAL,
    response_time_ms INTEGER,
    
    -- User interaction data
    user_edited_code TEXT,              -- If user edited the code
    user_feedback_decision VARCHAR,     -- 'approved', 'declined', 'edited'
    user_rating INTEGER,                -- 1-5 rating
    user_feedback_reasons TEXT,         -- JSON array of reasons
    code_edit_diff TEXT,                -- Diff between original and edited
    
    -- Learning data
    rule_suggestions_generated TEXT,    -- JSON array of suggestions
    rule_suggestions_submitted TEXT,    -- JSON array of submitted rules
    learning_insights TEXT,             -- JSON of insights extracted
    
    -- Quality metrics
    code_quality_score REAL,            -- Automated quality assessment
    explanation_clarity_score REAL,
    user_satisfaction REAL,
    correction_necessity_score REAL,    -- How much correction was needed
    
    -- Metadata
    script_category VARCHAR,            -- Extracted from query/context
    script_complexity VARCHAR,          -- 'simple', 'medium', 'complex'
    tags TEXT,                          -- JSON array of tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Comprehensive data collection for AI training and improvement with quality metrics.

#### 14. code_correction_patterns
**Purpose**: Pattern analysis for code corrections
```sql
CREATE TABLE code_correction_patterns (
    id VARCHAR PRIMARY KEY,
    interaction_id VARCHAR NOT NULL,    -- Foreign key to ai_training_interactions
    pattern_type VARCHAR NOT NULL,      -- 'serial_to_name', 'missing_waitforgump', etc.
    original_code TEXT NOT NULL,
    corrected_code TEXT NOT NULL,
    correction_reason TEXT,
    frequency_score INTEGER DEFAULT 1,
    success_rate REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Tracks common correction patterns to improve AI rule generation.

#### 15. user_behavior_patterns
**Purpose**: User behavior analysis
```sql
CREATE TABLE user_behavior_patterns (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    session_id VARCHAR NOT NULL,
    behavior_type VARCHAR NOT NULL,     -- 'edit_frequency', 'feedback_pattern', 'preference'
    behavior_data TEXT,                 -- JSON of behavior data
    frequency INTEGER DEFAULT 1,
    confidence_score REAL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Analyzes user behavior patterns for personalized AI responses.

#### 16. training_data_quality
**Purpose**: Quality metrics for training data
```sql
CREATE TABLE training_data_quality (
    id VARCHAR PRIMARY KEY,
    data_type VARCHAR NOT NULL,         -- 'interaction', 'correction', 'feedback'
    quality_metrics TEXT,               -- JSON of quality scores
    data_volume INTEGER,
    quality_score REAL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Tracks quality metrics for collected training data.

#### 17. ai_model_performance
**Purpose**: AI model performance tracking
```sql
CREATE TABLE ai_model_performance (
    id VARCHAR PRIMARY KEY,
    model_version VARCHAR NOT NULL,
    rules_version VARCHAR NOT NULL,
    metric_name VARCHAR NOT NULL,       -- 'accuracy', 'user_satisfaction', 'code_quality'
    metric_value REAL NOT NULL,
    sample_size INTEGER,
    measurement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage**: Tracks AI model performance metrics over time.

## Database Relationships

### Primary Relationships
1. **suggestions** → **admins** (reviewed_by → discord_id)
2. **script_ratings** → **scripts_cache** (script_id → id)
3. **ai_interaction_reviews** → **admins** (reviewed_by → discord_id)
4. **code_correction_patterns** → **ai_training_interactions** (interaction_id → id)

### Data Flow Patterns
1. **User Submissions**: suggestions, scripts_cache (pending → approved workflow)
2. **AI Interactions**: interactions → ai_interaction_reviews → rule_suggestions
3. **Training Data**: ai_training_interactions → code_correction_patterns → training_data_quality
4. **Performance Tracking**: ai_model_performance ← training_data_quality

## Indexes and Performance

### Key Indexes
- `idx_suggestions_status` - Fast filtering of pending/approved suggestions
- `idx_scripts_cache_category` - Category-based script filtering
- `idx_script_ratings_script_id` - Fast rating lookups
- `idx_rag_chunks_source` - Source-based chunk retrieval
- `idx_ai_training_interactions_session_id` - Session-based queries
- `idx_code_correction_patterns_type` - Pattern type analysis

### Performance Considerations
- SQLite with proper indexing for single-user/small-team usage
- FAISS integration for vector similarity search
- JSON fields for flexible metadata storage
- Timestamp indexing for time-based queries

## Usage Patterns

### For AI Agents

#### Querying Scripts
```sql
-- Get approved scripts by category
SELECT id, title, author, code_preview, rating_average 
FROM scripts_cache 
WHERE category = 'gg-scripts' AND is_approved = TRUE
ORDER BY rating_average DESC, view_count DESC;
```

#### Retrieving RAG Context
```sql
-- Get script chunks for AI context
SELECT text, title, url 
FROM rag_chunks 
WHERE source = 'script' 
ORDER BY created_at DESC;
```

#### Logging AI Interactions
```sql
-- Log new AI interaction
INSERT INTO ai_training_interactions (
    id, session_id, user_id, interaction_type, 
    user_query, ai_response_raw, ai_generated_code
) VALUES (?, ?, ?, ?, ?, ?, ?);
```

#### Tracking Corrections
```sql
-- Record code correction pattern
INSERT INTO code_correction_patterns (
    id, interaction_id, pattern_type, 
    original_code, corrected_code
) VALUES (?, ?, ?, ?, ?);
```

### For Admin Operations

#### Reviewing Suggestions
```sql
-- Get pending suggestions
SELECT * FROM suggestions 
WHERE status = 'pending' 
ORDER BY created_at ASC;
```

#### Managing Scripts
```sql
-- Get pending scripts for approval
SELECT * FROM scripts_cache 
WHERE is_approved = FALSE 
ORDER BY created_at ASC;
```

#### AI Review Management
```sql
-- Get pending AI reviews
SELECT * FROM ai_interaction_reviews 
WHERE status = 'pending' 
ORDER BY created_at ASC;
```

## Migration History

### Key Migrations
1. **Initial Setup**: Core tables (suggestions, admins, dockmasters)
2. **Script System**: Added script management tables
3. **AI Integration**: Added AI interaction and RAG tables
4. **Training Data**: Added comprehensive training data collection
5. **Rule Suggestions**: Added AI rule improvement system

### Migration Scripts
- `migrate_db.py` - Core database setup
- `migrate_scripts_schema.py` - Script system tables
- `migrate_rule_suggestions.py` - Rule suggestions table
- `migrate_training_data.py` - Training data tables

## Security Considerations

### Data Protection
- Discord IDs stored for user identification
- Admin-only access to sensitive operations
- Input validation on all user data
- SQL injection prevention via parameterized queries

### Access Control
- Admin verification for all admin operations
- User authentication via Discord OAuth
- Session-based access control
- Audit trails for all admin actions

## Backup and Maintenance

### Backup Strategy
- Single SQLite file backup: `cp suggestions.db suggestions_backup.db`
- Regular automated backups recommended
- FAISS index files stored alongside database

### Maintenance Tasks
- Regular VACUUM operations for SQLite optimization
- Index maintenance and rebuilding if needed
- Data cleanup for old training data
- Performance monitoring and optimization

## Integration Points

### Frontend Integration
- REST API endpoints for all database operations
- Real-time updates via WebSocket (if implemented)
- Admin interface for database management

### AI System Integration
- Direct database access for RAG operations
- FAISS vector search integration
- Training data export for model improvement

### External Systems
- GitHub integration for PR management
- Discord API for user authentication
- OpenAI API for AI responses

## Best Practices for AI Agents

### When Working with This Database

1. **Always Use Transactions**: Wrap related operations in transactions
2. **Handle JSON Fields**: Parse JSON fields properly for tags and metadata
3. **Respect Relationships**: Use foreign keys correctly
4. **Index Usage**: Query indexed fields for better performance
5. **Error Handling**: Implement proper error handling for database operations
6. **Data Validation**: Validate data before insertion
7. **Audit Trails**: Log important operations for debugging

### Common Query Patterns

```sql
-- Get user's recent interactions
SELECT * FROM ai_training_interactions 
WHERE user_id = ? 
ORDER BY timestamp DESC 
LIMIT 10;

-- Find similar scripts by tags
SELECT * FROM scripts_cache 
WHERE JSON_EXTRACT(tags, '$') LIKE '%fishing%' 
AND is_approved = TRUE;

-- Get correction patterns for analysis
SELECT pattern_type, COUNT(*) as frequency 
FROM code_correction_patterns 
GROUP BY pattern_type 
ORDER BY frequency DESC;
```

This database structure supports the DM Portal's comprehensive functionality while maintaining data integrity, performance, and extensibility for future enhancements.
