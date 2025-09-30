import math
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from enum import Enum, auto

@dataclass
class Point:
    x: int
    y: int

@dataclass
class Zone:
    min_x: int
    max_x: int
    min_y: int
    max_y: int
    primary_direction: str  # N, S, E, W, or XD

class Direction(Enum):
    NORTH = auto()
    SOUTH = auto()
    EAST = auto()
    WEST = auto()
    XD = auto()

from typing import List

class ComplexZone:
    def __init__(self, name: str, primary_direction: str):
        self.name = name
        self.primary_direction = primary_direction
        self.regions: List[Zone] = []

    def add_region(self, min_x: int, max_x: int, min_y: int, max_y: int):
        self.regions.append(Zone(min_x=min_x, max_x=max_x, min_y=min_y, max_y=max_y, primary_direction=self.primary_direction))

    def contains_point(self, point: Point) -> bool:
        return any(
            region.min_x <= point.x <= region.max_x and
            region.min_y <= point.y <= region.max_y
            for region in self.regions
        )

# Define complex zones with multiple regions
COMPLEX_ZONES = {
    "XD": ComplexZone("XD", "XD"),
    "SOUTH": ComplexZone("SOUTH", "S"),
    "EAST": ComplexZone("EAST", "E"),
    "WEST": ComplexZone("WEST", "W"),
}

# XD Zone: x:3000-5000, y:2000-4000
COMPLEX_ZONES["XD"].add_region(min_x=3000, max_x=5000, min_y=2000, max_y=4000)

# South Zone - Multiple regions
# Main southern area
COMPLEX_ZONES["SOUTH"].add_region(min_x=0, max_x=3000, min_y=2500, max_y=3000)
# Extended area
COMPLEX_ZONES["SOUTH"].add_region(min_x=0, max_x=3500, min_y=3500, max_y=4000)
# South Islands
COMPLEX_ZONES["SOUTH"].add_region(min_x=0, max_x=3500, min_y=4000, max_y=3400)

# East Zone
COMPLEX_ZONES["EAST"].add_region(min_x=3200, max_x=5000, min_y=0, max_y=2000)

# West Zone - Complex shape
COMPLEX_ZONES["WEST"].add_region(min_x=0, max_x=800, min_y=0, max_y=600)
COMPLEX_ZONES["WEST"].add_region(min_x=0, max_x=1300, min_y=700, max_y=800)
COMPLEX_ZONES["WEST"].add_region(min_x=0, max_x=1500, min_y=800, max_y=1000)
COMPLEX_ZONES["WEST"].add_region(min_x=0, max_x=3600, min_y=1000, max_y=2500)

def calculate_distance(p1: Point, p2: Point) -> float:
    """Calculate Euclidean distance between two points."""
    return math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)

def get_zone_for_point(point: Point) -> Optional[str]:
    """Determine which zone a point belongs to."""
    # XD zone takes absolute priority if coordinates are in its range
    if 3000 <= point.x <= 5000 and 2000 <= point.y <= 4000:
        return "XD"
        
    # Check other zones in priority order (S > E > W)
    priority_order = ["SOUTH", "EAST", "WEST"]
    
    for zone_name in priority_order:
        zone = COMPLEX_ZONES[zone_name]
        if zone.contains_point(point):
            return zone_name
    return None

def is_transition_point(point: Point, threshold: int = 200) -> bool:
    """
    Determine if a point is in a transition area between zones.
    Returns True if the point is near the boundary of any zone or if it's in multiple zones.
    """
    # Count how many zones this point could belong to
    matching_zones = sum(1 for zone in COMPLEX_ZONES.values() if zone.contains_point(point))
    if matching_zones > 1:
        return True
    
    # Check if we're near any zone boundaries
    for zone in COMPLEX_ZONES.values():
        for region in zone.regions:
            # Check if point is near any region boundary
            near_x_boundary = (
                abs(point.x - region.min_x) <= threshold or 
                abs(point.x - region.max_x) <= threshold
            )
            near_y_boundary = (
                abs(point.y - region.min_y) <= threshold or 
                abs(point.y - region.max_y) <= threshold
            )
            if near_x_boundary or near_y_boundary:
                return True
    return False

def validate_dockmaster_match(point: Point, matched_dm: str) -> bool:
    """
    Validate if a matched dockmaster makes sense for the given coordinates.
    Returns True if the match is valid, False otherwise.
    """
    # For XD zone, strictly enforce boundaries
    if 3000 <= point.x <= 5000 and 2000 <= point.y <= 4000:
        return matched_dm.startswith("XD")
        
    zone = get_zone_for_point(point)
    if not zone:
        return False
    
    # Handle XD zone specially
    if zone == "XD":
        return matched_dm.startswith("XD")
        
    # For cardinal directions, extract direction from the end
    if "-" in matched_dm:
        dm_direction = matched_dm.split("-")[-1]
    else:
        # If no hyphen, take the last character
        dm_direction = matched_dm[-1]
    
    # Prevent N matches in XD zone
    if dm_direction == "N" and 3000 <= point.x <= 5000 and 2000 <= point.y <= 4000:
        return False
    
    # For cardinal directions
    zone_obj = COMPLEX_ZONES[zone]
    return dm_direction == zone_obj.primary_direction

def suggest_correct_dockmaster(point: Point, available_dockmasters: List[str]) -> Optional[str]:
    """
    Suggest the most appropriate dockmaster based on coordinates.
    """
    zone = get_zone_for_point(point)
    if not zone:
        return None
    
    # Filter dockmasters that match the zone
    valid_dms = []
    for dm in available_dockmasters:
        if zone == "XD":
            if dm.startswith("XD-"):
                valid_dms.append(dm)
        else:
            zone_obj = COMPLEX_ZONES[zone]
            if dm.endswith(zone_obj.primary_direction):
                valid_dms.append(dm)
    
    return valid_dms[0] if valid_dms else None

# Example usage and test cases
def run_tests():
    test_cases = [
        # XD Zone tests
        {"coords": Point(6500, 3000), "expected_zone": "XD", "valid_dm": "XD-1"},
        {"coords": Point(7000, 2000), "expected_zone": "XD", "valid_dm": "XD-2"},
        
        # South zone tests
        {"coords": Point(3000, 5000), "expected_zone": "SOUTH", "valid_dm": "1A-S"},
        {"coords": Point(2000, 4500), "expected_zone": "SOUTH", "valid_dm": "2B-S"},
        
        # North zone tests
        {"coords": Point(3000, 1000), "expected_zone": "NORTH", "valid_dm": "3A-N"},
        {"coords": Point(2000, 500), "expected_zone": "NORTH", "valid_dm": "4B-N"},
        
        # Transition zone tests
        {"coords": Point(6000, 3000), "expected_zone": "XD", "is_transition": True},
        {"coords": Point(4000, 2000), "expected_zone": "EAST", "is_transition": True},
    ]
    
    for i, test in enumerate(test_cases, 1):
        point = test["coords"]
        zone = get_zone_for_point(point)
        is_transition = is_transition_point(point)
        
        print(f"\nTest Case {i}:")
        print(f"Coordinates: ({point.x}, {point.y})")
        print(f"Detected Zone: {zone}")
        print(f"Expected Zone: {test['expected_zone']}")
        print(f"Is Transition Point: {is_transition}")
        
        if "valid_dm" in test:
            is_valid = validate_dockmaster_match(point, test["valid_dm"])
            print(f"Valid DM '{test['valid_dm']}': {is_valid}")

if __name__ == "__main__":
    run_tests()
