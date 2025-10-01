import { IndividualHue } from '../../types/items';

/**
 * Color name mapping for common hue values
 * This is a simplified version - in the real system, this would be more comprehensive
 */
const HUE_COLOR_NAMES: Record<number, string> = {
  0: 'Black',
  1: 'Blue',
  2: 'Green', 
  3: 'Aqua',
  4: 'Red',
  5: 'Purple',
  6: 'Yellow',
  7: 'White',
  8: 'Gray',
  9: 'Orange',
  10: 'Light Gray',
  11: 'Pink',
  12: 'Dark Blue',
  13: 'Dark Green',
  14: 'Dark Red',
  15: 'Dark Purple',
  16: 'Dark Yellow',
  17: 'Dark Orange',
  18: 'Dark Pink',
  19: 'Light Blue',
  20: 'Light Green',
  21: 'Light Red',
  22: 'Light Purple',
  23: 'Light Yellow',
  24: 'Light Orange',
  25: 'Light Pink',
  // Add more as needed
};

/**
 * Get color name for a hue value
 */
export function getHueColorName(hue: number): string {
  return HUE_COLOR_NAMES[hue] || `Hue ${hue}`;
}

/**
 * Get all available hue values with their color names
 */
export function getAllHueOptions(): Array<{ hue: number; name: string }> {
  return Object.entries(HUE_COLOR_NAMES).map(([hue, name]) => ({
    hue: parseInt(hue, 10),
    name
  }));
}

/**
 * Filter hue options based on search term
 */
export function filterHueOptions(search: string): Array<{ hue: number; name: string }> {
  if (!search.trim()) {
    return getAllHueOptions();
  }
  
  const searchLower = search.toLowerCase();
  return getAllHueOptions().filter(option => 
    option.name.toLowerCase().includes(searchLower) ||
    option.hue.toString().includes(search)
  );
}

/**
 * Get hue name suggestions based on partial input
 */
export function getHueNameSuggestions(input: string, individualHues: IndividualHue[]): string[] {
  if (!input.trim()) {
    return [];
  }
  
  const inputLower = input.toLowerCase();
  const suggestions = new Set<string>();
  
  // Add suggestions from individual hues
  individualHues.forEach(hue => {
    if (hue.description.toLowerCase().includes(inputLower)) {
      suggestions.add(hue.description);
    }
  });
  
  // Add color name suggestions
  getAllHueOptions().forEach(option => {
    if (option.name.toLowerCase().includes(inputLower)) {
      suggestions.add(option.name);
    }
  });
  
  return Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
}

/**
 * Get hue value suggestions based on partial input
 */
export function getHueValueSuggestions(input: string, individualHues: IndividualHue[]): number[] {
  if (!input.trim()) {
    return [];
  }
  
  const inputNum = parseInt(input, 10);
  const suggestions: number[] = [];
  
  // If input is a number, suggest nearby values
  if (!isNaN(inputNum)) {
    for (let i = Math.max(0, inputNum - 5); i <= inputNum + 5; i++) {
      if (HUE_COLOR_NAMES[i] || individualHues.some(h => h.hue === i)) {
        suggestions.push(i);
      }
    }
  }
  
  // Add suggestions from individual hues that match the input
  individualHues.forEach(hue => {
    if (hue.hue.toString().includes(input) || hue.description.toLowerCase().includes(input.toLowerCase())) {
      suggestions.push(hue.hue);
    }
  });
  
  // Remove duplicates and limit results
  return [...new Set(suggestions)].slice(0, 10);
}

/**
 * Validate hue value
 */
export function validateHueValue(hue: number): boolean {
  return Number.isInteger(hue) && hue >= 0 && hue <= 3000; // UO hue range
}

/**
 * Validate hue description
 */
export function validateHueDescription(description: string): boolean {
  return description.trim().length > 0 && description.trim().length <= 100;
}

/**
 * Sort hues by usage count (descending) then by hue value
 */
export function sortHuesByUsage(hues: IndividualHue[]): IndividualHue[] {
  return [...hues].sort((a, b) => {
    if (b.usage_count !== a.usage_count) {
      return b.usage_count - a.usage_count;
    }
    return a.hue - b.hue;
  });
}

/**
 * Get most popular hues (top 10 by usage)
 */
export function getPopularHues(hues: IndividualHue[], limit: number = 10): IndividualHue[] {
  return sortHuesByUsage(hues).slice(0, limit);
}

/**
 * Check if a hue value already exists in a list
 */
export function hueExists(hue: number, hues: IndividualHue[]): boolean {
  return hues.some(h => h.hue === hue);
}

/**
 * Find hue by value in a list
 */
export function findHueByValue(hue: number, hues: IndividualHue[]): IndividualHue | undefined {
  return hues.find(h => h.hue === hue);
}

/**
 * Format hue for display
 */
export function formatHueDisplay(hue: IndividualHue): string {
  const colorName = getHueColorName(hue.hue);
  return `${hue.hue} (${colorName}) - ${hue.description}`;
}
