# Script Scraping and Management Setup

This guide explains how to set up automated script scraping and management for the DM Portal.

## Overview

The system now supports:
- **Bulk script updates** from JSONL files
- **Automated scraping** on a schedule (daily/weekly)
- **AI reindexing** after script updates
- **Admin interface** for managing script updates
- **Deduplication** to avoid duplicate scripts

## Files Created

### Backend Files
- `backend/script_manager.py` - Core script management utilities
- `backend/scheduled_scraper.py` - Automated scraping scheduler
- `backend/routes/scripts_additional.py` - Additional API endpoints
- `backend/add_new_scripts.py` - Simple script to add new scripts

### Frontend Files
- `frontend/pages/admin/scripts.tsx` - Admin interface for script management

## Quick Start

### 1. Add Your New Scripts

Once you have your new JSONL file with the 900+ scripts:

```bash
# Navigate to backend directory
cd backend

# Add scripts from your JSONL file
python add_new_scripts.py path/to/your/new_scripts.jsonl

# Or use the default outlands.jsonl
python add_new_scripts.py
```

### 2. Manual Update via Admin Interface

1. Go to `/admin/scripts` in your browser
2. Upload your JSONL file
3. Click "Bulk Update"
4. Click "Reindex AI" to update the AI system

### 3. Set Up Automated Scraping

```bash
# Run once immediately
python scheduled_scraper.py once

# Set up daily scraping (runs at 2 AM)
python scheduled_scraper.py schedule daily

# Set up weekly scraping (runs Monday at 2 AM)
python scheduled_scraper.py schedule weekly

# Manual update from file
python scheduled_scraper.py manual path/to/scripts.jsonl
```

## API Endpoints

### Bulk Update Scripts
```
POST /api/scripts/bulk-update
Content-Type: application/json

{
  "scripts_data": [
    {
      "title": "Script Title",
      "author": "Author Name",
      "category": "Fishing",
      "tags": ["fishing", "boat"],
      "description": "Script description",
      "code": "script code here",
      "url": "https://outlands.uorazorscripts.com/script/..."
    }
  ]
}
```

### Reindex AI
```
POST /api/scripts/reindex-ai
```

### Get Script Statistics
```
GET /api/scripts/stats
```

## JSONL Format

Your scraper should output JSONL format where each line is a JSON object:

```jsonl
{"title": "Script 1", "author": "Author", "category": "Fishing", "tags": ["fishing"], "description": "Description", "code": "code here", "url": "https://..."}
{"title": "Script 2", "author": "Author", "category": "PvP", "tags": ["pvp"], "description": "Description", "code": "code here", "url": "https://..."}
```

## Automated Scraping Setup

### Option 1: Cron Job (Linux/Mac)
```bash
# Edit crontab
crontab -e

# Add daily scraping at 2 AM
0 2 * * * cd /path/to/dm-portal/backend && python scheduled_scraper.py once
```

### Option 2: Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to daily at 2 AM
4. Set action to run: `python scheduled_scraper.py once`
5. Set working directory to your backend folder

### Option 3: Systemd Service (Linux)
Create `/etc/systemd/system/dm-portal-scraper.service`:
```ini
[Unit]
Description=DM Portal Script Scraper
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/dm-portal/backend
ExecStart=/usr/bin/python3 scheduled_scraper.py schedule daily
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable with:
```bash
sudo systemctl enable dm-portal-scraper
sudo systemctl start dm-portal-scraper
```

## Monitoring

### Logs
- Scraper logs: `backend/scraper.log`
- Application logs: Check your FastAPI logs

### Admin Interface
- Visit `/admin/scripts` to see:
  - Total script count
  - Approved vs pending scripts
  - Last update time
  - Manual update controls

## Troubleshooting

### Common Issues

1. **AI Server Not Running**
   - Make sure AI service is running on port 7001
   - Check AI server logs

2. **Database Connection Issues**
   - Verify database is running
   - Check connection string in `.env`

3. **File Not Found**
   - Ensure JSONL file path is correct
   - Check file permissions

4. **Memory Issues with Large Files**
   - Process scripts in batches
   - Use the manual update function

### Performance Tips

1. **Large Script Files**
   - Process in batches of 100-200 scripts
   - Use the manual update function for large files

2. **Frequent Updates**
   - Use daily scraping instead of hourly
   - Monitor AI reindexing performance

3. **Database Optimization**
   - Regular database maintenance
   - Monitor database size

## Security Considerations

1. **API Access**
   - Bulk update endpoints require authentication
   - Only admins can trigger updates

2. **File Uploads**
   - Validate JSONL format
   - Sanitize script content

3. **Automated Scraping**
   - Run with limited permissions
   - Monitor for unusual activity

## Next Steps

1. **Test the system** with a small batch of scripts
2. **Set up monitoring** for the scraping process
3. **Configure automated scraping** based on your needs
4. **Monitor performance** and adjust as needed

## Support

If you encounter issues:
1. Check the logs in `backend/scraper.log`
2. Verify all services are running
3. Test with a small JSONL file first
4. Check the admin interface for error messages
