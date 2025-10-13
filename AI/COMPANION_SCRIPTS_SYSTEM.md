# Companion Scripts System

## Overview

The Companion Scripts System allows scripts to be linked together when they work as a set. This is particularly useful for multi-part scripts where one script sets up variables or conditions that another script uses.

## Use Cases

### Common Scenarios

1. **Variable Setup Scripts**
   - Script 1: Sets variables using `@setvar`
   - Script 2: Uses those variables in execution

2. **Multi-Stage Python Scripts**  
   - Script 1: Data collection
   - Script 2: Data processing
   - Script 3: Data output

3. **Configuration + Execution**
   - Script 1: User configuration/setup
   - Script 2: Main execution using configured values

## How It Works

### Database Schema

**Fields Added to `scripts_cache` table:**
- `parent_script_id` (VARCHAR) - References the main script's ID
- `is_companion` (BOOLEAN) - TRUE if this is a companion script
- `execution_order` (INTEGER) - Optional ordering for multiple companions

**Relationship:**
- One main script can have multiple companion scripts
- Each companion script has ONE parent script
- Companion scripts are hidden from main listings
- Companion scripts display with their parent

### Backend Implementation

#### Migration
```bash
python backend/migrate_companion_scripts.py
```

Adds three new columns to scripts_cache table with proper defaults.

#### API Endpoints

**Get Companion Scripts**
```http
GET /api/scripts/{script_id}/companions
```

Returns companion scripts ordered by `execution_order`.

**Create Script with Companion**
```http
POST /api/scripts/
{
  "title": "Setup Variables",
  "code": "...",
  "parent_script_id": "main-script-id",
  "is_companion": true,
  "execution_order": 1
}
```

#### List Scripts Behavior
```http
GET /api/scripts/
```

**Default:** Excludes companion scripts (only shows main scripts)
**With `include_companions=true`:** Shows all scripts including companions

### Frontend Implementation

#### CreateScriptModal

**Companion Script Checkbox:**
- Blue highlighted section  
- Clear explanation of purpose
- Example use case shown

**When Checked:**
1. **Parent Script Dropdown** - Select main script
2. **Execution Order Field** - Optional ordering (1, 2, 3, etc.)

**Parent Script Selection:**
- Shows only approved main scripts (not companions)
- Displays: Title (Language)
- Required if is_companion is TRUE

#### CompanionScriptsSection Component

**Location:** Script detail page (below script info, before code)

**Display:**
- Blue bordered section
- Shows companion count
- Lists companions with:
  - Execution order badge (if set)
  - Title (clickable link)
  - Language badge
  - Description
  - Author and rating
  - View and Download buttons

**Visibility:**
- Only shows if main script has companions
- Hidden on companion script pages (no recursive display)

### User Experience

#### Creating a Companion Script

1. User clicks "Create Script"
2. Checks "This is a companion script"
3. Selects parent from dropdown
4. (Optional) Sets execution order
5. Fills in script details as normal
6. Submits

**Result:**
- Companion saved with link to parent
- Does NOT appear in main script listings
- Appears on parent script's detail page

#### Viewing Scripts with Companions

**Main Script Page Shows:**
- Normal script information
- **Companion Scripts section** (if any exist)
  - "These scripts work together..."
  - Ordered list of companions
  - Clear execution order
  - Note about running in order

**User Action:**
- Can click to view each companion
- Can download main + all companions
- Understands the relationship

#### Viewing a Companion Script

**Companion Script Page Shows:**
- Normal script information
- Link back to parent script
- Clear indication it's part of a set

## Benefits

### For Users

1. **Clear Organization** - Related scripts grouped together
2. **Execution Guidance** - Order is explicit
3. **Easy Discovery** - Find all parts of a multi-script solution
4. **Reduced Clutter** - Companion scripts don't clutter main listings

### For Script Authors

1. **Multi-Part Solutions** - Can create complex multi-script setups
2. **Proper Attribution** - All parts linked together
3. **Clear Documentation** - Execution order preserved
4. **Flexible Design** - Can add companions anytime

### For System

1. **Better Organization** - Scripts properly categorized
2. **Improved Search** - Main scripts easier to find
3. **Data Integrity** - Relationships tracked in database
4. **Scalability** - Supports complex script ecosystems

## Technical Details

### Database

```sql
-- Migration adds these columns
ALTER TABLE scripts_cache ADD COLUMN parent_script_id VARCHAR;
ALTER TABLE scripts_cache ADD COLUMN is_companion BOOLEAN DEFAULT FALSE;
ALTER TABLE scripts_cache ADD COLUMN execution_order INTEGER;
```

**Foreign Key:** 
- `parent_script_id` references `scripts_cache.id`
- Allows NULL (not all scripts have parents)

### Models

**Pydantic (API):**
```python
class ScriptCreate(BaseModel):
    # ... existing fields
    parent_script_id: Optional[str] = None
    is_companion: bool = False
    execution_order: Optional[int] = None
```

**TypeScript (Frontend):**
```typescript
interface Script {
  // ... existing fields
  parent_script_id?: string
  is_companion?: boolean
  execution_order?: number
}
```

### Query Logic

**Exclude Companions from Listings:**
```python
base_query = base_query.filter(or_(
    ScriptsCacheDB.is_companion == False,
    ScriptsCacheDB.is_companion == None
))
```

**Get Companions:**
```python
companions = db.query(ScriptsCacheDB).filter(
    ScriptsCacheDB.parent_script_id == script_id
).order_by(ScriptsCacheDB.execution_order.asc()).all()
```

## Examples

### Example 1: Variable Setup

**Main Script:** "Fishing Automation"
```razor
# Main fishing script
if @findobject 'fishingpole'
  dclick 'fishingpole'
  wait 500
endif
```

**Companion Script:** "Fishing Setup" (execution_order: 1)
```razor
# Run this first to set up variables
@setvar 'fishingpole' 0x4005A2B1
@setvar 'fishspot' 0x4005A2B2
overhead 'Variables configured!' 88
```

**Usage:**
1. User runs companion script first
2. Then runs main script
3. Variables are already set

### Example 2: Multi-Stage Python

**Main Script:** "Data Processor"
```python
# Processes collected data
data = load_data()
results = process(data)
save_results(results)
```

**Companion 1:** "Data Collector" (execution_order: 1)
```python
# Collects raw data first
data = collect_from_game()
save_data(data)
```

**Companion 2:** "Results Reporter" (execution_order: 2)
```python
# Reports results after processing
results = load_results()
generate_report(results)
```

**Usage:**
1. Run "Data Collector" first
2. Run "Data Processor" second
3. Run "Results Reporter" third

## Migration Path

### For Existing Scripts

1. **No Immediate Changes**
   - Existing scripts work as before
   - All default to `is_companion=FALSE`

2. **Gradual Adoption**
   - Users can convert existing scripts
   - Admin can reorganize script sets
   - No breaking changes

### For Script Authors

1. **Upload Main Script First**
2. **Upload Companions**
   - Check "companion script" box
   - Select parent
   - Set order
3. **Scripts Auto-Link**

## Best Practices

### For Authors

1. **Clear Naming**
   - Main: "Fishing Automation"
   - Companion: "Fishing Setup"
   - Indicates relationship

2. **Proper Ordering**
   - Use execution_order for clarity
   - 1 = first, 2 = second, etc.
   - Document in descriptions

3. **Complete Documentation**
   - Explain relationship in description
   - Note execution requirements
   - Provide usage instructions

### For Users

1. **Read Instructions**
   - Check companion scripts section
   - Note execution order
   - Follow documented steps

2. **Run in Order**
   - Follow numbered sequence
   - Don't skip steps
   - Wait for completion

3. **Keep Together**
   - Download all parts
   - Organize in folders
   - Label clearly

## Limitations

### Current Limitations

1. **Single Parent Only**
   - Each companion has ONE parent
   - Can't link to multiple main scripts
   - (Future: Many-to-many relationships?)

2. **No Auto-Execution**
   - Doesn't automatically run companions
   - User must run manually in order
   - (Future: Script chains?)

3. **Static Relationships**
   - Links set at creation
   - Can't easily reorganize later
   - (Future: Edit functionality?)

## Future Enhancements

### Planned

1. **Edit Companion Links**
   - Change parent script
   - Reorder companions
   - Break relationships

2. **Companion Tags**
   - Special tag for companion scripts
   - Filter by relationship type
   - Search by parent

3. **Auto-Run Chains**
   - Option to run all in sequence
   - Progress indicators
   - Error handling

### Potential

1. **Many-to-Many**
   - Script can be companion to multiple parents
   - Reusable setup scripts
   - Shared configurations

2. **Dependency Graphs**
   - Visual relationship map
   - Dependency resolution
   - Circular dependency detection

3. **Script Packages**
   - Bundle main + companions
   - Single download/install
   - Version management

## Related Documentation

- **Scripts System**: `/AI/SCRIPTS_SYSTEM_DOCUMENTATION.md`
- **Architecture**: `/AI/COMPREHENSIVE_ARCHITECTURE.md`
- **Status**: `/AI/status.md`

## Implementation Files

### Backend
- `backend/migrate_companion_scripts.py` - Database migration
- `backend/database.py` - SQLAlchemy model (lines 96-98)
- `backend/models.py` - Pydantic models (lines 71-73, 83-85, 111-113)
- `backend/routes/scripts.py` - API endpoints (lines 69-71, 293-305, 322-324)

### Frontend
- `frontend/lib/api.ts` - TypeScript types (lines 68-70, 81-83, 111-113, 343-346)
- `frontend/components/CreateScriptModal.tsx` - Upload UI (lines 24-25, 479-550)
- `frontend/components/CompanionScriptsSection.tsx` - Display component
- `frontend/pages/scripts/[id].tsx` - Integration (lines 411-414)

---

**Created**: 2025-10-13  
**Last Updated**: 2025-10-13  
**Status**: Complete and tested

