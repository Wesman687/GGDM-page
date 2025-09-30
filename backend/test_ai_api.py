#!/usr/bin/env python3
"""
Simple AI Agent Test - Test the actual API endpoint
This script tests the /ai/search endpoint to see what happens
"""

import requests
import json
import sys
import os

def test_ai_endpoint():
    """Test the AI search endpoint"""
    
    # Configuration
    base_url = "http://localhost:8000"  # Adjust if your backend runs on different port
    endpoint = "/api/scripts/ai/search"
    
    # Test data
    test_data = {
        "question": "fishing script",
        "rules_version": "rules-v1.0",
        "model_version": "gpt-4o-mini"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print("🚀 TESTING AI SEARCH ENDPOINT")
    print("=" * 50)
    print(f"URL: {base_url}{endpoint}")
    print(f"Data: {json.dumps(test_data, indent=2)}")
    print("=" * 50)
    
    try:
        # Make the request
        response = requests.post(
            f"{base_url}{endpoint}",
            json=test_data,
            headers=headers,
            params={"user_id": "test_user_123"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ SUCCESS!")
            print("Response:")
            print("-" * 30)
            print(f"Answer: {result.get('answer', 'N/A')[:200]}...")
            print(f"Code: {result.get('code', 'N/A')[:200]}...")
            print(f"Citations: {len(result.get('citations', []))}")
            print(f"Script Suggestions: {len(result.get('script_suggestions', []))}")
            print(f"Rules Version: {result.get('rules_version', 'N/A')}")
            print(f"Model Version: {result.get('model_version', 'N/A')}")
            
            # Show script suggestions
            if result.get('script_suggestions'):
                print("\nScript Suggestions:")
                for i, suggestion in enumerate(result['script_suggestions']):
                    print(f"  {i+1}. {suggestion.get('title', 'N/A')} by {suggestion.get('author', 'N/A')}")
                    print(f"     Rating: {suggestion.get('rating', 'N/A')}")
                    print(f"     Reason: {suggestion.get('relevance_reason', 'N/A')}")
            
            # Show citations
            if result.get('citations'):
                print("\nCitations:")
                for i, citation in enumerate(result['citations']):
                    print(f"  {i+1}. {citation.get('title', 'N/A')}")
            
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ CONNECTION ERROR")
        print("Make sure your backend server is running on http://localhost:8000")
        print("You can start it with: python run.py")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

def test_interactive_endpoint():
    """Test the interactive search endpoint"""
    
    base_url = "http://localhost:8000"
    endpoint = "/api/scripts/ai/interactive-search"
    
    test_data = {
        "question": "fishing script",
        "action": "search"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print("\n" + "=" * 50)
    print("🔄 TESTING INTERACTIVE SEARCH ENDPOINT")
    print("=" * 50)
    print(f"URL: {base_url}{endpoint}")
    print(f"Data: {json.dumps(test_data, indent=2)}")
    print("=" * 50)
    
    try:
        response = requests.post(
            f"{base_url}{endpoint}",
            json=test_data,
            headers=headers,
            params={"user_id": "test_user_123"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ SUCCESS!")
            print("Response:")
            print("-" * 30)
            print(f"Type: {result.get('type', 'N/A')}")
            print(f"Message: {result.get('message', 'N/A')}")
            
            if result.get('suggestions'):
                print(f"Suggestions: {len(result['suggestions'])}")
                for i, suggestion in enumerate(result['suggestions']):
                    print(f"  {i+1}. {suggestion.get('title', 'N/A')} by {suggestion.get('author', 'N/A')}")
            
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

def main():
    """Main test function"""
    print("🧪 AI AGENT API TEST TOOL")
    print("This tool tests the actual API endpoints")
    
    # Test regular search
    test_ai_endpoint()
    
    # Test interactive search
    test_interactive_endpoint()
    
    print("\n" + "=" * 50)
    print("✅ API TEST COMPLETE")
    print("=" * 50)

if __name__ == "__main__":
    main()
    
    print("\nWaiting 2 seconds...")
    import time
    time.sleep(2)
