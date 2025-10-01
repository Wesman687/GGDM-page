import React from 'react';
import { ScriptExample } from '../../../types/items';

interface ScriptPreviewProps {
  script: ScriptExample;
  expanded: boolean;
  contextLines: number;
  onToggleExpansion: () => void;
  onViewScript: () => void;
}

export function ScriptPreview({ 
  script, 
  expanded, 
  contextLines, 
  onToggleExpansion, 
  onViewScript 
}: ScriptPreviewProps) {
  // Safety check for undefined script
  if (!script) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="text-gray-500 text-sm">No script data available</div>
      </div>
    );
  }

  const getScriptPreview = (context: string, lineNumber: number, lines: number): string => {
    if (!context) return '';
    const allLines = context.split('\n');
    const startLine = Math.max(0, lineNumber - Math.floor(lines / 2));
    const endLine = Math.min(allLines.length, startLine + lines);
    
    return allLines.slice(startLine, endLine).join('\n');
  };

  const preview = getScriptPreview(script.context || script.usage_context || '', script.line_number || 0, contextLines);

  // Determine next expansion level
  const getNextExpansionText = () => {
    if (contextLines === 3) return 'Show More (6 lines)';
    if (contextLines === 6) return 'Show More (10 lines)';
    if (contextLines === 10) return 'Show Less';
    return 'Show Less';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium text-gray-900">{script.script_title || 'Unknown Script'}</h4>
          <span className="text-sm text-gray-500">Line {script.line_number || 0}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleExpansion}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {getNextExpansionText()}
          </button>
          {onViewScript && (
            <button
              onClick={() => onViewScript(script)}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              View Code
            </button>
          )}
        </div>
      </div>

      {/* Code Preview */}
      <div className="bg-gray-900 text-gray-100 rounded p-3 text-sm font-mono overflow-x-auto">
        <pre className="whitespace-pre-wrap">{preview}</pre>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Context: {contextLines} lines</span>
        <span>Script ID: {script.script_id || 'N/A'}</span>
      </div>
    </div>
  );
}

// Compact version for lists
export function ScriptPreviewCompact({ 
  script, 
  expanded, 
  contextLines, 
  onToggleExpansion 
}: {
  script: ScriptExample;
  expanded: boolean;
  contextLines: number;
  onToggleExpansion: () => void;
}) {
  const getScriptPreview = (context: string, lineNumber: number, lines: number): string => {
    const allLines = context.split('\n');
    const startLine = Math.max(0, lineNumber - Math.floor(lines / 2));
    const endLine = Math.min(allLines.length, startLine + lines);
    
    return allLines.slice(startLine, endLine).join('\n');
  };

  const preview = getScriptPreview(script.context || script.usage_context, script.line_number, contextLines);

  return (
    <div className="border border-gray-200 rounded p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-gray-900">{script.script_title}</span>
          <span className="text-xs text-gray-500">L{script.line_number}</span>
        </div>
        <button
          onClick={onToggleExpansion}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      <div className="bg-gray-100 rounded p-2 text-xs font-mono text-gray-800 overflow-x-auto">
        <pre className="whitespace-pre-wrap">{preview}</pre>
      </div>
    </div>
  );
}

// List component for multiple scripts
interface ScriptListProps {
  scripts: ScriptExample[];
  expandedScripts: {[key: string]: number};
  onToggleExpansion: (scriptId: string) => void;
  onViewScript?: (script: ScriptExample) => void;
  loading?: boolean;
}

export function ScriptList({ 
  scripts, 
  expandedScripts, 
  onToggleExpansion, 
  onViewScript,
  loading = false 
}: ScriptListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!scripts || scripts.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic text-center py-8">
        No script examples found for this item.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scripts.filter(script => script).map((script) => {
        const contextLines = expandedScripts[script.script_id] || 3;
        const expanded = contextLines > 3;
        
        return (
          <ScriptPreview
            key={script.script_id}
            script={script}
            expanded={expanded}
            contextLines={contextLines}
            onToggleExpansion={() => onToggleExpansion(script.script_id)}
            onViewScript={onViewScript ? () => onViewScript(script) : undefined}
          />
        );
      })}
    </div>
  );
}
