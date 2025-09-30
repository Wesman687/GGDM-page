#!/usr/bin/env python3
"""
AI Agent Debug Tool - Test what we're sending to the AI
This script helps debug AI interactions by showing:
1. What rules are loaded
2. What context is retrieved
3. What prompt is sent to the AI
4. What response we get back
"""

import sys
import os
sys.path.append('.')

from routes.scripts import load_rules, retrieve_relevant_scripts, suggest_existing_scripts
from ai_rag import retrieve, format_context, generate_citations
from ai_settings import RULES_PATH, OPENAI_MODEL
from openai import OpenAI
import json

def test_rules_loading():
    """Test what rules are being loaded"""
    print("=" * 60)
    print("🔧 TESTING AI RULES LOADING")
    print("=" * 60)
    
    rules = load_rules()
    print(f"Rules file path: {RULES_PATH}")
    print(f"Rules loaded: {len(rules)} characters")
    print(f"Contains 'Razor syntax': {'Razor syntax' in rules}")
    print(f"Contains 'NO PARENTHESES': {'NO PARENTHESES' in rules}")
    print(f"Contains 'findtype': {'findtype' in rules}")
    
    # Show first 500 characters
    print("\nFirst 500 characters of rules:")
    print("-" * 40)
    print(rules[:500])
    print("-" * 40)
    
    return rules

def test_context_retrieval(query):
    """Test what context is retrieved for a query"""
    print("\n" + "=" * 60)
    print(f"🔍 TESTING CONTEXT RETRIEVAL FOR: '{query}'")
    print("=" * 60)
    
    # Test documentation retrieval
    try:
        doc_chunks = retrieve(query, k=5)
        print(f"Documentation chunks found: {len(doc_chunks)}")
        for i, chunk in enumerate(doc_chunks[:3]):
            print(f"\nDoc Chunk {i+1}:")
            print(f"  Title: {chunk.get('title', 'N/A')}")
            print(f"  Source: {chunk.get('source', 'N/A')}")
            print(f"  Text preview: {chunk.get('text', '')[:200]}...")
    except Exception as e:
        print(f"Error retrieving documentation: {e}")
        doc_chunks = []
    
    # Test script retrieval
    try:
        script_chunks = retrieve_relevant_scripts(query, k=5)
        print(f"\nScript chunks found: {len(script_chunks)}")
        for i, chunk in enumerate(script_chunks[:3]):
            print(f"\nScript Chunk {i+1}:")
            print(f"  Title: {chunk.get('title', 'N/A')}")
            print(f"  Source: {chunk.get('source', 'N/A')}")
            print(f"  Text preview: {chunk.get('text', '')[:200]}...")
    except Exception as e:
        print(f"Error retrieving scripts: {e}")
        script_chunks = []
    
    return doc_chunks, script_chunks

def test_script_suggestions(query):
    """Test what script suggestions are generated"""
    print("\n" + "=" * 60)
    print(f"💡 TESTING SCRIPT SUGGESTIONS FOR: '{query}'")
    print("=" * 60)
    
    try:
        suggestions = suggest_existing_scripts(query, k=3)
        print(f"Script suggestions found: {len(suggestions)}")
        for i, suggestion in enumerate(suggestions):
            print(f"\nSuggestion {i+1}:")
            print(f"  Title: {suggestion.get('title', 'N/A')}")
            print(f"  Author: {suggestion.get('author', 'N/A')}")
            print(f"  Description: {suggestion.get('description', 'N/A')[:100]}...")
            print(f"  Rating: {suggestion.get('rating', 'N/A')}")
            print(f"  Relevance: {suggestion.get('relevance_reason', 'N/A')}")
    except Exception as e:
        print(f"Error generating suggestions: {e}")
        suggestions = []
    
    return suggestions

def test_ai_prompt(query, rules, doc_chunks, script_chunks):
    """Test what prompt is sent to the AI"""
    print("\n" + "=" * 60)
    print(f"🤖 TESTING AI PROMPT FOR: '{query}'")
    print("=" * 60)
    
    # Combine all chunks
    all_chunks = doc_chunks + script_chunks
    
    # Format context
    try:
        context_text = format_context(all_chunks)
        print(f"Context text length: {len(context_text)} characters")
        print(f"Context preview (first 500 chars):")
        print("-" * 40)
        print(context_text[:500])
        print("-" * 40)
    except Exception as e:
        print(f"Error formatting context: {e}")
        context_text = ""
    
    # Generate citations
    try:
        citations = generate_citations(all_chunks)
        print(f"\nCitations generated: {len(citations)}")
        for i, citation in enumerate(citations[:3]):
            print(f"  Citation {i+1}: {citation.get('title', 'N/A')}")
    except Exception as e:
        print(f"Error generating citations: {e}")
        citations = []
    
    # Build the full prompt
    prompt = f"""You are a Razor scripting expert for UO Outlands. Use ONLY Razor syntax (no parentheses in control structures!)

RULES:
{rules}

CONTEXT:
{context_text}

USER QUESTION: {query}

INSTRUCTIONS:
1. Use ONLY Razor syntax (no parentheses in control structures!)
2. Use proper Razor syntax: if findtype 'item' container as var (NOT if (findtype(...)))
3. Use item names or graphic IDs with findtype, NEVER serial numbers
4. Provide clear, working Razor scripts
5. Include comments explaining the script
6. Use proper Razor control structures: if ... endif, while ... endwhile

Generate a helpful response:"""
    
    print(f"\nFull prompt length: {len(prompt)} characters")
    print(f"Prompt preview (last 500 chars):")
    print("-" * 40)
    print(prompt[-500:])
    print("-" * 40)
    
    return prompt, citations

def test_ai_response(prompt):
    """Test what response we get from the AI"""
    print("\n" + "=" * 60)
    print("🎯 TESTING AI RESPONSE")
    print("=" * 60)
    
    try:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        ai_response = response.choices[0].message.content
        print(f"AI Response length: {len(ai_response)} characters")
        print(f"AI Response:")
        print("-" * 40)
        print(ai_response)
        print("-" * 40)
        
        return ai_response
        
    except Exception as e:
        print(f"Error calling AI: {e}")
        return None

def main():
    """Main test function"""
    print("🚀 AI AGENT DEBUG TOOL")
    print("This tool helps you see exactly what we're sending to the AI agent")
    
    # Test query
    query = "fishing script"
    
    # Step 1: Test rules loading
    rules = test_rules_loading()
    
    # Step 2: Test context retrieval
    doc_chunks, script_chunks = test_context_retrieval(query)
    
    # Step 3: Test script suggestions
    suggestions = test_script_suggestions(query)
    
    # Step 4: Test AI prompt construction
    prompt, citations = test_ai_prompt(query, rules, doc_chunks, script_chunks)
    
    # Step 5: Test AI response (optional - requires API key)
    if os.getenv("OPENAI_API_KEY"):
        print("\n" + "=" * 60)
        print("⚠️  CALLING AI API (this will use your OpenAI credits)")
        print("=" * 60)
        user_input = input("Do you want to test the actual AI response? (y/n): ")
        if user_input.lower() == 'y':
            ai_response = test_ai_response(prompt)
        else:
            print("Skipping AI API call")
    else:
        print("\n" + "=" * 60)
        print("⚠️  No OpenAI API key found - skipping AI response test")
        print("=" * 60)
    
    print("\n" + "=" * 60)
    print("✅ DEBUG TEST COMPLETE")
    print("=" * 60)
    print("Summary:")
    print(f"- Rules loaded: {len(rules)} characters")
    print(f"- Documentation chunks: {len(doc_chunks)}")
    print(f"- Script chunks: {len(script_chunks)}")
    print(f"- Script suggestions: {len(suggestions)}")
    print(f"- Prompt length: {len(prompt)} characters")

if __name__ == "__main__":
    main()
    
    print("\nWaiting 2 seconds...")
    import time
    time.sleep(2)
