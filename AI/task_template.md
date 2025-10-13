# 0) Metadata
- Task ID:
- Owner:
- Date: YYYY-MM-DD
- Repo/Branch:
- Related Issues/PRs:

# 1) 🎯 Summary
(1–2 sentences on what we’re building/fixing)

# 2) 🧭 Strategic Analysis & Recommended Solution
- Goal & Constraints:
- Options:
  A) ...
  B) ...
  (C) ...
- **Recommended**:
  - Primary reason:
  - Secondary reason:
  - Long-term reason:
  - Risks/Trade-offs:

> Approval checkpoint: proceed only after explicit approval.

# 3) ✅ Approval
- [ ] Yes — proceed
- [ ] No — revise (notes: ...)

# 4) 🔍 Current State (where this fits)
- System/Module Fit (+ data flow). (See `/AI/Architecture.md`)
- Touchpoints (files/modules):
- Data contracts / validation:
- Integrations (Discord, GitHub, OpenAI, Wiki):
- Env/Config & flags:
- Gaps/Risks:

# 5) 🧩 Implementation Plan
1) Read first:
   - `/AI/Architecture.md`, `/AI/instructions.md` (if present)
   - backend/routes/... , models, schemas
2) Dev rules snapshot (from .cursorrules):
   - small PRs; typed boundaries; modals for UX; update `/AI/status.md`
3) Steps:
   1. ...
   2. ...
   3. Error handling & edge cases
   4. Wiring & tests
   5. Docs & polish
4) Parallelizable work:
5) Dev/Run:
   - Install: `npm i` / `pip -r requirements.txt`
   - Dev: `npm run dev` / `uvicorn backend.main:app --reload`
   - Test: `npm test` / `pytest`

# 6) Project-Specific Guidelines
- API → `/api` proxy; version new endpoints `/api/v1/...`
- No `alert()`; use `<Modal>` components
- Code organization:
  - `frontend/{components,hooks,lib,types,ui}`
  - `backend/{routes,services,repositories,models}`
- Docs updated in `/AI/*` as needed

# 7) 📌 Acceptance Criteria
- [ ] Functional:
- [ ] Validation:
- [ ] Error Handling (normalized; frontend modal):
- [ ] Performance (e.g., p95 < 200ms dev):
- [ ] Security (sanitization, auth/roles):
- [ ] Testing (unit/integration/E2E if relevant):
- [ ] Docs (`/AI` updates, examples):

# 8) 🧪 Test Plan
- Unit:
- Integration:
- E2E (if applicable):
- Fixtures/Mocks:

# 9) 🔄 Status & Next Steps
- Record progress in `/AI/status.md` at meaningful milestones
- Next Steps:
  - ...
  - ...

# 10) 📦 Deliverables
- [ ] Code (modular)
- [ ] Tests
- [ ] Documentation
- [ ] Example usage (curl/screens)
- [ ] Status updated; approvals recorded

# 11) Save for Reuse
- Persist this task under `/AI/tasks/{ID or slug}.md` for reuse. (Same pattern as your prior template.) 
