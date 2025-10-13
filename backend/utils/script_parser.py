"""
Script Parser Utility

Extracts item references from Razor scripts by analyzing commands that interact with items.
Supports commands like findtype, dclicktype, usetype, etc.
"""

import re
from typing import List, Dict, Tuple


def extract_item_references(script_code: str) -> List[Dict]:
    """
    Extract item references from Razor script code.
    
    Looks for commands ending in 'type' (findtype, dclicktype, usetype, etc.)
    and extracts the item identifier (name or ID) that follows.
    
    Args:
        script_code: The full Razor script code
        
    Returns:
        List of dicts containing:
        - identifier: The item name or ID
        - command: The command used (findtype, dclicktype, etc.)
        - line_number: Line number in script
        - context: Full line of code for context
        - is_numeric: Whether the identifier appears to be an ID
    """
    items = []
    lines = script_code.split('\n')
    
    # Pattern to match commands ending in 'type' followed by item identifier
    # Matches: findtype, dclicktype, usetype, lifttype, droptype, etc.
    # The identifier can be:
    # - A quoted string: "item name"
    # - A number: 0x1234 or 1234
    # - An unquoted word: itemname
    type_command_pattern = re.compile(
        r'(\w+type)\s+(?:"([^"]+)"|\'([^\']+)\'|(\S+))',
        re.IGNORECASE
    )
    
    for line_num, line in enumerate(lines, start=1):
        # Skip comments
        if line.strip().startswith('#') or line.strip().startswith('//'):
            continue
            
        matches = type_command_pattern.finditer(line)
        
        for match in matches:
            command = match.group(1).lower()
            
            # Extract identifier from whichever group matched
            identifier = match.group(2) or match.group(3) or match.group(4)
            
            if identifier:
                # Determine if it's numeric (ID) or text (name)
                is_numeric = _is_numeric_id(identifier)
                
                items.append({
                    'identifier': identifier,
                    'command': command,
                    'line_number': line_num,
                    'context': line.strip(),
                    'is_numeric': is_numeric
                })
    
    return items


def _is_numeric_id(identifier: str) -> bool:
    """
    Check if identifier is a numeric ID (decimal or hex).
    
    Args:
        identifier: The item identifier to check
        
    Returns:
        True if identifier is numeric (0x1234 or 1234), False otherwise
    """
    identifier = identifier.strip()
    
    # Check for hex format
    if identifier.startswith('0x'):
        try:
            int(identifier, 16)
            return True
        except ValueError:
            return False
    
    # Check for decimal number
    if identifier.isdigit():
        return True
    
    return False


def normalize_item_identifier(identifier: str) -> Tuple[str, int]:
    """
    Normalize item identifier to separate name and ID.
    
    Args:
        identifier: Raw identifier from script
        
    Returns:
        Tuple of (name, item_id) where one will be None based on type
    """
    if _is_numeric_id(identifier):
        # Convert to integer
        if identifier.startswith('0x'):
            item_id = int(identifier, 16)
        else:
            item_id = int(identifier)
        return None, item_id
    else:
        # It's a name
        return identifier, None


def deduplicate_items(items: List[Dict]) -> List[Dict]:
    """
    Remove duplicate item references, keeping first occurrence.
    
    Args:
        items: List of item reference dicts
        
    Returns:
        Deduplicated list of items
    """
    seen = set()
    unique_items = []
    
    for item in items:
        key = (item['identifier'].lower(), item['is_numeric'])
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
    
    return unique_items


def get_item_usage_summary(script_code: str) -> Dict:
    """
    Get a summary of item usage in the script.
    
    Args:
        script_code: The full Razor script code
        
    Returns:
        Dict with:
        - total_references: Total number of item references found
        - unique_items: Number of unique items
        - items: List of unique item references
        - commands_used: Set of commands used (findtype, dclicktype, etc.)
    """
    items = extract_item_references(script_code)
    unique_items = deduplicate_items(items)
    commands_used = set(item['command'] for item in items)
    
    return {
        'total_references': len(items),
        'unique_items': len(unique_items),
        'items': unique_items,
        'commands_used': list(commands_used)
    }

