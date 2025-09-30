#!/usr/bin/env python3
"""
Setup script for the UO Outlands Razor Script scraper
"""

import subprocess
import sys
import os
from pathlib import Path

def install_playwright():
    """Install playwright and its browsers"""
    print("Installing Playwright...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
        print("Installing Playwright browsers...")
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        print("✅ Playwright installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Playwright: {e}")
        return False

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import playwright
        print("✅ Playwright is installed")
        return True
    except ImportError:
        print("❌ Playwright is not installed")
        return False

def create_directories():
    """Create necessary directories"""
    directories = [
        "scraped_data",
        "logs"
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✅ Created directory: {directory}")

def main():
    print("🚀 Setting up UO Outlands Razor Script Scraper")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path("scraper.py").exists():
        print("❌ Please run this script from the backend directory")
        sys.exit(1)
    
    # Create directories
    create_directories()
    
    # Check dependencies
    if not check_dependencies():
        print("\n📦 Installing dependencies...")
        if not install_playwright():
            print("❌ Setup failed")
            sys.exit(1)
    
    print("\n✅ Setup complete!")
    print("\n📋 Next steps:")
    print("1. Run the scraper: python scraper.py")
    print("2. Or run with options: python scraper.py --help")
    print("3. Check scraped_data/ for output files")
    print("\n🔧 Common commands:")
    print("  python scraper.py --out scraped_data/new_scripts.jsonl")
    print("  python scraper.py --limit 100 --headful")
    print("  python scraper.py --no-cache")

if __name__ == "__main__":
    main()
