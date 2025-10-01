import { useState, useCallback } from 'react';
import { ScriptExample } from '../../types/items';

const API_BASE = 'http://localhost:7000/api/items';

export function useScriptExamples(itemId: number) {
  const [scriptExamples, setScriptExamples] = useState<ScriptExample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedScripts, setExpandedScripts] = useState<{[key: string]: number}>({});

  const ITEMS_PER_PAGE = 10;
  const EXPANSION_LEVELS = [3, 6, 10, 15, 20, 25, 30];

  // Load script examples for an item
  const loadScriptExamples = useCallback(async (page: number = 1) => {
    if (!itemId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      
      const response = await fetch(`${API_BASE}/${itemId}/script-examples?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load script examples');
      }
      
      const data = await response.json();
      setScriptExamples(data.scripts || []);
      setTotal(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading script examples:', err);
      setError(err instanceof Error ? err.message : 'Failed to load script examples');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  // Toggle script expansion
  const toggleScriptExpansion = useCallback((scriptId: string) => {
    setExpandedScripts(prev => {
      const currentLevel = prev[scriptId] || 0;
      const currentIndex = EXPANSION_LEVELS.indexOf(currentLevel);
      const nextIndex = (currentIndex + 1) % EXPANSION_LEVELS.length;
      const nextLevel = EXPANSION_LEVELS[nextIndex];
      
      return {
        ...prev,
        [scriptId]: nextLevel
      };
    });
  }, []);

  // Get script preview with specified context lines
  const getScriptPreview = useCallback((script: ScriptExample, contextLines: number): string => {
    const lines = script.context.split('\n');
    const startLine = Math.max(0, script.line_number - Math.floor(contextLines / 2));
    const endLine = Math.min(lines.length, startLine + contextLines);
    
    const previewLines = lines.slice(startLine, endLine);
    return previewLines.join('\n');
  }, []);

  // Get current expansion level for a script
  const getCurrentExpansionLevel = useCallback((scriptId: string): number => {
    return expandedScripts[scriptId] || EXPANSION_LEVELS[0];
  }, [expandedScripts]);

  // Check if script is expanded beyond default
  const isScriptExpanded = useCallback((scriptId: string): boolean => {
    return (expandedScripts[scriptId] || EXPANSION_LEVELS[0]) > EXPANSION_LEVELS[0];
  }, [expandedScripts]);

  // Reset expansion for all scripts
  const resetExpansions = useCallback(() => {
    setExpandedScripts({});
  }, []);

  // Get pagination info
  const getPaginationInfo = useCallback(() => {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);
    
    return {
      totalPages,
      currentPage,
      startItem,
      endItem,
      total,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      nextPage: currentPage + 1,
      prevPage: currentPage - 1,
      displayText: total > 0 ? `Showing ${startItem}-${endItem} of ${total}` : 'No scripts',
    };
  }, [currentPage, total]);

  // Navigate to page
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= Math.ceil(total / ITEMS_PER_PAGE)) {
      loadScriptExamples(page);
    }
  }, [loadScriptExamples, total]);

  // Go to next page
  const nextPage = useCallback(() => {
    const pagination = getPaginationInfo();
    if (pagination.hasNextPage) {
      goToPage(pagination.nextPage);
    }
  }, [getPaginationInfo, goToPage]);

  // Go to previous page
  const prevPage = useCallback(() => {
    const pagination = getPaginationInfo();
    if (pagination.hasPrevPage) {
      goToPage(pagination.prevPage);
    }
  }, [getPaginationInfo, goToPage]);

  // Load first page when itemId changes
  const initializeScripts = useCallback(() => {
    if (itemId) {
      loadScriptExamples(1);
      resetExpansions();
    }
  }, [itemId, loadScriptExamples, resetExpansions]);

  return {
    // State
    scriptExamples,
    loading,
    error,
    total,
    currentPage,
    expandedScripts,
    
    // Actions
    loadScriptExamples,
    toggleScriptExpansion,
    resetExpansions,
    goToPage,
    nextPage,
    prevPage,
    initializeScripts,
    
    // Utilities
    getScriptPreview,
    getCurrentExpansionLevel,
    isScriptExpanded,
    getPaginationInfo,
    clearError: () => setError(null),
  };
}
