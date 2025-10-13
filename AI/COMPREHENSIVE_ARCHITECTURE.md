# DM Portal - Comprehensive Architecture Documentation

## System Overview

The **DM Portal** is a full-stack web application for the UO Outlands community that provides:
- **Dockmaster Suggestion System**: GitHub-integrated suggestion workflow for game locations
- **Razor Script Management**: Comprehensive script repository with rating and review system
- **AI-Powered Script Assistant**: RAG-based AI for intelligent script generation and assistance
- **Admin Management**: Complete admin workflow for content and AI management
- **Self-Learning AI**: Continuous improvement through user feedback and intent management

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER LAYER                           │
│  (Browser - Discord OAuth Authenticated GG Members)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
│  Next.js (Port 3000) - TypeScript + Tailwind CSS            │
│  - Pages: Scripts, Items, Admin, Suggest                     │
│  - Components: AIBotInterface, ScriptViewer, etc.            │
│  - Auth: NextAuth with Discord Provider                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND API LAYER                           │
│  FastAPI (Port 7000) - Python 3.10+                          │
│  ┌─────────────────┬──────────────────┬──────────────────┐  │
│  │  Main Routes    │  AI Integration  │  Admin Routes    │  │
│  │  - Scripts      │  - RAG System    │  - Reviews       │  │
│  │  - Items        │  - Intent Mgmt   │  - Uncertainty   │  │
│  │  - Suggestions  │  - Rules Engine  │  - Analytics     │  │
│  │  - Dockmasters  │  - Training Data │  - Management    │  │
│  └─────────────────┴──────────────────┴──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────────────┬────────────────────────────────┐  │
│  │  SQLite Database     │  FAISS Vector Index            │  │
│  │  - suggestions.db    │  - Embeddings for RAG          │  │
│  │  - ai_service.db     │  - Script chunks               │  │
│  │  - All metadata      │  - Documentation chunks        │  │
│  └──────────────────────┴────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                           │
│  - OpenAI API (GPT-4o-mini, text-embedding-3-small)          │
│  - Discord API (OAuth + Guild Verification)                  │
│  - GitHub API (Pull Request Creation)                        │
│  - UO Outlands Wiki (Knowledge Scraping)                     │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 13+ (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js with Discord Provider
- **HTTP Client**: Axios
- **State Management**: React Hooks + Context API
- **Code Display**: Syntax highlighting components

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **ORM**: SQLAlchemy
- **Database**: SQLite 3
- **Vector Search**: FAISS (Facebook AI Similarity Search)
- **AI/ML**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Validation**: Pydantic 2.x
- **Server**: Uvicorn

### AI System
- **RAG Framework**: Custom implementation with FAISS
- **Embeddings**: text-embedding-3-small (1536 dimensions)
- **LLM**: GPT-4o-mini
- **Context Window**: 16,000 characters max
- **Top-K Retrieval**: 8 chunks (60% GG Scripts, 40% other sources)

### Infrastructure
- **Version Control**: Git + GitHub
- **Branch Strategy**: dev (development) → main (production)
- **Environment**: .env files (excluded from git)
- **Deployment**: PM2 or systemd for production

## Directory Structure

```
dm-portal/
├── frontend/                      # Next.js Frontend
│   ├── pages/
│   │   ├── _app.tsx              # App wrapper with auth
│   │   ├── index.tsx             # Home page
│   │   ├── scripts.tsx           # Scripts listing
│   │   ├── scripts/[id].tsx      # Script detail with ratings
│   │   ├── items.tsx             # Items management
│   │   ├── suggest.tsx           # Dockmaster suggestions
│   │   ├── admin.tsx             # Admin dashboard
│   │   ├── admin-ai-management.tsx  # AI management interface
│   │   ├── admin-scripts.tsx     # Script management
│   │   ├── admin-items.tsx       # Item management
│   │   ├── auth/signin.tsx       # Discord sign-in
│   │   └── api/
│   │       ├── auth/[...nextauth].ts  # NextAuth config
│   │       └── verify-gg-member.ts    # Guild verification
│   ├── components/
│   │   ├── AIBotInterface.tsx    # AI chat interface
│   │   ├── ScriptViewer.tsx      # Code display
│   │   ├── ScriptCard.tsx        # Script cards with ratings
│   │   ├── CreateScriptModal.tsx # Script upload
│   │   ├── DiscordAuth.tsx       # Auth button
│   │   ├── GGMemberGuard.tsx     # Auth guard
│   │   └── items/                # Item components
│   ├── lib/
│   │   ├── api.ts                # API client
│   │   └── auth.tsx              # Auth context
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # TypeScript types
│   └── styles/                   # Global styles
│
├── backend/                       # FastAPI Backend
│   ├── main.py                   # Main FastAPI app with AI integration
│   ├── database.py               # SQLAlchemy models
│   ├── models.py                 # Pydantic models
│   ├── routes/
│   │   ├── scripts.py            # Script CRUD + AI endpoints
│   │   ├── items.py              # Item management
│   │   ├── admin.py              # Admin operations
│   │   ├── suggestions.py        # Dockmaster suggestions
│   │   ├── ai_intents.py         # Intent management
│   │   ├── ai_uncertainty.py     # Uncertainty handling
│   │   └── github.py             # GitHub integration
│   ├── ai_*.py                   # AI modules (consolidated)
│   │   ├── ai_models.py          # AI data models
│   │   ├── ai_settings.py        # AI configuration
│   │   ├── ai_rag.py             # RAG implementation
│   │   ├── ai_lint.py            # Code linting
│   │   └── ai_db.py              # AI database ops
│   ├── ai/                       # AI data and config
│   │   ├── data/
│   │   │   ├── scripts.jsonl     # Script corpus
│   │   │   └── docs/             # Documentation
│   │   ├── rules/
│   │   │   └── RULES.md          # AI behavior rules
│   │   └── indexer/
│   │       └── ingest.py         # Data ingestion
│   ├── utils/
│   │   ├── matcher.py            # Pattern matching
│   │   └── zone_validator.py    # Zone validation
│   ├── migrate_*.py              # Database migrations
│   ├── scraper.py                # Script scraper
│   └── requirements.txt          # Python dependencies
│
└── AI/                           # Documentation
    ├── Architecture.md           # System architecture
    ├── DATABASE_DOCUMENTATION.md # Database schema
    ├── AI_AGENT_GUIDE.md         # AI system guide
    ├── ADMIN_SCRIPT_MANAGEMENT_GUIDE.md
    ├── DISCORD_AUTHENTICATION_GUIDE.md
    ├── INTENT_MANAGEMENT_SYSTEM.md
    └── [other documentation]
```

## Core Features

### 1. Script Management System
- **User Uploads**: Discord-authenticated users can submit scripts
- **Admin Approval**: Scripts require admin approval before visibility
- **Rating System**: 1-5 star ratings with weighted scoring (Jasown scripts = 5x weight)
- **Tag System**: 3-tag limit with smart ranking algorithm
- **Search**: Manual (text/tag/rating) and AI-powered search
- **Featured Scripts**: Admin-controlled featured status with priority display

### 2. AI Assistant System
- **RAG Architecture**: Retrieval-Augmented Generation with FAISS
- **Data Sources**:
  - 6,444 script chunks (60% priority to GG Scripts)
  - 71 documentation chunks
  - 21 AI rules chunks
  - Wiki knowledge base
- **Features**:
  - Natural language queries
  - Code generation with citations
  - Interactive code editing
  - Feedback loop for learning
  - Rule suggestion system

### 3. Intent Management & Uncertainty System
- **Confidence Thresholds**:
  - High (0.8+): Proceed normally
  - Medium (0.5-0.8): Ask user confirmation
  - Low (0.3-0.5): Request admin review
  - Very Low (<0.3): Immediate admin review (high priority)
- **Intent Patterns**: Dynamic patterns in database
- **Self-Learning**: Wiki integration, usage tracking, admin feedback
- **Admin Interface**: Review queue, pattern management, analytics

### 4. Authentication & Authorization
- **Discord OAuth2**: NextAuth.js integration
- **Guild Verification**: GG Discord server membership required
- **Admin System**: 
  - Super admins (environment variable)
  - Regular admins (database)
  - Admin actions tracked with audit trails
- **Session Management**: JWT tokens with auto-refresh

### 5. Dockmaster Suggestion System
- **User Submissions**: Add/remove dockmaster location suggestions
- **GitHub Integration**: Automatic PR creation to game repository
- **Admin Workflow**: Approve/reject with GitHub synchronization
- **Zone Validation**: Validate coordinates and map data

## Database Schema

### Core Tables (suggestions.db)

#### Scripts System
```sql
scripts_cache
├── id (PRIMARY KEY)
├── title, author, category, language
├── tags (JSON), description
├── code_preview, full_code, exe_download_url
├── rating_average, rating_count
├── view_count, download_count
├── is_approved, is_featured
├── created_by (Discord ID)
└── approved_by (Discord ID)

script_ratings
├── id (PRIMARY KEY)
├── script_id (FOREIGN KEY)
├── user_id (Discord ID)
├── rating (1-5), review
├── weight (1=user, 5=Jasown)
└── is_jasown_rating

script_tags_config
├── id (PRIMARY KEY)
├── tag_name (UNIQUE)
├── tag_color, tag_category
└── is_active
```

#### AI System (ai_service.db)
```sql
rag_chunks
├── id (PRIMARY KEY)
├── source (script/docs/rules)
├── title, url, text
└── meta (JSON)

interactions
├── id (PRIMARY KEY)
├── question, assistant_draft
├── retrieved, citations
├── decision, rating, reasons
├── edits_diff
└── session_id

ai_interaction_reviews
├── id (PRIMARY KEY)
├── session_id, user_id
├── interaction_type
├── original_query, ai_response
├── generated_code
├── status (pending/approved/rejected)
├── admin_notes, admin_modified_code
└── reviewed_by (Discord ID)

intent_patterns
├── id (PRIMARY KEY)
├── intent_name
├── keywords (JSON), tags (JSON)
├── context_needed (JSON)
├── requirements (JSON)
├── confidence_score, usage_count
└── last_updated

uncertainty_requests
├── id (PRIMARY KEY)
├── user_query, detected_intent (JSON)
├── confidence_score, uncertainty_reason
├── suggested_action
├── admin_response (JSON)
├── status (pending/resolved)
└── resolved_by (Discord ID)

wiki_knowledge
├── id (PRIMARY KEY)
├── source_url, content_type
├── title, content
├── extracted_keywords (JSON)
├── extracted_intents (JSON)
└── confidence_score
```

#### Suggestions System
```sql
suggestions
├── id (PRIMARY KEY)
├── action (add/remove)
├── zone_id, x, y, map
├── enabled, reason
├── submitter_name, submitter_discord
├── status (pending/approved/rejected)
├── reviewed_by, reviewed_at
├── pr_url, pr_number
└── admin_notes

dockmasters
├── id (PRIMARY KEY)
├── zone_id, x, y, map
├── enabled, is_reference_point
└── added_by (Discord ID)

admins
├── discord_id (PRIMARY KEY)
├── username
├── added_by
└── is_active
```

## API Architecture

### Authentication Flow
```
1. User → Discord OAuth → NextAuth
2. NextAuth → Token → Frontend Session
3. Frontend → API Request + Discord ID
4. Backend → Verify Admin Status
5. Backend → Process Request
6. Backend → Response
```

### Key API Endpoints

#### Script Endpoints (backend/routes/scripts.py)
```
GET    /api/scripts/                          # List scripts with filters
POST   /api/scripts/                          # Create script (requires user_id)
GET    /api/scripts/{id}                      # Get script details
PUT    /api/scripts/{id}                      # Update script (admin only)
DELETE /api/scripts/{id}                      # Delete script (admin only)

POST   /api/scripts/{id}/rate                 # Rate script
GET    /api/scripts/{id}/ratings              # Get ratings

GET    /api/scripts/tags/                     # Get all tags
POST   /api/scripts/tags/                     # Create tag (admin only)

POST   /api/scripts/admin/{id}/toggle-featured   # Toggle featured
GET    /api/scripts/admin/analytics               # Get analytics
```

#### AI Endpoints (backend/routes/scripts.py)
```
POST   /api/scripts/ai/search                # AI search (RAG)
POST   /api/scripts/ai/feedback              # Submit feedback

GET    /api/scripts/admin/ai-rules           # Get AI rules
PUT    /api/scripts/admin/ai-rules           # Update rules (admin)

GET    /api/scripts/admin/ai-reviews         # Get AI reviews
PUT    /api/scripts/admin/ai-reviews/{id}    # Update review
```

#### Intent & Uncertainty Endpoints
```
GET    /api/ai/intents/patterns              # Get intent patterns
PUT    /api/ai/intents/patterns/{id}         # Update pattern
GET    /api/ai/intents/analytics             # Get analytics

GET    /api/ai/uncertainty/pending-reviews   # Get pending reviews
POST   /api/ai/uncertainty/resolve/{id}      # Resolve uncertainty
GET    /api/ai/uncertainty/stats             # Get stats
POST   /api/ai/uncertainty/analyze           # Analyze query
```

#### Admin Endpoints (backend/routes/admin.py)
```
GET    /api/admin/suggestions                # Get suggestions
PUT    /api/admin/suggestions/{id}           # Update suggestion
POST   /api/admin/suggestions/{id}/approve   # Approve (create PR)
POST   /api/admin/suggestions/{id}/reject    # Reject

GET    /api/admin/admins                     # List admins
POST   /api/admin/admins                     # Add admin (super admin only)
DELETE /api/admin/admins/{id}                # Remove admin
```

## AI System Architecture

### RAG Pipeline
```
1. User Query → Intent Analysis
   ├── Confidence Scoring
   ├── Uncertainty Assessment
   └── Context Requirements

2. Context Retrieval
   ├── Query Embedding (text-embedding-3-small)
   ├── FAISS Similarity Search (Top-K=8)
   ├── Priority: 60% GG Scripts, 40% Other
   └── Context Formatting

3. LLM Processing
   ├── Load AI Rules (RULES.md)
   ├── Format Prompt with Context
   ├── OpenAI API Call (GPT-4o-mini)
   └── Extract Code + Explanation

4. Response Delivery
   ├── Code Linting
   ├── Citation Generation
   ├── Feedback Collection
   └── Learning Integration
```

### Self-Learning System
```
1. User Edits Code
   ↓
2. Detect Correction Patterns
   ├── Serial number → Item name
   ├── Missing waitforgump
   ├── Missing @clearignore
   ├── Improper findtype
   └── Missing waits
   ↓
3. Generate Rule Suggestions
   ↓
4. Admin Review & Approval
   ↓
5. Auto-Update AI Rules
   ├── Backup RULES.md
   ├── Append New Rules
   └── Reload AI System
   ↓
6. Improved Future Responses
```

### Intent Pattern Matching
```
Input: User Query
  ↓
1. Extract Keywords & Tags
  ↓
2. Match Against Intent Patterns
   ├── Keyword Match Score (0.4 weight)
   ├── Tag Match Score (0.3 weight)
   ├── Context Match Score (0.2 weight)
   └── Usage History Score (0.1 weight)
  ↓
3. Calculate Confidence
  ↓
4. Determine Action
   ├── High (≥0.8): Proceed
   ├── Medium (0.5-0.8): Ask user
   ├── Low (0.3-0.5): Admin review
   └── Very Low (<0.3): Immediate admin review
```

## Data Flow Patterns

### Script Upload Flow
```
User (GG Member) → Discord Auth → Frontend Modal → API Request
  ↓
Backend Validation
  ├── Required fields check
  ├── Tag limit (max 3)
  ├── Code truncation (500 char preview)
  └── Category assignment
  ↓
Database Insert
  ├── scripts_cache (is_approved=FALSE)
  ├── created_by = Discord ID
  └── rating setup (Jasown auto-weighted)
  ↓
Admin Review Queue
  ↓
Admin Approval → is_approved=TRUE → Public Visibility
```

### AI Search Flow
```
User Query → Frontend AIBotInterface
  ↓
POST /api/scripts/ai/search
  ↓
Backend AI Processing
  ├── Intent Analysis (confidence scoring)
  ├── Uncertainty Check
  │   └── If Low: Add to admin review queue
  ├── RAG Retrieval (FAISS + SQLite)
  ├── Context Formatting (GG Scripts priority)
  ├── AI Rules Loading
  ├── OpenAI API Call
  └── Code Extraction & Linting
  ↓
Response to Frontend
  ├── Explanation
  ├── Generated Code
  ├── Citations
  └── Confidence Data
  ↓
User Feedback
  ├── Approve/Decline/Edit
  ├── Generate Rule Suggestions
  └── Log Training Data
  ↓
Admin Review (if needed)
  └── Update Intent Patterns
```

### Suggestion Workflow
```
User Submission → Frontend Form
  ↓
Backend Validation
  ├── Zone validation
  ├── Coordinate validation
  └── Duplicate check
  ↓
Database Insert (status=pending)
  ↓
Admin Review → Approve/Reject
  ↓
If Approved:
  ├── GitHub API Call
  ├── Create Pull Request
  ├── Store PR URL & Number
  └── Update status=approved
```

## Authentication & Authorization

### User Roles
```
1. Guest (Not Authenticated)
   └── View: Public scripts only

2. Authenticated User (Discord + GG Member)
   ├── View: All approved scripts
   ├── Create: Scripts, ratings, suggestions
   └── Submit: AI queries, feedback

3. Admin
   ├── All user permissions
   ├── Approve/Reject: Scripts, suggestions, AI reviews
   ├── Manage: Tags, featured status, AI rules
   ├── Edit: Intent patterns, uncertainty settings
   └── View: Analytics, training data

4. Super Admin
   ├── All admin permissions
   └── Manage: Admin users
```

### Auth Implementation
```typescript
// Frontend: NextAuth Configuration
providers: [DiscordProvider]
callbacks: {
  jwt: Store access token, refresh token, Discord ID
  session: Pass Discord info to client
}

// Frontend: GG Membership Verification
useAuth() Hook
  ├── Check NextAuth session
  ├── Call /api/verify-gg-member
  ├── Discord API: GET /users/@me/guilds
  ├── Verify GG_GUILD_ID present
  └── Cache result (5 min)

// Backend: Request Validation
FastAPI Dependency
  ├── Extract user_id from query params
  ├── Check admin status (if required)
  │   ├── Super admins (env var)
  │   └── Regular admins (database)
  └── Authorize or 403 Forbidden
```

## Environment Configuration

### Frontend (.env.local)
```bash
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_GG_GUILD_ID=xxx
NEXT_PUBLIC_ADMIN_IDS=comma,separated,ids
NEXT_PUBLIC_API_URL=http://localhost:7000
```

### Backend (.env)
```bash
# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# Database
AI_DB_DSN=sqlite:///./ai_service.db
DATABASE_URL=sqlite:///./suggestions.db

# AI Config
MAX_CONTEXT_CHARS=16000
TOP_K=8
RULES_PATH=backend/ai/rules/RULES.md
SCRIPTS_PATH=backend/ai/data/scripts.jsonl
DOCS_PATH=backend/ai/data/docs/razor_scripting.md

# Discord
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx

# GitHub
GITHUB_TOKEN=xxx
GITHUB_REPO_OWNER=LeoPiro
GITHUB_REPO_NAME=GG_Dms

# Admin
SUPER_ADMIN_IDS=comma,separated,discord,ids

# Intent Management
INTENT_CONFIDENCE_HIGH=0.8
INTENT_CONFIDENCE_MEDIUM=0.5
INTENT_CONFIDENCE_LOW=0.3
INTENT_CONFIDENCE_VERY_LOW=0.1

# Wiki Integration
WIKI_BASE_URL=https://wiki.uooutlands.com
WIKI_SCRAPING_ENABLED=true
WIKI_UPDATE_INTERVAL=86400
```

## Development Workflow

### Git Strategy
```
Branches:
  main (production)
    ↑
  dev (development) ← Active branch
    ↑
  feature/* (optional)

Workflow:
1. Work in 'dev' branch
2. Commit frequently
3. Push to origin/dev
4. When stable → merge to main
5. Tag releases (optional)
```

### Local Development
```bash
# Terminal 1: Backend (Port 7000)
cd backend
python main.py

# Terminal 2: Frontend (Port 3000)
cd frontend
npm run dev

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:7000
# - API Docs: http://localhost:7000/docs
```

### Key Coding Patterns

#### Frontend Patterns
```typescript
// API Calls with Auth
const response = await axios.get('/api/scripts', {
  params: {
    user_id: session.user.discordId,
    is_admin: isAdmin
  }
})

// Protected Routes
<GGMemberGuard>
  <ProtectedContent />
</GGMemberGuard>

// Admin Actions
if (isAdmin) {
  // Admin-only operations
}
```

#### Backend Patterns
```python
# Endpoint with Auth
@router.post("/", response_model=Script)
async def create_script(
    script_data: ScriptCreate,
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    # Create script logic
    
# Admin-Only Endpoint
async def admin_endpoint(
    user_id: str = Query(...),
    is_admin: bool = Query(...),
    db: Session = Depends(get_db)
):
    if not is_admin or not is_super_admin(user_id):
        raise HTTPException(403)
    # Admin logic
```

## Deployment

### Production Setup (PM2)
```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start "python main.py" --name "dm-backend" --cwd backend
pm2 start "npm run start" --name "dm-frontend" --cwd frontend

# Save and auto-restart
pm2 save
pm2 startup
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:7000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Backups
```bash
# SQLite Backups
cp backend/suggestions.db backups/suggestions_$(date +%Y%m%d).db
cp backend/ai_service.db backups/ai_service_$(date +%Y%m%d).db

# FAISS Index Backup
cp backend/ai/indexer/embeddings.npy backups/
```

## Performance Considerations

### Frontend Optimizations
- **Code Splitting**: Next.js automatic code splitting
- **Caching**: SWR for data fetching and caching
- **Debouncing**: Search input debounced (300ms)
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Next.js Image component

### Backend Optimizations
- **Database Indexing**: Indexes on frequently queried fields
- **Pagination**: All list endpoints paginated (max 100)
- **Connection Pooling**: SQLAlchemy connection pooling
- **Caching**: 5-minute cache for GG membership checks
- **Query Optimization**: Efficient joins and filters

### AI Optimizations
- **Context Limiting**: MAX_CONTEXT_CHARS=16000
- **Chunk Optimization**: Balanced chunk sizes
- **FAISS**: Fast vector similarity search
- **TOP_K Tuning**: Balance quality vs speed (TOP_K=8)
- **Response Caching**: Cache similar queries

## Security Considerations

### Authentication Security
- **OAuth2**: Discord OAuth2 flow
- **JWT**: Secure token storage
- **Token Refresh**: Automatic refresh before expiry
- **Session Security**: HTTPOnly cookies

### API Security
- **Input Validation**: Pydantic models
- **SQL Injection**: Parameterized queries (SQLAlchemy)
- **XSS Prevention**: Content sanitization
- **Rate Limiting**: Discord API rate limit handling
- **CORS**: Configured for frontend origin only

### Data Security
- **Environment Variables**: Secrets in .env (gitignored)
- **Admin Verification**: Server-side admin checks
- **Audit Trails**: All admin actions logged
- **User Privacy**: Discord IDs only, minimal data

## Monitoring & Maintenance

### Health Checks
```bash
# Backend Health
curl http://localhost:7000/health

# Database Check
sqlite3 suggestions.db "SELECT COUNT(*) FROM scripts_cache;"
sqlite3 ai_service.db "SELECT COUNT(*) FROM rag_chunks;"

# FAISS Index
python -c "import faiss; print('FAISS OK')"
```

### Regular Maintenance
```
Daily:
- Review pending suggestions
- Monitor AI uncertainty requests
- Check error logs

Weekly:
- Review AI analytics
- Update intent patterns
- Optimize database (VACUUM)
- Review admin actions

Monthly:
- Update dependencies
- Review system performance
- Database backups
- Security audit
```

### Logging
```
Frontend: Browser console + network tab
Backend: FastAPI console logs
AI: Interaction logs in database
Admin: Audit trail in database
```

## Key Integrations

### Discord Integration
- **OAuth2**: User authentication
- **Guild API**: GG membership verification
- **User API**: Profile information
- **Rate Limiting**: Exponential backoff retry

### GitHub Integration
- **PR Creation**: Automatic pull requests for suggestions
- **Token Auth**: Personal access token
- **Repository**: LeoPiro/GG_Dms
- **Error Handling**: Retry logic with status tracking

### OpenAI Integration
- **GPT-4o-mini**: Code generation
- **text-embedding-3-small**: Embeddings (1536 dimensions)
- **Streaming**: Response streaming for real-time feedback
- **Error Handling**: Retry with exponential backoff

### Wiki Integration
- **Scraping**: Automated UO Outlands wiki scraping
- **Knowledge Extraction**: Keywords and mechanics
- **Pattern Enhancement**: Intent pattern expansion
- **Confidence Boosting**: Wiki-backed patterns

## Critical Business Logic

### Script Approval Logic
```python
# Auto-approval for Jasown
if script.author.lower() in ["jasown", "jasown scripts"]:
    script.is_approved = True
    script.rating_average = 5.0
    script.rating_count = 5
    # Create weighted rating
    rating = ScriptRating(
        weight=5,
        is_jasown_rating=True,
        rating=5
    )
```

### Rating Calculation
```python
# Weighted average
total_weighted = sum(r.rating * r.weight for r in ratings)
total_weight = sum(r.weight for r in ratings)
rating_average = total_weighted / total_weight
rating_count = total_weight  # Effective count
```

### AI Confidence Decision Tree
```python
if confidence >= 0.8:
    # High confidence - proceed
    return generate_response()
elif confidence >= 0.5:
    # Medium confidence - ask user
    return ask_for_confirmation()
elif confidence >= 0.3:
    # Low confidence - admin review
    return queue_for_admin_review(priority="normal")
else:
    # Very low confidence - immediate admin review
    return queue_for_admin_review(priority="high")
```

### Tag Ranking Algorithm
```python
def rank_scripts(scripts, search_tags):
    for script in scripts:
        score = 0
        # Tag matches (highest priority)
        matching_tags = set(script.tags) & set(search_tags)
        score += len(matching_tags) * 100
        
        # Featured status
        if script.is_featured:
            score += 50
        
        # Rating
        score += script.rating_average * 10
        
        # Views (normalized)
        score += min(script.view_count / 100, 20)
        
        script.rank_score = score
    
    return sorted(scripts, key=lambda s: s.rank_score, reverse=True)
```

## Error Handling Patterns

### Frontend Error Handling
```typescript
// API Error Handling
try {
  const response = await api.get('/scripts')
} catch (error) {
  if (error.response?.status === 401) {
    // Auth expired - sign out
    signOut()
  } else if (error.response?.status === 403) {
    // Not authorized
    setError('Not authorized')
  } else if (error.code === 'ECONNABORTED') {
    // Timeout
    setError('Request timeout - please try again')
  } else {
    // Generic error
    setError('An error occurred')
  }
}

// GG Membership Retry Logic
const checkGGMembership = async (isRetry = false) => {
  try {
    const response = await axios.get('/api/verify-gg-member')
    setIsGGMember(response.data.isGGMember)
  } catch (error) {
    if (retryCount < 5) {
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 8000)
      setTimeout(() => checkGGMembership(true), delay)
      setRetryCount(retryCount + 1)
    }
  }
}
```

### Backend Error Handling
```python
# FastAPI Error Handling
from fastapi import HTTPException

# Validation Error
if not script.title:
    raise HTTPException(
        status_code=400, 
        detail="Title is required"
    )

# Not Found
script = db.query(ScriptsCacheDB).filter_by(id=script_id).first()
if not script:
    raise HTTPException(
        status_code=404, 
        detail="Script not found"
    )

# Unauthorized
if not is_admin and script.created_by != user_id:
    raise HTTPException(
        status_code=403, 
        detail="Not authorized to modify this script"
    )

# AI Error Handling
try:
    response = await openai_client.chat.completions.create(...)
except openai.APIError as e:
    logger.error(f"OpenAI API error: {e}")
    raise HTTPException(
        status_code=503, 
        detail="AI service temporarily unavailable"
    )
```

## Testing Strategy

### Frontend Testing
- **Component Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright (potential)
- **Auth Flow**: Manual testing with Discord
- **API Integration**: Mock API responses

### Backend Testing
- **Unit Tests**: pytest for business logic
- **Integration Tests**: API endpoint testing
- **Database Tests**: SQLite in-memory testing
- **AI Tests**: Mock OpenAI responses

### Manual Testing Checklist
```
Authentication:
☐ Discord OAuth flow
☐ GG membership verification
☐ Admin status check
☐ Token refresh

Scripts:
☐ Create script (user)
☐ Approve script (admin)
☐ Rate script
☐ Search scripts (manual + AI)
☐ Featured toggle (admin)

AI:
☐ Ask question
☐ Edit AI code
☐ Submit feedback
☐ Rule suggestions
☐ Uncertainty handling

Admin:
☐ Review suggestions
☐ Create PR
☐ Manage AI rules
☐ Review intent patterns
```

## Migration Guide

### Database Migrations
```bash
# Run migrations in order
python backend/migrate_db.py
python backend/migrate_scripts_schema.py
python backend/migrate_rule_suggestions.py
python backend/migrate_intent_learning.py
python backend/migrate_training_data.py
python backend/migrate_individual_hues.py
python backend/migrate_hue_sets.py
python backend/migrate_item_database.py
```

### Data Ingestion
```bash
# AI Data Ingestion
cd backend/ai
python indexer/ingest.py

# Script Scraping
cd backend
python scraper.py
python add_new_scripts.py scraped_data/outlands_scripts.jsonl

# Scheduled Scraping
python scheduled_scraper.py schedule daily
```

## Troubleshooting Guide

### Common Issues

**Issue: AI not responding**
```bash
# Check AI service
curl http://localhost:7000/health

# Check database
sqlite3 ai_service.db "SELECT COUNT(*) FROM rag_chunks;"

# Check OpenAI API
python -c "import os; from openai import OpenAI; print(OpenAI(api_key=os.getenv('OPENAI_API_KEY')).models.list())"
```

**Issue: Discord auth failing**
```bash
# Check environment
echo $DISCORD_CLIENT_ID
echo $NEXT_PUBLIC_GG_GUILD_ID

# Check NextAuth
curl http://localhost:3000/api/auth/providers
```

**Issue: Database errors**
```bash
# Check database files
ls -lh backend/*.db

# Verify schema
sqlite3 suggestions.db ".schema scripts_cache"
sqlite3 ai_service.db ".schema rag_chunks"

# Vacuum database
sqlite3 suggestions.db "VACUUM;"
```

## Future Enhancements Roadmap

### Phase 1 (Current)
- ✅ Core script management
- ✅ AI assistant with RAG
- ✅ Intent management
- ✅ Uncertainty handling
- ✅ Self-learning system
- ✅ Admin interface

### Phase 2 (Planned)
- [ ] Advanced caching (Redis)
- [ ] Real-time wiki updates
- [ ] ML-based intent classification
- [ ] Custom model training
- [ ] Performance analytics dashboard
- [ ] Mobile-responsive improvements

### Phase 3 (Future)
- [ ] Discord bot integration
- [ ] WebSocket real-time updates
- [ ] Advanced A/B testing
- [ ] Multi-language support
- [ ] Public API with rate limiting
- [ ] Advanced script versioning

---

## Summary for Cursor Rules

**Key Technologies**: Next.js (TypeScript), FastAPI (Python), SQLite + FAISS, OpenAI API

**Architecture**: Consolidated single backend (port 7000) + frontend (port 3000)

**Auth**: Discord OAuth2 → NextAuth → GG membership verification → Admin status

**AI System**: RAG with FAISS → Intent analysis → Confidence scoring → Uncertainty management → Self-learning

**Data Flow**: User → Frontend → API → Database ← AI ← OpenAI

**Admin**: Complete workflow for scripts, suggestions, AI rules, intent patterns, uncertainty reviews

**Critical Patterns**:
- All API calls include user_id (Discord ID)
- Admin endpoints require is_admin=true
- Scripts auto-approved for Jasown (weighted rating)
- AI confidence thresholds determine action
- Tag limit of 3 per script
- GG membership cached for 5 minutes
- Environment variables for all secrets

**File Patterns**:
- Frontend: `pages/*.tsx`, `components/*.tsx`, `lib/*.ts`
- Backend: `routes/*.py`, `ai_*.py`, `migrate_*.py`
- Database: SQLite files in backend/
- AI: `backend/ai/` for data, rules, indexer
- Docs: `AI/*.md` for documentation

