# AI Memory Bank

## Purpose
The Memory Bank is a structured system for the AI agent to track:
- **Completed tasks** and implementation details
- **Pending work** and requirements
- **System state** and configurations
- **Known issues** and their solutions
- **Architecture decisions** and rationale

## Structure

```
/AI/memory/
├── tasks/
│   ├── completed/           # Finished tasks with implementation details
│   ├── in_progress/         # Currently active work
│   └── pending/             # Planned future work
├── system/
│   ├── state.json          # Current system configuration
│   ├── issues.json         # Known issues and workarounds
│   └── decisions.json      # Architecture decisions log
├── features/
│   ├── scripts.json        # Scripts system memory
│   ├── ai.json             # AI system memory
│   ├── auth.json           # Authentication system memory
│   └── admin.json          # Admin system memory
└── meta/
    ├── schema.json         # Memory schemas
    └── index.json          # Memory index for quick lookup
```

## Memory Types

### Task Memory (tasks/)
Tracks work items from start to completion.

**Completed Task Example:**
```json
{
  "id": "task_001",
  "title": "Script Rating System",
  "status": "completed",
  "completed_at": "2025-10-13",
  "summary": "Implemented weighted rating system for scripts",
  "implementation": {
    "files_changed": [
      "backend/routes/scripts.py",
      "frontend/pages/scripts/[id].tsx",
      "backend/database.py"
    ],
    "key_decisions": [
      "Jasown scripts receive 5x weighted rating",
      "Rating calculation uses sum(rating * weight) / sum(weight)",
      "Users can update their own ratings"
    ],
    "challenges": [
      {
        "issue": "Rating updates not reflecting immediately",
        "solution": "Added real-time update to UI after rating submission"
      }
    ]
  },
  "testing": {
    "test_files": ["backend/tests/test_ratings.py"],
    "manual_testing": "Verified rating updates, Jasown weighting, UI feedback"
  },
  "documentation": [
    "Updated COMPREHENSIVE_ARCHITECTURE.md",
    "Updated SCRIPTS_SYSTEM_DOCUMENTATION.md"
  ]
}
```

**Pending Task Example:**
```json
{
  "id": "task_pending_001",
  "title": "Advanced Search Filters",
  "status": "pending",
  "priority": "medium",
  "requirements": [
    "Add date range filtering",
    "Add multiple tag AND/OR logic",
    "Add author autocomplete"
  ],
  "dependencies": ["None"],
  "estimated_effort": "medium",
  "notes": "Consider UI/UX impact on search bar complexity"
}
```

### System Memory (system/)
Tracks current state, issues, and decisions.

**State Example (state.json):**
```json
{
  "last_updated": "2025-10-13",
  "environment": {
    "backend_port": 7000,
    "frontend_port": 3000,
    "database": "SQLite + FAISS",
    "ai_model": "gpt-4o-mini",
    "embedding_model": "text-embedding-3-small"
  },
  "features": {
    "scripts_management": "active",
    "ai_assistant": "active",
    "intent_management": "active",
    "uncertainty_handling": "active",
    "items_management": "in_progress",
    "hue_management": "pending"
  },
  "metrics": {
    "total_scripts": "~900",
    "total_users": "tracked_by_discord",
    "ai_interactions": "tracked_in_db"
  }
}
```

**Issues Example (issues.json):**
```json
{
  "known_issues": [
    {
      "id": "issue_001",
      "title": "Discord rate limiting on membership checks",
      "severity": "medium",
      "status": "mitigated",
      "description": "Discord API rate limits can cause auth delays",
      "workaround": "5-minute cache + exponential backoff retry (max 5 attempts)",
      "files_affected": [
        "frontend/lib/auth.tsx",
        "frontend/pages/api/verify-gg-member.ts"
      ],
      "permanent_solution": "Consider implementing Redis caching"
    }
  ],
  "resolved_issues": []
}
```

**Decisions Example (decisions.json):**
```json
{
  "architecture_decisions": [
    {
      "id": "decision_001",
      "date": "2025-10-01",
      "title": "Consolidated AI Service",
      "decision": "Integrate AI service into main backend (port 7000)",
      "rationale": [
        "Simplified deployment (2 services instead of 3)",
        "Reduced latency (no proxy overhead)",
        "Easier debugging and monitoring",
        "Lower resource usage"
      ],
      "alternatives_considered": [
        "Separate AI service on port 7001 (rejected: too complex)"
      ],
      "impact": "Requires updating all AI endpoints, but significant operational improvement"
    },
    {
      "id": "decision_002",
      "date": "2025-10-05",
      "title": "SQLite + FAISS over PostgreSQL + pgvector",
      "decision": "Use SQLite with FAISS for vector search",
      "rationale": [
        "Simpler deployment (no PostgreSQL setup)",
        "Sufficient for current scale",
        "Single database file backups",
        "FAISS performance excellent for our use case"
      ],
      "alternatives_considered": [
        "PostgreSQL + pgvector (rejected: overkill for current needs)"
      ],
      "impact": "Easier maintenance, but may need migration at larger scale"
    }
  ]
}
```

### Feature Memory (features/)
Tracks feature-specific implementation details and patterns.

**Scripts System Example (scripts.json):**
```json
{
  "feature": "scripts_management",
  "status": "active",
  "key_patterns": {
    "approval_workflow": {
      "description": "Scripts start unapproved, require admin approval",
      "exception": "Jasown scripts auto-approved with weighted rating",
      "implementation": "backend/routes/scripts.py:create_script()"
    },
    "rating_system": {
      "description": "Weighted average rating (user=1, Jasown=5)",
      "calculation": "sum(rating * weight) / sum(weight)",
      "implementation": "backend/routes/scripts.py:calculate_weighted_rating()"
    },
    "tag_limits": {
      "description": "Maximum 3 tags per script",
      "validation": "Enforced in Pydantic model and API endpoint",
      "implementation": "backend/models.py:ScriptCreate"
    }
  },
  "api_endpoints": [
    "GET /api/scripts/ - List with filters",
    "POST /api/scripts/ - Create (requires user_id)",
    "POST /api/scripts/{id}/rate - Rate script",
    "POST /api/scripts/admin/{id}/toggle-featured - Toggle featured"
  ],
  "database_tables": [
    "scripts_cache",
    "script_ratings",
    "script_tags_config"
  ],
  "known_gotchas": [
    "Always check is_approved before showing scripts to non-admins",
    "Jasown detection is case-insensitive",
    "Code preview is first 500 chars only"
  ]
}
```

**AI System Example (ai.json):**
```json
{
  "feature": "ai_assistant",
  "status": "active",
  "architecture": {
    "type": "RAG (Retrieval-Augmented Generation)",
    "vector_db": "FAISS",
    "metadata_db": "SQLite",
    "llm": "GPT-4o-mini",
    "embeddings": "text-embedding-3-small (1536 dim)"
  },
  "key_patterns": {
    "context_retrieval": {
      "description": "60% GG Scripts (priority), 40% other sources",
      "top_k": 8,
      "max_context": "16,000 characters",
      "implementation": "backend/ai_rag.py"
    },
    "confidence_thresholds": {
      "high": "≥0.8 - Proceed normally",
      "medium": "0.5-0.8 - Ask user confirmation",
      "low": "0.3-0.5 - Admin review queue",
      "very_low": "<0.3 - Immediate admin review"
    },
    "self_learning": {
      "description": "Learns from user edits and admin feedback",
      "rule_suggestions": "Generated from code corrections",
      "implementation": "backend/routes/ai_uncertainty.py"
    }
  },
  "data_sources": {
    "scripts": "6,444 chunks from Razor scripts",
    "documentation": "71 chunks from official docs",
    "rules": "21 chunks from AI rules",
    "wiki": "UO Outlands wiki (scraped)"
  },
  "known_gotchas": [
    "Always check confidence before proceeding",
    "FAISS index must be loaded at startup",
    "Rules file backup before any updates",
    "Intent patterns in database, not hardcoded"
  ]
}
```

## Usage Patterns

### When Starting New Work
1. Check `tasks/pending/` for planned work
2. Review `system/state.json` for current system state
3. Check `features/{feature}.json` for implementation patterns
4. Review `system/issues.json` for known problems
5. Check `system/decisions.json` for architectural context

### During Development
1. Update `tasks/in_progress/` with progress
2. Document challenges and solutions in task file
3. Update `features/{feature}.json` with new patterns
4. Add to `system/issues.json` if issues found

### After Completion
1. Move task from `in_progress/` to `completed/`
2. Update `/AI/status.md` with summary
3. Update `system/state.json` if system state changed
4. Document any architectural decisions in `decisions.json`
5. Update feature memory with new patterns

### When Debugging
1. Check `system/issues.json` for known problems
2. Review `tasks/completed/` for similar work
3. Check `features/{feature}.json` for gotchas
4. Review decisions.json for architectural context

## Memory Maintenance

### Regular Updates
- **After each task**: Update task status and move to appropriate folder
- **Weekly**: Review and clean up old in_progress items
- **Monthly**: Archive very old completed tasks
- **As needed**: Update system state and feature patterns

### Memory Quality
- Be specific and actionable
- Include file paths and line numbers where relevant
- Document "why" not just "what"
- Link related memories
- Keep patterns up-to-date

## Quick Commands

```bash
# Find completed tasks related to scripts
grep -r "scripts" AI/memory/tasks/completed/

# Check current system state
cat AI/memory/system/state.json

# Review known issues
cat AI/memory/system/issues.json

# See all pending work
ls AI/memory/tasks/pending/

# Check feature patterns
cat AI/memory/features/scripts.json
```

---

**The Memory Bank is the AI's persistent knowledge base. Keep it updated, specific, and actionable.**

