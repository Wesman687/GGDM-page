import React, { useState, useEffect } from 'react';
import { AddHueRequest } from '../../../types/items';
import { getHueColorName, getHueNameSuggestions, getHueValueSuggestions, validateHueValue, validateHueDescription } from '../../../utils/items/hueHelpers';

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
  
  // Autocomplete suggestions
  const [hueValueSuggestions, setHueValueSuggestions] = useState<number[]>([]);
  const [hueNameSuggestions, setHueNameSuggestions] = useState<string[]>([]);
  const [showValueSuggestions, setShowValueSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Update suggestions when input changes
  useEffect(() => {
    if (hueValue.trim()) {
      const suggestions = getHueValueSuggestions(hueValue, individualHues);
      setHueValueSuggestions(suggestions);
      setShowValueSuggestions(suggestions.length > 0);
    } else {
      setHueValueSuggestions([]);
      setShowValueSuggestions(false);
    }
  }, [hueValue]); // Removed individualHues dependency to prevent infinite loops

  useEffect(() => {
    if (hueDescription.trim()) {
      const suggestions = getHueNameSuggestions(hueDescription, individualHues);
      setHueNameSuggestions(suggestions);
      setShowNameSuggestions(suggestions.length > 0);
    } else {
      setHueNameSuggestions([]);
      setShowNameSuggestions(false);
    }
  }, [hueDescription]); // Removed individualHues dependency to prevent infinite loops

  const handleHueValueChange = (value: string) => {
    setHueValue(value);
    setErrors(prev => ({ ...prev, hue: '' }));
  };

  const handleHueNameChange = (value: string) => {
    setHueDescription(value);
    setErrors(prev => ({ ...prev, description: '' }));
  };

  const selectHueValue = (value: number) => {
    setHueValue(value.toString());
    setShowValueSuggestions(false);
  };

  const selectHueName = (name: string) => {
    setHueDescription(name);
    setShowNameSuggestions(false);
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    const hueNum = parseInt(hueValue, 10);
    if (!validateHueValue(hueNum)) {
      newErrors.hue = 'Hue must be between 0 and 3000';
    }

    if (!validateHueDescription(hueDescription)) {
      newErrors.description = 'Description is required and must be less than 100 characters';
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
      }
    } catch (error) {
      console.error('Error adding hue:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowValueSuggestions(false);
      setShowNameSuggestions(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hue Value */}
          <div className="relative">
            <label htmlFor="hue-value" className="block text-sm font-medium text-gray-700 mb-1">
              Hue Value
            </label>
            <input
              type="number"
              id="hue-value"
              value={hueValue}
              onChange={(e) => handleHueValueChange(e.target.value)}
              onFocus={() => setShowValueSuggestions(hueValueSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowValueSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.hue ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter hue value (0-3000)"
              disabled={disabled || submitting}
              min="0"
              max="3000"
            />
            
            {/* Value Suggestions */}
            {showValueSuggestions && hueValueSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {hueValueSuggestions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectHueValue(value)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: `hsl(${value}, 70%, 50%)` }}
                      />
                      <span className="font-medium">{value}</span>
                      <span className="text-sm text-gray-500">({getHueColorName(value)})</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {errors.hue && (
              <p className="mt-1 text-sm text-red-600">{errors.hue}</p>
            )}
          </div>

          {/* Hue Description */}
          <div className="relative">
            <label htmlFor="hue-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              id="hue-description"
              value={hueDescription}
              onChange={(e) => handleHueNameChange(e.target.value)}
              onFocus={() => setShowNameSuggestions(hueNameSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter hue description"
              disabled={disabled || submitting}
              maxLength={100}
            />
            
            {/* Name Suggestions */}
            {showNameSuggestions && hueNameSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {hueNameSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectHueName(name)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Preview */}
        {hueValue && hueDescription && !errors.hue && !errors.description && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-3">
              <div
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: `hsl(${parseInt(hueValue, 10)}, 70%, 50%)` }}
              />
              <div>
                <span className="font-medium">Hue {hueValue}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({getHueColorName(parseInt(hueValue, 10))})
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
