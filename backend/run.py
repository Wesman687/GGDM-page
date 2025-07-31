#!/usr/bin/env python3
"""
Simple runner script for the Dockmaster Suggestion Portal API
Usage: python run.py
"""

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Get configuration from environment or use defaults
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "7000"))
    reload = os.getenv("RELOAD", "true").lower() in ("true", "1", "yes")
    
    print(f"🚀 Starting Dockmaster Suggestion Portal API...")
    print(f"📡 Server will be available at: http://{host}:{port}")
    print(f"📚 API Documentation at: http://{host}:{port}/docs")
    print(f"🔄 Auto-reload: {'Enabled' if reload else 'Disabled'}")
    print("=" * 50)
    
    # Start the server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
