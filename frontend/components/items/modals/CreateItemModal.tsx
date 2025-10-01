import React, { useState } from 'react';
import { ItemCategory, CreateItemRequest } from '../../../types/items';

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateItem: (item: CreateItemRequest) => Promise<boolean>;
  categories: ItemCategory[];
  loading?: boolean;
}

export function CreateItemModal({ 
  isOpen, 
  onClose, 
  onCreateItem, 
  categories, 
  loading = false 
}: CreateItemModalProps) {
  const [formData, setFormData] = useState<CreateItemRequest>({
    name: '',
    item_id: undefined,
    hue: 0,
    category_id: categories[0]?.id || 0,
    description: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (field: keyof CreateItemRequest, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (formData.item_id !== undefined && (formData.item_id < 0 || !Number.isInteger(formData.item_id))) {
      newErrors.item_id = 'Item ID must be a non-negative integer';
    }

    if (formData.hue < 0 || formData.hue > 3000 || !Number.isInteger(formData.hue)) {
      newErrors.hue = 'Hue must be between 0 and 3000';
    }

    if (!formData.category_id || formData.category_id <= 0) {
      newErrors.category_id = 'Please select a category';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    
    try {
      // Clean up the data - remove undefined item_id
      const submitData: CreateItemRequest = {
        ...formData,
        item_id: formData.item_id || undefined,
      };
      
      const success = await onCreateItem(submitData);
      
      if (success) {
        // Reset form and close modal
        setFormData({
          name: '',
          item_id: undefined,
          hue: 0,
          category_id: categories[0]?.id || 0,
          description: '',
        });
        setErrors({});
        onClose();
      }
    } catch (error) {
      console.error('Error creating item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setFormData({
        name: '',
        item_id: undefined,
        hue: 0,
        category_id: categories[0]?.id || 0,
        description: '',
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create New Item</h2>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter item name"
                disabled={submitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Item ID */}
            <div>
              <label htmlFor="item_id" className="block text-sm font-medium text-gray-700 mb-1">
                Item ID (Optional)
              </label>
              <input
                type="number"
                id="item_id"
                value={formData.item_id || ''}
                onChange={(e) => handleInputChange('item_id', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.item_id ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter item ID"
                disabled={submitting}
                min="0"
              />
              {errors.item_id && (
                <p className="mt-1 text-sm text-red-600">{errors.item_id}</p>
              )}
            </div>

            {/* Hue */}
            <div>
              <label htmlFor="hue" className="block text-sm font-medium text-gray-700 mb-1">
                Hue *
              </label>
              <input
                type="number"
                id="hue"
                value={formData.hue}
                onChange={(e) => handleInputChange('hue', parseInt(e.target.value, 10))}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.hue ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter hue value (0-3000)"
                disabled={submitting}
                min="0"
                max="3000"
              />
              {errors.hue && (
                <p className="mt-1 text-sm text-red-600">{errors.hue}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                id="category"
                value={formData.category_id}
                onChange={(e) => handleInputChange('category_id', parseInt(e.target.value, 10))}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.category_id ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={submitting}
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter item description"
                disabled={submitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
