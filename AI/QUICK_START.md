# DM Portal - Quick Start Guide

## 🚀 For AI Agents Working on This Codebase

### Before Making ANY Changes
**ALWAYS read these files in order:**
1. `.cursorrules` - Development rules (STRICT enforcement)
2. `AI/MEMORY_BANK.md` - Quick reference guide
3. `AI/COMPREHENSIVE_ARCHITECTURE.md` - Full system documentation
4. `AI/status.md` - Current status and recent work

### Critical Rules
- ✅ **NO type hints** in Python code
- ✅ **Interfaces over types** in TypeScript
- ✅ **ALL API calls** include `user_id` (Discord ID)
- ✅ **Admin endpoints** require `is_admin=true` + server verification
- ✅ **Document every function** (docstrings/comments)
- ✅ **Tests required** for new endpoints
- ✅ **Pydantic validation** for all inputs
- ✅ **SQLAlchemy only** (no raw SQL)
- ✅ **Auto-format** with prettier/black
- ✅ **ALWAYS update** `/AI/status.md` after completing work

## 📁 Project Structure

```
dm-portal/
├── .cursorrules                 # ⭐ Development rules (READ FIRST)
├── frontend/                     # Next.js (TypeScript, Port 3000)
│   ├── pages/                   # Routes
│   ├── components/              # React components
│   ├── lib/                     # Utilities
│   └── types/                   # TypeScript interfaces
├── backend/                      # FastAPI (Python, Port 7000)
│   ├── main.py                  # Main app (includes AI)
│   ├── routes/                  # API endpoints
│   ├── ai_*.py                  # AI modules (consolidated)
│   └── ai/                      # AI data and rules
└── AI/                          # 📚 Documentation
    ├── COMPREHENSIVE_ARCHITECTURE.md  # Full system docs
    ├── MEMORY_BANK.md                 # Quick reference
    ├── status.md                      # Current status (UPDATE THIS)
    ├── task_template.md               # Template for new features
    └── memory/                        # AI memory system
        ├── system/                    # System state
        ├── features/                  # Feature patterns
        └── tasks/                     # Task tracking
```

## 🎯 Common Tasks

### Starting Development
```bash
# Terminal 1: Backend (includes AI on port 7000)
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Creating a New Feature
1. Create task from `/AI/task_template.md`
2. Get approval on approach
3. Implement following `.cursorrules`
4. Add tests
5. Update `/AI/status.md`
6. Update relevant documentation

### Making Code Changes
1. Read `.cursorrules` for patterns
2. Check `/AI/memory/features/{feature}.json` for existing patterns
3. Follow established patterns exactly
4. Document all functions
5. Handle errors properly
6. Run formatters (black, prettier)
7. Run tests
8. Update `/AI/status.md`

## 🔑 Critical Data Patterns

### Scripts System
- Default: `is_approved = False`
- Jasown exception: Auto-approve + 5x weighted rating
- Tag limit: Maximum 3 tags (ENFORCED)
- Code preview: First 500 characters

### Authentication
- All API calls: Include `user_id` (Discord ID)
- Admin endpoints: Require `is_admin=true` + server verification
- Never trust client for admin status

### AI Confidence
- ≥0.8: Proceed normally
- 0.5-0.8: Ask user confirmation
- 0.3-0.5: Admin review queue
- <0.3: Urgent admin review

### Rating Calculation
```python
weighted_avg = sum(rating * weight) / sum(weight)
# User ratings: weight = 1
# Jasown ratings: weight = 5
```

## 📊 Key Architecture Facts

### System Stack
- **Frontend**: Next.js 13+ (TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python 3.10+)
- **Database**: SQLite (2 files: suggestions.db, ai_service.db)
- **Vector Search**: FAISS (consolidated with backend)
- **AI**: GPT-4o-mini + text-embedding-3-small
- **Auth**: NextAuth.js with Discord OAuth

### ⚠️ CRITICAL: Consolidated Architecture
**NO separate AI service on port 7001!**
AI is integrated into main backend on port 7000.

### Data Flow
```
User → Frontend (3000) → Backend API (7000) → SQLite + FAISS
                              ↓
                         OpenAI API
```

## 🗂️ Memory Bank System

### Purpose
AI agents can track:
- Completed tasks and how they were done
- Pending work and requirements
- System state and configurations
- Known issues and solutions
- Architecture decisions

### Structure
```
AI/memory/
├── system/
│   ├── state.json          # Current system state
│   ├── issues.json         # Known issues + solutions
│   └── decisions.json      # Architecture decisions
├── features/
│   ├── scripts.json        # Scripts patterns
│   ├── ai.json             # AI patterns
│   └── auth.json           # Auth patterns
└── tasks/
    ├── completed/          # Done tasks
    ├── in_progress/        # Active work
    └── pending/            # Future work
```

### Using Memory Bank
- **Before work**: Check `tasks/pending/` and `system/state.json`
- **During work**: Update `tasks/in_progress/`
- **After work**: Move to `tasks/completed/` + update `/AI/status.md`
- **For patterns**: Check `features/{feature}.json`
- **For issues**: Check `system/issues.json`

## 🧪 Testing Requirements

### New Endpoints
- **MUST have tests** before PR
- Test happy path + error cases
- Document test coverage

### Test Patterns
```python
# Backend test example
def test_create_script_success():
    # Test successful creation
    
def test_create_script_unauthorized():
    # Test without auth
    
def test_create_script_invalid_tags():
    # Test with > 3 tags (should fail)
```

## 🚨 Error Handling

### Backend
```python
# Validation error
raise HTTPException(status_code=400, detail="Data required")

# Not found
raise HTTPException(status_code=404, detail="Resource not found")

# Unauthorized
raise HTTPException(status_code=403, detail="Admin access required")
```

### Frontend
```typescript
// Use Modal components for errors
try {
  await apiCall();
} catch (error) {
  if (error.response?.status === 401) {
    setError('Session expired. Please sign in again.');
  }
  // Show error in Modal component
}
```

## 📝 Required Documentation

### Every Function
```python
def calculate_rating(ratings):
    """
    Calculate weighted average rating.
    
    Jasown ratings have weight=5, user ratings have weight=1.
    Returns tuple of (average, effective_count).
    """
    # implementation
```

```typescript
/**
 * Fetches scripts with filtering and pagination.
 * 
 * @param filters - Search filters
 * @param pagination - Page and limit
 * @returns Promise with scripts and total count
 */
async function fetchScripts(filters, pagination) {
  // implementation
}
```

## 🔄 After Completing Work

### ALWAYS Update
1. `/AI/status.md` - Add what was completed, how, and next steps
2. Relevant feature memory in `/AI/memory/features/`
3. Task status in `/AI/memory/tasks/`
4. Related documentation if behavior changed

### Checklist
- [ ] Code follows `.cursorrules`
- [ ] Every function documented
- [ ] Tests written and passing
- [ ] Formatted (black/prettier)
- [ ] No linter errors
- [ ] `/AI/status.md` updated
- [ ] Memory bank updated
- [ ] Related docs updated

## 🎯 Quick Reference Links

### Must-Read Files
1. `.cursorrules` - All development rules
2. `AI/MEMORY_BANK.md` - Quick reference
3. `AI/COMPREHENSIVE_ARCHITECTURE.md` - Full docs
4. `AI/status.md` - Current status

### Feature Documentation
- Scripts: `AI/SCRIPTS_SYSTEM_DOCUMENTATION.md`
- AI: `AI/AI_AGENT_GUIDE.md`
- Auth: `AI/DISCORD_AUTHENTICATION_GUIDE.md`
- Intent: `AI/INTENT_MANAGEMENT_SYSTEM.md`

### Memory Bank
- System state: `AI/memory/system/state.json`
- Known issues: `AI/memory/system/issues.json`
- Decisions: `AI/memory/system/decisions.json`
- Scripts patterns: `AI/memory/features/scripts.json`
- AI patterns: `AI/memory/features/ai.json`

## 🚀 Development Commands

### Backend
```bash
cd backend

# Run server
python main.py

# Run tests
pytest

# Format code
black .

# Run migrations
python migrate_*.py
```

### Frontend
```bash
cd frontend

# Run dev server
npm run dev

# Format code
npm run format  # or npx prettier --write .

# Run tests
npm test
```

## ⚠️ Common Mistakes to Avoid

### Backend
- ❌ Adding type hints in Python
- ❌ Raw SQL queries (use SQLAlchemy)
- ❌ Missing user_id parameter
- ❌ Trusting client for admin status
- ❌ Not validating with Pydantic

### Frontend
- ❌ Using `type` instead of `interface`
- ❌ Using `alert()` instead of Modal
- ❌ API calls without user_id
- ❌ Not handling auth expiration

### General
- ❌ Skipping documentation
- ❌ Not updating `/AI/status.md`
- ❌ Missing error handling
- ❌ No tests for new endpoints
- ❌ Breaking changes without asking

## 🎉 Summary

**The codebase is getting complex - these rules and memory systems keep it organized!**

1. **ALWAYS** check `.cursorrules` first
2. **ALWAYS** consult Memory Bank for context
3. **ALWAYS** update `/AI/status.md` after work
4. **ALWAYS** follow established patterns
5. **ALWAYS** document and test

**When in doubt, ask rather than assume!**

---

Happy coding! 🚀

*Last updated: 2025-10-13*

