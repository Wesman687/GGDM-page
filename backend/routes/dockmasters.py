from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db, AdminDB, DockmasterDB
from models import DockmasterEntry
from utils.matcher import (
    find_nearest_dockmaster,
    should_prompt_for_verification,
    validate_dockmaster_id,
    find_transition_zones
)
import httpx
import os
import re

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_dockmasters(db: Session = Depends(get_db)):
    """Fetch all dockmasters."""
    dockmasters = db.query(DockmasterDB).filter(
        DockmasterDB.is_active == True,
        DockmasterDB.y != 6142,  # Filter out reference points
        ~DockmasterDB.zone_id.like('M%')  # Filter out M# grid locations
    ).all()
    
    # Convert to list for custom sorting
    dockmaster_list = [
        {
            "zone_id": dm.zone_id,
            "x": dm.x,
            "y": dm.y,
            "map": dm.map,
            "enabled": dm.enabled
        }
        for dm in dockmasters
    ]
    
    # Custom sort function to handle zone IDs properly
    def sort_zone_id(item):
        zone_id = item["zone_id"]
        # Handle XD zones numerically (XD1, XD2, ..., XD10, XD11)
        if zone_id.startswith("XD"):
            try:
                return (0, int(zone_id[2:]))  # 0 to put XD zones first, then numeric
            except ValueError:
                return (0, 9999)  # Invalid XD numbers go to end of XD section
        # Handle regular zones (numbers + letters)
        else:
            # Extract number and letters for proper sorting
            import re
            match = re.match(r'(\d+)([A-Z]*)(-.*)?', zone_id)
            if match:
                number = int(match.group(1))
                letters = match.group(2) or ""
                suffix = match.group(3) or ""
                return (1, number, letters, suffix)  # 1 to put after XD zones
            else:
                return (2, zone_id)  # Fallback alphabetical
    
    dockmaster_list.sort(key=sort_zone_id)
    return dockmaster_list

@router.post("/refresh")
async def refresh_dockmasters_from_github(db: Session = Depends(get_db)):
    """Refresh dockmasters database from GitHub."""
    try:
        # GitHub configuration
        github_token = os.getenv("GITHUB_TOKEN")
        repo_owner = os.getenv("GITHUB_REPO_OWNER", "LeoPiro")
        repo_name = os.getenv("GITHUB_REPO_NAME", "GG_Dms")
        file_path = os.getenv("GITHUB_FILE_PATH", "GG DOCKMASTERS.txt")
        
        if not github_token:
            raise HTTPException(status_code=500, detail="GitHub token not configured")
        
        # Fetch file from GitHub
        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3.raw"
        }
        
        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{file_path}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to fetch file from GitHub: {response.status_code}")
        
        # Parse the file content
        content = response.text
        lines = content.strip().split('\n')
        
        # Clear existing dockmasters
        db.query(DockmasterDB).delete()
        
        # Process each line using the same logic as github.py
        for line_num, line in enumerate(lines, 1):
            original_line = line
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
                
            # Remove leading + if present (GitHub diff format)
            if line.startswith('+'):
                line = line[1:].strip()
            
            # Skip if still empty after cleaning
            if not line:
                continue
                
            # Split by tabs first, then by multiple spaces as fallback
            if '\t' in line:
                parts = [part.strip() for part in line.split('\t')]
            else:
                # Split by whitespace and filter empty parts
                parts = [part for part in line.split() if part]
            
            # Filter out empty parts
            parts = [part for part in parts if part]
            
            if len(parts) >= 5:
                try:
                    # Validate coordinates are numeric
                    zone_id = parts[0]
                    x_coord = int(parts[1])
                    y_coord = int(parts[2])
                    map_id = int(parts[3])
                    enabled = parts[4].lower() in ['true', '1', 'yes', 'enabled']
                    
                    # Create dockmaster entry
                    dockmaster = DockmasterDB(
                        zone_id=zone_id,
                        x=x_coord,
                        y=y_coord,
                        map=map_id,
                        enabled=enabled,
                        added_by="github_refresh",
                        is_reference_point=(y_coord == 6142),  # Mark reference points
                        is_active=True
                    )
                    db.add(dockmaster)
                except (ValueError, IndexError) as e:
                    print(f"Line {line_num}: '{original_line}' -> '{line}' - {str(e)}")
            elif len(parts) > 0:  # Non-empty line but insufficient parts
                print(f"Line {line_num}: '{original_line}' -> '{line}' - Expected 5 parts, got {len(parts)}: {parts}")
        
        # Commit changes
        db.commit()
        
        # Get updated count
        total_count = db.query(DockmasterDB).count()
        active_count = db.query(DockmasterDB).filter(
            DockmasterDB.is_active == True,
            DockmasterDB.y != 6142,
            ~DockmasterDB.zone_id.like('M%')
        ).count()
        
        return {
            "message": "Dockmasters refreshed successfully from GitHub",
            "total_dockmasters": total_count,
            "active_visible_dockmasters": active_count
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to refresh dockmasters: {str(e)}")

@router.get("/match", response_model=dict)
async def match_dockmaster(
    x: int = Query(..., description="X coordinate to match"),
    y: int = Query(..., description="Y coordinate to match"),
    confidence_threshold: float = Query(0.8, description="Minimum confidence threshold"),
    db: Session = Depends(get_db)
):
    """Find the nearest dockmaster to given coordinates."""
    # Load actual dockmasters from database
    db_dockmasters = db.query(DockmasterDB).filter(DockmasterDB.enabled == True).all()
    
    entries = [
        DockmasterEntry(
            zone_id=dm.zone_id,
            x=dm.x,
            y=dm.y,
            map=dm.map,
            enabled=dm.enabled,
            is_reference_point="6142" in str(dm.x) or "6142" in str(dm.y)
        )
        for dm in db_dockmasters
    ]

    # Find nearest match
    nearest, confidence = find_nearest_dockmaster(x, y, entries)
    
    if not nearest:
        raise HTTPException(status_code=404, detail="No valid dockmaster found")

    needs_verification = should_prompt_for_verification(confidence, confidence_threshold)
    
    return {
        "match": nearest,
        "confidence": confidence,
        "needs_verification": needs_verification
    }

@router.get("/transition-zones", response_model=List[List[DockmasterEntry]])
async def get_transition_zones(distance_threshold: int = Query(100)):
    """Get all transition zones based on proximity."""
    # In a real implementation, this would load from database or file
    entries = [
        DockmasterEntry(zone_id="1A-N", x=1000, y=1000, map=7),
        DockmasterEntry(zone_id="1B-S", x=1100, y=1050, map=7),
        DockmasterEntry(zone_id="XD-1", x=2000, y=2000, map=7)
    ]

    return find_transition_zones(entries, distance_threshold)
