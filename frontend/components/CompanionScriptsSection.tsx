/**
 * Companion Scripts Section
 * 
 * Displays companion scripts linked to a main script.
 * Shows scripts that work together with the main script (e.g., setup + execution scripts).
 */

import { useState, useEffect } from 'react';
import { Script, apiService } from '@/lib/api';
import { Code, Download, Link as LinkIcon, Plus } from 'lucide-react';
import Link from 'next/link';
import CreateScriptModal from './CreateScriptModal';

interface CompanionScriptsSectionProps {
  mainScriptId: string;
  mainScriptTitle: string;
  canAddCompanion?: boolean;  // Whether user can add companions (is owner or admin)
}

export default function CompanionScriptsSection({ 
  mainScriptId, 
  mainScriptTitle,
  canAddCompanion = false 
}: CompanionScriptsSectionProps) {
  const [companions, setCompanions] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadCompanionScripts();
  }, [mainScriptId]);

  /**
   * Load companion scripts for the main script
   */
  const loadCompanionScripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getCompanionScripts(mainScriptId);
      setCompanions(data);
    } catch (err) {
      console.error('Error loading companion scripts:', err);
      setError('Failed to load companion scripts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Loading companion scripts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (companions.length === 0 && !canAddCompanion) {
    return null; // Don't show anything if there are no companions and user can't add any
  }

  return (
    <>
      <CreateScriptModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadCompanionScripts();
        }}
        parentScriptId={mainScriptId}
        parentScriptTitle={mainScriptTitle}
      />
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <LinkIcon size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Companion Scripts ({companions.length})
            </h3>
          </div>
          
          {canAddCompanion && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              <span>Add Companion Script</span>
            </button>
          )}
        </div>
        
        {companions.length > 0 ? (
          <p className="text-sm text-gray-600 mb-4">
            These scripts work together with this main script. Run them in the order shown.
          </p>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            No companion scripts yet. Click the button above to add scripts that work together with this main script (e.g., setup scripts, variable configuration).
          </p>
        )}

      <div className="space-y-3">
        {companions.map((companion, index) => (
          <div
            key={companion.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  {companion.execution_order && (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                      {companion.execution_order}
                    </span>
                  )}
                  <Link 
                    href={`/scripts/${companion.id}`}
                    className="text-base font-medium text-blue-600 hover:text-blue-800"
                  >
                    {companion.title}
                  </Link>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    companion.language === 'python' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {companion.language}
                  </span>
                </div>
                
                {companion.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {companion.description}
                  </p>
                )}

                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span>by {companion.author}</span>
                  {companion.rating_count > 0 && (
                    <span className="flex items-center">
                      ⭐ {companion.rating_average.toFixed(1)} ({companion.rating_count})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <Link 
                  href={`/scripts/${companion.id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  <Code size={16} className="mr-1" />
                  View
                </Link>
                
                {companion.exe_download_url && (
                  <a
                    href={companion.exe_download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                  >
                    <Download size={16} className="mr-1" />
                    .exe
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> These scripts are designed to work together. Make sure to run them in the order shown above for proper functionality.
        </p>
      </div>
    </div>
  );
}

