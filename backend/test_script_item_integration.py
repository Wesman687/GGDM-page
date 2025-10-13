"""
Test Script for Item-Script Integration

Tests the end-to-end flow of:
1. Parsing items from script code
2. Validating items against database
3. Linking scripts to items
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from utils.script_parser import (
    extract_item_references,
    normalize_item_identifier,
    deduplicate_items,
    get_item_usage_summary
)

# Sample Razor script with various item references
SAMPLE_SCRIPT = """
# Fishing Macro
# Uses various items and commands

if findtype "fish" backpack
    say "Found fish!"
endif

if findtype 0x9CC backpack
    say "Found fish by ID!"
endif

dclicktype "fishing pole"
pause 2000

if findtype 3520 backpack as fish
    lift fish
    drop backpack
endif

usetype "scissors" backpack

# Multiple references to same item
findtype "gold coin" backpack
findtype "gold coin" self

# Hex reference
findtype 0xEED backpack

# Numeric reference
findtype 3821 backpack
"""


def test_extract_item_references():
    """Test extracting item references from script"""
    print("=" * 60)
    print("TEST 1: Extract Item References")
    print("=" * 60)
    
    items = extract_item_references(SAMPLE_SCRIPT)
    
    print(f"\nFound {len(items)} item references:")
    for item in items:
        print(f"  Line {item['line_number']}: {item['identifier']} ({item['command']})")
        print(f"    Is numeric: {item['is_numeric']}")
        print(f"    Context: {item['context']}")
        print()
    
    assert len(items) > 0, "Should find at least one item reference"
    print("✓ Test passed\n")
    return items


def test_normalize_identifiers():
    """Test normalizing item identifiers"""
    print("=" * 60)
    print("TEST 2: Normalize Item Identifiers")
    print("=" * 60)
    
    test_cases = [
        ("fish", ("fish", None)),
        ("0x9CC", (None, 2508)),
        ("3520", (None, 3520)),
        ("fishing pole", ("fishing pole", None)),
        ("0xEED", (None, 3821)),
    ]
    
    for identifier, expected in test_cases:
        result = normalize_item_identifier(identifier)
        print(f"  '{identifier}' -> name={result[0]}, id={result[1]}")
        assert result == expected, f"Expected {expected}, got {result}"
    
    print("✓ Test passed\n")


def test_deduplicate():
    """Test deduplicating item references"""
    print("=" * 60)
    print("TEST 3: Deduplicate Items")
    print("=" * 60)
    
    items = extract_item_references(SAMPLE_SCRIPT)
    unique_items = deduplicate_items(items)
    
    print(f"  Original items: {len(items)}")
    print(f"  Unique items: {len(unique_items)}")
    
    print("\nUnique items:")
    for item in unique_items:
        print(f"  - {item['identifier']}")
    
    assert len(unique_items) <= len(items), "Deduplicated should be less than or equal to original"
    print("\n✓ Test passed\n")


def test_usage_summary():
    """Test getting usage summary"""
    print("=" * 60)
    print("TEST 4: Get Usage Summary")
    print("=" * 60)
    
    summary = get_item_usage_summary(SAMPLE_SCRIPT)
    
    print(f"  Total references: {summary['total_references']}")
    print(f"  Unique items: {summary['unique_items']}")
    print(f"  Commands used: {', '.join(summary['commands_used'])}")
    
    print("\nUnique items found:")
    for item in summary['items']:
        print(f"  - {item['identifier']} (Line {item['line_number']})")
    
    assert summary['total_references'] > 0, "Should have total references"
    assert summary['unique_items'] > 0, "Should have unique items"
    assert len(summary['commands_used']) > 0, "Should have commands used"
    print("\n✓ Test passed\n")


def test_command_detection():
    """Test that various *type commands are detected"""
    print("=" * 60)
    print("TEST 5: Command Detection")
    print("=" * 60)
    
    test_script = """
    findtype "item1" backpack
    dclicktype "item2" 
    usetype "item3"
    lifttype "item4"
    droptype "item5"
    """
    
    items = extract_item_references(test_script)
    commands = set(item['command'] for item in items)
    
    expected_commands = {'findtype', 'dclicktype', 'usetype', 'lifttype', 'droptype'}
    print(f"  Expected commands: {expected_commands}")
    print(f"  Found commands: {commands}")
    
    for cmd in expected_commands:
        assert cmd in commands, f"Should detect {cmd}"
    
    print("✓ Test passed\n")


def test_quoted_vs_unquoted():
    """Test handling of quoted vs unquoted item names"""
    print("=" * 60)
    print("TEST 6: Quoted vs Unquoted Items")
    print("=" * 60)
    
    test_script = """
    findtype "quoted item" backpack
    findtype unquoted backpack
    findtype 'single quoted' backpack
    """
    
    items = extract_item_references(test_script)
    identifiers = [item['identifier'] for item in items]
    
    print(f"  Found identifiers: {identifiers}")
    
    assert "quoted item" in identifiers, "Should handle double quotes"
    assert "unquoted" in identifiers, "Should handle unquoted"
    assert "single quoted" in identifiers, "Should handle single quotes"
    
    print("✓ Test passed\n")


def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("RUNNING SCRIPT PARSER TESTS")
    print("=" * 60 + "\n")
    
    try:
        test_extract_item_references()
        test_normalize_identifiers()
        test_deduplicate()
        test_usage_summary()
        test_command_detection()
        test_quoted_vs_unquoted()
        
        print("=" * 60)
        print("ALL TESTS PASSED ✓")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()

