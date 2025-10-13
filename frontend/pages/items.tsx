import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Item, ItemFilters } from '../types/items';
import { useItems } from '../hooks/items/useItems';
import { useHues } from '../hooks/items/useHues';
import { ItemFilters as ItemFiltersComponent } from '../components/items/ItemFilters';
import { CreateItemModal } from '../components/items/modals/CreateItemModal';
import { ViewItemModal } from '../components/items/modals/ViewItemModal';
import { ItemsMergeModal } from '../components/items/modals/ItemsMergeModal';
import { HueListCompact } from '../components/items/hues/HueList';
import { HueSetManager } from '../components/items/hues/HueSetManager';
import { computeItemProperties, isPlaceholderName } from '../utils/items/itemHelpers';

export default function ItemsPage() {
  const [filters, setFilters] = useState<ItemFilters>({
    search: '',
    category_id: null,
    matched_only: false,
    unmatched_only: false,
  });
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeItem, setMergeItem] = useState<Item | null>(null);

  const {
    items,
    categories,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    mergeItems,
    quickRename,
    clearError
  } = useItems();

  const { hueSets, loadHueSets, individualHues } = useHues();

  useEffect(() => {
    loadItems(filters);
    loadHueSets();
  }, [loadItems, loadHueSets, filters]);

  const handleFiltersChange = (newFilters: ItemFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      category_id: null,
      matched_only: false,
      unmatched_only: false,
    });
  };

  const handleCreateItem = async (itemData: any): Promise<boolean> => {
    try {
      const newItem = await createItem(itemData);
      return !!newItem;
    } catch (error) {
      return false;
    }
  };

  const handleUpdateItem = async (id: number, data: any): Promise<boolean> => {
    try {
      const updatedItem = await updateItem(id, data);
      if (updatedItem) {
        // Refresh the items list to show the updated data
        await loadItems(filters);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleDeleteItem = async (id: number): Promise<boolean> => {
    try {
      const success = await deleteItem(id);
      if (success) {
        // Refresh the items list to remove the deleted item
        await loadItems(filters);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleQuickRename = async (id: number, newName: string): Promise<boolean> => {
    try {
      const success = await quickRename(id, newName);
      if (success) {
        // Refresh the items list to show the renamed item
        await loadItems(filters);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleMergeItems = async (sourceId: number, targetId: number): Promise<boolean> => {
    try {
      const mergedItem = await mergeItems({ source_item_id: sourceId, target_item_id: targetId });
      if (mergedItem) {
        // Refresh the items list to show the merged result
        await loadItems(filters);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleOpenMergeModal = (item: Item) => {
    setMergeItem(item);
    setShowMergeModal(true);
  };

  const handleCloseMergeModal = () => {
    setShowMergeModal(false);
    setMergeItem(null);
  };


  const handleItemClick = (item: Item) => {
    const itemWithProperties = computeItemProperties(item);
    setSelectedItem(itemWithProperties);
    setShowViewModal(true);
  };

  useEffect(() => {
    if (error) {
      console.error('Items error:', error);
      clearError();
    }
  }, [error, clearError]);

  return (
    <Layout title="">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Item Management</h1>
            <p className="mt-2 text-gray-600">
              Manage and organize items with their hues and script usage examples.
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Item
            </button>
            <HueSetManager hueSets={hueSets} individualHues={individualHues} onHueSetsChange={loadHueSets} />
          </div>
        </div>

        <ItemFiltersComponent
          filters={filters}
          categories={categories}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading items...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hues
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No items found. Create your first item to get started.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const itemWithProperties = computeItemProperties(item);
                      
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleItemClick(itemWithProperties)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {itemWithProperties.display_name}
                                </div>
                                {itemWithProperties.display_id && (
                                  <div className="text-sm text-gray-500">
                                    ID: {itemWithProperties.display_id}
                                  </div>
                                )}
                              </div>
                              {itemWithProperties.item_type !== 'complete' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMergeModal(itemWithProperties);
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                                >
                                  Merge
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.item_id || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.category_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <HueListCompact hues={item.hues || []} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(itemWithProperties);
                                }}
                                className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete "${item.display_name}"?`)) {
                                    handleDeleteItem(item.id);
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CreateItemModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateItem={handleCreateItem}
        categories={categories}
        loading={loading}
      />

      <ViewItemModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        item={selectedItem}
        categories={categories}
        onUpdateItem={handleUpdateItem}
        onQuickRename={handleQuickRename}
        onMergeItems={handleMergeItems}
      />

      <ItemsMergeModal
        isOpen={showMergeModal}
        onClose={handleCloseMergeModal}
        item={mergeItem}
        categories={categories}
        onMergeItems={handleMergeItems}
        onUpdateItem={handleUpdateItem}
      />

    </Layout>
  );
}