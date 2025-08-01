from utils.matcher import find_nearest_dockmaster
from utils.zone_validator import Point, get_zone_for_point
from models import DockmasterEntry

# Test data - representative dockmasters from each zone
TEST_DOCKMASTERS = [
    # West dockmasters (complex shape)
    DockmasterEntry(zone_id="1A-W", x=400, y=300, map=7),  # In 0-800 x, 0-600 y region
    DockmasterEntry(zone_id="2A-W", x=1000, y=750, map=7), # In 0-1300 x, 700-800 y region
    DockmasterEntry(zone_id="3A-W", x=1200, y=900, map=7), # In 0-1500 x, 800-1000 y region
    DockmasterEntry(zone_id="4A-W", x=2000, y=1500, map=7), # In 0-3600 x, 1000-2500 y region
    
    # South dockmasters
    DockmasterEntry(zone_id="1B-S", x=1500, y=2700, map=7), # In 0-3000 x, 2500-3000 y region
    DockmasterEntry(zone_id="2B-S", x=2000, y=3700, map=7), # In 0-3500 x, 3500-4000 y region
    DockmasterEntry(zone_id="3B-S", x=1500, y=3800, map=7), # South Islands region
    
    # East dockmasters
    DockmasterEntry(zone_id="3A-E", x=3800, y=1000, map=7), # In 3200-5000 x, 0-2000 y region
    DockmasterEntry(zone_id="4A-E", x=4500, y=1500, map=7),
    
    # XD dockmasters (3000-5000 x, 2000-4000 y)
    DockmasterEntry(zone_id="XD-1", x=3500, y=2500, map=7),
    DockmasterEntry(zone_id="XD-2", x=4000, y=3000, map=7),
    DockmasterEntry(zone_id="XD-3", x=4500, y=3500, map=7),
    
    # Reference points (should be ignored)
    DockmasterEntry(zone_id="REF-1", x=6142, y=3000, map=7),
    DockmasterEntry(zone_id="REF-2", x=3000, y=6142, map=7),
]

def test_matcher():
    test_cases = [
        # XD zone tests (3000-5000 x, 2000-4000 y)
        {"x": 3393, "y": 3356, "expected_zone": "XD", "expected_prefix": "XD-"},  # Specific problem case
        {"x": 3500, "y": 2500, "expected_zone": "XD", "expected_prefix": "XD-"},
        {"x": 4000, "y": 3000, "expected_zone": "XD", "expected_prefix": "XD-"},
        {"x": 4500, "y": 3500, "expected_zone": "XD", "expected_prefix": "XD-"},
        
        # South zone tests
        # Main southern area (0-3000 x, 2500-3000 y)
        {"x": 1500, "y": 2700, "expected_zone": "SOUTH", "expected_prefix": "-S"},
        # Extended area (0-3500 x, 3500-4000 y)
        {"x": 2000, "y": 3700, "expected_zone": "SOUTH", "expected_prefix": "-S"},
        # South Islands
        {"x": 1500, "y": 3800, "expected_zone": "SOUTH", "expected_prefix": "-S"},
        
        # East zone tests (3200-5000 x, 0-2000 y)
        {"x": 3800, "y": 1000, "expected_zone": "EAST", "expected_prefix": "-E"},
        {"x": 4500, "y": 1500, "expected_zone": "EAST", "expected_prefix": "-E"},
        
        # West zone tests
        # Region 1 (0-800 x, 0-600 y)
        {"x": 400, "y": 300, "expected_zone": "WEST", "expected_prefix": "-W"},
        # Region 2 (0-1300 x, 700-800 y)
        {"x": 1000, "y": 750, "expected_zone": "WEST", "expected_prefix": "-W"},
        # Region 3 (0-1500 x, 800-1000 y)
        {"x": 1200, "y": 900, "expected_zone": "WEST", "expected_prefix": "-W"},
        # Region 4 (0-3600 x, 1000-2500 y)
        {"x": 2000, "y": 1500, "expected_zone": "WEST", "expected_prefix": "-W"},
        
        # Transition zone tests
        {"x": 3000, "y": 2000, "expected_zone": "XD", "is_transition": True},  # XD boundary
        {"x": 3500, "y": 3500, "expected_zone": "SOUTH", "is_transition": True},  # South/XD overlap
    ]
    
    print("\nRunning Dockmaster Matcher Tests\n" + "="*30)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"Coordinates: ({test['x']}, {test['y']})")
        
        # Get zone
        point = Point(test['x'], test['y'])
        zone = get_zone_for_point(point)
        print(f"Detected Zone: {zone}")
        print(f"Expected Zone: {test['expected_zone']}")
        
        # Find nearest dockmaster
        nearest, confidence = find_nearest_dockmaster(test['x'], test['y'], TEST_DOCKMASTERS)
        
        if nearest:
            print(f"Matched Dockmaster: {nearest.zone_id} (confidence: {confidence:.2f})")
            
            # Verify the match is appropriate for the zone
            if test.get('expected_prefix'):
                is_correct_type = (
                    nearest.zone_id.startswith(test['expected_prefix']) if test['expected_prefix'] == "XD-"
                    else nearest.zone_id.endswith(test['expected_prefix'])
                )
                print(f"Correct dockmaster type: {is_correct_type}")
                
                if not is_correct_type:
                    print("ERROR: Incorrect dockmaster type matched!")
        else:
            print("No match found!")
            
        if test.get('is_transition'):
            print(f"Transition zone detected: {nearest.transition_zone if nearest else 'N/A'}")
        
        print("-"*30)

if __name__ == "__main__":
    test_matcher()
