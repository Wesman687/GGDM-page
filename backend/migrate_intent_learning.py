#!/usr/bin/env python3
"""
Migration script for AI Intent Learning System
Creates the necessary database tables for the learning system
"""

import sqlite3
from datetime import datetime

def migrate_intent_learning():
    """Create tables for the intent learning system"""
    
    print("🧠 MIGRATING AI INTENT LEARNING SYSTEM")
    print("=" * 50)
    
    conn = sqlite3.connect('suggestions.db')
    cursor = conn.cursor()
    
    try:
        # Create intent patterns table
        print("📋 Creating intent_patterns table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS intent_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                intent_name TEXT NOT NULL UNIQUE,
                keywords TEXT NOT NULL,  -- JSON array
                tags TEXT NOT NULL,     -- JSON array
                context_needed TEXT,    -- JSON array
                requirements TEXT,      -- JSON array
                wiki_sources TEXT,      -- JSON array of wiki pages
                confidence_score REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create wiki knowledge table
        print("📚 Creating wiki_knowledge table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wiki_knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_name TEXT NOT NULL,
                page_url TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                extracted_keywords TEXT,  -- JSON array
                game_mechanics TEXT,      -- JSON array
                item_references TEXT,     -- JSON array
                location_references TEXT, -- JSON array
                last_scraped TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                content_length INTEGER DEFAULT 0,
                UNIQUE(page_name, content_hash)
            )
        ''')
        
        # Create learning logs table
        print("📝 Creating intent_learning_logs table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS intent_learning_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_query TEXT NOT NULL,
                detected_intent TEXT,
                confidence_score REAL,
                new_keywords TEXT,       -- JSON array
                suggested_intent TEXT,
                learning_action TEXT,    -- 'expanded', 'created', 'confirmed'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for performance
        print("🔍 Creating indexes...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_intent_patterns_name ON intent_patterns(intent_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_intent_patterns_confidence ON intent_patterns(confidence_score DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_intent_patterns_usage ON intent_patterns(usage_count DESC)')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wiki_knowledge_name ON wiki_knowledge(page_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wiki_knowledge_scraped ON wiki_knowledge(last_scraped DESC)')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_learning_logs_query ON intent_learning_logs(user_query)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_learning_logs_intent ON intent_learning_logs(detected_intent)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_learning_logs_created ON intent_learning_logs(created_at DESC)')
        
        # Insert initial intent patterns
        print("🎯 Inserting initial intent patterns...")
        initial_patterns = [
            ('fishing', '["fishing", "fish", "net", "pole", "boat", "water", "captcha", "pooner", "mib", "frenzy"]', 
             '["fishing", "boating", "seafaring", "captcha", "pooner"]',
             '["fishing mechanics", "boat handling", "captcha solving", "net management"]',
             '["boat startup", "captcha detection", "net management", "fish processing"]', '[]', 0.9),
            
            ('mining', '["mining", "ore", "pickaxe", "vein", "gems", "stone", "metal", "rock"]',
             '["mining", "ore", "gems", "tools", "veins"]',
             '["mining mechanics", "tool usage", "ore processing", "vein detection"]',
             '["tool management", "ore detection", "weight management", "vein targeting"]', '[]', 0.9),
            
            ('combat', '["combat", "fight", "attack", "weapon", "spell", "heal", "battle", "warfare"]',
             '["combat", "weapons", "spells", "healing", "battle"]',
             '["combat mechanics", "spell casting", "targeting", "damage calculation"]',
             '["target selection", "spell rotation", "healing logic", "damage optimization"]', '[]', 0.9),
            
            ('pvp', '["pvp", "player", "versus", "duel", "pk", "killer", "murderer"]',
             '["pvp", "combat", "player", "versus", "dueling"]',
             '["pvp mechanics", "player detection", "combat tactics", "escape strategies"]',
             '["player targeting", "escape tactics", "healing priority", "combat positioning"]', '[]', 0.8),
            
            ('pvm', '["pvm", "monster", "boss", "creature", "mob", "dungeon", "beast"]',
             '["pvm", "monsters", "bosses", "dungeons", "creatures"]',
             '["monster mechanics", "boss tactics", "dungeon navigation", "creature behavior"]',
             '["monster detection", "boss strategies", "loot collection", "safety measures"]', '[]', 0.8),
            
            ('crafting', '["crafting", "smith", "tailor", "carpenter", "alchemy", "tinkering", "blacksmith"]',
             '["crafting", "blacksmith", "tailor", "carpenter", "alchemy", "tinkering"]',
             '["crafting mechanics", "material management", "skill requirements", "recipe knowledge"]',
             '["material detection", "crafting process", "skill training", "quality optimization"]', '[]', 0.8),
            
            ('boating', '["boat", "ship", "sailing", "navigation", "water", "sea", "ocean"]',
             '["boating", "navigation", "sailing", "water", "maritime"]',
             '["boating mechanics", "navigation", "water travel", "maritime safety"]',
             '["boat control", "navigation", "water safety", "route planning"]', '[]', 0.7),
            
            ('targeting', '["target", "targeting", "aim", "focus", "select", "choose"]',
             '["targeting", "selection", "aiming", "focus"]',
             '["targeting mechanics", "target selection", "range management", "line of sight"]',
             '["target detection", "range calculation", "target switching", "aiming precision"]', '[]', 0.7),
            
            ('dungeons', '["dungeon", "cave", "underground", "maze", "tunnel", "labyrinth"]',
             '["dungeons", "caves", "underground", "exploration", "mazes"]',
             '["dungeon mechanics", "navigation", "safety", "exploration tactics"]',
             '["navigation", "monster detection", "escape routes", "treasure hunting"]', '[]', 0.7),
            
            ('looting', '["loot", "looting", "sort", "organize", "chest", "bag", "inventory"]',
             '["looting", "sorting", "organizing", "inventory", "management"]',
             '["looting mechanics", "item organization", "inventory management", "container handling"]',
             '["item detection", "container management", "sorting logic", "space optimization"]', '[]', 0.7)
        ]
        
        for pattern in initial_patterns:
            cursor.execute('''
                INSERT OR REPLACE INTO intent_patterns 
                (intent_name, keywords, tags, context_needed, requirements, wiki_sources, confidence_score)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', pattern)
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Show summary
        cursor.execute("SELECT COUNT(*) FROM intent_patterns")
        pattern_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM wiki_knowledge")
        wiki_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM intent_learning_logs")
        log_count = cursor.fetchone()[0]
        
        print(f"\n📊 DATABASE SUMMARY:")
        print(f"   Intent patterns: {pattern_count}")
        print(f"   Wiki knowledge entries: {wiki_count}")
        print(f"   Learning logs: {log_count}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_intent_learning()
    
    print("\nWaiting 2 seconds...")
    import time
    time.sleep(2)
