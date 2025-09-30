import re
from typing import List

def split_markdown(text: str, max_chars: int = 1200, overlap: int = 150) -> List[str]:
    """Split markdown text into chunks based on headers and size limits."""
    parts = re.split(r'(?m)^#{1,6}\s', text)
    return _window(parts, max_chars, overlap)

def split_code(text: str, max_chars: int = 1200, overlap: int = 150) -> List[str]:
    """Split code text into chunks based on blank lines and size limits."""
    blocks = re.split(r'\n\s*\n', text)  # Split on blank lines
    return _window(blocks, max_chars, overlap)

def split_razor_script(text: str, max_chars: int = 1200, overlap: int = 150) -> List[str]:
    """Split Razor script text into logical chunks."""
    # Split on major control structures and comments
    parts = re.split(r'(?m)^(#.*$|@setvar!.*$|if\s|while\s|for\s)', text)
    return _window(parts, max_chars, overlap)

def _window(parts: List[str], max_chars: int, overlap: int) -> List[str]:
    """Create overlapping windows from text parts."""
    chunks = []
    for part in parts:
        part = (part or "").strip()
        if not part:
            continue
        
        # If part is too long, split it further
        while len(part) > max_chars:
            # Try to split at a good break point
            cut = part.rfind("\n\n", 0, max_chars)
            if cut < 300:  # If no good break point, cut at max_chars
                cut = max_chars
            
            chunks.append(part[:cut].strip())
            part = part[cut - overlap:].strip()
        
        if part:
            chunks.append(part)
    
    return chunks

def clean_text(text: str) -> str:
    """Clean text for better chunking."""
    # Remove excessive whitespace
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    # Remove trailing whitespace
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
    return text.strip()
