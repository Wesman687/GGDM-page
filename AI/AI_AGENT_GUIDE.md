# AI Agent System Guide

## Overview

The AI Agent System is a sophisticated Razor Scripting assistant that helps users create, modify, and understand Razor scripts for UO Outlands. It uses Retrieval-Augmented Generation (RAG) to provide accurate, context-aware script generation based on existing scripts, official documentation, and custom rules.

## Architecture

### Components

1. **Frontend Interface** (`frontend/components/AIBotInterface.tsx`)
   - Modal-based chat interface
   - Real-time conversation with AI
   - Code display with syntax highlighting
   - Feedback submission system

2. **Main Backend** (`backend/`) - **CONSOLIDATED**
   - API endpoints for AI interactions
   - User authentication and authorization
   - Script management and storage
   - Admin controls for AI reviews
   - **AI functionality integrated directly**

3. **Database Systems** - **SIMPLIFIED**
   - **SQLite with FAISS**: All data including RAG chunks, script metadata, ratings, AI interaction logs

## How It Works

### 1. User Query Processing

When a user asks a question:

1. **Query Analysis**: The consolidated backend receives the user's question
2. **Context Retrieval**: RAG system searches for relevant information from:
   - GG Scripts (prioritized - 60% of results)
   - Other scripts and documentation (40% of results)
   - Official Outlands Razor Scripting documentation
   - Custom AI rules
3. **Context Formatting**: Retrieved information is organized with:
   - GG Scripts section (priority reference)
   - Additional reference materials
   - Analysis instructions for the AI
4. **LLM Processing**: GPT-4o-mini generates response using:
   - Retrieved context
   - Custom rules
   - User's specific question
5. **Code Extraction**: Generated Razor code is extracted and linted
6. **Response Delivery**: Complete response with explanation, code, and caveats

### 2. RAG System Details

#### Data Sources
- **Scripts**: 6,444 chunks from existing Razor scripts
- **Documentation**: 71 chunks from official Outlands Razor documentation
- **Rules**: 21 chunks from custom AI rules

#### Search Algorithm (SQLite + FAISS)
```python
# Uses FAISS for vector similarity search with SQLite for metadata
# GG Scripts get priority in the retrieval process
# Fallback to text search if FAISS is not available
```

#### Context Formatting
The AI receives structured context:
```
=== GG SCRIPTS (PRIORITY REFERENCE) ===
--- GG Script 1: Fishing Macro (Relevance: 0.95) ---
[Script content]

=== ADDITIONAL REFERENCE MATERIALS ===
--- Documentation 1: Razor Commands (Relevance: 0.72) ---
[Documentation content]

=== ANALYSIS INSTRUCTIONS ===
1. PRIORITIZE patterns from GG Scripts above
2. Use multiple GG Script examples to understand best practices
3. Combine techniques from different GG Scripts when appropriate
4. Reference additional materials only for specific technical details
5. Ensure your script follows GG Script conventions and patterns
```

### 3. AI Rules System

#### Rules Management
- **Location**: `backend/ai/rules/RULES.md`
- **Admin Control**: Admins can edit rules through `/admin-ai-rules` page
- **Versioning**: Automatic backups created on each update
- **Integration**: Rules are loaded and applied to every AI response

#### Current Rules Include
- Core Razor principles (clear, minimal code)
- Critical requirements (gump interactions, ignore management)
- Code structure guidelines
- Performance guidelines
- Common patterns and anti-patterns
- Best practices for testing and documentation

### 4. Feedback and Learning System

#### AI Interaction Reviews
When AI generates code, it creates an `AIInteractionReview` entry:
- **Status**: `pending` (requires admin review)
- **Content**: Original query, AI response, generated code
- **Admin Actions**: Approve, reject, or modify code
- **Learning**: Approved interactions improve future responses

#### Feedback Loop
1. User asks question → AI generates response
2. Admin reviews generated code
3. Admin approves/modifies/rejects
4. Approved code becomes training data
5. System learns from approved patterns

## Usage Guide

### For Users

#### Starting a Conversation
1. Navigate to Scripts page
2. Click "Ask AI Assistant" button
3. Type your question in the chat interface
4. Wait for AI response
5. Review generated code and explanation

#### Best Practices for Questions
- **Be Specific**: "Create a fishing macro" vs "Create a fishing macro that uses bandages when health is low"
- **Include Context**: Mention skill levels, equipment, or specific requirements
- **Ask Follow-ups**: The AI remembers conversation context
- **Provide Feedback**: Use the feedback system to improve responses

#### Example Questions
```
"Create a macro that finds and uses bandages when my health is below 80%"

"Help me modify this script to add error checking for missing items"

"How do I create a timer that resets every 30 seconds?"

"Create a script that uses the cooldown system for potion usage"
```

### For Admins

#### Managing AI Rules
1. Navigate to Admin Panel → AI Rules Management
2. Edit rules in the text editor
3. Save changes (automatic backup created)
4. Rules immediately affect AI responses

#### Reviewing AI Interactions
1. Navigate to Admin Panel → Script Management
2. View pending AI interaction reviews
3. Actions available:
   - **Approve**: Code becomes available for future reference
   - **Modify**: Edit the code and approve modified version
   - **Reject**: Mark as rejected with reason
   - **Create Script**: Convert approved interaction to a script

#### Monitoring AI Performance
- View AI interaction statistics
- Track approval/rejection rates
- Monitor common issues or patterns
- Update rules based on feedback

## Technical Details

### API Endpoints (Consolidated)

#### Main Backend Endpoints (includes AI)
- `POST /ask` - Submit question to AI
- `POST /feedback` - Submit feedback on AI response
- `GET /ai/stats` - AI interaction statistics
- `GET /ai/interactions` - Recent AI interactions
- `GET /health` - Service health check
- `POST /api/scripts/ai/search` - Search AI interactions
- `POST /api/scripts/ai/feedback` - Submit AI feedback
- `GET /api/scripts/admin/ai-reviews` - Get AI interaction reviews
- `PUT /api/scripts/admin/ai-reviews/{id}` - Update AI review
- `POST /api/scripts/admin/ai-reviews/{id}/create-script` - Create script from review

### Database Schema

#### AI Interaction Reviews
```sql
CREATE TABLE ai_interaction_reviews (
    id VARCHAR PRIMARY KEY,
    session_id VARCHAR,
    user_id VARCHAR,
    interaction_type VARCHAR,
    original_query TEXT,
    ai_response TEXT,
    generated_code TEXT,
    status VARCHAR DEFAULT 'pending',
    admin_notes TEXT,
    admin_modified_code TEXT,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### RAG Chunks (SQLite + FAISS)
```sql
CREATE TABLE rag_chunks (
    id TEXT PRIMARY KEY,
    source TEXT CHECK (source IN ('script','docs','rules')),
    title TEXT,
    url TEXT,
    text TEXT NOT NULL,
    meta TEXT DEFAULT '{}', -- JSON stored as TEXT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Embeddings stored in separate FAISS index file
```

### Configuration

#### Environment Variables (Consolidated)
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
MAX_CONTEXT_CHARS=16000
TOP_K=8

# Database Configuration (SQLite + FAISS)
DATABASE_URL=sqlite:///./suggestions.db
AI_DB_DSN=sqlite:///./ai_service.db

# File Paths
RULES_PATH=backend/ai/rules/RULES.md
SCRIPTS_PATH=backend/ai/data/scripts.jsonl
DOCS_PATH=backend/ai/data/docs/razor_scripting.md
```

## Troubleshooting

### Common Issues

#### AI Not Responding
1. Check main backend health: `GET /health`
2. Verify OpenAI API key
3. Check SQLite database connectivity
4. Review server logs

#### Poor Quality Responses
1. Check AI rules are up-to-date
2. Review recent feedback
3. Update documentation if needed
4. Consider rule modifications

#### Slow Response Times
1. Check embedding generation
2. Verify database performance
3. Monitor context size
4. Consider reducing TOP_K value

### Performance Optimization

#### Database Optimization
- Regular VACUUM on SQLite database
- Monitor FAISS index performance
- Monitor query performance

#### Context Management
- Limit MAX_CONTEXT_CHARS to prevent token overflow
- Optimize chunk sizes
- Balance TOP_K for quality vs speed

## Future Enhancements

### Planned Features
- **Custom Model Training**: Train on approved GG scripts
- **Advanced Analytics**: Detailed AI performance metrics
- **Rule Templates**: Pre-built rule sets for different script types
- **Batch Processing**: Process multiple questions at once
- **Integration APIs**: External system integration

### Continuous Improvement
- Regular documentation updates
- Rule refinement based on feedback
- Performance monitoring and optimization
- User experience enhancements

## Support

For technical issues or questions about the AI system:
1. Check this documentation
2. Review server logs
3. Contact system administrators
4. Submit issues through the feedback system

The AI Agent System is designed to continuously improve through user feedback and admin oversight, ensuring high-quality Razor script generation for the UO Outlands community.
