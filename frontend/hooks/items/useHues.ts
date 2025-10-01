import { useState, useEffect, useCallback } from 'react';
import { HueSet, IndividualHue, AddHueRequest, UpdateHueRequest } from '../../types/items';

const API_BASE = 'http://localhost:7000/api/items';

export function useHues() {
  const [hueSets, setHueSets] = useState<HueSet[]>([]);
  const [individualHues, setIndividualHues] = useState<IndividualHue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load hue sets
  const loadHueSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/hue-sets`);
      if (!response.ok) {
        throw new Error('Failed to load hue sets');
      }
      
      const data = await response.json();
      setHueSets(data);
    } catch (err) {
      console.error('Error loading hue sets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hue sets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load individual hues
  const loadIndividualHues = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/individual-hues`);
      if (!response.ok) {
        throw new Error('Failed to load individual hues');
      }
      
      const data = await response.json();
      setIndividualHues(data);
    } catch (err) {
      console.error('Error loading individual hues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load individual hues');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create hue set
  const createHueSet = useCallback(async (name: string, hues: Array<{ hue: number; description: string }>): Promise<HueSet | null> => {
    try {
      const response = await fetch(`${API_BASE}/hue-sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, hues }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create hue set');
      }

      const newHueSet = await response.json();
      setHueSets(prev => [...prev, newHueSet]);
      
      return newHueSet;
    } catch (err) {
      console.error('Error creating hue set:', err);
      setError(err instanceof Error ? err.message : 'Failed to create hue set');
      return null;
    }
  }, []);

  // Update hue set
  const updateHueSet = useCallback(async (id: number, name: string, hues: Array<{ hue: number; description: string }>): Promise<HueSet | null> => {
    try {
      const response = await fetch(`${API_BASE}/hue-sets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, hues }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update hue set');
      }

      const updatedHueSet = await response.json();
      setHueSets(prev => prev.map(set => 
        set.id === id ? updatedHueSet : set
      ));
      
      return updatedHueSet;
    } catch (err) {
      console.error('Error updating hue set:', err);
      setError(err instanceof Error ? err.message : 'Failed to update hue set');
      return null;
    }
  }, []);

  // Delete hue set
  const deleteHueSet = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/hue-sets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete hue set');
      }

      setHueSets(prev => prev.filter(set => set.id !== id));
      
      return true;
    } catch (err) {
      console.error('Error deleting hue set:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete hue set');
      return false;
    }
  }, []);

  // Use hue set (increment usage count)
  const useHueSet = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/hue-sets/${id}/use`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to use hue set');
      }

      // Update local state
      setHueSets(prev => prev.map(set => 
        set.id === id ? { ...set, usage_count: set.usage_count + 1 } : set
      ));
      
      return true;
    } catch (err) {
      console.error('Error using hue set:', err);
      setError(err instanceof Error ? err.message : 'Failed to use hue set');
      return false;
    }
  }, []);

  // Create/update individual hue
  const createIndividualHue = useCallback(async (hueData: AddHueRequest): Promise<IndividualHue | null> => {
    try {
      const response = await fetch(`${API_BASE}/individual-hues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hueData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create individual hue');
      }

      const newHue = await response.json();
      
      // Update local state
      setIndividualHues(prev => {
        const existing = prev.find(h => h.hue === newHue.hue);
        if (existing) {
          return prev.map(h => h.hue === newHue.hue ? newHue : h);
        } else {
          return [...prev, newHue];
        }
      });
      
      return newHue;
    } catch (err) {
      console.error('Error creating individual hue:', err);
      setError(err instanceof Error ? err.message : 'Failed to create individual hue');
      return null;
    }
  }, []);

  // Initialize data
  useEffect(() => {
    loadHueSets();
    loadIndividualHues();
  }, [loadHueSets, loadIndividualHues]);

  return {
    // State
    hueSets,
    individualHues,
    loading,
    error,
    
    // Actions
    loadHueSets,
    loadIndividualHues,
    createHueSet,
    updateHueSet,
    deleteHueSet,
    useHueSet,
    createIndividualHue,
    
    // Utilities
    clearError: () => setError(null),
  };
}

// Hook for managing item-specific hues
export function useItemHues(itemId: number) {
  const [hues, setHues] = useState<Array<{ hue: number; description: string; usage_count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load item hues
  const loadItemHues = useCallback(async () => {
    if (!itemId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/${itemId}/hues`);
      if (!response.ok) {
        throw new Error('Failed to load item hues');
      }
      
      const data = await response.json();
      setHues(data);
    } catch (err) {
      console.error('Error loading item hues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load item hues');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  // Add hue to item
  const addHue = useCallback(async (hueData: AddHueRequest): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/${itemId}/hues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hueData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add hue');
      }

      const newHue = await response.json();
      setHues(prev => [...prev, newHue]);
      
      return true;
    } catch (err) {
      console.error('Error adding hue:', err);
      setError(err instanceof Error ? err.message : 'Failed to add hue');
      return false;
    }
  }, [itemId]);

  // Update hue description
  const updateHue = useCallback(async (hueValue: number, updateData: UpdateHueRequest): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/${itemId}/hues/${hueValue}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update hue');
      }

      setHues(prev => prev.map(hue => 
        hue.hue === hueValue ? { ...hue, description: updateData.description } : hue
      ));
      
      return true;
    } catch (err) {
      console.error('Error updating hue:', err);
      setError(err instanceof Error ? err.message : 'Failed to update hue');
      return false;
    }
  }, [itemId]);

  // Remove hue from item
  const removeHue = useCallback(async (hueValue: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/${itemId}/hues/${hueValue}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to remove hue');
      }

      setHues(prev => prev.filter(hue => hue.hue !== hueValue));
      
      return true;
    } catch (err) {
      console.error('Error removing hue:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove hue');
      return false;
    }
  }, [itemId]);

  // Load hues when itemId changes
  useEffect(() => {
    loadItemHues();
  }, [loadItemHues]);

  return {
    // State
    hues,
    loading,
    error,
    
    // Actions
    loadItemHues,
    addHue,
    updateHue,
    removeHue,
    
    // Utilities
    clearError: () => setError(null),
  };
}
