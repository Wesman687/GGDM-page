import React, { useState, useEffect } from 'react';
import { AddHueRequest } from '../../../types/items';

interface HueInputProps {
  onAddHue: (hueData: AddHueRequest) => Promise<boolean>;
  individualHues?: Array<{ hue: number; description: string; usage_count: number }>;
  disabled?: boolean;
}

export function HueInput({ onAddHue, individualHues = [], disabled = false }: HueInputProps) {
  const [hueValue, setHueValue] = useState('');
  const [hueDescription, setHueDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Search/filter functionality
  const [filteredHues, setFilteredHues] = useState<Array<{ hue: number; description: string; usage_count: number }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter hues based on search input
  useEffect(() => {
    if (hueValue.trim()) {
      const searchTerm = hueValue.toLowerCase();
      const filtered = individualHues.filter(hue => 
        hue.hue.toString().includes(searchTerm) || 
        hue.description.toLowerCase().includes(searchTerm)
      );
      setFilteredHues(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredHues([]);
      setShowSuggestions(false);
    }
  }, [hueValue, individualHues]);

  const handleHueValueChange = (value: string) => {
    setHueValue(value);
    setErrors(prev => ({ ...prev, hue: '' }));
  };

  const handleHueNameChange = (value: string) => {
    setHueDescription(value);
    setErrors(prev => ({ ...prev, description: '' }));
  };

  const selectHue = (hue: { hue: number; description: string }) => {
    setHueValue(hue.hue.toString());
    setHueDescription(hue.description);
    setShowSuggestions(false);
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!hueValue.trim()) {
      newErrors.hue = 'Hue value is required';
    } else {
      const hueNum = parseInt(hueValue, 10);
      if (isNaN(hueNum) || hueNum < 0 || hueNum > 3000) {
        newErrors.hue = 'Hue must be between 0 and 3000';
      }
    }

    if (!hueDescription.trim()) {
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
      const success = await onAddHue({
        hue: parseInt(hueValue, 10),
        description: hueDescription.trim(),
      });
      
      if (success) {
        setHueValue('');
        setHueDescription('');
        setErrors({});
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error adding hue:', error);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hue Search */}
        <div className="relative">
          <label htmlFor="hue-search" className="block text-sm font-medium text-gray-700 mb-1">
            Search Hue
          </label>
          <input
            type="text"
            id="hue-search"
            value={hueValue}
            onChange={(e) => handleHueValueChange(e.target.value)}
            onFocus={() => setShowSuggestions(filteredHues.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.hue ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Type hue number or description..."
            disabled={disabled || submitting}
          />
          
          {/* Search Results */}
          {showSuggestions && filteredHues.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filteredHues.slice(0, 10).map((hue) => (
                <button
                  key={hue.hue}
                  type="button"
                  onClick={() => selectHue(hue)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{hue.hue}</span>
                      <span className="text-gray-500 ml-2">- {hue.description}</span>
                    </div>
                    {hue.usage_count > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {hue.usage_count} uses
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {errors.hue && (
            <p className="mt-1 text-sm text-red-600">{errors.hue}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="hue-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            id="hue-description"
            value={hueDescription}
            onChange={(e) => handleHueDescriptionChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter description"
            disabled={disabled || submitting}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Preview */}
        {hueValue && hueDescription && !errors.hue && !errors.description && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded border border-gray-300 bg-gray-200" />
              <div>
                <span className="font-medium">Hue {hueValue}</span>
                <span className="text-sm text-gray-500 ml-2">
                </span>
                <div className="text-sm text-gray-600">{hueDescription}</div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || submitting || !hueValue || !hueDescription}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Hue'}
          </button>
        </div>
      </form>
    </div>
  );
}
