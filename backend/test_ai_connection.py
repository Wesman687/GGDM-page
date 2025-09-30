#!/usr/bin/env python3
"""
Test connection to AI service
"""

import httpx
import asyncio

async def test_ai_connection():
    """Test connection to AI service."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get('http://localhost:7001/health')
            print(f"AI Service Health Check: {response.status_code}")
            print(f"Response: {response.text}")
            
            # Test AI endpoint
            ai_request = {
                "question": "test connection",
                "session_id": "test123"
            }
            response = await client.post('http://localhost:7001/ask', json=ai_request)
            print(f"AI Ask Test: {response.status_code}")
            if response.status_code == 200:
                print("✅ AI service is working!")
            else:
                print(f"❌ AI service error: {response.text}")
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ai_connection())
