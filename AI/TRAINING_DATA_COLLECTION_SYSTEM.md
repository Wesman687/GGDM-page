# AI Training Data Collection System

## Overview

The AI Training Data Collection System is a comprehensive solution for capturing, analyzing, and exporting data from AI interactions to improve model performance and create custom training datasets. This system automatically collects valuable training data from every user interaction, code correction, and feedback submission.

## Features

### 1. Comprehensive Data Collection
- **User Interactions**: Every AI query and response is logged with full context
- **Code Corrections**: User edits and corrections are captured with before/after comparisons
- **Feedback Data**: User ratings, decisions, and feedback reasons are stored
- **Behavioral Patterns**: User interaction patterns and preferences are tracked
- **Quality Metrics**: Automated quality assessment of AI responses and user satisfaction

### 2. Advanced Analytics
- **Performance Metrics**: Track AI response quality over time
- **Correction Patterns**: Identify common issues and improvement opportunities
- **User Satisfaction**: Monitor user ratings and approval rates
- **Quality Trends**: Visualize improvement in AI performance over time
- **Pattern Recognition**: Automatically detect and categorize correction patterns

### 3. Data Export Capabilities
- **Multiple Formats**: Export data in JSON format for easy processing
- **Filtered Exports**: Export data by date range, user, or interaction type
- **Privacy Controls**: Anonymize user data for public datasets
- **Training-Ready**: Format data for machine learning model training

## Database Schema

### Core Tables

#### ai_training_interactions
```sql
CREATE TABLE ai_training_interactions (
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
);
```

#### code_correction_patterns
```sql
CREATE TABLE code_correction_patterns (
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
);
```

#### user_behavior_patterns
```sql
CREATE TABLE user_behavior_patterns (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    session_id VARCHAR NOT NULL,
    behavior_type VARCHAR NOT NULL,  -- 'edit_frequency', 'feedback_pattern', 'preference'
    behavior_data TEXT,  -- JSON of behavior data
    frequency INTEGER DEFAULT 1,
    confidence_score REAL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Collection Process

### 1. Interaction Logging
Every AI interaction is automatically logged with:
- **User Query**: The original question or request
- **Context Data**: Retrieved chunks and citations used
- **AI Response**: Complete response including explanation and code
- **Timing Data**: Response time and processing metrics
- **Quality Scores**: Automated assessment of response quality

### 2. Correction Tracking
When users edit AI-generated code:
- **Before/After Comparison**: Original vs edited code
- **Pattern Detection**: Automatic identification of correction patterns
- **Reason Analysis**: Understanding why corrections were made
- **Frequency Tracking**: How often specific patterns occur

### 3. Feedback Integration
User feedback is captured with:
- **Rating Data**: 1-5 star ratings
- **Decision Data**: Approved, declined, or edited
- **Reason Data**: Specific reasons for feedback
- **Satisfaction Metrics**: Overall user satisfaction scores

## Quality Assessment

### Automated Quality Scoring

#### Code Quality Score (0-1)
- **Good Practices**: +0.1 for proper variable capture, gump handling, ignore management
- **Bad Practices**: -0.2 for serial numbers, infinite loops without waits
- **Documentation**: +0.05 for comments and explanations

#### Explanation Clarity Score (0-1)
- **Length**: +0.1 for adequate explanation length
- **Purpose**: +0.1 for explaining what and how
- **Structure**: +0.1 for multiple sentences
- **Accuracy**: +0.05 for no obvious errors

#### User Satisfaction Score (0-1)
- **Rating-Based**: Direct conversion from 1-5 rating scale
- **Feedback-Based**: Inferred from approval/decline decisions
- **Behavior-Based**: Based on edit frequency and patterns

#### Correction Necessity Score (0-1)
- **Diff Analysis**: Measures how much code was changed
- **Pattern Recognition**: Identifies common correction types
- **Severity Assessment**: Evaluates the importance of corrections

## Analytics and Insights

### Key Metrics
- **Total Interactions**: Number of AI interactions logged
- **Average User Rating**: Mean user satisfaction score
- **Approval Rate**: Percentage of approved responses
- **Correction Patterns**: Most common types of corrections
- **Quality Trends**: Performance improvement over time

### Pattern Recognition
The system automatically identifies common correction patterns:
- **Serial to Name**: Converting serial numbers to item names
- **Missing Waitforgump**: Adding proper gump handling
- **Missing Clearignore**: Adding ignore management
- **Improper Findtype**: Fixing findtype usage
- **Missing Waits**: Adding necessary delays

### Quality Trends
Track AI performance improvement over time:
- **Code Quality**: Automated assessment of generated code
- **Explanation Clarity**: Quality of AI explanations
- **User Satisfaction**: Overall user happiness
- **Correction Frequency**: How often corrections are needed

## Export Capabilities

### Data Export Formats
- **JSON Export**: Complete dataset in JSON format
- **Filtered Exports**: By date range, user, or interaction type
- **Pattern Exports**: Specific correction patterns only
- **Quality Exports**: High-quality interactions only

### Privacy Controls
- **User Anonymization**: Remove or hash user identifiers
- **Data Sanitization**: Remove sensitive information
- **Consent Tracking**: Track user consent for data usage
- **Retention Policies**: Automatic data cleanup

### Training Data Preparation
- **Format Conversion**: Convert to ML training formats
- **Quality Filtering**: Include only high-quality interactions
- **Balanced Datasets**: Ensure representative samples
- **Validation Sets**: Separate training and validation data

## Usage Examples

### Example 1: Code Quality Improvement
```
Original AI Code: if findtype 0x0E7D backpack as pole
User Edits To:    if findtype "fishing pole" backpack as pole
System Logs:      - Pattern: serial_to_name
                  - Quality improvement: +0.2
                  - User satisfaction: 0.8
                  - Correction necessity: 0.3
```

### Example 2: Pattern Recognition
```
Pattern Detected: missing_waitforgump
Frequency: 15 occurrences
Success Rate: 0.9
Rule Generated: "Always add waitforgump after gumpresponse"
```

### Example 3: Quality Trend Analysis
```
Date: 2024-01-15
Code Quality: 0.75 (+0.05 from previous day)
User Satisfaction: 0.82 (+0.03 from previous day)
Correction Rate: 0.12 (-0.02 from previous day)
```

## Admin Interface

### Training Data Dashboard
- **Key Metrics**: Overview of system performance
- **Correction Patterns**: Most common issues and fixes
- **Quality Trends**: Performance over time
- **Export Tools**: Download training data

### Analytics Features
- **Interactive Charts**: Visualize trends and patterns
- **Filtering Options**: Analyze specific time periods
- **Export Capabilities**: Download data in various formats
- **Quality Monitoring**: Track data quality metrics

## API Endpoints

### Analytics Endpoints
- `GET /api/ai/training-analytics` - Get comprehensive analytics
- `GET /api/ai/export-training-data` - Export training data
- `GET /api/ai/training-data-quality` - Get quality metrics

### Data Collection Endpoints
- `POST /api/ai/search` - Log AI interactions (enhanced)
- `POST /api/ai/feedback` - Log user feedback (enhanced)
- `POST /api/ai/rule-suggestions` - Log rule suggestions

## Benefits

### For AI Development
1. **Continuous Learning**: AI improves with each interaction
2. **Pattern Recognition**: Identify common issues and solutions
3. **Quality Metrics**: Track performance improvements
4. **Training Data**: Rich dataset for model training

### For Users
1. **Better AI**: Improved responses over time
2. **Community Learning**: System learns from all users
3. **Quality Assurance**: Automated quality assessment
4. **Feedback Integration**: User input directly improves AI

### For Admins
1. **Performance Monitoring**: Track AI improvement
2. **Data Insights**: Understand user needs and patterns
3. **Quality Control**: Monitor and improve data quality
4. **Export Capabilities**: Use data for external analysis

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Use collected data for ML model training
2. **Advanced Pattern Recognition**: More sophisticated pattern detection
3. **Predictive Analytics**: Predict user needs and preferences
4. **Automated Model Updates**: Retrain models based on collected data

### Advanced Analytics
1. **Sentiment Analysis**: Analyze user feedback sentiment
2. **Usage Patterns**: Understand how users interact with AI
3. **Performance Optimization**: Identify bottlenecks and improvements
4. **Custom Metrics**: Define custom quality and performance metrics

## Privacy and Security

### Data Protection
- **User Consent**: Clear consent for data collection
- **Anonymization**: Remove identifying information
- **Encryption**: Secure storage of sensitive data
- **Access Control**: Admin-only access to training data

### Compliance
- **Data Retention**: Automatic cleanup of old data
- **User Rights**: Allow users to view and delete their data
- **Transparency**: Clear documentation of data usage
- **Audit Trails**: Track all data access and modifications

The AI Training Data Collection System provides a comprehensive foundation for continuous AI improvement, enabling data-driven enhancements to the AI assistant's performance and creating valuable datasets for future model training and research.
