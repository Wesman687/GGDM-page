from database import Base, engine, SessionLocal, DockmasterDB
import re

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create a new session
    db = SessionLocal()
    
    try:
        # Clear existing dockmasters
        db.query(DockmasterDB).delete()
        
        # Read sample DMs from file
        with open('../../.github/sample_dms.xml', 'r') as f:
            lines = f.readlines()
        
        # Process each line
        for line in lines:
            line = line.strip()
            if not line.startswith('+'):
                continue
                
            # Remove leading + and split fields
            parts = re.split(r'\s+', line[1:].strip())
            if len(parts) >= 5:
                try:
                    # Handle special cases like "The Gym"
                    if parts[0] == "The":
                        zone_id = "The " + parts[1]
                        parts = [zone_id] + parts[2:]
                    else:
                        zone_id = parts[0]
                    
                    x = int(parts[1])
                    y = int(parts[2])
                    map_id = int(parts[3])
                    enabled = parts[4].lower() == 'true'
                    
                    # Create dockmaster entry
                    dockmaster = DockmasterDB(
                        zone_id=zone_id,
                        x=x,
                        y=y,
                        map=map_id,
                        enabled=enabled,
                        added_by="system",  # Set default user for initialization
                        is_reference_point=False,  # Default to False
                        is_active=True  # Default to True for initial data
                    )
                    db.add(dockmaster)
                except (ValueError, IndexError) as e:
                    print(f"Skipping invalid line: {line.strip()} - {str(e)}")
        
        # Commit changes
        db.commit()
        print("Database initialized successfully!")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
