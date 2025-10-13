import React, { useState, useEffect, useCallback } from 'react';
import { Item, ItemCategory } from '../../../types/items';
import { isNumericId } from '../../../utils/items/itemHelpers';

interface ItemsMergeModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onMergeItems: (sourceId: number, targetId: number) => Promise<boolean>;
  onUpdateItem: (id: number, data: any) => Promise<boolean>;
  categories: ItemCategory[];
}

export function ItemsMergeModal({
  item,
  isOpen,
  onClose,
  onMergeItems,
  onUpdateItem,
  categories
}: ItemsMergeModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');


  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && item) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedItem(null);
      setError('');
    }
  }, [isOpen, item]);

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !item) {
        setSearchResults([]);
        setError('');
        return;
      }

      setSearching(true);
      setError('');

      try {
        // Use the dedicated search endpoint
        const response = await fetch(`http://localhost:7000/api/items/items/search/${encodeURIComponent(query.trim())}?limit=10`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.items || []);
          if (!data.items || data.items.length === 0) {
            setError('No items found');
          }
        } else {
          setSearchResults([]);
          setError('Search failed');
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [item]
  );

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const handleMergeOrCreate = async () => {
    if (!item) return;

    if (selectedItem) {
      // Merge with selected item
      const success = await onMergeItems(item.id, selectedItem.id);
      if (success) {
        onClose();
      } else {
        setError('Merge failed. Please try again.');
      }
    } else if (searchQuery.trim()) {
      // Create new item with the provided data or fix current item
      try {
        let updateData: any = {
          category_id: item.category_id,
          description: item.description
        };

        // Determine what we're fixing based on the current item state
        const hasNumericName = item.name && isNumericId(item.name);
        const hasRealName = item.name && !isNumericId(item.name);
        const hasId = item.item_id !== null && item.item_id !== undefined;

        if (hasNumericName && !hasId) {
          // Item has numeric/hex name but no ID - move name to ID and set new name
          let itemIdValue;
          if (item.name.startsWith('0x')) {
            itemIdValue = parseInt(item.name, 16); // Convert hex to int
          } else {
            itemIdValue = parseInt(item.name);
          }
          updateData.item_id = itemIdValue;
          updateData.name = searchQuery.trim();
        } else if (!hasRealName && hasId) {
          // Item has ID but no real name - set the name
          updateData.name = searchQuery.trim();
        } else if (hasRealName && !hasId) {
          // Item has real name but no ID - add the ID
          if (isNumericId(searchQuery.trim())) {
            if (searchQuery.trim().startsWith('0x')) {
              updateData.item_id = parseInt(searchQuery.trim(), 16);
            } else {
              updateData.item_id = parseInt(searchQuery.trim());
            }
          } else {
            // If search query is not numeric, treat it as a new name
            updateData.name = searchQuery.trim();
          }
        } else if (!hasRealName && !hasId) {
          // Item has neither - check if search query is numeric or hex
          if (isNumericId(searchQuery.trim())) {
            if (searchQuery.trim().startsWith('0x')) {
              updateData.item_id = parseInt(searchQuery.trim(), 16);
            } else {
              updateData.item_id = parseInt(searchQuery.trim());
            }
            updateData.name = ''; // Will need to be filled later
          } else {
            updateData.name = searchQuery.trim();
          }
        }

        const success = await onUpdateItem(item.id, updateData);
        if (success) {
          onClose();
        } else {
          setError('Failed to update item. Please try again.');
        }
      } catch (err) {
        setError('Failed to update item. Please try again.');
      }
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Merge Item</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Item */}
          <div>
            <div className="text-sm text-gray-600 mb-1">Current Item</div>
            <div className="text-sm font-medium">{item.display_name || 'Unnamed Item'}</div>
            <div className="text-xs text-gray-500">ID: {item.display_id || 'N/A'}</div>
          </div>

          {/* Search */}
          <div>
            <div className="text-sm text-gray-600 mb-1">
              {(() => {
                const hasNumericName = item.name && isNumericId(item.name);
                const hasRealName = item.name && !isNumericId(item.name);
                const hasId = item.item_id !== null && item.item_id !== undefined;
                
                if (hasNumericName && !hasId) {
                  return 'Enter item name (ID will be moved from name field)';
                } else if (!hasRealName && hasId) {
                  return 'Enter item name';
                } else if (!hasRealName && !hasId) {
                  return 'Enter item name or ID';
                }
                return 'Find by ID or Name';
              })()}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter name or ID..."
              className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            
            {searching && <div className="text-xs text-blue-600 mt-1">Searching...</div>}
            {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div>
              <div className="text-sm text-gray-600 mb-2">Results</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-2 text-sm border rounded cursor-pointer ${
                      selectedItem?.id === result.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedItem(result)}
                  >
                    <div className="font-medium">{result.display_name || result.name}</div>
                    <div className="text-xs text-gray-500">ID: {result.display_id || result.item_id || 'N/A'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t">
            <div>
              {searchQuery.trim() && searchResults.length === 0 && !searching && (
                <button
                  onClick={handleMergeOrCreate}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {(() => {
                    const hasNumericName = item.name && isNumericId(item.name);
                    const hasRealName = item.name && !isNumericId(item.name);
                    const hasId = item.item_id !== null && item.item_id !== undefined;
                    
                    if (hasNumericName && !hasId) {
                      return 'Fix Item (Move ID & Set Name)';
                    } else if (!hasRealName && hasId) {
                      return 'Set Name';
                    } else if (!hasRealName && !hasId) {
                      return 'Set Name/ID';
                    }
                    return 'Create New';
                  })()}
                </button>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              {selectedItem && (
                <button
                  onClick={handleMergeOrCreate}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Merge
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
