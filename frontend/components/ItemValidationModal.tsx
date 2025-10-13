/**
 * Item Validation Modal
 * 
 * Displays items referenced in a script and allows users to:
 * - Add missing items to the database
 * - Complete incomplete items (add missing name or ID)
 * - View which items are already complete
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

interface ItemValidation {
  identifier: string;
  is_numeric: boolean;
  normalized_name: string | null;
  normalized_id: number | null;
  status: 'complete' | 'incomplete' | 'missing';
  missing_data: string[];
  db_item: {
    id: number;
    name: string;
    item_id: number | null;
    category_id: number;
  } | null;
  usage: {
    command: string;
    line_number: number;
    context: string;
  };
}

interface ValidationResponse {
  total_items: number;
  items: ItemValidation[];
  status_counts: {
    complete: number;
    incomplete: number;
    missing: number;
  };
  commands_used: string[];
}

interface Category {
  id: number;
  name: string;
  description: string;
}

interface ItemValidationModalProps {
  scriptCode: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ItemValidationModal({
  scriptCode,
  onComplete,
  onCancel
}: ItemValidationModalProps) {
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [editingItem, setEditingItem] = useState<ItemValidation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    item_id: '',
    category_id: 1,
    description: ''
  });

  useEffect(() => {
    loadValidation();
    loadCategories();
  }, []);

  /**
   * Load item validation results from backend
   */
  const loadValidation = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/items/validate-script-items', {
        script_code: scriptCode
      });
      setValidation(response.data);
      
      // Find first item that needs attention
      const firstIncomplete = response.data.items.findIndex(
        (item: ItemValidation) => item.status !== 'complete'
      );
      if (firstIncomplete !== -1) {
        setCurrentItemIndex(firstIncomplete);
        prepareEditForm(response.data.items[firstIncomplete]);
      }
    } catch (error) {
      console.error('Error validating items:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load item categories from backend
   */
  const loadCategories = async () => {
    try {
      const response = await axios.get('/api/items/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  /**
   * Prepare edit form with current item data
   */
  const prepareEditForm = (item: ItemValidation) => {
    setEditingItem(item);
    
    // Pre-fill form with existing data or normalized data
    setFormData({
      name: item.db_item?.name || item.normalized_name || '',
      item_id: item.db_item?.item_id?.toString() || item.normalized_id?.toString() || '',
      category_id: item.db_item?.category_id || 1,
      description: ''
    });
  };

  /**
   * Handle saving item (create or update)
   */
  const handleSaveItem = async () => {
    if (!editingItem || !validation) return;

    try {
      const itemData = {
        name: formData.name,
        item_id: formData.item_id ? parseInt(formData.item_id) : null,
        hue: 0,
        category_id: formData.category_id,
        description: formData.description
      };

      if (editingItem.status === 'missing') {
        // Create new item
        await axios.post('/api/items/items', itemData);
      } else if (editingItem.status === 'incomplete' && editingItem.db_item) {
        // Update existing item with missing data
        await axios.put(`/api/items/items/${editingItem.db_item.id}`, itemData);
      }

      // Reload validation to get updated status
      await loadValidation();
      
      // Move to next item that needs attention
      moveToNextIncompleteItem();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Error saving item. Please try again.');
    }
  };

  /**
   * Skip current item and move to next
   */
  const handleSkipItem = () => {
    moveToNextIncompleteItem();
  };

  /**
   * Move to next incomplete item or complete if done
   */
  const moveToNextIncompleteItem = () => {
    if (!validation) return;

    const nextIncomplete = validation.items.findIndex(
      (item, index) => index > currentItemIndex && item.status !== 'complete'
    );

    if (nextIncomplete !== -1) {
      setCurrentItemIndex(nextIncomplete);
      prepareEditForm(validation.items[nextIncomplete]);
    } else {
      // All items handled - move to completion
      checkAllItemsComplete();
    }
  };

  /**
   * Check if all items are complete and allow proceeding
   */
  const checkAllItemsComplete = async () => {
    if (!validation) return;

    // Reload validation to get final status
    try {
      const response = await axios.post('/api/items/validate-script-items', {
        script_code: scriptCode
      });
      
      const incomplete = response.data.items.filter(
        (item: ItemValidation) => item.status !== 'complete'
      );

      if (incomplete.length === 0) {
        // All items complete - can proceed
        onComplete();
      } else {
        // Still have incomplete items
        alert(`${incomplete.length} items still need attention. Please complete or skip them.`);
      }
    } catch (error) {
      console.error('Error checking items:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-white">Validating script items...</div>
        </div>
      </div>
    );
  }

  if (!validation) {
    return null;
  }

  // No items found - can proceed
  if (validation.total_items === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-white mb-4">No Items Found</h2>
          <p className="text-gray-300 mb-4">
            No item references were found in this script. You can proceed with uploading.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All items complete - can proceed
  if (validation.status_counts.incomplete === 0 && validation.status_counts.missing === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-white mb-4">✓ All Items Validated</h2>
          <p className="text-gray-300 mb-4">
            All {validation.total_items} items referenced in this script are complete and in the database.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = validation.items[currentItemIndex];
  const incompleteItems = validation.items.filter(item => item.status !== 'complete');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Item Validation</h2>
          <p className="text-gray-300">
            This script references {validation.total_items} items. Please ensure all items are in the database.
          </p>
          
          {/* Progress */}
          <div className="mt-4 flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-300">Complete: {validation.status_counts.complete}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-300">Incomplete: {validation.status_counts.incomplete}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-300">Missing: {validation.status_counts.missing}</span>
            </div>
          </div>
        </div>

        {/* Current Item */}
        {editingItem && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {editingItem.status === 'missing' ? 'Add New Item' : 'Complete Item'}
                </h3>
                <p className="text-sm text-gray-400">
                  Item {currentItemIndex + 1} of {validation.total_items}
                </p>
              </div>
              <div className={`px-3 py-1 rounded text-sm font-medium ${
                editingItem.status === 'complete' ? 'bg-green-600 text-white' :
                editingItem.status === 'incomplete' ? 'bg-yellow-600 text-white' :
                'bg-red-600 text-white'
              }`}>
                {editingItem.status}
              </div>
            </div>

            {/* Usage Context */}
            <div className="bg-gray-900 rounded p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">
                Line {editingItem.usage.line_number} - {editingItem.usage.command}
              </p>
              <code className="text-sm text-green-400">{editingItem.usage.context}</code>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Item Name {editingItem.missing_data.includes('name') && (
                    <span className="text-red-400">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="e.g., Gold Coin"
                  disabled={editingItem.db_item?.name && !editingItem.missing_data.includes('name')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Item ID {editingItem.missing_data.includes('item_id') && (
                    <span className="text-red-400">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="e.g., 3821 or 0xEED"
                  disabled={editingItem.db_item?.item_id && !editingItem.missing_data.includes('item_id')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  rows={2}
                  placeholder="Additional notes about this item"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6">
              <button
                onClick={handleSkipItem}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Skip
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!formData.name && !formData.item_id}
              >
                {editingItem.status === 'missing' ? 'Add Item' : 'Update Item'}
              </button>
            </div>
          </div>
        )}

        {/* All Items List */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">All Items ({validation.total_items})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {validation.items.map((item, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded ${
                  index === currentItemIndex ? 'bg-gray-600' : 'bg-gray-800'
                }`}
              >
                <div className="flex-1">
                  <span className="text-white text-sm">{item.identifier}</span>
                  <span className="text-gray-400 text-xs ml-2">
                    (Line {item.usage.line_number})
                  </span>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'complete' ? 'bg-green-500' :
                  item.status === 'incomplete' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel Upload
          </button>
          <button
            onClick={checkAllItemsComplete}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Complete & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

