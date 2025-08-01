#!/usr/bin/env python3

# Test script to check what happens with inconsistent formatting
sample_content = """# GG DOCKMASTERS
# Zone_ID	X	Y	Map	Enabled
1A-E	3499	1127	true
1B-E	3920	1292	true
1C-E	4345	937	7	true
XD7	3413	3572	7	true
7B-S	3285	3554	7	true
"""

def process_line_test(line):
    parts = line.split('\t') if '\t' in line else line.split()
    if len(parts) >= 3:  # Valid data line
        zone_id = parts[0].strip()
        x = parts[1].strip()
        y = parts[2].strip()
        
        # Handle different column formats
        if len(parts) == 4:
            # Format: zone_id x y enabled (missing map)
            map_val = "7"
            enabled = parts[3].strip()
        elif len(parts) >= 5:
            # Format: zone_id x y map enabled
            map_val = parts[3].strip()
            enabled = parts[4].strip()
        else:
            # Format: zone_id x y (missing map and enabled)
            map_val = "7"
            enabled = "true"
        
        # Ensure enabled is properly formatted
        if enabled.lower() in ['true', '1', 'yes', 'enabled', 'on']:
            enabled = "true"
        elif enabled.lower() in ['false', '0', 'no', 'disabled', 'off']:
            enabled = "false"
        else:
            enabled = "true"  # Default to "true" for any unclear values
        
        normalized_line = f"{zone_id}\t{x}\t{y}\t{map_val}\t{enabled}"
        print(f"Input:  '{line.strip()}'")
        print(f"Parts:  {parts} (len={len(parts)})")
        print(f"Output: '{normalized_line}'")
        print("---")

lines = sample_content.strip().split('\n')
for line in lines:
    if line.strip() and not line.startswith('#'):
        process_line_test(line)
