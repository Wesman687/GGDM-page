#!/usr/bin/env python3
"""
Test multi-tag search fix
"""

import requests
import time

def test_multi_tag_fix():
    print("Testing multi-tag search fix...")
    
    # Test multi-tag search (fishing,harpoon) - should show ALL scripts with either tag
    print("\nMulti-tag search (fishing,harpoon):")
    response = requests.get('http://localhost:7000/api/scripts/?tags=fishing,harpoon')
    print(f"Status: {response.status_code}")
    print(f"Count: {len(response.json())}")
    
    if response.json():
        print("Results (should show scripts with either fishing OR harpoon, ranked by matches):")
        for i, script in enumerate(response.json()[:10]):
            tags = script.get('tags', [])
            fishing_match = any('fishing' in tag.lower() for tag in tags)
            harpoon_match = any('harpoon' in tag.lower() for tag in tags)
            match_count = sum([fishing_match, harpoon_match])
            print(f"  {i+1}. {script['title']}: {tags} (matches: {match_count})")
    
    # Test single tag for comparison
    print("\nSingle tag search (fishing) for comparison:")
    response = requests.get('http://localhost:7000/api/scripts/?tags=fishing')
    print(f"Count: {len(response.json())}")

if __name__ == "__main__":
    test_multi_tag_fix()
