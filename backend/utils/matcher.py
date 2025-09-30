import re
from typing import List, Optional, Tuple
from models import DockmasterEntry
import math
from .zone_validator import Point, get_zone_for_point, validate_dockmaster_match, is_transition_point

# Regex pattern for both traditional and XD dockmasters (after formatting)
DOCKMASTER_ID_PATTERN = r"(?:\d+[A-Z]?-[NSEW]|XD\d+)"  # Note: XD format no longer requires hyphen

def format_dockmaster_id(zone_id: str) -> str:
    """Format a dockmaster ID to the standardized format."""
    # Clean the input
    zone_id = zone_id.strip().upper()
    
    # Handle XD format
    xd_match = re.match(r"XD-?\s*(\d+)", zone_id, re.IGNORECASE)
    if xd_match:
        return f"XD{xd_match.group(1)}"  # Format as XD1, XD2, etc. without hyphen
    
    # Handle regular format (e.g., 1A-S, 1AS)
    regular_match = re.match(r"(\d+)([A-Z])?-?([NSEW])", zone_id)
    if regular_match:
        num, letter, direction = regular_match.groups()
        return f"{num}{letter or ''}-{direction}"
    
    return zone_id

def validate_dockmaster_id(zone_id: str) -> bool:
    """Validate a dockmaster ID against the allowed patterns."""
    # Try to format the ID first
    formatted_id = format_dockmaster_id(zone_id)
    
    # Handle XD zone format (allow one or two digits)
    if re.match(r"XD\d{1,2}", formatted_id):
        return True
    
    # Handle regular zone IDs
    if re.match(r"\d+[A-Z]?-[NSEW]", formatted_id):
        return True
        
    raise ValueError("Zone ID must be in format like '1A-S' or 'XD1' (caps and hyphens will be auto-formatted)")

def calculate_distance(x1: int, y1: int, x2: int, y2: int) -> float:
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

def is_reference_point(entry: DockmasterEntry) -> bool:
    """Check if an entry is a reference-only point (e.g., contains 6142)."""
    return "6142" in str(entry.x) or "6142" in str(entry.y)

def find_transition_zones(entries: List[DockmasterEntry], distance_threshold: int = 100) -> List[List[DockmasterEntry]]:
    """Identify potential transition zones based on proximity."""
    zones = []
    processed = set()

    for entry in entries:
        if entry.zone_id in processed or is_reference_point(entry):
            continue

        # Check if this point is in a transition zone
        if is_transition_point(Point(entry.x, entry.y)):
            zone = [entry]
            for other in entries:
                if other.zone_id == entry.zone_id or other.zone_id in processed or is_reference_point(other):
                    continue

                if is_transition_point(Point(other.x, other.y)):
                    distance = calculate_distance(entry.x, entry.y, other.x, other.y)
                    if distance <= distance_threshold:
                        zone.append(other)

            if len(zone) > 1:
                zones.append(zone)
                processed.update(e.zone_id for e in zone)

    return zones

def find_nearest_dockmaster(
    x: int,
    y: int,
    entries: List[DockmasterEntry],
    confidence_threshold: float = 0.8
) -> Tuple[Optional[DockmasterEntry], float]:
    """
    Find the nearest dockmaster to given coordinates.
    Returns (dockmaster, confidence_score).
    """
    if not entries:
        return None, 0.0

    # First, remove all reference points (y=6142)
    filtered_entries = [e for e in entries if not is_reference_point(e)]
    if not filtered_entries:
        return None, 0.0

    point = Point(x, y)
    
    # For coordinates in XD zone, only consider XD dockmasters
    if 3000 <= x <= 5000 and 2000 <= y <= 4000:
        # Filter to only XD dockmasters
        valid_entries = [e for e in filtered_entries if e.zone_id.startswith("XD")]
        if not valid_entries:
            return None, 0.0
            
        # Find nearest XD dockmaster
        distances = [(e, calculate_distance(x, y, e.x, e.y)) for e in valid_entries]
        distances.sort(key=lambda x: x[1])
        nearest = distances[0][0]
        confidence = 0.9  # High confidence for XD zone matches
        
        return nearest, confidence
        
    # For other coordinates, proceed with normal zone matching
    zone = get_zone_for_point(point)
    if not zone:
        return None, 0.0

    # Filter out reference points and non-matching zone dockmasters
    valid_entries = []
    for entry in filtered_entries:  # Use filtered_entries instead of entries
        # For XD zone coordinates, only allow XD dockmasters
        if 3000 <= x <= 5000 and 2000 <= y <= 4000:
            if entry.zone_id.startswith("XD"):
                valid_entries.append(entry)
        # For other zones, validate normally (excluding N dockmasters in XD zone)
        elif not (entry.zone_id.endswith("-N") and 3000 <= x <= 5000 and 2000 <= y <= 4000):
            if validate_dockmaster_match(point, entry.zone_id):
                valid_entries.append(entry)

    if not valid_entries:
        return None, 0.0

    # Calculate distances and sort
    distances = [(e, calculate_distance(x, y, e.x, e.y)) for e in valid_entries]
    distances.sort(key=lambda x: x[1])

    nearest, min_distance = distances[0]
    
    # Base confidence calculation
    confidence = 1.0

    # If there's more than one option, adjust confidence based on distances
    if len(distances) > 1:
        second_nearest, second_distance = distances[1]
        distance_ratio = min_distance / second_distance
        confidence *= (1.0 - distance_ratio)

    # Check if this is in a transition zone
    if is_transition_point(point):
        confidence *= 0.8
        nearest.transition_zone = f"transition_{zone}"

    # Extra confidence reduction for XD zone matches
    if zone == "XD":
        confidence *= 0.9  # Be a bit more conservative with XD matches

    return nearest, confidence

def should_prompt_for_verification(confidence: float, threshold: float = 0.8) -> bool:
    """Determine if human verification is needed based on confidence score."""
    return confidence < threshold
