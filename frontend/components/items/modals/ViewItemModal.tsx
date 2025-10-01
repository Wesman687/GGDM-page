import React, { useState, useEffect } from 'react';
import { Item, ItemCategory, UpdateItemRequest } from '../../../types/items';
import { HueList } from '../hues/HueList';
import { ScriptList } from '../scripts/ScriptPreview';
import { useItemHues, useHues } from '../../../hooks/items/useHues';
import { useScriptExamples } from '../../../hooks/items/useScriptExamples';
import { HueInput } from '../hues/HueInput';
import { BulkHueForm } from '../hues/BulkHueForm';

interface ViewItemModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateItem: (id: number, data: UpdateItemRequest) => Promise<boolean>;
  onQuickRename: (id: number, name: string) => Promise<boolean>;
  onMergeItems: (sourceId: number, targetId: number) => Promise<boolean>;
  categories: ItemCategory[];
}

export function ViewItemModal({
  item,
  isOpen,
  onClose,
  onUpdateItem,
  onQuickRename,
  onMergeItems,
  categories
}: ViewItemModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    item_id: 0,
    category_id: 0,
    description: '',
  });
  const [showQuickRename, setShowQuickRename] = useState(false);
  const [quickRenameValue, setQuickRenameValue] = useState('');
  const [showBulkHueForm, setShowBulkHueForm] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedScript, setSelectedScript] = useState<any>(null);
  
  // Merge modal state
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<any[]>([]);
  const [mergeSelectedItem, setMergeSelectedItem] = useState<any>(null);
  const [mergeSearching, setMergeSearching] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [submitting, setSubmitting] = useState(false);

  // Hooks for hues and scripts
  const { hues, addHue, updateHue, removeHue } = useItemHues(item?.id || 0);
  const { hueSets, individualHues, loadHueSets, loadIndividualHues } = useHues();
  const { 
    scriptExamples, 
    expandedScripts, 
    toggleScriptExpansion, 
    getPaginationInfo,
    nextPage,
    prevPage,
    initializeScripts,
    loading: scriptsLoading
  } = useScriptExamples(item?.id || 0);

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        item_id: item.item_id || 0,
        category_id: item.category_id || 0,
        description: item.description || '',
      });
      setQuickRenameValue(item.name || '');
      setShowQuickRename(false);
      setIsEditing(false);
      setErrors({});
    }
  }, [item]);

  // Initialize scripts and hues when modal opens
  useEffect(() => {
    if (isOpen && item) {
      initializeScripts();
      loadHueSets();
      loadIndividualHues();
    }
  }, [isOpen, item, initializeScripts, loadHueSets, loadIndividualHues]);

  const handleInputChange = (field: keyof UpdateItemRequest, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (formData.item_id !== undefined && formData.item_id !== null && (formData.item_id < 0 || !Number.isInteger(formData.item_id))) {
      newErrors.item_id = 'Item ID must be a non-negative integer';
    }

    if (formData.category_id !== undefined && (!formData.category_id || formData.category_id <= 0)) {
      newErrors.category_id = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!item || !validateForm()) {
      return;
    }

    setSubmitting(true);
    
    try {
      const success = await onUpdateItem(item.id, formData);
      if (success) {
        setIsEditing(false);
        setErrors({});
      }
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRename = async () => {
    if (!item || !quickRenameValue.trim()) {
      return;
    }

    setSubmitting(true);
    
    try {
      const success = await onQuickRename(item.id, quickRenameValue.trim());
      if (success) {
        setShowQuickRename(false);
        setQuickRenameValue('');
      }
    } catch (error) {
      console.error('Error renaming item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setShowQuickRename(false);
    setShowBulkHueForm(false);
    setShowMergeModal(false);
    setErrors({});
    onClose();
  };

  // Reset merge modal state when it opens
  useEffect(() => {
    if (showMergeModal && item) {
      setMergeSearchQuery('');
      setMergeSearchResults([]);
      setMergeSelectedItem(null);
      setMergeError('');
    }
  }, [showMergeModal, item]);

  // Merge search functionality
  const handleMergeSearch = async () => {
    if (!mergeSearchQuery.trim() || !item) return;

    setMergeSearching(true);
    setMergeError('');

    try {
      let url = '';
      let searchType = '';

      // Determine what we're searching for based on what's missing
      if (!item.item_id || item.item_id === 0) {
        // Missing ID, search by ID
        const itemId = parseInt(mergeSearchQuery.trim());
        if (isNaN(itemId)) {
          setMergeError('Please enter a valid item ID number');
          return;
        }
        url = `/api/items/items/${itemId}`;
        searchType = 'id';
      } else if (!item.name || item.name.startsWith('item_')) {
        // Missing name, search by name
        url = `/api/items/items?search=${encodeURIComponent(mergeSearchQuery.trim())}&limit=10`;
        searchType = 'name';
      } else {
        setMergeError('This item appears to be complete already');
        return;
      }

      const response = await fetch(url);
      
      if (searchType === 'id') {
        // Single item result for ID search
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            setMergeSearchResults([data]);
          } else {
            setMergeSearchResults([]);
            setMergeError('No item found with that ID');
          }
        } else {
          setMergeSearchResults([]);
          setMergeError('No item found with that ID');
        }
      } else {
        // Multiple results for name search
        if (response.ok) {
          const data = await response.json();
          setMergeSearchResults(data.items || []);
          if (!data.items || data.items.length === 0) {
            setMergeError('No items found with that name');
          }
        } else {
          setMergeSearchResults([]);
          setMergeError('No items found with that name');
        }
      }
    } catch (err) {
      setMergeError('Search failed. Please try again.');
      setMergeSearchResults([]);
    } finally {
      setMergeSearching(false);
    }
  };

  // Handle merge or create
  const handleMergeOrCreate = async () => {
    if (!item) return;

    if (mergeSelectedItem) {
      // Merge with selected item
      const success = await onMergeItems(item.id, mergeSelectedItem.id);
      if (success) {
        handleClose();
      } else {
        setMergeError('Merge failed. Please try again.');
      }
    } else if (mergeSearchQuery.trim()) {
      // Create new item with the provided data
      try {
        let updateData: any = {
          name: item.name,
          item_id: item.item_id,
          category_id: item.category_id,
          description: item.description
        };

        // Add the missing data
        if (!item.item_id || item.item_id === 0) {
          updateData.item_id = parseInt(mergeSearchQuery.trim());
        } else if (!item.name || item.name.startsWith('item_')) {
          updateData.name = mergeSearchQuery.trim();
        }

        const success = await onUpdateItem(item.id, updateData);
        if (success) {
          handleClose();
        } else {
          setMergeError('Failed to update item. Please try again.');
        }
      } catch (err) {
        setMergeError('Failed to update item. Please try again.');
      }
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header with Save/Clear buttons */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Item' : 'Item Details'}
          </h2>
          <div className="flex items-center space-x-3">
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            )}
            {isEditing && (
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: item?.name || '',
                    item_id: item?.item_id || 0,
                    category_id: item?.category_id || 0,
                    description: item?.description || '',
                  });
                  setErrors({});
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Clear
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex h-[calc(95vh-120px)]">
          {/* Left Side - Item Details */}
          <div className="w-1/2 p-6 border-r overflow-y-auto">
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-3">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Edit Item
                      </button>
                      {(item.item_type === 'id_only' || item.item_type === 'named_only') && (
                        <button
                          onClick={() => setShowMergeModal(true)}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                        >
                          Merge Item
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex space-x-3">
                      <button
                        onClick={handleSave}
                        disabled={submitting}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {submitting ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: item?.name || '',
                            item_id: item?.item_id || 0,
                            category_id: item?.category_id || 0,
                            description: item?.description || '',
                          });
                          setErrors({});
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Quick Rename */}
                {!isEditing && (
                  <div className="flex items-center space-x-2">
                    {showQuickRename ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={quickRenameValue}
                          onChange={(e) => setQuickRenameValue(e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                          placeholder="New name"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleQuickRename();
                            }
                          }}
                        />
                        <button
                          onClick={handleQuickRename}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowQuickRename(false);
                            setQuickRenameValue('');
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowQuickRename(true)}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        Quick Rename
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Item Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter item name"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {item.display_name || 'N/A'}
                    </div>
                  )}
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item ID
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={formData.item_id}
                      onChange={(e) => handleInputChange('item_id', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter item ID"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {item.display_id || 'N/A'}
                    </div>
                  )}
                  {errors.item_id && <p className="text-red-500 text-sm mt-1">{errors.item_id}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  {isEditing ? (
                    <select
                      value={formData.category_id}
                      onChange={(e) => handleInputChange('category_id', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Select Category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {item.category_name || 'Uncategorized'}
                    </div>
                  )}
                  {errors.category_id && <p className="text-red-500 text-sm mt-1">{errors.category_id}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  {isEditing ? (
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter description"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md min-h-[80px]">
                      {item.description || 'No description'}
                    </div>
                  )}
                  {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                </div>
              </div>

              {/* Status Information */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-3">Status</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.item_type === 'complete' 
                          ? 'bg-green-100 text-green-800'
                          : item.item_type === 'named_only'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.item_type === 'complete' && 'Complete'}
                        {item.item_type === 'named_only' && 'Named Only'}
                        {item.item_type === 'id_only' && 'ID Only'}
                      </span>
                      {item.is_verified && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hues Count
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {hues.length} hues
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Script Examples
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {getPaginationInfo().total} examples
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Hues and Scripts */}
          <div className="w-1/2 p-6 overflow-y-auto">
            {/* Hues Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Hues ({hues.length})</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowBulkHueForm(!showBulkHueForm)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    {showBulkHueForm ? 'Hide Bulk' : 'Bulk Add'}
                  </button>
                </div>
              </div>

              {showBulkHueForm && (
                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-md font-medium mb-3">Bulk Hue Options</h4>
                  <BulkHueForm
                    onAddHues={(hues) => {
                      hues.forEach(hue => addHue(hue));
                    }}
                    hueSets={hueSets}
                    individualHues={individualHues}
                  />
                </div>
              )}

              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="text-md font-medium mb-3">Add Individual Hue</h4>
                <HueInput onAddHue={addHue} individualHues={individualHues} />
              </div>

              <div className="border border-gray-200 rounded-lg">
                <div className="p-4 border-b bg-gray-50">
                  <h4 className="text-md font-medium">Current Hues</h4>
                </div>
                <div className="p-4">
                  <HueList
                    hues={hues}
                    onEditHue={updateHue}
                    onRemoveHue={removeHue}
                    editable={true}
                  />
                </div>
              </div>
            </div>

            {/* Scripts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Scripts ({getPaginationInfo().total})</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {getPaginationInfo().displayText}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={prevPage}
                      disabled={getPaginationInfo().currentPage === 1}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                      Previous
                    </button>
                    <button
                      onClick={nextPage}
                      disabled={getPaginationInfo().currentPage >= getPaginationInfo().totalPages}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg">
                <ScriptList
                  scripts={scriptExamples}
                  expandedScripts={expandedScripts}
                  onToggleExpansion={toggleScriptExpansion}
                  onViewScript={(script) => {
                    setSelectedScript(script);
                    setShowScriptModal(true);
                  }}
                  loading={scriptsLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          {isEditing && (
            <button
              onClick={handleSave}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>

        {/* Script Modal */}
        {showScriptModal && selectedScript && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowScriptModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedScript?.script_title || 'Unknown Script'}</h3>
                  <p className="text-sm text-gray-500">Line {selectedScript?.line_number || 0}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => window.open(`/scripts/${selectedScript?.script_id || ''}`, '_blank')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    View Source
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowScriptModal(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Full Code */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{selectedScript?.context || selectedScript?.usage_context || 'No content available'}</pre>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowScriptModal(false);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merge Modal */}
        {showMergeModal && item && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowMergeModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Merge Item</h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMergeModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Current Item Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Current Item</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Name:</span> {item.display_name || 'N/A'}</div>
                    <div><span className="font-medium">ID:</span> {item.display_id || 'N/A'}</div>
                    <div><span className="font-medium">Category:</span> {item.category_name || 'Uncategorized'}</div>
                    <div><span className="font-medium">Type:</span> {item.item_type}</div>
                  </div>
                </div>

                {/* Search Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">
                    {(!item.item_id || item.item_id === 0) 
                      ? 'Find Item by ID' 
                      : (!item.name || item.name.startsWith('item_'))
                      ? 'Find Item by Name'
                      : 'Search Items'
                    }
                  </h3>
                  
                  <div className="flex space-x-3 mb-4">
                    <input
                      type={(!item.item_id || item.item_id === 0) ? 'number' : 'text'}
                      value={mergeSearchQuery}
                      onChange={(e) => setMergeSearchQuery(e.target.value)}
                      placeholder={
                        (!item.item_id || item.item_id === 0) 
                          ? 'Enter item ID to search for' 
                          : 'Enter item name to search for'
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleMergeSearch();
                        }
                      }}
                    />
                    <button
                      onClick={handleMergeSearch}
                      disabled={!mergeSearchQuery.trim() || mergeSearching}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {mergeSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="text-sm text-gray-600 mb-4">
                    {(!item.item_id || item.item_id === 0) ? (
                      <p>• This item is missing an ID. Enter an item ID to find the matching item to merge with.</p>
                    ) : (!item.name || item.name.startsWith('item_')) ? (
                      <p>• This item is missing a proper name. Enter an item name to find the matching item to merge with.</p>
                    ) : (
                      <p>• Search for an item to merge with this one.</p>
                    )}
                  </div>

                  {mergeError && (
                    <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{mergeError}</div>
                  )}
                </div>

                {/* Search Results */}
                {mergeSearchResults.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-4">Search Results</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {mergeSearchResults.map((result) => (
                        <div
                          key={result.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            mergeSelectedItem?.id === result.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setMergeSelectedItem(result)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{result.display_name || result.name}</div>
                              <div className="text-sm text-gray-600">
                                ID: {result.display_id || result.item_id || 'N/A'} | Category: {result.category_name || 'Uncategorized'}
                              </div>
                              <div className="text-sm text-gray-500">
                                Type: {result.item_type}
                              </div>
                            </div>
                            <div className={`w-3 h-3 rounded-full border-2 ${
                              mergeSelectedItem?.id === result.id
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between">
                  <div>
                    {mergeSearchQuery.trim() && mergeSearchResults.length === 0 && !mergeSearching && (
                      <button
                        onClick={handleMergeOrCreate}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Create New Item
                      </button>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMergeModal(false);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    {mergeSelectedItem && (
                      <button
                        onClick={handleMergeOrCreate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Merge Items
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}