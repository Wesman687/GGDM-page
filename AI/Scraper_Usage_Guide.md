# UO Outlands Razor Script Scraper - Usage Guide

## Overview

This scraper automatically extracts all Razor scripts from the UO Outlands Razor Scripts website and saves them in JSONL format for integration with the DM Portal.

## Files Created

- `backend/scraper.py` - Main scraper script
- `backend/visited_urls.txt` - Cache of visited URLs
- `backend/scraper_requirements.txt` - Dependencies
- `backend/setup_scraper.py` - Setup script
- `backend/scraped_data/` - Output directory (created automatically)

## Quick Start

### 1. Setup

```bash
cd backend
python setup_scraper.py
```

This will:
- Install Playwright and Chromium browser
- Create necessary directories
- Verify dependencies

### 2. Run Scraper

```bash
# Basic scraping (saves to scraped_data/outlands_scripts.jsonl)
python scraper.py

# With custom output file
python scraper.py --out scraped_data/my_scripts.jsonl

# Limit to first 100 scripts (for testing)
python scraper.py --limit 100

# Run with visible browser (for debugging)
python scraper.py --headful

# Ignore visited cache (re-scrape everything)
python scraper.py --no-cache
```

### 3. Add Scripts to Database

```bash
# Add scraped scripts to database
python add_new_scripts.py scraped_data/outlands_scripts.jsonl
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--out` | Output JSONL file path | `outlands_scripts.jsonl` |
| `--visited` | Visited URLs cache file | `visited_urls.txt` |
| `--limit` | Max scripts to fetch (0 = all) | `0` |
| `--headful` | Run browser non-headless | `False` |
| `--no-cache` | Ignore visited cache | `False` |
| `--flush-every` | Write to JSONL after N records | `1` |

## Output Format

The scraper outputs JSONL format where each line is a JSON object:

```json
{
  "title": "Script Title",
  "author": "Author Name", 
  "category": "Fishing",
  "tags": ["fishing", "boat"],
  "description": "Script description",
  "code": "script code here",
  "url": "https://outlands.uorazorscripts.com/script/...",
  "deleted": false
}
```

## Features

### Smart Code Extraction
- Automatically finds the main code block
- Removes line numbers and site chrome
- Handles syntax highlighting cleanup
- Detects deleted scripts

### Deduplication
- Tracks visited URLs to avoid re-scraping
- Skips scripts already in output file
- Handles deleted/tombstoned pages

### Robust Error Handling
- Continues on individual page errors
- Timeout handling for slow pages
- Comprehensive logging

### Performance Optimizations
- Infinite scroll to load all scripts
- Batch writing to avoid memory issues
- Configurable flush intervals

## Integration with DM Portal

### Manual Integration
1. Run scraper: `python scraper.py`
2. Add to database: `python add_new_scripts.py scraped_data/outlands_scripts.jsonl`
3. Reindex AI: Use admin interface or API

### Automated Integration
```bash
# Set up daily automated scraping
python scheduled_scraper.py schedule daily
```

## Troubleshooting

### Common Issues

1. **Playwright Not Installed**
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. **Browser Launch Fails**
   - Try `--headful` to see browser
   - Check if Chromium is installed
   - Run `python setup_scraper.py`

3. **Timeout Errors**
   - Increase timeout: modify `TIMEOUT_MS` in scraper.py
   - Check internet connection
   - Try `--limit 10` for testing

4. **Memory Issues**
   - Use `--flush-every 10` for large batches
   - Process in smaller chunks

5. **Site Changes**
   - Update selectors in `extract_detail()` function
   - Check if site structure changed

### Debug Mode

```bash
# Run with visible browser and verbose output
python scraper.py --headful --limit 5
```

### Logs

Check the console output for:
- `[+]` Success messages
- `[!]` Warning/error messages
- `[-]` Skipped items

## Performance Tips

### For Large Scrapes
- Use `--flush-every 50` to write in batches
- Monitor memory usage
- Consider running overnight

### For Regular Updates
- Use visited cache (default behavior)
- Only new scripts will be scraped
- Much faster on subsequent runs

### For Testing
- Use `--limit 10` for quick tests
- Use `--headful` to see what's happening
- Check output file after each run

## Advanced Usage

### Custom Output Location
```bash
python scraper.py --out /path/to/custom/output.jsonl
```

### Resume Interrupted Scrape
```bash
# Scraper automatically resumes from visited cache
python scraper.py
```

### Clean Restart
```bash
# Remove visited cache to start fresh
rm visited_urls.txt
python scraper.py --no-cache
```

### Integration with Cron (Linux/Mac)
```bash
# Add to crontab for daily scraping at 2 AM
0 2 * * * cd /path/to/dm-portal/backend && python scheduled_scraper.py once
```

## Monitoring

### Check Progress
- Monitor console output
- Check `visited_urls.txt` for progress
- Verify output file is growing

### Verify Results
```bash
# Count scripts in output
wc -l scraped_data/outlands_scripts.jsonl

# Check a few records
head -3 scraped_data/outlands_scripts.jsonl | jq .
```

## Security Considerations

- Respects robots.txt (if implemented)
- Uses reasonable delays between requests
- Identifies as a scraper in user agent
- Doesn't overwhelm the server

## Support

If you encounter issues:
1. Check this guide first
2. Try debug mode (`--headful --limit 5`)
3. Check console output for errors
4. Verify dependencies are installed
5. Test with a small limit first

## Next Steps

After scraping:
1. **Add to Database**: Use `add_new_scripts.py`
2. **Reindex AI**: Trigger AI reindexing
3. **Set Up Automation**: Configure scheduled scraping
4. **Monitor**: Check admin interface for statistics
