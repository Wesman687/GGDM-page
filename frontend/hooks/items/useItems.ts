import { useState, useEffect, useCallback } from 'react';
import { Item, ItemCategory, CreateItemRequest, UpdateItemRequest, MergeItemRequest, ItemFilters } from '../../types/items';
import { computeItemPropertiesBatch, computeItemProperties } from '../../utils/items/itemHelpers';

const API_BASE = 'http://localhost:7000/api/items';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }, []);

  // Load items with filters
  const loadItems = useCallback(async (filters: ItemFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.category_id !== null) {
        params.append('category_id', filters.category_id.toString());
      }
      if (filters.matched_only) {
        params.append('matched_only', 'true');
      }
      if (filters.unmatched_only) {
        params.append('unmatched_only', 'true');
      }
      
      const response = await fetch(`${API_BASE}/items?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load items');
      }
      
      const data = await response.json();
      // Compute properties for all items
      const itemsWithProperties = computeItemPropertiesBatch(data);
      setItems(itemsWithProperties);
    } catch (err) {
      console.error('Error loading items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create item
  const createItem = useCallback(async (itemData: CreateItemRequest): Promise<Item | null> => {
    try {
      const response = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create item');
      }

      const newItem = await response.json();
      const itemWithProperties = computeItemProperties(newItem);
      
      // Add to local state
      setItems(prev => [...prev, itemWithProperties]);
      
      return itemWithProperties;
    } catch (err) {
      console.error('Error creating item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create item');
      return null;
    }
  }, []);

  // Update item
  const updateItem = useCallback(async (id: number, itemData: UpdateItemRequest): Promise<Item | null> => {
    try {
      const response = await fetch(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update item');
      }

      const updatedItem = await response.json();
      const itemWithProperties = computeItemProperties(updatedItem);
      
      // Update local state
      setItems(prev => prev.map(item => 
        item.id === id ? itemWithProperties : item
      ));
      
      return itemWithProperties;
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
      return null;
    }
  }, []);

  // Delete item
  const deleteItem = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete item');
      }

      // Remove from local state
      setItems(prev => prev.filter(item => item.id !== id));
      
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      return false;
    }
  }, []);

  // Merge items
  const mergeItems = useCallback(async (mergeData: MergeItemRequest): Promise<Item | null> => {
    try {
      const response = await fetch(`${API_BASE}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mergeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to merge items');
      }

      const mergedItem = await response.json();
      const itemWithProperties = computeItemProperties(mergedItem);
      
      // Update local state - remove source item, update target item
      setItems(prev => prev
        .filter(item => item.id !== mergeData.source_item_id)
        .map(item => item.id === mergeData.target_item_id ? itemWithProperties : item)
      );
      
      return itemWithProperties;
    } catch (err) {
      console.error('Error merging items:', err);
      setError(err instanceof Error ? err.message : 'Failed to merge items');
      return null;
    }
  }, []);

  // Quick rename functionality
  const quickRename = useCallback(async (id: number, newName: string): Promise<boolean> => {
    const result = await updateItem(id, { name: newName });
    return result !== null;
  }, [updateItem]);

  // Initialize data
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    // State
    items,
    categories,
    loading,
    error,
    
    // Actions
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    mergeItems,
    quickRename,
    loadCategories,
    
    // Utilities
    clearError: () => setError(null),
  };
}
