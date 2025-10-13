import React, { useState } from 'react';
import { EditHueModal } from './EditHueModal';

interface Hue {
  hue: number;
  description: string;
  usage_count: number;
}

interface HueListProps {
  hues: Hue[];
  onEditHue?: (hue: number, updateData: { description: string }) => void;
  onRemoveHue?: (hue: number) => void;
  editable?: boolean;
  loading?: boolean;
}

export function HueList({ hues, onEditHue, onRemoveHue, editable = false, loading = false }: HueListProps) {
  const [editingHue, setEditingHue] = useState<{ hue: number; description: string; usage_count: number } | null>(null);

  const handleEdit = (hue: { hue: number; description: string; usage_count: number }) => {
    setEditingHue(hue);
  };

  const handleSave = async (hueValue: number, newDescription: string): Promise<boolean> => {
    if (onEditHue) {
      const success = await onEditHue(hueValue, { description: newDescription });
      return success;
    }
    return false;
  };
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!hues || hues.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        No hues configured for this item.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {hues.map((hue) => (
          <div
            key={hue.hue}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center space-x-3">
              {/* Hue info */}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    {hue.hue}
                  </span>
                  <span className="text-sm text-gray-500">
                    {hue.description}
                  </span>
                  {hue.usage_count > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {hue.usage_count} uses
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            {editable && (onEditHue || onRemoveHue) && (
              <div className="flex items-center space-x-2">
                {onEditHue && (
                  <button
                    onClick={() => handleEdit(hue)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
                {onRemoveHue && (
                  <button
                    onClick={() => onRemoveHue(hue.hue)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingHue && (
        <EditHueModal
          isOpen={!!editingHue}
          onClose={() => setEditingHue(null)}
          hue={editingHue}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// Compact version for smaller spaces
export function HueListCompact({ hues, loading = false }: { hues: Hue[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex space-x-2">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!hues || hues.length === 0) {
    return (
      <span className="text-gray-400 text-xs">No hues</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {hues.slice(0, 5).map((hue) => (
        <span
          key={hue.hue}
          className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
          title={`Hue ${hue.hue} - ${hue.description}`}
        >
          {hue.hue}
        </span>
      ))}
      {hues.length > 5 && (
        <span className="text-gray-500 text-xs px-2 py-1">
          +{hues.length - 5} more
        </span>
      )}
    </div>
  );
}
