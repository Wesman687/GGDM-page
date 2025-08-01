#!/usr/bin/env python3

# Simple test of the actual function
import sys
import os
sys.path.append('.')

# Test with sample GitHub content (4-column format like in the PR)
test_content = """# GG DOCKMASTERS
1A-E	3499	1127	true
1B-E	3920	1292	true
XD11	3393	3356	7	true
M1	500	300	true"""

# Parse like our function does
lines = test_content.strip().split('\n')
header_lines = []
data_lines = []

for line in lines:
    if line.strip() == "" or line.startswith('#'):
        header_lines.append(line)
    else:
        parts = line.split('\t') if '\t' in line else line.split()
        if len(parts) >= 3:  # Valid data line
            zone_id = parts[0].strip()
            x = parts[1].strip()
            y = parts[2].strip()
            
            print(f"Processing: {line}")
            print(f"Parts: {parts} (length: {len(parts)})")
            
            # Handle different column formats
            if len(parts) == 4:
                # Format: zone_id x y enabled (missing map)
                map_val = "7"
                enabled = parts[3].strip()
                print(f"  4-column detected: map='{map_val}', enabled='{enabled}'")
            elif len(parts) >= 5:
                # Format: zone_id x y map enabled
                map_val = parts[3].strip()
                enabled = parts[4].strip()
                print(f"  5-column detected: map='{map_val}', enabled='{enabled}'")
            else:
                # Format: zone_id x y (missing map and enabled)
                map_val = "7"
                enabled = "true"
                print(f"  3-column detected: map='{map_val}', enabled='{enabled}'")
            
            # Ensure enabled is properly formatted
            if enabled.lower() in ['true', '1', 'yes', 'enabled', 'on']:
                enabled = "true"
            elif enabled.lower() in ['false', '0', 'no', 'disabled', 'off']:
                enabled = "false"
            else:
                enabled = "true"  # Default to "true" for any unclear values
            
            normalized_line = f"{zone_id}\t{x}\t{y}\t{map_val}\t{enabled}"
            print(f"  Result: '{normalized_line}'")
            print("---")
            data_lines.append(normalized_line)

print("\nFINAL RESULT:")
for line in header_lines + data_lines:
    print(line)
