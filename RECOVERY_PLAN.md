# Items.tsx Recovery Plan

## What Happened
The `frontend/pages/items.tsx` file (2200+ lines) was corrupted during debugging and is now empty (1 line). No git history available for recovery.

## What Needs to Be Recreated

### Core Functionality Required
1. **Item Management Interface** - List, create, edit, delete items
2. **Item Properties**:
   - Name, Item ID, Hue, Category, Description
   - Usage count, Matched status (has both name & ID)
   - Multiple hues per item with color names
   - Script usage examples with expandable context
3. **Search & Filters** - Search by name/ID, filter by category, matched/unmatched
4. **Quick Actions**:
   - Quick rename for `item_XXXX` entries
   - "Find Name" button for ID-only items
   - "Find ID" button for name-only items
5. **Merge Functionality** - Merge duplicate items (ID-only + name-only)
6. **Hue Management**:
   - Add individual hues with autocomplete
   - Bulk add hues from predefined sets
   - Edit/remove hues
   - Hue sets manager (create, edit, delete sets)
7. **Script Examples**:
   - Paginated list (10 per page)
   - Expandable context (3, 6, 10, 15, 20, 25, 30 lines)
   - "View Script" modal
   - Link to original script

## Proposed Refactoring (Better Architecture)

### File Structure
```
frontend/
├── pages/
│   └── items.tsx                    # Main page (200 lines max)
├── components/
│   └── items/
│       ├── ItemList.tsx            # Table/list view
│       ├── ItemFilters.tsx         # Search & filter controls
│       ├── modals/
│       │   ├── CreateItemModal.tsx
│       │   ├── ViewItemModal.tsx   # Combined view/edit
│       │   ├── MergeItemModal.tsx
│       │   ├── ScriptViewModal.tsx
│       │   └── HueSetsManager.tsx
│       ├── hues/
│       │   ├── HueList.tsx
│       │   ├── HueInput.tsx        # With autocomplete
│       │   └── BulkHueForm.tsx
│       └── scripts/
│           ├── ScriptExampleList.tsx
│           └── ScriptPreview.tsx   # Expandable preview
├── hooks/
│   └── items/
│       ├── useItems.ts             # Data fetching & CRUD
│       ├── useItemMerge.ts         # Merge logic
│       ├── useHues.ts              # Hue management
│       └── useScriptExamples.ts    # Script examples
├── types/
│   └── items.ts                    # TypeScript interfaces
└── utils/
    └── items/
        ├── itemHelpers.ts          # Computed properties
        └── hueHelpers.ts           # Color name mapping
```

### Key Interfaces (from original)
```typescript
interface Item {
  id: number;
  name: string;
  item_id: number | null;
  hue: number;
  category_id: number;
  category_name: string;
  description: string;
  usage_count: number;
  is_verified: boolean;
  hues: Array<{hue: number, description: string, usage_count: number}>;
  script_examples: Array<{script_id: string, script_title: string, context: string, line_number: number}>;
  // Computed
  item_type: 'id-only' | 'name-only' | 'complete';
  display_name: string;
  display_id: string | null;
}
```

## API Endpoints Being Used
- `GET /api/items/categories` - List categories
- `GET /api/items/items?search=&category_id=&verified_only=&unmatched_only=&limit=` - List items
- `POST /api/items/items` - Create item
- `PUT /api/items/items/{id}` - Update item
- `DELETE /api/items/items/{id}` - Delete item
- `POST /api/items/merge` - Merge two items
- `GET /api/items/{id}/hues` - Get item hues
- `POST /api/items/{id}/hues` - Add hue
- `PUT /api/items/{id}/hues/{hue_value}` - Update hue description
- `DELETE /api/items/{id}/hues/{hue_value}` - Remove hue
- `GET /api/items/hue-sets` - List hue sets
- `POST /api/items/hue-sets` - Create hue set
- `PUT /api/items/hue-sets/{id}` - Update hue set
- `DELETE /api/items/hue-sets/{id}` - Delete hue set
- `POST /api/items/hue-sets/{id}/use` - Increment usage count
- `GET /api/items/individual-hues` - List all hues with color names
- `POST /api/items/individual-hues` - Create/update individual hue

## State Management (from original)
```typescript
// Items
const [items, setItems] = useState<Item[]>([])
const [loading, setLoading] = useState(true)
const [categories, setCategories] = useState<ItemCategory[]>([])

// Filters
const [searchTerm, setSearchTerm] = useState('')
const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
const [matchedOnly, setMatchedOnly] = useState(false)
const [unmatchedOnly, setUnmatchedOnly] = useState(false)

// Modals
const [showCreateModal, setShowCreateModal] = useState(false)
const [viewingItem, setViewingItem] = useState<Item | null>(null)
const [viewingScript, setViewingScript] = useState<ScriptExample | null>(null)
const [mergeModal, setMergeModal] = useState({...})

// Hues
const [hueSets, setHueSets] = useState<any[]>([])
const [individualHues, setIndividualHues] = useState<any[]>([])
const [showHueSetsManager, setShowHueSetsManager] = useState(false)
const [addingHue, setAddingHue] = useState(false)
const [newHueValue, setNewHueValue] = useState('')
const [newHueDesc, setNewHueDesc] = useState('')
const [hueValueSuggestions, setHueValueSuggestions] = useState<number[]>([])
const [hueNameSuggestions, setHueNameSuggestions] = useState<string[]>([])

// Scripts
const [scriptPage, setScriptPage] = useState(1)
const [expandedScripts, setExpandedScripts] = useState<{[key: string]: number}>({})

// Quick rename
const [quickRenaming, setQuickRenaming] = useState<number | null>(null)
const [quickRenameValue, setQuickRenameValue] = useState('')
```

## Key Functions to Recreate
1. `loadItems()` - Fetch items with filters
2. `loadCategories()` - Fetch categories
3. `loadHueSets()` - Fetch hue sets
4. `loadIndividualHues()` - Fetch individual hues
5. `handleCreateItem()` - Create new item
6. `handleUpdateItem()` - Update item
7. `handleDeleteItem()` - Delete item
8. `handleMergeItems()` - Merge two items
9. `handleQuickRename()` - Quick rename functionality
10. `handleAddHue()` - Add single hue
11. `handleAddBulkHues()` - Add multiple hues
12. `handleEditHue()` - Edit hue description
13. `handleRemoveHue()` - Remove hue
14. `getHueColorName()` - Get color name for hue value
15. `handleHueValueChange()` - Autocomplete for hue value
16. `handleHueNameChange()` - Autocomplete for hue name
17. `toggleScriptExpansion()` - Expand/collapse script context
18. `openScriptModal()` - Open script viewing modal
19. `getScriptPreview()` - Get preview of script context
20. `computeItemProperties()` - Compute item type and display properties

## Critical Features to Preserve
1. **Autocomplete for Hues** - Must show suggestions for both values and names
2. **Immediate State Updates** - When editing hues, update `viewingItem` state immediately
3. **Safety Checks** - `viewingItem.hues !== undefined` to prevent crashes
4. **Pagination** - Script examples paginated (10 per page)
5. **Expandable Context** - Script context expands: 3→6→10→15→20→25→30 lines
6. **Mutual Exclusivity** - Matched/Unmatched filters are mutually exclusive
7. **Computed Properties** - `item_type`, `display_name`, `display_id`, `is_verified`
8. **Find Buttons** - Show "Find Name" for ID-only, "Find ID" for name-only
9. **Quick Rename** - For items starting with `item_`
10. **Hue Sets** - Reusable hue collections with usage tracking

## Backend Files (Already Working)
- ✅ `backend/routes/items.py` - All API endpoints working
- ✅ `backend/routes/scripts.py` - Updated with SQLite instead of SQLAlchemy
- ✅ `backend/routes/ai_items.py` - Updated with SQLite
- ✅ `backend/database.py` - Database models
- ✅ SQLite database with all tables created

## Instructions for New Chat

### Context to Provide
```
I need to recreate a complex React/Next.js component that was lost. The file is 
`frontend/pages/items.tsx` - an item management interface.

Please recreate it with PROPER SEPARATION OF CONCERNS using multiple component 
files instead of one massive file.

Key requirements:
1. Split into logical components (list, filters, modals, hue management, etc.)
2. Use custom hooks for data fetching and state management
3. Keep main page file under 200 lines
4. All features from the original must work

[Attach this RECOVERY_PLAN.md file]

Backend is working perfectly - all API endpoints are ready. Just need clean, 
maintainable frontend code.
```

### Recommended Creation Order
1. **Types & Interfaces** (`types/items.ts`) - Define all TypeScript types
2. **Utility Functions** (`utils/items/`) - Helper functions
3. **Custom Hooks** (`hooks/items/`) - Data fetching logic
4. **Simple Components** - HueList, ScriptPreview, ItemFilters
5. **Modal Components** - One at a time, test each
6. **Main Page** - Wire everything together
7. **Test & Debug** - One feature at a time

## Notes
- Backend server is running on port 7000
- Frontend uses `http://localhost:7000` for API calls
- Uses toast notifications for success/error messages
- GGMemberGuard wrapper for authentication
- Layout component for page structure

## Testing Checklist After Recreation
- [ ] Items load and display correctly
- [ ] Search and filters work
- [ ] Create new item
- [ ] Edit item (in view modal)
- [ ] Delete item
- [ ] Quick rename works
- [ ] Find Name/Find ID buttons appear correctly
- [ ] Merge functionality works
- [ ] Add single hue with autocomplete
- [ ] Add bulk hues
- [ ] Edit hue description
- [ ] Remove hue
- [ ] Hue sets manager (create, edit, delete)
- [ ] Script examples paginate
- [ ] Script context expands
- [ ] View script modal opens
- [ ] "Go to Original Script" works
- [ ] Matched/Unmatched filters work
- [ ] No crashes when hues are undefined
