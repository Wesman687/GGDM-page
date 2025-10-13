import React, { useState, useEffect } from 'react';

interface EditHueModalProps {
  isOpen: boolean;
  onClose: () => void;
  hue: { hue: number; description: string; usage_count: number };
  onSave: (hueValue: number, newDescription: string) => Promise<boolean>;
}

export function EditHueModal({ isOpen, onClose, hue, onSave }: EditHueModalProps) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update description when hue changes
  useEffect(() => {
    if (hue) {
      setDescription(hue.description);
    }
  }, [hue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const success = await onSave(hue.hue, description.trim());
      if (success) {
        onClose();
      } else {
        setError('Failed to update hue description');
      }
    } catch (err) {
      setError('Error updating hue description');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setDescription(hue.description);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Edit Hue</h2>
            <button 
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={submitting}
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            {/* Hue Info */}
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 rounded border border-gray-300 bg-gray-200" />
              <div>
                <span className="font-medium">Hue {hue.hue}</span>
                <div className="text-sm text-gray-500">
                  {hue.usage_count > 0 ? `${hue.usage_count} uses` : 'No usage'}
                </div>
              </div>
            </div>

            {/* Description Input */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter hue description"
                disabled={submitting}
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
