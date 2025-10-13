# DM Portal - AI Memory Bank

## System Identity
**Project**: DM Portal - UO Outlands Community Platform
**Type**: Full-stack web application with AI-powered script assistance
**Purpose**: Script repository, AI assistant, dockmaster suggestions, admin management

## Core Architecture

### Technology Stack
- **Frontend**: Next.js 13+ (TypeScript, Tailwind CSS, Port 3000)
- **Backend**: FastAPI (Python 3.10+, Port 7000) - **CONSOLIDATED** (no separate AI service)
- **Database**: SQLite (suggestions.db, ai_service.db) + FAISS for vectors
- **AI**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Auth**: NextAuth.js with Discord OAuth2
- **VCS**: Git (dev → main branches)

### System Layout
```
User (Discord Auth) → Frontend (3000) → Backend API (7000) → SQLite + FAISS
                                              ↓
                                        OpenAI API
                                        GitHub API
                                        Discord API
```

## Critical Rules & Patterns

### Authentication
1. **All users must**: Discord OAuth → GG membership verified
2. **All API calls include**: `user_id` (Discord ID from session)
3. **Admin endpoints require**: `is_admin=true` parameter
4. **Super admins**: Environment variable `SUPER_ADMIN_IDS`
5. **GG membership cache**: 5 minutes

### Data Patterns
1. **Scripts**: `is_approved=FALSE` by default (requires admin approval)
2. **Jasown scripts**: Auto-approved + weighted rating (5x = counts as 5 ratings)
3. **Tag limit**: Maximum 3 tags per script
4. **Rating system**: 1-5 stars, weighted average (user=1, Jasown=5)
5. **Code preview**: First 500 characters for listings

### AI System
1. **RAG Architecture**: FAISS vector search + SQLite metadata
2. **Context**: 60% GG Scripts (priority), 40% other sources
3. **Top-K**: 8 chunks retrieved
4. **Max context**: 16,000 characters
5. **Confidence thresholds**:
   - High (≥0.8): Proceed normally
   - Medium (0.5-0.8): Ask user confirmation
   - Low (0.3-0.5): Admin review queue
   - Very Low (<0.3): Immediate high-priority admin review

### File Structure
```
frontend/
├── pages/ (routes)
├── components/ (UI)
├── lib/api.ts (API client)
└── lib/auth.tsx (auth context)

backend/
├── main.py (FastAPI app with AI)
├── routes/*.py (API endpoints)
├── ai_*.py (AI modules)
├── ai/data/, ai/rules/ (AI data)
├── database.py (SQLAlchemy)
└── models.py (Pydantic)
```

## Key Endpoints

### Scripts
- `GET /api/scripts/` - List (filterable by category, tags, rating)
- `POST /api/scripts/` - Create (requires user_id)
- `POST /api/scripts/{id}/rate` - Rate script (1-5 stars)
- `POST /api/scripts/admin/{id}/toggle-featured` - Toggle featured (admin)

### AI
- `POST /api/scripts/ai/search` - AI search with RAG
- `POST /api/scripts/ai/feedback` - Submit feedback
- `GET /api/scripts/admin/ai-rules` - Get AI rules (admin)
- `PUT /api/scripts/admin/ai-rules` - Update rules (admin)

### Intent & Uncertainty
- `GET /api/ai/intents/patterns` - Get intent patterns
- `POST /api/ai/uncertainty/analyze` - Analyze uncertainty
- `GET /api/ai/uncertainty/pending-reviews` - Admin queue

### Admin
- `GET /api/admin/suggestions` - Dockmaster suggestions
- `POST /api/admin/suggestions/{id}/approve` - Approve (creates PR)

### Items Management
- `GET /api/items/items` - List items (filterable by search, category)
- `POST /api/items/items` - Create item
- `PUT /api/items/items/{id}` - Update item
- `DELETE /api/items/items/{id}` - Delete item
- `POST /api/items/items/merge` - Merge two items
- `GET /api/items/items/search/{query}` - Search items by name/ID
- `GET /api/items/{id}/hues` - Get item hues
- `POST /api/items/{id}/hues` - Add hue to item
- `PUT /api/items/{id}/hues/{hue}` - Update hue description
- `DELETE /api/items/{id}/hues/{hue}` - Remove hue from item
- `GET /api/items/hue-sets` - Get all hue sets
- `POST /api/items/hue-sets` - Create new hue set
- `GET /api/items/individual-hues` - Get all individual hues
- `GET /api/items/{id}/script-examples` - Get script usage examples

## Database Schema Quick Ref

### scripts_cache
- PK: id
- Required: title, author, category, language, code
- Flags: is_approved, is_featured
- Tracking: created_by (Discord ID), rating_average, rating_count

### script_ratings
- PK: id
- FK: script_id → scripts_cache.id
- Fields: user_id (Discord ID), rating (1-5), review, weight
- Special: is_jasown_rating (weight=5)

### rag_chunks
- PK: id
- Fields: source (script/docs/rules), text, title, url, meta (JSON)
- Embeddings: Stored in separate FAISS index

### intent_patterns
- PK: id
- Fields: intent_name, keywords (JSON), tags (JSON), context_needed (JSON)
- Tracking: confidence_score, usage_count

### uncertainty_requests
- PK: id
- Fields: user_query, detected_intent (JSON), confidence_score
- Admin: admin_response (JSON), status, resolved_by (Discord ID)

### items
- PK: id
- Fields: name, item_id, hue, category_id, description, usage_count, is_verified
- Tracking: created_at, updated_at

### item_hues
- PK: id
- FK: item_id → items.id
- Fields: hue, description, usage_count, created_at

### item_categories
- PK: id
- Fields: name, description, created_at

### hue_sets
- PK: id
- Fields: name, description, hues (comma-separated), usage_count, created_at, updated_at, is_active

### item_script_usage
- PK: id
- FK: item_id → items.id
- Fields: script_id, line_number, usage_context, created_at
- Unique constraint: (item_id, script_id, line_number)

## Environment Variables

### Frontend (.env.local)
```
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXT_PUBLIC_GG_GUILD_ID=xxx
NEXT_PUBLIC_ADMIN_IDS=comma,separated
NEXT_PUBLIC_API_URL=http://localhost:7000
```

### Backend (.env)
```
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
AI_DB_DSN=sqlite:///./ai_service.db
SUPER_ADMIN_IDS=comma,separated,discord,ids
GITHUB_TOKEN=xxx
```

## Common Code Patterns

### Frontend API Call
```typescript
const response = await axios.get('/api/scripts', {
  params: {
    user_id: session.user.discordId,
    is_admin: isAdmin
  }
})
```

### Backend Endpoint
```python
@router.post("/", response_model=Script)
async def create_script(
    script_data: ScriptCreate,
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    # Logic here
```

### Admin Check
```python
if not is_admin or not is_super_admin(user_id):
    raise HTTPException(status_code=403, detail="Not authorized")
```

## Workflows

### Script Submission
1. User authenticated (Discord + GG member)
2. Submit via CreateScriptModal
3. API validates (title, code, max 3 tags)
4. Insert with is_approved=FALSE
5. Admin review → approve → is_approved=TRUE

### AI Search
1. User query → Intent analysis + confidence
2. If low confidence → Admin review queue
3. RAG retrieval (FAISS + SQLite, 60% GG Scripts)
4. Load AI rules → Format prompt → OpenAI call
5. Extract code + lint → Return with citations
6. User feedback → Generate rule suggestions → Training data

### Suggestion Approval
1. User submits dockmaster suggestion
2. Admin reviews → Approves
3. Backend creates GitHub PR to LeoPiro/GG_Dms
4. Store PR URL/number → Update status

## Self-Learning System

### Pattern Detection
- Serial number → Item name conversion
- Missing `waitforgump` after `gumpresponse`
- Missing `@clearignore` before scans
- Improper `findtype` usage

### Learning Flow
1. User edits AI code
2. Detect correction patterns
3. Generate rule suggestions
4. Admin reviews → Approves
5. Auto-backup RULES.md
6. Append new rules
7. Improved future responses

## Development Commands

### Local Development
```bash
# Backend (Port 7000)
cd backend && python main.py

# Frontend (Port 3000)
cd frontend && npm run dev
```

### Data Operations
```bash
# Ingest AI data
cd backend/ai && python indexer/ingest.py

# Scrape scripts
cd backend && python scraper.py
python add_new_scripts.py scraped_data/outlands_scripts.jsonl

# Migrations
python migrate_*.py
```

### Production (PM2)
```bash
pm2 start "python main.py" --name "dm-backend" --cwd backend
pm2 start "npm run start" --name "dm-frontend" --cwd frontend
```

## Security Rules
1. **Never commit**: .env files, API keys, secrets
2. **Always validate**: User inputs server-side (Pydantic)
3. **Use parameterized**: SQLAlchemy queries (prevent SQL injection)
4. **Check admin**: Server-side verification, never trust client
5. **Audit trail**: Log all admin actions

## Error Handling

### Frontend
- Auth expired (401) → Sign out
- Forbidden (403) → Show error
- Timeout → Retry with exponential backoff (max 5 retries)
- Discord rate limit (429) → Show "try again in X seconds"

### Backend
- Validation → 400 with detail
- Not found → 404 with detail
- Unauthorized → 403 with detail
- AI service down → 503 with detail

## Integration Points
1. **Discord API**: OAuth + guild membership verification
2. **GitHub API**: PR creation for suggestions (uses personal access token)
3. **OpenAI API**: Chat completions + embeddings (retry on failure)
4. **UO Outlands Wiki**: Automated scraping for knowledge expansion

## Performance Notes
- Pagination: All lists max 100 items
- Debounce: Search input 300ms
- Cache: GG membership 5min, API responses where applicable
- FAISS: Fast vector search for RAG
- Database: Proper indexes on frequently queried fields

## Monitoring Checklist
- [ ] Backend health: `curl http://localhost:7000/health`
- [ ] Database: `sqlite3 suggestions.db "SELECT COUNT(*) FROM scripts_cache;"`
- [ ] FAISS: `sqlite3 ai_service.db "SELECT COUNT(*) FROM rag_chunks;"`
- [ ] OpenAI: Check API usage and costs
- [ ] Admin queue: Review pending items daily

## Critical Business Logic
1. **Jasown auto-weight**: Scripts by "jasown" or "jasown scripts" get 5-star rating (weight=5)
2. **Tag ranking**: Matching tags × 100 + featured × 50 + rating × 10 + views/100
3. **Confidence decision**: ≥0.8 proceed, 0.5-0.8 ask user, 0.3-0.5 admin review, <0.3 immediate review
4. **Script approval**: User scripts pending by default, admin must approve

## Quick Troubleshooting
- **AI not responding**: Check health endpoint, verify FAISS index, check OpenAI API key
- **Auth failing**: Verify Discord env vars, check NextAuth config, test /api/verify-gg-member
- **DB errors**: Check file permissions, run VACUUM, verify schema with .schema command
- **Rate limiting**: Discord API has limits, implement exponential backoff

## Deployment Notes
- **Services**: Only 2 services needed (backend + frontend)
- **Ports**: 7000 (backend), 3000 (frontend)
- **Database**: SQLite files in backend/ directory
- **Backups**: Regular backups of .db files and FAISS index
- **Nginx**: Proxy / to :3000, /api/ to :7000

---

**Remember**: This is a CONSOLIDATED architecture. The AI service is integrated into the main backend on port 7000. No separate AI service on port 7001.

**Key Features**:
✅ Script management with approval workflow
✅ AI assistant with RAG (FAISS + SQLite)
✅ Intent management with uncertainty handling
✅ Self-learning from user feedback
✅ Discord OAuth with GG membership verification
✅ GitHub integration for suggestions
✅ Comprehensive admin interface
✅ Items management with hue system and merging

**Current Branch**: `dev` (development) → merge to `main` for production

