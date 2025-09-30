"""
Scheduled Script Scraper
Handles automated scraping and updating of scripts
"""

import asyncio
import schedule
import time
import json
import httpx
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from script_manager import ScriptManager, load_scripts_from_jsonl
from database import get_db
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class ScheduledScraper:
    def __init__(self):
        self.ai_server_url = "http://localhost:7001"
        self.scrape_frequency = "daily"  # daily, weekly, or custom
        self.last_scrape_time = None
        self.scrape_count = 0
    
    async def scrape_and_update(self):
        """Main scraping and update function"""
        try:
            logger.info("Starting scheduled script scrape and update...")
            
            # Run the scraper first
            logger.info("Running scraper...")
            scrape_result = self.run_scraper()
            if not scrape_result:
                logger.error("Scraper failed")
                return
            
            # Get database session
            db = next(get_db())
            script_manager = ScriptManager(db)
            
            # Check if we have a new JSONL file
            jsonl_file = Path("scraped_data/outlands_scripts.jsonl")
            if not jsonl_file.exists():
                logger.warning("No JSONL file found at scraped_data/outlands_scripts.jsonl")
                return
            
            # Load scripts from file
            scripts_data = load_scripts_from_jsonl(str(jsonl_file))
            if not scripts_data:
                logger.warning("No scripts found in JSONL file")
                return
            
            logger.info(f"Found {len(scripts_data)} scripts to process")
            
            # Update scripts in database
            result = await script_manager.bulk_update_scripts(scripts_data, "scheduled_scraper")
            
            logger.info(f"Script update completed: {result}")
            
            # Trigger AI reindexing
            try:
                reindex_result = await script_manager.reindex_ai_scripts()
                logger.info(f"AI reindexing: {reindex_result}")
            except Exception as e:
                logger.error(f"AI reindexing failed: {e}")
            
            # Update scrape tracking
            self.last_scrape_time = datetime.utcnow()
            self.scrape_count += 1
            
            # Log statistics
            stats = script_manager.get_script_stats()
            logger.info(f"Database stats: {stats}")
            
            db.close()
            
        except Exception as e:
            logger.error(f"Scheduled scrape failed: {e}")
            if 'db' in locals():
                db.close()
    
    def run_scraper(self) -> bool:
        """Run the scraper script"""
        try:
            # Run the scraper
            result = subprocess.run([
                sys.executable, "scraper.py",
                "--out", "scraped_data/outlands_scripts.jsonl",
                "--visited", "visited_urls.txt",
                "--flush-every", "10"
            ], capture_output=True, text=True, timeout=3600)  # 1 hour timeout
            
            if result.returncode == 0:
                logger.info("Scraper completed successfully")
                return True
            else:
                logger.error(f"Scraper failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("Scraper timed out after 1 hour")
            return False
        except Exception as e:
            logger.error(f"Failed to run scraper: {e}")
            return False
    
    def setup_schedule(self, frequency: str = "daily"):
        """Set up the scraping schedule"""
        self.scrape_frequency = frequency
        
        if frequency == "daily":
            schedule.every().day.at("02:00").do(self.run_scrape)  # 2 AM daily
        elif frequency == "weekly":
            schedule.every().monday.at("02:00").do(self.run_scrape)  # Monday 2 AM
        elif frequency == "hourly":
            schedule.every().hour.do(self.run_scrape)
        else:
            logger.error(f"Unknown frequency: {frequency}")
            return
        
        logger.info(f"Scheduled scraping set to: {frequency}")
    
    def run_scrape(self):
        """Wrapper to run the async scrape function"""
        asyncio.run(self.scrape_and_update())
    
    def start_scheduler(self):
        """Start the scheduler loop"""
        logger.info("Starting scheduled scraper...")
        
        while True:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except KeyboardInterrupt:
                logger.info("Scheduler stopped by user")
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(60)


class ManualScraper:
    """Manual scraping utilities for immediate updates"""
    
    @staticmethod
    async def update_from_file(file_path: str, user_id: str = "manual_scraper"):
        """Manually update scripts from a file"""
        logger.info(f"Manual update from file: {file_path}")
        
        db = next(get_db())
        script_manager = ScriptManager(db)
        
        try:
            scripts_data = load_scripts_from_jsonl(file_path)
            if not scripts_data:
                logger.warning("No scripts found in file")
                return {"error": "No scripts found"}
            
            result = await script_manager.bulk_update_scripts(scripts_data, user_id)
            
            # Trigger AI reindexing
            try:
                await script_manager.reindex_ai_scripts()
                logger.info("AI reindexing completed")
            except Exception as e:
                logger.error(f"AI reindexing failed: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Manual update failed: {e}")
            return {"error": str(e)}
        finally:
            db.close()
    
    @staticmethod
    async def update_from_url(url: str, user_id: str = "manual_scraper"):
        """Update scripts from a remote URL"""
        logger.info(f"Manual update from URL: {url}")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                response.raise_for_status()
                
                # Save to temporary file
                temp_file = Path("temp_scripts.jsonl")
                temp_file.write_text(response.text, encoding='utf-8')
                
                # Update from file
                result = await ManualScraper.update_from_file(str(temp_file), user_id)
                
                # Clean up
                temp_file.unlink()
                
                return result
                
        except Exception as e:
            logger.error(f"Manual update from URL failed: {e}")
            return {"error": str(e)}


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "manual":
            # Manual update from file
            file_path = sys.argv[2] if len(sys.argv) > 2 else "frontend/outlands.jsonl"
            result = asyncio.run(ManualScraper.update_from_file(file_path))
            print(f"Manual update result: {result}")
            
        elif command == "schedule":
            # Start scheduled scraper
            frequency = sys.argv[2] if len(sys.argv) > 2 else "daily"
            scraper = ScheduledScraper()
            scraper.setup_schedule(frequency)
            scraper.start_scheduler()
            
        elif command == "once":
            # Run once immediately
            scraper = ScheduledScraper()
            asyncio.run(scraper.scrape_and_update())
            
        else:
            print("Usage:")
            print("  python scheduled_scraper.py manual [file_path]")
            print("  python scheduled_scraper.py schedule [frequency]")
            print("  python scheduled_scraper.py once")
    else:
        print("Usage:")
        print("  python scheduled_scraper.py manual [file_path]")
        print("  python scheduled_scraper.py schedule [frequency]")
        print("  python scheduled_scraper.py once")
