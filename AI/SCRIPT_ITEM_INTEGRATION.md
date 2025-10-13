# Script-Item Integration System

## Overview

The Script-Item Integration System automatically detects, validates, and links items referenced in Razor scripts during the upload process. This ensures data consistency between scripts and the item database while helping users maintain complete item records.

## How It Works

### Upload Workflow

1. **User Creates Script**: User fills out script upload form
2. **Parse Items**: System extracts item references from script code
3. **Validate Items**: Check each item against database
4. **User Action**: Prompt user to add/complete missing items
5. **Create Script**: Save script after items are validated
6. **Link Items**: Create associations in `item_script_usage` table

### Item Detection

The system detects items in commands ending with `type`:

```razor
findtype "fish" backpack          # Detects: fish (name)
findtype 0x9CC backpack           # Detects: 0x9CC (hex ID = 2508)
dclicktype "fishing pole"         # Detects: fishing pole (name)
usetype 3821 backpack             # Detects: 3821 (decimal ID)
lifttype "scissors"               # Detects: scissors (name)
droptype 0xEED                    # Detects: 0xEED (hex ID = 3821)
```

Supported commands: `findtype`, `dclicktype`, `usetype`, `lifttype`, `droptype`, etc.

### Item Validation States

- **Complete**: Item has both name and ID ✅
- **Incomplete**: Item missing either name or ID (needs completion) ⚠️
- **Missing**: Item not in database (needs to be added) ❌

## User Experience

### ItemValidationModal

When user submits a script, they see:

1. **Summary**: Total items, status breakdown (complete/incomplete/missing)
2. **Current Item Form**: 
   - Shows line number and code context
   - Pre-fills known data
   - Prompts for missing data
   - Skip or Save options
3. **Progress List**: All items with status indicators
4. **Complete Button**: Enabled when all items handled

### Example Flow

**Scenario**: User uploads fishing script with items

```razor
if findtype "fish" backpack
    say "Found fish!"
endif

dclicktype 0x9CC  # fishing pole (hex ID)
```

**Modal Shows**:
- Item 1: "fish" - Status: Incomplete (missing ID)
  - User adds: ID = 2508
- Item 2: "0x9CC" - Status: Incomplete (missing name)  
  - User adds: Name = "fishing pole"
- Both items now complete → Continue to create script

## Technical Implementation

### Backend

#### Script Parser (`backend/utils/script_parser.py`)

```python
# Extract items from script code
items = extract_item_references(script_code)
# Returns: [
#   {
#     'identifier': 'fish',
#     'is_numeric': False,
#     'command': 'findtype',
#     'line_number': 1,
#     'context': 'if findtype "fish" backpack'
#   },
#   ...
# ]

# Normalize to name/ID
name, item_id = normalize_item_identifier('0x9CC')
# Returns: (None, 2508)

# Get summary
summary = get_item_usage_summary(script_code)
# Returns: {
#   'total_references': 5,
#   'unique_items': 3,
#   'items': [...],
#   'commands_used': ['findtype', 'dclicktype']
# }
```

#### API Endpoints

**POST /api/items/validate-script-items**
```json
{
  "script_code": "findtype \"fish\" backpack"
}

// Returns:
{
  "total_items": 1,
  "items": [
    {
      "identifier": "fish",
      "is_numeric": false,
      "normalized_name": "fish",
      "normalized_id": null,
      "status": "incomplete",
      "missing_data": ["item_id"],
      "db_item": {
        "id": 123,
        "name": "fish",
        "item_id": null,
        "category_id": 1
      },
      "usage": {
        "command": "findtype",
        "line_number": 1,
        "context": "findtype \"fish\" backpack"
      }
    }
  ],
  "status_counts": {
    "complete": 0,
    "incomplete": 1,
    "missing": 0
  },
  "commands_used": ["findtype"]
}
```

**POST /api/items/link-script-to-items**
```json
{
  "script_id": "abc-123",
  "script_title": "Fishing Macro",
  "script_code": "findtype \"fish\" backpack"
}

// Returns:
{
  "linked_count": 1,
  "total_items": 1,
  "errors": null
}
```

### Frontend

#### ItemValidationModal Component

**Props**:
- `scriptCode`: The script code to validate
- `onComplete`: Called when validation complete
- `onCancel`: Called when user cancels

**Features**:
- Auto-loads validation on mount
- Step-by-step item processing
- Form pre-population with known data
- Progress tracking
- Category selection
- Skip/save options

#### CreateScriptModal Integration

```typescript
// State
const [showItemValidation, setShowItemValidation] = useState(false)

// On submit
const handleSubmit = async (e) => {
  // Validate form
  // Show item validation modal
  setShowItemValidation(true)
}

// After items validated
const handleItemValidationComplete = async () => {
  // Create script
  const response = await apiService.createScript(...)
  
  // Link items
  await linkScriptToItems(response.id, title, code)
  
  // Success
  onClose()
}
```

### Database Schema

#### item_script_usage Table

```sql
CREATE TABLE item_script_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    script_id VARCHAR NOT NULL,
    script_title VARCHAR NOT NULL,
    usage_context TEXT NOT NULL,      -- Line of code
    line_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE(item_id, script_id, line_number)
);
```

**UNIQUE Constraint**: Prevents duplicate links for same item/script/line

## Key Features

### Smart Parsing

- **Quotes**: Handles double quotes, single quotes, and unquoted
- **Hex Numbers**: Converts 0x format to decimal
- **Comments**: Ignores lines starting with # or //
- **Deduplication**: Removes duplicate references to same item
- **Context**: Preserves full line for reference

### Validation Logic

```python
# Check if item is complete
has_real_name = name and not is_numeric(name)
has_id = item_id is not None

if has_real_name and has_id:
    status = 'complete'
elif has_real_name and not has_id:
    status = 'incomplete'  # missing ID
    missing_data = ['item_id']
elif not has_real_name and has_id:
    status = 'incomplete'  # missing name
    missing_data = ['name']
else:
    status = 'missing'  # not in database
```

### Error Handling

- **Import Errors**: Graceful handling with clear messages
- **Database Errors**: Transaction rollback on failure
- **Duplicate Links**: Uses INSERT OR IGNORE for idempotency
- **Missing Items**: Allows skip to proceed with incomplete data

## Testing

### Backend Tests (`test_script_item_integration.py`)

1. **Extract Item References**: Finds all item references in code
2. **Normalize Identifiers**: Converts to name/ID pairs
3. **Deduplicate**: Removes duplicate references
4. **Usage Summary**: Generates comprehensive summary
5. **Command Detection**: Detects all *type commands
6. **Quote Handling**: Handles various quote formats

**Run Tests**:
```bash
cd backend
python test_script_item_integration.py
```

**Expected Output**:
```
============================================================
RUNNING SCRIPT PARSER TESTS
============================================================

TEST 1: Extract Item References ✓
TEST 2: Normalize Item Identifiers ✓
TEST 3: Deduplicate Items ✓
TEST 4: Get Usage Summary ✓
TEST 5: Command Detection ✓
TEST 6: Quoted vs Unquoted Items ✓

============================================================
ALL TESTS PASSED ✓
============================================================
```

## Benefits

### For Users

1. **Data Consistency**: Ensures items in database match script references
2. **Easy Discovery**: Find which scripts use specific items
3. **Complete Records**: Prompts completion of incomplete item data
4. **Context Aware**: See exactly how items are used in scripts

### For Admins

1. **Quality Control**: Ensures item database completeness
2. **Usage Analytics**: Track which items are most commonly used
3. **Data Cleanup**: Identify and fix incomplete item records
4. **Script Review**: See item usage during script approval

### For System

1. **Referential Integrity**: Maintains links between scripts and items
2. **Search Enhancement**: Can search scripts by items they use
3. **Analytics**: Track item popularity and usage patterns
4. **Data Quality**: Enforces complete item records

## Future Enhancements

### Planned

1. **Bulk Import**: Handle item detection in bulk script imports
2. **Auto-Creation**: Option to auto-create items with best-guess data
3. **Suggestions**: Suggest item matches based on similar names/IDs
4. **Validation Rules**: Custom validation rules per item category

### Potential

1. **AI Enhancement**: Use AI to suggest item names from IDs
2. **Community Data**: Suggest data from community-verified items
3. **Duplicate Detection**: Detect when new items duplicate existing ones
4. **Usage Patterns**: Analyze and report on common usage patterns

## Related Documentation

- **Scripts System**: `/AI/SCRIPTS_SYSTEM_DOCUMENTATION.md`
- **Items Management**: `/AI/ITEM_MANAGEMENT_SYSTEM_DOCUMENTATION.md`
- **Architecture**: `/AI/COMPREHENSIVE_ARCHITECTURE.md`
- **Memory Bank**: `/AI/MEMORY_BANK.md`

## Implementation Files

### Backend
- `backend/utils/script_parser.py` - Core parsing logic
- `backend/routes/items.py` - API endpoints (lines 914-1138)
- `backend/test_script_item_integration.py` - Test suite

### Frontend
- `frontend/components/ItemValidationModal.tsx` - Validation UI
- `frontend/components/CreateScriptModal.tsx` - Integration (lines 1-32, 79-160, 164-173)

---

**Created**: 2025-10-13  
**Last Updated**: 2025-10-13  
**Status**: Complete and tested

