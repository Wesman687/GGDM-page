import React, { useState } from 'react';
import { HueSet } from '../../types/items';

interface HueSetManagerProps {
  hueSets: HueSet[];
  individualHues: Array<{ hue: number; description: string; usage_count: number }>;
  onHueSetsChange: () => void;
}

export function HueSetManager({ hueSets, individualHues, onHueSetsChange }: HueSetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hues: ''
  });
  const [selectedHues, setSelectedHues] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      // Convert selected hues to comma-separated string
      const huesString = Array.from(selectedHues).join(', ');
      
      const response = await fetch('/api/items/hue-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          hues: huesString
        }),
      });

      if (response.ok) {
        setFormData({ name: '', description: '', hues: '' });
        setSelectedHues(new Set());
        setShowCreateForm(false);
        onHueSetsChange();
      } else {
        const error = await response.json();
        setErrors({ submit: error.detail || 'Failed to create hue set' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const toggleHueSelection = (hue: number) => {
    setSelectedHues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hue)) {
        newSet.delete(hue);
      } else {
        newSet.add(hue);
      }
      return newSet;
    });
  };

  const selectAllHues = () => {
    setSelectedHues(new Set(individualHues.map(h => h.hue)));
  };

  const clearSelection = () => {
    setSelectedHues(new Set());
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
      >
        Manage Hue Sets
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Hue Set Management</h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {/* Create New Hue Set Button */}
              <div className="mb-4">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create New Bulk Hue Set
                </button>
              </div>

              {/* Create Form */}
              {showCreateForm && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="text-md font-medium mb-3">Create New Bulk Hue Set</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., Ore Hues, Resource Hues"
                        required
                      />
                      {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Brief description of this hue set"
                      />
                    </div>

                    {/* Hue Selection */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Select Hues ({selectedHues.size} selected)
                        </label>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={selectAllHues}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                        <div className="grid grid-cols-2 gap-2">
                          {individualHues.map((hue) => (
                            <label
                              key={hue.hue}
                              className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-50 ${
                                selectedHues.has(hue.hue) ? 'bg-blue-50 border border-blue-300' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedHues.has(hue.hue)}
                                onChange={() => toggleHueSelection(hue.hue)}
                                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm">
                                <span className="font-medium">{hue.hue}</span>
                                <span className="text-gray-500 ml-1">- {hue.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={submitting || selectedHues.size === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting ? 'Creating...' : 'Create Hue Set'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>

                    {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
                  </form>
                </div>
              )}

              {/* Existing Hue Sets */}
              <div>
                <h3 className="text-md font-medium mb-3">Existing Hue Sets</h3>
                <div className="space-y-3">
                  {hueSets.map((hueSet) => (
                    <div key={hueSet.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{hueSet.name}</h4>
                          <p className="text-sm text-gray-600">{hueSet.description}</p>
                          <p className="text-sm text-gray-500">
                            {hueSet.hues.length} hues: {hueSet.hues.map(h => h.hue).join(', ')}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(hueSet.hues.map(h => h.hue).join(', '));
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          Copy Hue Values
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
