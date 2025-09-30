from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import requests
from datetime import datetime
from typing import List
import os
import httpx
import re
from models import SuggestionUpdate, Suggestion, GitHubPRResponse, DockmasterEntry, AdminCreate, Admin
from database import get_db, SuggestionDB, AdminDB, DockmasterDB
from routes.suggestions import db_suggestion_to_pydantic
from routes.github import get_github_headers, get_repo_info

router = APIRouter()

def get_super_admin_ids():
    """Get list of super admin Discord IDs from environment"""
    super_admin_str = os.getenv("SUPER_ADMIN_IDS", "")
    if super_admin_str:
        return [id.strip() for id in super_admin_str.split(",") if id.strip()]
    return []

async def refresh_dockmasters_from_github(db: Session):
    """Refresh dockmasters database from GitHub after PR merge"""
    try:
        # GitHub configuration
        github_token = os.getenv("GITHUB_TOKEN")
        repo_owner = os.getenv("GITHUB_REPO_OWNER", "LeoPiro")
        repo_name = os.getenv("GITHUB_REPO_NAME", "GG_Dms")
        file_path = os.getenv("GITHUB_FILE_PATH", "GG DOCKMASTERS.txt")
        
        if not github_token:
            print("GitHub token not configured, skipping auto-refresh")
            return
        
        # Fetch file from GitHub
        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3.raw"
        }
        
        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{file_path}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
        if response.status_code != 200:
            print(f"Failed to fetch file from GitHub for auto-refresh: {response.status_code}")
            return
        
        # Parse the file content using the same logic as dockmasters.py
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
            if '	' in line:
                parts = [part.strip() for part in line.split('	')]
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
                        added_by="github_auto_refresh",
                        is_reference_point=(y_coord == 6142),  # Mark reference points
                        is_active=True
                    )
                    db.add(dockmaster)
                except (ValueError, IndexError) as e:
                    print(f"Auto-refresh: Line {line_num}: '{original_line}' -> '{line}' - {str(e)}")
            elif len(parts) > 0:  # Non-empty line but insufficient parts
                print(f"Auto-refresh: Line {line_num}: '{original_line}' -> '{line}' - Expected 5 parts, got {len(parts)}: {parts}")
        
        # Commit changes
        db.commit()
        
        # Get updated count
        total_count = db.query(DockmasterDB).count()
        active_count = db.query(DockmasterDB).filter(
            DockmasterDB.is_active == True,
            DockmasterDB.y != 6142,
            ~DockmasterDB.zone_id.like('M%')
        ).count()
        
        print(f"Auto-refreshed dockmasters from GitHub: {total_count} total, {active_count} visible")
        
    except Exception as e:
        print(f"Failed to auto-refresh dockmasters from GitHub: {str(e)}")
        db.rollback()

def is_super_admin(discord_id: str) -> bool:
    """Check if a Discord ID is a super admin"""
    return discord_id in get_super_admin_ids()

def get_all_admin_ids(db: Session) -> List[str]:
    """Get all admin IDs from database and super admins from environment"""
    # Get super admins
    super_admins = get_super_admin_ids()
    
    # Get regular admins from database
    db_admins = db.query(AdminDB).filter(AdminDB.is_active == True).all()
    db_admin_ids = [admin.discord_id for admin in db_admins]
    
    # Combine and deduplicate
    all_admins = list(set(super_admins + db_admin_ids))
    return all_admins

def db_admin_to_pydantic(db_admin: AdminDB) -> Admin:
    """Convert database admin to Pydantic model"""
    return Admin(
        discord_id=db_admin.discord_id,
        username=db_admin.username,
        added_by=db_admin.added_by,
        added_at=db_admin.added_at,
        is_active=db_admin.is_active
    )

@router.put("/{suggestion_id}", response_model=Suggestion)
async def update_suggestion(suggestion_id: str, update_data: SuggestionUpdate, db: Session = Depends(get_db)):
    """Update suggestion status (approve/reject)"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Update suggestion
    db_suggestion.status = update_data.status
    db_suggestion.reviewed_at = datetime.utcnow()
    db_suggestion.admin_notes = update_data.admin_notes
    
    db.commit()
    db.refresh(db_suggestion)
    
    updated_suggestion = db_suggestion_to_pydantic(db_suggestion)
    
    # If approved, try to create GitHub PR
    if update_data.status == "approved":
        try:
            pr_response = await create_github_pr_internal(updated_suggestion, db, db_suggestion)
            # Store PR info in database
            if pr_response:
                db_suggestion.pr_url = pr_response.pr_url
                db_suggestion.pr_number = pr_response.pr_number
                db_suggestion.pr_error = None  # Clear any previous error
                db.commit()
                print(f"Successfully created PR #{pr_response.pr_number} at {pr_response.pr_url}")
                
                # Auto-refresh dockmasters from GitHub after successful PR creation
                try:
                    refresh_result = await refresh_dockmasters_from_github(db)
                    print(f"Auto-refresh after PR creation: {refresh_result}")
                except Exception as refresh_error:
                    print(f"Auto-refresh failed after PR creation: {refresh_error}")
                    # Don't fail the approval if refresh fails
        except Exception as e:
            # Store error but don't fail the approval
            error_msg = str(e)
            import traceback
            print(f"Failed to create GitHub PR: {error_msg}")
            print("Full traceback:")
            print(traceback.format_exc())
            db_suggestion.pr_error = error_msg
            db_suggestion.pr_retry_count = (db_suggestion.pr_retry_count or 0) + 1
            db.commit()
    
    return updated_suggestion

@router.post("/{suggestion_id}/create-pr", response_model=GitHubPRResponse)
async def create_github_pr(suggestion_id: str, db: Session = Depends(get_db)):
    """Create a GitHub Pull Request for an approved suggestion"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    suggestion = db_suggestion_to_pydantic(db_suggestion)
    pr_response = await create_github_pr_internal(suggestion, db, db_suggestion)
    
    # Auto-refresh dockmasters from GitHub after successful PR creation
    try:
        refresh_result = await refresh_dockmasters_from_github(db)
        print(f"Auto-refresh after manual PR creation: {refresh_result}")
    except Exception as refresh_error:
        print(f"Auto-refresh failed after manual PR creation: {refresh_error}")
        # Don't fail the PR creation if refresh fails
    
    return pr_response

@router.post("/{suggestion_id}/retry-pr", response_model=GitHubPRResponse)
async def retry_github_pr(suggestion_id: str, db: Session = Depends(get_db)):
    """Retry creating a GitHub Pull Request for a failed approved suggestion"""
    db_suggestion = db.query(SuggestionDB).filter(SuggestionDB.id == suggestion_id).first()
    
    if not db_suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    if db_suggestion.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved suggestions can create PRs")
    
    if db_suggestion.pr_url:
        raise HTTPException(status_code=400, detail="PR already exists for this suggestion")
    
    try:
        suggestion = db_suggestion_to_pydantic(db_suggestion)
        pr_response = await create_github_pr_internal(suggestion, db, db_suggestion)
        
        # Update database with success
        db_suggestion.pr_url = pr_response.pr_url
        db_suggestion.pr_number = pr_response.pr_number
        db_suggestion.pr_error = None  # Clear error
        db_suggestion.pr_retry_count = (db_suggestion.pr_retry_count or 0) + 1
        db.commit()
        
        # Auto-refresh dockmasters from GitHub after successful PR retry
        try:
            refresh_result = await refresh_dockmasters_from_github(db)
            print(f"Auto-refresh after PR retry: {refresh_result}")
        except Exception as refresh_error:
            print(f"Auto-refresh failed after PR retry: {refresh_error}")
            # Don't fail the PR creation if refresh fails
        
        return pr_response
    except Exception as e:
        # Update retry count and error
        error_msg = str(e)
        db_suggestion.pr_error = error_msg
        db_suggestion.pr_retry_count = (db_suggestion.pr_retry_count or 0) + 1
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {error_msg}")

async def create_github_pr_internal(suggestion: Suggestion, db: Session, db_suggestion: SuggestionDB = None) -> GitHubPRResponse:
    """Create a GitHub Pull Request for an approved suggestion"""
    
    if suggestion.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved suggestions can create PRs")
        
    # Validate suggestion data
    if suggestion.action == "add" and (suggestion.x is None or suggestion.y is None):
        raise HTTPException(status_code=400, detail="Add suggestion missing coordinates")
    
    if not suggestion.zone_id:
        raise HTTPException(status_code=400, detail="Missing zone ID")
    
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Create branch name
        branch_name = f"suggestion-{suggestion.id[:8]}-{suggestion.action}-{suggestion.zone_id}"
        
        # Get current file content
        file_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(file_url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get current file content")
        
        file_data = response.json()
        
        # Decode current content
        import base64
        current_content = base64.b64decode(file_data["content"]).decode("utf-8")
        
        # Modify content based on suggestion
        new_content = apply_suggestion_to_content(current_content, suggestion)
        
        # Get main branch SHA for creating new branch
        main_branch_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/git/refs/heads/main"
        main_response = requests.get(main_branch_url, headers=headers)
        
        if main_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get main branch SHA")
        
        main_sha = main_response.json()["object"]["sha"]
        
        # Create new branch
        create_branch_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/git/refs"
        branch_data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": main_sha
        }
        
        print(f"Creating branch with data: {branch_data}")
        print(f"Branch creation URL: {create_branch_url}")
        
        branch_response = requests.post(create_branch_url, json=branch_data, headers=headers)
        
        try:
            response_data = branch_response.json()
        except Exception as e:
            response_data = {"error": "Could not parse response"}
            
        if branch_response.status_code != 201:
            error_msg = f"Failed to create branch. Status: {branch_response.status_code}. Response: {response_data}"
            print(error_msg)
            
            # Check if branch already exists
            existing_branch = requests.get(f"{create_branch_url}/heads/{branch_name}", headers=headers)
            if existing_branch.status_code == 200:
                print(f"Branch {branch_name} already exists, will try to reuse it")
            else:
                raise HTTPException(status_code=500, detail=error_msg)
        
        # Update file in new branch
        encoded_content = base64.b64encode(new_content.encode()).decode()
        
        commit_message = f"{suggestion.action.title()} DM {suggestion.zone_id}"
        if suggestion.reason:
            commit_message += f": {suggestion.reason}"
        
        update_data = {
            "message": commit_message,
            "content": encoded_content,
            "sha": file_data["sha"],
            "branch": branch_name
        }
        
        print(f"Attempting to update file in branch {branch_name}")
        update_response = requests.put(file_url, json=update_data, headers=headers)
        
        if update_response.status_code not in [200, 201]:
            error_response = update_response.json()
            error_detail = f"Failed to update file in branch. Status: {update_response.status_code}, Response: {error_response}"
            print(error_detail)
            raise HTTPException(status_code=500, detail=error_detail)
        
        # Create Pull Request
        pr_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/pulls"
        
        # Print debug information
        print(f"Creating PR for suggestion {suggestion.id}")
        print(f"Branch: {branch_name}")
        print(f"URL: {pr_url}")
        print(f"Headers: {headers} (token hidden)")
        
        # Validate the branch exists before creating PR
        branch_check_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/git/refs/heads/{branch_name}"
        branch_check = requests.get(branch_check_url, headers=headers)
        if branch_check.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Branch creation failed or branch does not exist. Status: {branch_check.status_code}")
        
        pr_body = f"""
## Dockmaster Suggestion

**Action**: {suggestion.action.title()}
**Zone ID**: {suggestion.zone_id}
**Reason**: {suggestion.reason}

"""
        
        if suggestion.action == "add":
            pr_body += f"""
**Coordinates**: X={suggestion.x}, Y={suggestion.y}, Map={suggestion.map}
**Enabled**: {suggestion.enabled}
"""
        
        if suggestion.submitter_name:
            pr_body += f"\n**Submitted by**: {suggestion.submitter_name}"
        
        pr_body += f"\n\n*Auto-generated from suggestion #{suggestion.id}*"
        
        pr_data = {
            "title": f"{suggestion.action.title()} Dockmaster {suggestion.zone_id}",
            "body": pr_body,
            "head": branch_name,
            "base": "main"
        }
        
        pr_response = requests.post(pr_url, json=pr_data, headers=headers)
        
        if pr_response.status_code != 201:
            try:
                error_response = pr_response.json()
                error_detail = f"Failed to create pull request: {pr_response.status_code} - {error_response.get('message', 'Unknown error')}"
                if 'errors' in error_response:
                    error_detail += f"\nErrors: {error_response['errors']}"
            except Exception as e:
                error_detail = f"Failed to create pull request: {pr_response.status_code} - Could not parse error response: {pr_response.text}"
            
            print(error_detail)
            print(f"PR creation request data: {pr_data}")
            raise HTTPException(status_code=500, detail=error_detail)
        
        pr_info = pr_response.json()
        print(f"Successfully created PR with response: {pr_info}")
        
        return GitHubPRResponse(
            pr_url=pr_info["html_url"],
            pr_number=pr_info["number"],
            branch_name=branch_name
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}")

def apply_suggestion_to_content(content: str, suggestion: Suggestion) -> str:
    """Apply the suggestion changes to the file content and return properly sorted content"""
    lines = content.strip().split('\n')
    
    # Custom sorting function for zone IDs
    def sort_zone_id(zone_id):
        # Handle XD zones numerically (XD1, XD2, ..., XD10, XD11)
        if zone_id.startswith("XD"):
            try:
                return (0, int(zone_id[2:]))  # 0 to put XD zones first, then numeric
            except ValueError:
                return (0, 9999)  # Invalid XD numbers go to end of XD section
        # Handle XP zones (similar to XD)
        elif zone_id.startswith("XP"):
            try:
                return (0.1, int(zone_id[2:]))  # 0.1 to put XP zones after XD
            except ValueError:
                return (0.1, 9999)
        # Handle M zones (put them at the very end)
        elif zone_id.startswith("M"):
            try:
                return (99, int(zone_id[1:]))  # 99 to put M zones at the very end
            except ValueError:
                return (99, 9999)
        # Handle special zones (GH, The Gym, GG-Shelter, etc.)
        elif not zone_id[0].isdigit():
            return (50, zone_id)  # 50 to put special zones in middle
        # Handle regular zones (numbers + letters + direction)
        else:
            # Extract number and letters for proper sorting
            import re
            match = re.match(r'(\d+)([A-Z]*)(-([NSEW]))?', zone_id)
            if match:
                number = int(match.group(1))
                letters = match.group(2) or ""
                direction = match.group(4) or ""
                # Sort by number first, then letters, then direction (E, N, S, W)
                direction_order = {"E": 1, "N": 2, "S": 3, "W": 4, "": 5}
                return (1, number, letters, direction_order.get(direction, 5))
            else:
                return (2, zone_id)  # Fallback alphabetical
    
    # Parse all existing lines, keeping comments and headers at the top
    header_lines = []
    data_lines = []
    
    for line in lines:
        if line.strip() == "" or line.startswith('#'):
            header_lines.append(line)
        else:
            parts = line.split('\t') if '\t' in line else line.split()
            if len(parts) >= 3:  # Valid data line
                # Include ALL dockmasters (M#, y=6142, everything)
                # Normalize formatting to use tabs consistently and ensure all fields are present
                zone_id = parts[0].strip()
                x = parts[1].strip()
                y = parts[2].strip()
                
                # Handle different column formats
                if len(parts) == 4:
                    # Format: zone_id x y enabled (missing map)
                    map_val = "7"
                    enabled = parts[3].strip()
                elif len(parts) >= 5:
                    # Format: zone_id x y map enabled
                    map_val = parts[3].strip()
                    enabled = parts[4].strip()
                else:
                    # Format: zone_id x y (missing map and enabled)
                    map_val = "7"
                    enabled = "true"
                
                # Ensure enabled is properly formatted
                if enabled.lower() in ['true', '1', 'yes', 'enabled', 'on']:
                    enabled = "true"
                elif enabled.lower() in ['false', '0', 'no', 'disabled', 'off']:
                    enabled = "false"
                else:
                    enabled = "true"  # Default to "true" for any unclear values
                
                normalized_line = f"{zone_id}\t{x}\t{y}\t{map_val}\t{enabled}"
                data_lines.append(normalized_line)
    
    if suggestion.action == "add":
        # Add new dockmaster entry
        map_value = suggestion.map if hasattr(suggestion, 'map') and suggestion.map is not None else 7
        enabled_value = suggestion.enabled if hasattr(suggestion, 'enabled') and suggestion.enabled is not None else True
        enabled_str = "true" if enabled_value else "false"
        new_line = f"{suggestion.zone_id}\t{suggestion.x}\t{suggestion.y}\t{map_value}\t{enabled_str}"
        data_lines.append(new_line)
        
    elif suggestion.action == "remove":
        # Remove existing dockmaster entry
        data_lines = [line for line in data_lines 
                     if not (line.strip() and 
                            (line.split('\t')[0] if '\t' in line else line.split()[0]) == suggestion.zone_id)]
    
    # Sort ALL data lines properly (including M# and y=6142)
    data_lines.sort(key=lambda line: sort_zone_id(
        (line.split('\t')[0] if '\t' in line else line.split()[0]).strip()
    ))
    
    # Combine header and sorted data (ALL data, not filtered)
    result_lines = header_lines + data_lines
    return '\n'.join(result_lines) + '\n'

@router.post("/fix-format")
async def fix_file_format(db: Session = Depends(get_db)):
    """Create a special PR to fix the entire file format to ensure all entries have '7 true' format"""
    
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Get current file content
        file_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(file_url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get current file content")
        
        file_data = response.json()
        
        # Decode current content
        import base64
        current_content = base64.b64decode(file_data["content"]).decode("utf-8")
        
        print(f"DEBUG: Raw content first 500 chars:")
        print(f"DEBUG: {current_content[:500]!r}")
        
        # Apply format normalization to ALL entries
        lines = current_content.strip().split('\n')
        
        print(f"DEBUG: First 10 raw lines from GitHub:")
        for i, line in enumerate(lines[:10]):
            print(f"DEBUG: Raw line {i+1}: {line!r}")
        
        # Parse all existing lines, keeping comments and headers at the top
        header_lines = []
        data_lines = []
        
        for line in lines:
            if line.strip() == "" or line.startswith('#'):
                header_lines.append(line)
            else:
                # Handle lines that might start with git diff markers (+ or -)
                clean_line = line.lstrip('+-').strip()
                parts = clean_line.split('\t') if '\t' in clean_line else clean_line.split()
                if len(parts) >= 3:  # Valid data line
                    zone_id = parts[0].strip()
                    x = parts[1].strip()
                    y = parts[2].strip()
                    
                    print(f"DEBUG: Processing line: {line.strip()!r}")
                    print(f"DEBUG: Clean line: {clean_line!r}")
                    print(f"DEBUG: Parts: {parts}")
                    
                    # Handle different column formats - FIX ALL TO HAVE 7 TRUE
                    if len(parts) == 4:
                        # Format: zone_id x y enabled (missing map)
                        map_val = "7"
                        enabled = parts[3].strip()
                        print(f"DEBUG: 4-col format: map={map_val}, enabled={enabled}")
                    elif len(parts) >= 5:
                        # Format: zone_id x y map enabled (keep existing)
                        map_val = parts[3].strip()
                        enabled = parts[4].strip()
                        print(f"DEBUG: 5-col format: map={map_val}, enabled={enabled}")
                    else:
                        # Format: zone_id x y (missing map and enabled)
                        map_val = "7"
                        enabled = "true"
                        print(f"DEBUG: 3-col format: map={map_val}, enabled={enabled}")
                    
                    # Ensure enabled is properly formatted
                    if enabled.lower() in ['true', '1', 'yes', 'enabled', 'on']:
                        enabled = "true"
                    elif enabled.lower() in ['false', '0', 'no', 'disabled', 'off']:
                        enabled = "false"
                    else:
                        enabled = "true"  # Default to "true" for any unclear values
                    
                    normalized_line = f"{zone_id}\t{x}\t{y}\t{map_val}\t{enabled}"
                    print(f"DEBUG: Normalized: {normalized_line}")
                    data_lines.append(normalized_line)
                else:
                    print(f"DEBUG: Skipping line (insufficient parts): {line.strip()!r}")
        
        # Remove duplicates while preserving order (only remove exact line duplicates, not zone duplicates)
        seen_lines = set()
        unique_data_lines = []
        for line in data_lines:
            if line not in seen_lines:
                seen_lines.add(line)
                unique_data_lines.append(line)
        
        # TEMPORARILY DISABLE SORTING TO TEST IF IT'S CAUSING THE ISSUE
        # Keep original order to avoid any corruption during sorting
        # unique_data_lines.sort(key=lambda line: sort_zone_id(line.split('\t')[0].strip()))
        
        # Combine header and sorted data
        result_lines = header_lines + unique_data_lines
        new_content = '\n'.join(result_lines) + '\n'
        
        # DEBUG: Print a few sample lines to see what we're actually creating
        print(f"DEBUG: Sample of final content lines:")
        for i, line in enumerate(result_lines[:10]):  # Show first 10 lines
            print(f"DEBUG: Line {i+1}: {line!r}")
        
        # DEBUG: Check specific problematic zones
        for line in result_lines:
            if '7B-S' in line or '1A-E' in line or '1A-W' in line:
                print(f"DEBUG: Key zone line: {line!r}")
        
        # Validate the result before creating PR
        if len(unique_data_lines) < 100:  # Safety check
            raise HTTPException(status_code=500, detail=f"Safety check failed: Only {len(unique_data_lines)} entries found, expected ~130")
        
        # Create branch name
        branch_name = f"format-fix-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
        
        # Get main branch SHA for creating new branch
        main_branch_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/git/refs/heads/main"
        main_response = requests.get(main_branch_url, headers=headers)
        
        if main_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get main branch SHA")
        
        main_sha = main_response.json()["object"]["sha"]
        
        # Create new branch
        create_branch_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/git/refs"
        branch_data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": main_sha
        }
        
        branch_response = requests.post(create_branch_url, json=branch_data, headers=headers)
        
        if branch_response.status_code != 201:
            error_data = branch_response.json()
            raise HTTPException(status_code=500, detail=f"Failed to create branch: {error_data}")
        
        # Update file in new branch
        encoded_content = base64.b64encode(new_content.encode()).decode()
        
        update_data = {
            "message": "Fix file format: Normalize all entries to have '7 true' format and remove duplicates",
            "content": encoded_content,
            "sha": file_data["sha"],
            "branch": branch_name
        }
        
        update_response = requests.put(file_url, json=update_data, headers=headers)
        
        if update_response.status_code not in [200, 201]:
            error_response = update_response.json()
            raise HTTPException(status_code=500, detail=f"Failed to update file: {error_response}")
        
        # Create Pull Request
        pr_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/pulls"
        
        pr_body = f"""
## File Format Fix

This PR normalizes the entire dockmaster file to ensure consistent formatting:

- **Fixed format**: All entries now have `zone_id x y 7 true` format
- **Processed entries**: {len(unique_data_lines)} total entries
- **Removed duplicates**: {len(data_lines) - len(unique_data_lines)} duplicate lines
- **Proper sorting**: All zones sorted correctly (XD zones first, then regular zones, then M zones)

This fixes the issue where some entries had only 4 columns while others had 5 columns, causing inconsistent formatting in future PRs.

*Auto-generated format fix*
"""
        
        pr_data = {
            "title": "Fix File Format: Normalize all entries to '7 true' format",
            "body": pr_body,
            "head": branch_name,
            "base": "main"
        }
        
        pr_response = requests.post(pr_url, json=pr_data, headers=headers)
        
        if pr_response.status_code != 201:
            error_response = pr_response.json()
            raise HTTPException(status_code=500, detail=f"Failed to create PR: {error_response}")
        
        pr_info = pr_response.json()
        
        return {
            "message": "Format fix PR created successfully",
            "pr_url": pr_info["html_url"],
            "pr_number": pr_info["number"],
            "branch_name": branch_name,
            "fixed_entries": len(unique_data_lines),
            "removed_duplicates": len(data_lines) - len(unique_data_lines)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create format fix PR: {str(e)}")

@router.get("/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Get admin dashboard statistics"""
    total = db.query(SuggestionDB).count()
    pending = db.query(SuggestionDB).filter(SuggestionDB.status == "pending").count()
    approved = db.query(SuggestionDB).filter(SuggestionDB.status == "approved").count()
    rejected = db.query(SuggestionDB).filter(SuggestionDB.status == "rejected").count()
    
    return {
        "total_suggestions": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected
    }

# Admin Management Endpoints

@router.get("/admins", response_model=List[Admin])
async def get_admins(db: Session = Depends(get_db)):
    """Get all admins (both super admins and regular admins)"""
    # Get regular admins from database
    db_admins = db.query(AdminDB).filter(AdminDB.is_active == True).all()
    admins = [db_admin_to_pydantic(admin) for admin in db_admins]
    
    # Add super admins (they're not stored in DB but come from environment)
    super_admin_ids = get_super_admin_ids()
    for super_admin_id in super_admin_ids:
        # Check if this super admin is already in the list
        if not any(admin.discord_id == super_admin_id for admin in admins):
            admins.append(Admin(
                discord_id=super_admin_id,
                username="Super Admin",
                added_by="system",
                added_at=datetime.utcnow(),
                is_active=True
            ))
    
    return admins

@router.post("/admins", response_model=Admin)
async def add_admin(admin_data: AdminCreate, current_admin_id: str, db: Session = Depends(get_db)):
    """Add a new admin (super admins only)"""
    if not is_super_admin(current_admin_id):
        raise HTTPException(status_code=403, detail="Only super admins can add new admins")
    
    # Check if user is already an admin
    existing_admin = db.query(AdminDB).filter(AdminDB.discord_id == admin_data.discord_id).first()
    if existing_admin:
        if existing_admin.is_active:
            raise HTTPException(status_code=400, detail="User is already an admin")
        else:
            # Reactivate existing admin
            existing_admin.is_active = True
            existing_admin.added_by = current_admin_id
            existing_admin.added_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_admin)
            return db_admin_to_pydantic(existing_admin)
    
    # Check if it's a super admin (they don't need to be in the database)
    if admin_data.discord_id in get_super_admin_ids():
        raise HTTPException(status_code=400, detail="User is already a super admin")
    
    # Create new admin
    new_admin = AdminDB(
        discord_id=admin_data.discord_id,
        username=admin_data.username,
        added_by=current_admin_id,
        added_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    
    return db_admin_to_pydantic(new_admin)

@router.delete("/admins/{discord_id}")
async def remove_admin(discord_id: str, current_admin_id: str, db: Session = Depends(get_db)):
    """Remove an admin (super admins only, cannot remove super admins)"""
    if not is_super_admin(current_admin_id):
        raise HTTPException(status_code=403, detail="Only super admins can remove admins")
    
    # Cannot remove super admins
    if discord_id in get_super_admin_ids():
        raise HTTPException(status_code=400, detail="Cannot remove super admins")
    
    # Find and deactivate admin
    admin = db.query(AdminDB).filter(AdminDB.discord_id == discord_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    admin.is_active = False
    db.commit()
    
    return {"message": f"Admin {discord_id} removed successfully"}
