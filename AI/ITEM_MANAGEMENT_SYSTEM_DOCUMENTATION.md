# Item Management System Documentation

## Overview

The Item Management System is a comprehensive web application for managing game items, including their names, IDs, categories, hues, and script usage examples. The system handles data inconsistencies from scraped scripts and provides tools for merging duplicate or incomplete item records.

## Architecture

### Technology Stack
- **Frontend**: Next.js (TypeScript) + React
- **Backend**: FastAPI (Python)
- **Database**: SQLite (`suggestions.db`)
- **Authentication**: Discord OAuth via NextAuth

### Key Features
- **Item CRUD Operations**: Create, read, update, delete items
- **Merge System**: Intelligent merging of duplicate/incomplete items
- **Hue Management**: Associate items with color hues
- **Script Examples**: View script usage examples for each item
- **Data Cleanup**: Handle numeric names and ID inconsistencies

## Database Schema

### Core Tables

#### `items` Table
```sql
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    item_id INTEGER,
    hue INTEGER,
    category_id INTEGER,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `item_hues` Table
```sql
CREATE TABLE item_hues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    hue_value INTEGER NOT NULL,
    hue_name VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

#### `item_script_usage` Table
```sql
CREATE TABLE item_script_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    script_id VARCHAR NOT NULL,
    script_title VARCHAR NOT NULL,
    usage_context TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE(item_id, script_id, line_number)
);
```

## Merge System

### Overview

The merge system is designed to handle data inconsistencies from scraped scripts where the same item might be referenced by name in some scripts and by ID in others. This creates duplicate or incomplete records that need to be consolidated.

### Merge Types

#### 1. Individual Item Merge
**Purpose**: Merge two specific items manually
**Endpoint**: `POST /api/items/merge`
**Use Case**: When a user identifies two items that should be the same

**Process**:
1. **Data Consolidation**: Merge data from source item into target item
   - Use target item as base, fill missing data from source
   - Priority: target > source for each field
2. **Hue Transfer**: Move all hues from source to target
3. **Script Usage Transfer**: Handle UNIQUE constraint conflicts
   - Delete conflicting script usage records from source
   - Move remaining script usage from source to target
4. **Source Deletion**: Remove source item after successful transfer

**Request Format**:
```json
{
  "source_item_id": 12345,
  "target_item_id": 67890
}
```

**Response**: Returns the merged target item

#### 2. Bulk Merge Duplicates
**Purpose**: Automatically merge all duplicate items
**Endpoint**: `POST /api/items/bulk-merge-duplicates`
**Use Case**: Clean up database after data import/scraping

**Process**:
1. **Find Duplicate Names**: Items with same name (non-numeric, non-hex)
2. **Find Duplicate IDs**: Items with same item_id
3. **For Each Duplicate Group**:
   - Keep first item as target
   - Merge all others into target (same process as individual merge)
   - Handle UNIQUE constraint conflicts properly

**Response**:
```json
{
  "merged_count": 15,
  "message": "Successfully merged 15 duplicate items"
}
```

### Merge Logic Details

#### Data Consolidation Strategy
```python
# Merge data - use target as base, fill in missing data from source
merged_name = target_item[1] if target_item[1] else source_item[1]
merged_item_id = target_item[2] if target_item[2] else source_item[2]
merged_hue = target_item[3] if target_item[3] else source_item[3]
merged_category_id = target_item[4] if target_item[4] else source_item[4]
merged_description = target_item[5] if target_item[5] else source_item[5]
```

#### UNIQUE Constraint Handling
The `item_script_usage` table has a UNIQUE constraint on `(item_id, script_id, line_number)`. When merging:

1. **Delete Conflicting Records**: Remove script usage from source that conflicts with target
2. **Move Remaining Records**: Transfer non-conflicting script usage to target
3. **Preserve Data Integrity**: Ensure no duplicate script usage records

```python
# Handle script usage - delete conflicting ones, keep unique ones
cursor.execute('''
    DELETE FROM item_script_usage 
    WHERE item_id = ? AND (script_id, line_number) IN (
        SELECT script_id, line_number 
        FROM item_script_usage 
        WHERE item_id = ?
    )
''', (source_id, target_id))

# Move remaining script usage from source to target
cursor.execute('UPDATE item_script_usage SET item_id = ? WHERE item_id = ?', 
              (target_id, source_id))
```

### Frontend Integration

#### Merge Button Placement
- **Location**: Inline with item name/ID in the main table
- **Visibility**: Only shown for incomplete items (`item_type !== 'complete'`)
- **Styling**: Blue button with hover effects

#### Merge Modal
- **Search Functionality**: Search by name or ID based on what's missing
- **Dynamic Instructions**: Changes based on item state
- **Create Option**: Option to create new item if no match found

#### Item Type Detection
```typescript
// Frontend logic for determining item completeness
export function computeItemType(item: Item): 'complete' | 'named_only' | 'id_only' {
  const hasRealName = item.name && item.name.trim() !== '' && !isNumericId(item.name);
  const hasId = item.item_id !== null && item.item_id !== undefined;
  
  if (hasRealName && hasId) return 'complete';
  if (hasRealName && !hasId) return 'named_only';
  if (!hasRealName && hasId) return 'id_only';
  return 'named_only'; // Default fallback
}
```

## Data Processing

### Numeric Name Handling
Items scraped from scripts sometimes have numeric names that should be item IDs:

```typescript
export function isNumericId(name: string): boolean {
  return /^\d+$/.test(name.trim()) || /^0x[0-9a-fA-F]+$/.test(name.trim());
}
```

### Display Logic
```typescript
export function computeDisplayName(item: Item): string {
  if (item.name && item.name.trim() !== '' && !isNumericId(item.name)) {
    return item.name;
  }
  if (item.item_id !== null && item.item_id !== undefined) {
    return `item_${item.item_id}`;
  }
  if (item.name && isNumericId(item.name)) {
    return `item_${item.name}`;
  }
  return 'Unknown Item';
}
```

## API Endpoints

### Core Item Operations
- `GET /api/items/items` - List items with filtering
- `POST /api/items/items` - Create new item
- `GET /api/items/items/{id}` - Get specific item
- `PUT /api/items/items/{id}` - Update item
- `DELETE /api/items/items/{id}` - Delete item

### Merge Operations
- `POST /api/items/merge` - Merge two specific items
- `POST /api/items/bulk-merge-duplicates` - Bulk merge all duplicates

### Search Operations
- `GET /api/items/items/search/{query}` - Search items by name/ID
- `GET /api/items/categories` - List item categories

### Hue Management
- `GET /api/items/{item_id}/hues` - Get item hues
- `POST /api/items/{item_id}/hues` - Add hue to item
- `PUT /api/items/hues/{hue_id}` - Update hue
- `DELETE /api/items/hues/{hue_id}` - Remove hue

### Script Examples
- `GET /api/items/{item_id}/script-examples` - Get script usage examples

## Error Handling

### Database Lock Prevention
- **Connection Management**: Proper `try/except/finally` blocks
- **Transaction Handling**: Rollback on errors, commit on success
- **Connection Cleanup**: Always close connections in finally blocks

### UNIQUE Constraint Handling
- **Conflict Detection**: Check for existing records before insertion
- **Graceful Degradation**: Delete conflicting records, preserve unique ones
- **Data Integrity**: Maintain referential integrity during merges

## Usage Examples

### Manual Item Merge
1. User identifies two items that should be the same
2. Clicks "Merge" button on incomplete item
3. Searches for matching item by name/ID
4. Selects target item from search results
5. Confirms merge operation
6. System consolidates data and removes duplicate

### Bulk Duplicate Cleanup
1. Admin runs bulk merge after data import
2. System automatically finds all duplicate groups
3. Merges each group into single item
4. Reports number of items merged
5. Database is cleaned of duplicates

### Data Import Workflow
1. Import scraped script data
2. Run bulk merge to handle duplicates
3. Manual review of remaining incomplete items
4. Use individual merge for specific cases
5. Verify data integrity

## Performance Considerations

### Database Optimization
- **Indexes**: Proper indexing on frequently queried fields
- **Batch Operations**: Bulk operations for large datasets
- **Connection Pooling**: Efficient database connection management

### Frontend Optimization
- **Debounced Search**: Limit API calls during search
- **Pagination**: Handle large item lists efficiently
- **Caching**: Cache frequently accessed data

## Security Considerations

### Input Validation
- **Pydantic Models**: All API inputs validated
- **SQL Injection Prevention**: Parameterized queries only
- **Type Checking**: Strong typing throughout

### Authentication
- **Discord OAuth**: User authentication required
- **Admin Operations**: Admin-only access for sensitive operations
- **Session Management**: Secure session handling

## Future Enhancements

### Planned Features
- **Batch Import**: CSV/JSON import functionality
- **Advanced Search**: Full-text search capabilities
- **Data Export**: Export merged data for analysis
- **Audit Trail**: Track merge operations and changes
- **Automated Cleanup**: Scheduled duplicate detection and merging

### Technical Improvements
- **Database Migration**: Schema versioning system
- **API Versioning**: Backward compatibility support
- **Performance Monitoring**: Metrics and optimization
- **Error Reporting**: Comprehensive error tracking

This documentation provides a complete overview of the Item Management System's merge functionality and overall architecture. The merge system is designed to handle real-world data inconsistencies while maintaining data integrity and providing a smooth user experience.