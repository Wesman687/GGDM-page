from fastapi import APIRouter, HTTPException, Depends
import requests
import os
from typing import List
from models import DockmasterEntry

router = APIRouter()

def get_github_headers():
    token = os.getenv("GITHUB_TOKEN")
    if not token or token == "your_github_token_here":
        raise HTTPException(
            status_code=500, 
            detail="GitHub token not configured. Please set GITHUB_TOKEN in your .env file. Visit: https://github.com/settings/tokens"
        )
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

def get_repo_info():
    return {
        "owner": os.getenv("GITHUB_REPO_OWNER", "LeoPiro"),
        "repo": os.getenv("GITHUB_REPO_NAME", "GG_Dms"),
        "file_path": os.getenv("GITHUB_FILE_PATH", "GG DOCKMASTERS.txt")
    }

@router.get("/raw-content")
async def get_raw_content():
    """Get raw content from GitHub file for debugging"""
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Get file content from GitHub
        url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"GitHub API error: {response.status_code}")
        
        file_data = response.json()
        
        # Decode base64 content
        import base64
        content = base64.b64decode(file_data["content"]).decode("utf-8")
        
        # Split into lines for analysis
        lines = content.strip().split('\n')
        
        return {
            "file_info": {
                "name": file_data["name"],
                "size": file_data["size"],
                "encoding": file_data["encoding"]
            },
            "content": content,
            "lines": lines,
            "line_count": len(lines),
            "non_empty_lines": [line for line in lines if line.strip()],
            "parsing_analysis": [
                {
                    "line_number": i + 1,
                    "content": line,
                    "parts_by_tab": line.split('\t') if '\t' in line else None,
                    "parts_by_space": line.split() if line.strip() else None,
                    "is_comment": line.strip().startswith('#'),
                    "is_empty": not line.strip()
                }
                for i, line in enumerate(lines[:10])  # First 10 lines for analysis
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get raw content: {str(e)}")

@router.get("/test-connection")
async def test_github_connection():
    """Test GitHub API connection and token validity"""
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Test basic GitHub API access
        url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 401:
            return {
                "status": "error",
                "message": "Invalid GitHub token. Please check your GITHUB_TOKEN in .env file.",
                "repo_info": repo_info
            }
        elif response.status_code == 404:
            return {
                "status": "error", 
                "message": f"Repository not found: {repo_info['owner']}/{repo_info['repo']}",
                "repo_info": repo_info
            }
        elif response.status_code == 200:
            repo_data = response.json()
            return {
                "status": "success",
                "message": "GitHub connection successful!",
                "repo_info": repo_info,
                "repo_details": {
                    "name": repo_data["name"],
                    "private": repo_data["private"],
                    "default_branch": repo_data["default_branch"]
                }
            }
        else:
            return {
                "status": "error",
                "message": f"GitHub API error: {response.status_code}",
                "repo_info": repo_info
            }
            
    except HTTPException as e:
        return {
            "status": "error",
            "message": e.detail,
            "repo_info": get_repo_info()
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Connection test failed: {str(e)}",
            "repo_info": get_repo_info()
        }

@router.get("/dockmasters", response_model=List[DockmasterEntry])
async def get_dockmasters():
    """Get current Dockmasters from GitHub repository"""
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Get file content from GitHub
        url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Dockmasters file not found in repository")
        elif response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"GitHub API error: {response.status_code}")
        
        file_data = response.json()
        
        # Decode base64 content
        import base64
        content = base64.b64decode(file_data["content"]).decode("utf-8")
        
        # Parse the content
        dockmasters = []
        lines = content.strip().split('\n')
        parsing_errors = []
        
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
                    x_coord = int(parts[1])
                    y_coord = int(parts[2])
                    map_id = int(parts[3])
                    
                    dockmaster = DockmasterEntry(
                        zone_id=parts[0],
                        x=x_coord,
                        y=y_coord,
                        map=map_id,
                        enabled=parts[4].lower() in ['true', '1', 'yes', 'enabled']
                    )
                    dockmasters.append(dockmaster)
                except (ValueError, IndexError) as e:
                    error_msg = f"Line {line_num}: '{original_line}' -> '{line}' - {str(e)}"
                    parsing_errors.append(error_msg)
                    print(error_msg)
                    continue
            elif len(parts) > 0:  # Non-empty line but insufficient parts
                error_msg = f"Line {line_num}: '{original_line}' -> '{line}' - Expected 5 parts (zone_id, x, y, map, enabled), got {len(parts)}: {parts}"
                parsing_errors.append(error_msg)
                print(error_msg)
        
        print(f"Successfully parsed {len(dockmasters)} dockmasters from {len(lines)} lines")
        if parsing_errors:
            print(f"Parsing errors ({len(parsing_errors)}): {parsing_errors[:5]}...")  # Show first 5 errors
        
        return dockmasters
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from GitHub: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/file-info")
async def get_file_info():
    """Get metadata about the Dockmasters file"""
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"GitHub API error: {response.status_code}")
        
        file_data = response.json()
        
        return {
            "name": file_data["name"],
            "size": file_data["size"],
            "sha": file_data["sha"],
            "last_modified": file_data.get("last_modified"),
            "download_url": file_data["download_url"]
        }
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file info: {str(e)}")

async def update_github_file(content: str, commit_message: str, branch_name: str = None):
    """Update the Dockmasters file in GitHub"""
    try:
        repo_info = get_repo_info()
        headers = get_github_headers()
        
        # Get current file SHA
        url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/contents/{repo_info['file_path']}"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get current file SHA")
        
        current_file = response.json()
        current_sha = current_file["sha"]
        
        # Create/update file
        import base64
        encoded_content = base64.b64encode(content.encode()).decode()
        
        update_data = {
            "message": commit_message,
            "content": encoded_content,
            "sha": current_sha
        }
        
        if branch_name:
            update_data["branch"] = branch_name
        
        response = requests.put(url, json=update_data, headers=headers)
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"Failed to update file: {response.status_code}")
        
        return response.json()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update GitHub file: {str(e)}")
