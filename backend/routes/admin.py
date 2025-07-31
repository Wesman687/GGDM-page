from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import requests
from datetime import datetime
from typing import List
import os
from models import SuggestionUpdate, Suggestion, GitHubPRResponse, DockmasterEntry, AdminCreate, Admin
from database import get_db, SuggestionDB, AdminDB
from routes.suggestions import db_suggestion_to_pydantic
from routes.github import get_github_headers, get_repo_info

router = APIRouter()

def get_super_admin_ids():
    """Get list of super admin Discord IDs from environment"""
    super_admin_ids = os.getenv("SUPER_ADMIN_IDS", "").split(",")
    return [id.strip() for id in super_admin_ids if id.strip()]

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
    return await create_github_pr_internal(suggestion, db, db_suggestion)

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
        
        branch_response = requests.post(create_branch_url, json=branch_data, headers=headers)
        
        if branch_response.status_code != 201:
            raise HTTPException(status_code=500, detail="Failed to create branch")
        
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
    """Apply the suggestion changes to the file content"""
    lines = content.strip().split('\n')
    
    if suggestion.action == "add":
        # Add new dockmaster entry
        new_line = f"{suggestion.zone_id}\t{suggestion.x}\t{suggestion.y}\t{suggestion.map}\t{str(suggestion.enabled).lower()}"
        
        # Find appropriate place to insert (alphabetically by zone_id)
        insert_index = len(lines)
        for i, line in enumerate(lines):
            if line.strip() and not line.startswith('#'):
                parts = line.split('\t') if '\t' in line else line.split()
                if len(parts) > 0 and parts[0] > suggestion.zone_id:
                    insert_index = i
                    break
        
        lines.insert(insert_index, new_line)
        
    elif suggestion.action == "remove":
        # Remove existing dockmaster entry
        lines = [line for line in lines 
                if not (line.strip() and 
                       not line.startswith('#') and 
                       (line.split('\t')[0] if '\t' in line else line.split()[0]) == suggestion.zone_id)]
    
    return '\n'.join(lines) + '\n'

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
