import { Item } from '../../types/items';

/**
 * Compute item type based on name and item_id
 */
export function computeItemType(item: Item): 'id-only' | 'name-only' | 'complete' {
  const hasName = item.name && item.name.trim() !== '';
  const hasId = item.item_id !== null && item.item_id !== undefined;
  
  if (hasName && hasId) {
    return 'complete';
  } else if (hasId && !hasName) {
    return 'id-only';
  } else if (hasName && !hasId) {
    return 'name-only';
  }
  
  return 'name-only'; // Default fallback
}

/**
 * Compute display name for an item
 */
export function computeDisplayName(item: Item): string {
  if (item.name && item.name.trim() !== '') {
    return item.name;
  }
  
  if (item.item_id !== null && item.item_id !== undefined) {
    return `item_${item.item_id}`;
  }
  
  return 'Unknown Item';
}

/**
 * Compute display ID for an item
 */
export function computeDisplayId(item: Item): string | null {
  if (item.item_id !== null && item.item_id !== undefined) {
    return item.item_id.toString();
  }
  return null;
}

/**
 * Check if an item is verified (has both name and ID)
 */
export function isItemVerified(item: Item): boolean {
  return item.name && item.name.trim() !== '' && 
         item.item_id !== null && item.item_id !== undefined;
}

/**
 * Check if an item name looks like a placeholder (starts with "item_")
 */
export function isPlaceholderName(name: string): boolean {
  return name.toLowerCase().startsWith('item_');
}

/**
 * Generate a suggested name from item ID
 */
export function generateNameFromId(itemId: number): string {
  return `item_${itemId}`;
}

/**
 * Extract item ID from placeholder name
 */
export function extractIdFromPlaceholder(name: string): number | null {
  const match = name.match(/^item_(\d+)$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Sort items by various criteria
 */
export function sortItems(items: Item[], sortBy: 'name' | 'id' | 'category' | 'usage' = 'name'): Item[] {
  const sorted = [...items].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.display_name || '').localeCompare(b.display_name || '');
      case 'id':
        return (a.item_id || 0) - (b.item_id || 0);
      case 'category':
        return (a.category_name || '').localeCompare(b.category_name || '');
      case 'usage':
        return b.usage_count - a.usage_count;
      default:
        return 0;
    }
  });
  
  return sorted;
}

/**
 * Filter items based on search criteria
 */
export function filterItems(items: Item[], filters: {
  search: string;
  category_id: number | null;
  matched_only: boolean;
  unmatched_only: boolean;
}): Item[] {
  return items.filter(item => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = item.name.toLowerCase().includes(searchLower);
      const matchesId = item.item_id?.toString().includes(searchLower) || false;
      
      if (!matchesName && !matchesId) {
        return false;
      }
    }
    
    // Category filter
    if (filters.category_id !== null && item.category_id !== filters.category_id) {
      return false;
    }
    
    // Matched/unmatched filters (mutually exclusive)
    if (filters.matched_only && !isItemVerified(item)) {
      return false;
    }
    
    if (filters.unmatched_only && isItemVerified(item)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Compute item properties and add them to the item
 */
export function computeItemProperties(item: Item): Item {
  return {
    ...item,
    item_type: computeItemType(item),
    display_name: computeDisplayName(item),
    display_id: computeDisplayId(item),
    is_verified: isItemVerified(item)
  };
}

/**
 * Batch compute properties for multiple items
 */
export function computeItemPropertiesBatch(items: Item[]): Item[] {
  return items.map(computeItemProperties);
}
