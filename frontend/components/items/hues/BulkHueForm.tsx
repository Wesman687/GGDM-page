import React, { useState } from 'react';
import { AddHueRequest } from '../../../types/items';
import { HueSet } from '../../../types/items';

interface BulkHueFormProps {
  onAddHues: (hues: AddHueRequest[]) => Promise<void>;
  hueSets?: HueSet[];
  individualHues?: Array<{ hue: number; description: string; usage_count: number }>;
  disabled?: boolean;
}

export function BulkHueForm({ 
  onAddHues, 
  hueSets = [], 
  individualHues = [], 
  disabled = false 
}: BulkHueFormProps) {
  const [selectedHueSet, setSelectedHueSet] = useState<number | null>(null);
  const [customHues, setCustomHues] = useState('');
  const [mode, setMode] = useState<'hue-set' | 'custom'>('hue-set');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const parseCustomHues = (text: string): AddHueRequest[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const hues: AddHueRequest[] = [];

    for (const line of lines) {
      // Try different formats:
      // "123:Red" or "123 Red" or "123 - Red" or "123,Red"
      const match = line.match(/^(\d+)\s*[:,\-\s]\s*(.+)$/);
      if (match) {
        const hue = parseInt(match[1], 10);
        const description = match[2].trim();
        
        if (hue >= 0 && hue <= 3000 && description.length > 0) {
          hues.push({ hue, description });
        }
      }
    }

    return hues;
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (mode === 'hue-set') {
      if (!selectedHueSet) {
        newErrors.hueSet = 'Please select a hue set';
      }
    } else if (mode === 'custom') {
      if (!customHues.trim()) {
        newErrors.customHues = 'Please enter hue data';
      } else {
        const parsed = parseCustomHues(customHues);
        if (parsed.length === 0) {
          newErrors.customHues = 'No valid hues found. Use format: "123:Red" or "123 Red"';
        }
      }
    }
    // crafting mode doesn't need validation - it always has the preset hues

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
      let hues: AddHueRequest[] = [];

      if (mode === 'hue-set' && selectedHueSet) {
        const hueSet = hueSets.find(set => set.id === selectedHueSet);
        if (hueSet) {
          hues = hueSet.hues.map(h => ({
            hue: h.hue,
            description: h.description,
          }));
        }
      } else if (mode === 'custom') {
        hues = parseCustomHues(customHues);
      }

      await onAddHues(hues);
      
      // Reset form
      setSelectedHueSet(null);
      setCustomHues('');
      setErrors({});
    } catch (error) {
      console.error('Error adding bulk hues:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedHueSet(null);
    setCustomHues('');
    setErrors({});
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Selection */}
        <div>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="hue-set"
                checked={mode === 'hue-set'}
                onChange={(e) => setMode(e.target.value as 'hue-set')}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                disabled={disabled || submitting}
              />
              <span className="text-sm font-medium text-gray-700">Use Hue Set</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="custom"
                checked={mode === 'custom'}
                onChange={(e) => setMode(e.target.value as 'custom')}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                disabled={disabled || submitting}
              />
              <span className="text-sm font-medium text-gray-700">Custom Hues</span>
            </label>
          </div>
        </div>

        {/* Hue Set Selection */}
        {mode === 'hue-set' && (
          <div>
            <label htmlFor="hue-set" className="block text-sm font-medium text-gray-700 mb-1">
              Select Hue Set
            </label>
            <select
              id="hue-set"
              value={selectedHueSet || ''}
              onChange={(e) => setSelectedHueSet(e.target.value ? parseInt(e.target.value, 10) : null)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.hueSet ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={disabled || submitting}
            >
              <option value="">Select a hue set...</option>
              {hueSets.map(set => (
                <option key={set.id} value={set.id}>
                  {set.name} ({set.hues.length} hues)
                </option>
              ))}
            </select>
            {errors.hueSet && (
              <p className="mt-1 text-sm text-red-600">{errors.hueSet}</p>
            )}

            {/* Hue Set Preview */}
            {selectedHueSet && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  {hueSets.find(s => s.id === selectedHueSet)?.name} Preview:
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {hueSets.find(s => s.id === selectedHueSet)?.hues.map((hue, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: `hsl(${hue.hue}, 70%, 50%)` }}
                      />
                      <span>{hue.hue}: {hue.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Hues Input */}
        {mode === 'custom' && (
          <div>
            <label htmlFor="custom-hues" className="block text-sm font-medium text-gray-700 mb-1">
              Custom Hues (one per line)
            </label>
            <textarea
              id="custom-hues"
              value={customHues}
              onChange={(e) => setCustomHues(e.target.value)}
              rows={8}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.customHues ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder={`Enter hues in format:
123:Red
456:Blue
789 Green
012 - Yellow`}
              disabled={disabled || submitting}
            />
            {errors.customHues && (
              <p className="mt-1 text-sm text-red-600">{errors.customHues}</p>
            )}

            {/* Custom Hues Preview */}
            {customHues.trim() && !errors.customHues && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Preview ({parseCustomHues(customHues).length} hues):
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {parseCustomHues(customHues).map((hue, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: `hsl(${hue.hue}, 70%, 50%)` }}
                      />
                      <span>{hue.hue}: {hue.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={disabled || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Hues'}
          </button>
        </div>
      </form>
    </div>
  );
}
