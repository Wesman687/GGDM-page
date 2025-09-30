# AI Integration Architecture

## Overview

This document describes the AI integration architecture for the DM Portal Scripts system. The AI system provides RAG (Retrieval-Augmented Generation) capabilities for Razor Scripting assistance.

**UPDATED: The AI service has been consolidated into the main backend for simplified deployment and better performance.**

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Main Backend  │
│   (Port 3000)   │◄──►│   (Port 7000)   │
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   (All Data)    │
                       └─────────────────┘
```

## Components

### 1. Frontend (Next.js)
- **Location**: `frontend/`
- **Port**: 3000
- **Components**:
  - `ScriptsSearchBar.tsx` - Search interface with AI/Manual modes
  - `AIBotInterface.tsx` - Chat interface for AI interactions
  - `ScriptViewer.tsx` - Professional code display
  - `ScriptCard.tsx` - Script listing cards

### 2. Main Backend (FastAPI) - Consolidated
- **Location**: `backend/`
- **Port**: 7000
- **Components**:
  - `routes/scripts.py` - Scripts CRUD and direct AI integration
  - `database.py` - SQLite database models
  - `models.py` - Pydantic models
  - `ai_*.py` - AI functionality modules (consolidated from separate service)
  - `ai/` - AI data and configuration (embeddings, rules, scripts)

## Data Flow

### AI Search Flow (Consolidated)
1. User types query in frontend
2. Frontend sends request to main backend (`/api/scripts/ai/search`)
3. Main backend performs RAG directly:
   - Generates query embedding
   - Searches SQLite + FAISS for relevant chunks
   - Formats context
   - Calls OpenAI API
   - Returns response with code and citations
4. Frontend displays response with feedback options

### Feedback Flow (Consolidated)
1. User submits feedback (approve/decline/edit)
2. Frontend sends to main backend (`/api/scripts/ai/feedback`)
3. Main backend stores feedback in SQLite
4. Response confirmed to frontend

## Database Schema

### SQLite (Consolidated Backend)
- `scripts_cache` - Script metadata and previews
- `script_ratings` - User ratings
- `ai_interactions_log` - Basic interaction logging
- `script_tags_config` - Tag configuration
- `rag_chunks` - Vector embeddings of scripts/docs/rules (with FAISS index)
- `interactions` - Detailed AI interaction logs with feedback

## Environment Configuration

### Required Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# Database Configuration (SQLite with FAISS)
AI_DB_DSN=sqlite:///./ai_service.db

# File Paths
RULES_PATH=backend/ai/rules/RULES.md
SCRIPTS_PATH=backend/ai/data/scripts.jsonl
DOCS_PATH=backend/ai/data/docs/razor_scripting.md

# AI Configuration
MAX_CONTEXT_CHARS=16000
TOP_K=8
```

## Data Sources

### 1. Scripts Data
- **Source**: `backend/ai/data/scripts.jsonl`
- **Format**: JSONL with title, author, category, tags, code, url
- **Processing**: Chunked by logical code blocks

### 2. Documentation
- **Source**: `backend/ai/data/docs/razor_scripting.md`
- **Format**: Markdown documentation
- **Processing**: Chunked by headers and sections

### 3. Rules
- **Source**: `backend/ai/rules/RULES.md`
- **Format**: Markdown rules and guidelines
- **Processing**: Chunked by sections

## API Endpoints

### Main Backend (Port 7000) - Consolidated
```
GET  /api/scripts/                    # List scripts
POST /api/scripts/ai/search          # AI search (direct)
POST /api/scripts/ai/feedback        # AI feedback (direct)
GET  /ask                             # AI question/answer (direct)
POST /feedback                        # Submit feedback (direct)
GET  /ai/stats                        # AI interaction statistics
GET  /ai/interactions                 # Recent AI interactions
GET  /health                          # Health check
```

## Deployment

### Development (Simplified)
```bash
# Terminal 1: Main Backend (includes AI)
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Production (Simplified)
- Use process managers (PM2, systemd) for single backend service
- Configure reverse proxy (nginx) for single backend
- Set up SQLite with FAISS (no PostgreSQL required)
- Configure environment variables
- Set up monitoring and logging

## Security Considerations

1. **API Keys**: Store OpenAI API key securely
2. **CORS**: Configure appropriate CORS policies
3. **Rate Limiting**: Implement rate limiting for AI endpoints
4. **Input Validation**: Validate all user inputs
5. **Error Handling**: Don't expose sensitive error details

## Monitoring

### Health Checks
- Main backend (includes AI): `GET /health`

### Metrics to Track
- AI response times
- OpenAI API usage/costs
- User feedback rates
- Database performance
- Error rates

## Troubleshooting

### Common Issues
1. **AI Functionality Unavailable**: Check if AI modules are properly imported
2. **Database Connection**: Verify SQLite database connection
3. **OpenAI API**: Check API key and rate limits
4. **Embeddings**: Ensure data ingestion completed and FAISS index loaded
5. **CORS Issues**: Check CORS configuration

### Logs
- Main backend (includes AI): Console output
- Database: SQLite database file
- Frontend: Browser console

## Future Enhancements

1. **Caching**: Implement Redis caching for frequent queries
2. **Batch Processing**: Batch embedding generation
3. **Model Fine-tuning**: Use feedback data for fine-tuning
4. **Advanced Analytics**: Detailed usage analytics
5. **Multi-language**: Support for other scripting languages
6. **Real-time Updates**: WebSocket for real-time responses
7. **A/B Testing**: Test different AI models/prompts
8. **Cost Optimization**: Optimize OpenAI API usage

## Maintenance

### Regular Tasks
1. **Data Ingestion**: Re-run ingestion when new scripts added
2. **Database Maintenance**: Regular PostgreSQL maintenance
3. **Model Updates**: Update OpenAI models as needed
4. **Rule Updates**: Update rules based on feedback
5. **Performance Monitoring**: Monitor response times and costs

### Backup Strategy
1. **PostgreSQL**: Regular database backups
2. **SQLite**: Backup script metadata
3. **Data Files**: Backup source data files
4. **Configuration**: Backup environment configuration
