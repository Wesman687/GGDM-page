#!/usr/bin/env python3

# Test script to show sample PR content
import sys
import os
sys.path.append('.')

# Sample existing content (like what would be in GitHub)
sample_content = """# GG DOCKMASTERS
# Zone_ID	X	Y	Map	Enabled
1C-E	4345	937	7	true
1D-E	4336	796	7	true
1E-E	4339	700	7	true
1F-E	4312	547	7	true
2B-E	3947	1300	7	true
4A-E	3719	1369	7	true
XD7	3393	3356	7	true
M1	1000	2000	7	true
"""

# Mock suggestion class
class MockSuggestion:
    def __init__(self, action, zone_id, x=None, y=None, map_val=7, enabled=True):
        self.id = 'test123'
        self.action = action
        self.zone_id = zone_id
        self.x = x
        self.y = y
        self.map = map_val
        self.enabled = enabled
        self.reason = 'Test suggestion'

def sort_zone_id(zone_id):
    """Custom sorting function for zone IDs"""
    import re
    # Handle XD zones numerically (XD1, XD2, ..., XD10, XD11)
    if zone_id.startswith("XD"):
        try:
            return (0, int(zone_id[2:]))  # 0 to put XD zones first, then numeric
        except ValueError:
            return (0, 9999)  # Invalid XD numbers go to end of XD section
    # Handle XP zones (similar to XD)
    elif zone_id.startswith("XP"):
        try:
            return (0.1, int(zone_id[2:]))  # 0.1 to put XP zones after XD
        except ValueError:
            return (0.1, 9999)
    # Handle M zones (put them at the very end)
    elif zone_id.startswith("M"):
        try:
            return (99, int(zone_id[1:]))  # 99 to put M zones at the very end
        except ValueError:
            return (99, 9999)
    # Handle special zones (GH, The Gym, GG-Shelter, etc.)
    elif not zone_id[0].isdigit():
        return (50, zone_id)  # 50 to put special zones in middle
    # Handle regular zones (numbers + letters + direction)
    else:
        # Extract number and letters for proper sorting
        match = re.match(r'(\d+)([A-Z]*)(-([NSEW]))?', zone_id)
        if match:
            number = int(match.group(1))
            letters = match.group(2) or ""
            direction = match.group(4) or ""
            # Sort by number first, then letters, then direction (E, N, S, W)
            direction_order = {"E": 1, "N": 2, "S": 3, "W": 4, "": 5}
            return (1, number, letters, direction_order.get(direction, 5))
        else:
            return (2, zone_id)  # Fallback alphabetical

def apply_suggestion_to_content(content: str, suggestion) -> str:
    """Apply the suggestion changes to the file content and return properly sorted content"""
    lines = content.strip().split('\n')
    
    # Parse all existing lines, keeping comments and headers at the top
    header_lines = []
    data_lines = []
    
    for line in lines:
        if line.strip() == "" or line.startswith('#'):
            header_lines.append(line)
        else:
            parts = line.split('\t') if '\t' in line else line.split()
            if len(parts) >= 3:  # Valid data line
                # Include ALL dockmasters (M#, y=6142, everything)
                # Normalize formatting to use tabs consistently and ensure all fields are present
                zone_id = parts[0].strip()
                x = parts[1].strip()
                y = parts[2].strip()
                map_val = parts[3].strip() if len(parts) > 3 else "7"
                enabled = parts[4].strip() if len(parts) > 4 else "true"
                
                # Ensure enabled is properly formatted
                if enabled.lower() in ['true', '1', 'yes', 'enabled', 'on']:
                    enabled = "true"
                elif enabled.lower() in ['false', '0', 'no', 'disabled', 'off']:
                    enabled = "false"
                else:
                    enabled = "true"  # Default to "true" for any unclear values
                
                normalized_line = f"{zone_id}\t{x}\t{y}\t{map_val}\t{enabled}"
                data_lines.append(normalized_line)
    
    if suggestion.action == "add":
        # Add new dockmaster entry
        map_value = suggestion.map if hasattr(suggestion, 'map') and suggestion.map is not None else 7
        enabled_value = suggestion.enabled if hasattr(suggestion, 'enabled') and suggestion.enabled is not None else True
        enabled_str = "true" if enabled_value else "false"
        new_line = f"{suggestion.zone_id}\t{suggestion.x}\t{suggestion.y}\t{map_value}\t{enabled_str}"
        data_lines.append(new_line)
        
    elif suggestion.action == "remove":
        # Remove existing dockmaster entry
        data_lines = [line for line in data_lines 
                     if not (line.strip() and 
                            (line.split('\t')[0] if '\t' in line else line.split()[0]) == suggestion.zone_id)]
    
    # Sort ALL data lines properly (including M# and y=6142)
    data_lines.sort(key=lambda line: sort_zone_id(
        (line.split('\t')[0] if '\t' in line else line.split()[0]).strip()
    ))
    
    # Combine header and sorted data (ALL data, not filtered)
    result_lines = header_lines + data_lines
    return '\n'.join(result_lines) + '\n'

# Test adding a new dockmaster
test_suggestion = MockSuggestion('add', 'XD11', 3000, 4000, 7, True)

result = apply_suggestion_to_content(sample_content, test_suggestion)
print('SAMPLE PR CONTENT FOR ADDING XD11:')
print('=' * 60)
print(result)
print('=' * 60)

# Test with some missing values
test_suggestion2 = MockSuggestion('add', '1G-E', 5000, 6000)  # No explicit map/enabled

result2 = apply_suggestion_to_content(sample_content, test_suggestion2)
print('\nSAMPLE PR CONTENT FOR ADDING 1G-E (with defaults):')
print('=' * 60)
print(result2)
print('=' * 60)
