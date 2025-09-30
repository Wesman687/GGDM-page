# AI Service Setup Instructions

**UPDATED: AI functionality is now consolidated into the main backend for simplified setup.**

## Prerequisites

1. **Python 3.10+**
2. **SQLite** (no PostgreSQL required)
3. **OpenAI API Key**
4. **Existing DM Portal** (backend and frontend)

## Step 1: Install Dependencies

```bash
cd backend
pip install openai==1.* tenacity sqlalchemy faiss-cpu numpy fastapi uvicorn[standard] pydantic==2.* python-dotenv
```

**Note: No PostgreSQL or pgvector installation required!**

## Step 2: Configure Environment

Create or update your `.env` file in the backend directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# AI Database Configuration (SQLite)
AI_DB_DSN=sqlite:///./ai_service.db

# File Paths (relative to backend directory)
RULES_PATH=backend/ai/rules/RULES.md
SCRIPTS_PATH=backend/ai/data/scripts.jsonl
DOCS_PATH=backend/ai/data/docs/razor_scripting.md

# AI Configuration
MAX_CONTEXT_CHARS=16000
TOP_K=8
```

## Step 3: Ingest Data

```bash
cd backend/ai
python indexer/ingest.py
```

This will:
- Process scripts from `data/scripts.jsonl`
- Process documentation from `data/docs/razor_scripting.md`
- Process rules from `rules/RULES.md`
- Generate embeddings for all chunks
- Store everything in SQLite + FAISS

## Step 4: Start Services (Simplified)

### Terminal 1: Main Backend (Port 7000) - Includes AI
```bash
cd backend
python main.py
```

### Terminal 2: Frontend (Port 3000)
```bash
cd frontend
npm run dev
```

**That's it! Only 2 services to run instead of 3.**

## Step 5: Test the Integration

### Test Main Backend Health (includes AI)
```bash
curl http://localhost:7000/health
```

### Test AI Search
```bash
curl -X POST http://localhost:7000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a fishing script?"}'
```

### Test Frontend Integration
1. Open http://localhost:3000/scripts
2. Click "AI Assistant" button
3. Ask a question like "Create a fishing script"
4. Verify response includes code and citations

## Troubleshooting

### Common Issues

#### 1. SQLite Database Error
```
Error: database connection failed
```
**Solution**: Ensure SQLite database file can be created and is writable.

#### 2. FAISS Import Error
```
ERROR: No module named 'faiss'
```
**Solution**: Install FAISS:
```bash
pip install faiss-cpu
```

#### 3. OpenAI API Error
```
Error: Invalid API key
```
**Solution**: Verify your OpenAI API key is correct and has sufficient credits.

#### 4. Port Already in Use
```
Error: [Errno 98] Address already in use
```
**Solution**: Check if port 7000 is already in use and kill the process or change the port.

#### 5. Data Ingestion Fails
```
Error: No data to ingest!
```
**Solution**: Ensure data files exist:
- `backend/ai/data/scripts.jsonl`
- `backend/ai/data/docs/razor_scripting.md`
- `backend/ai/rules/RULES.md`

### Debugging Steps

1. **Check Service Status**:
   ```bash
   curl http://localhost:7000/health  # Main backend (includes AI)
   ```

2. **Check Database Connection**:
   ```bash
   sqlite3 ai_service.db "SELECT COUNT(*) FROM rag_chunks;"
   ```

3. **Check Logs**:
   - Main backend (includes AI): Console output
   - Frontend: Browser console

4. **Verify Environment Variables**:
   ```bash
   cd backend
   python -c "from ai_settings import *; print('AI settings loaded successfully')"
   ```

## Production Deployment

### 1. Use Process Manager (Simplified)
```bash
# Install PM2
npm install -g pm2

# Start services (only 2 instead of 3!)
pm2 start "python main.py" --name "dm-portal-backend" --cwd backend
pm2 start "npm run start" --name "dm-portal-frontend" --cwd frontend
```

### 2. Configure Reverse Proxy (nginx) - Simplified
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api/ {
        proxy_pass http://localhost:7000;
    }
}
```

### 3. Set Up Monitoring (Simplified)
- Monitor OpenAI API usage and costs
- Set up SQLite database monitoring
- Configure log aggregation
- Set up alerting for service failures (only 2 services to monitor!)

## Maintenance

### Regular Tasks

1. **Update Data** (when new scripts added):
   ```bash
   cd backend/ai
   python indexer/ingest.py
   ```

2. **Database Maintenance**:
   ```bash
   sqlite3 ai_service.db "VACUUM;"
   ```

3. **Monitor Costs**:
   - Check OpenAI API usage
   - Monitor database performance
   - Review interaction statistics

### Backup Strategy (Simplified)

1. **SQLite Backup**:
   ```bash
   cp ai_service.db ai_service_backup.db
   ```

2. **Data Files Backup**:
   ```bash
   tar -czf ai_data_backup.tar.gz backend/ai/data/ backend/ai/rules/
   ```

3. **Configuration Backup**:
   ```bash
   cp .env .env.backup
   ```
