import os
import json
import numpy as np
from typing import List, Dict
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from openai import OpenAI
import sys
from pathlib import Path

# Add backend directory to path to import consolidated modules
backend_dir = Path(__file__).parent.parent.parent
sys.path.append(str(backend_dir))

from ai_settings import DB_DSN, EMBED_MODEL, USE_FAISS

# Set correct paths relative to project root
SCRIPTS_PATH = "../../../frontend/outlands.jsonl"  # Use the frontend data
DOCS_PATH = "../data/docs/razor_scripting.md"
RULES_PATH = "../rules/RULES.md"
from chunk import split_code, split_markdown, clean_text

load_dotenv()

engine = create_engine(DB_DSN, future=True)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def embed_texts(texts: List[str]) -> np.ndarray:
    """Generate embeddings for a batch of texts."""
    try:
        response = client.embeddings.create(
            model=EMBED_MODEL, 
            input=texts
        )
        vectors = [data.embedding for data in response.data]
        return np.array(vectors, dtype="float32")
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        raise

def upsert_chunks(payloads: List[Dict]):
    """Insert or update chunks in the database."""
    try:
        with engine.begin() as conn:
            for payload in payloads:
                conn.execute(text("""
                    INSERT OR REPLACE INTO rag_chunks 
                    (id, source, title, url, text, meta, created_at)
                    VALUES (:id, :source, :title, :url, :text, :meta, :created_at)
                """), payload)
        print(f"Upserted {len(payloads)} chunks")
    except Exception as e:
        print(f"Error upserting chunks: {e}")
        raise

def process_scripts_file(file_path: str) -> List[Dict]:
    """Process scripts from JSONL file."""
    chunks = []
    
    if not os.path.exists(file_path):
        print(f"Scripts file not found: {file_path}")
        return chunks
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    script_data = json.loads(line.strip())
                    if not script_data.get('code'):
                        continue
                    
                    # Split code into logical chunks
                    code_chunks = split_code(script_data['code'])
                    
                    for i, chunk_text in enumerate(code_chunks):
                        if not chunk_text.strip():
                            continue
                            
                        chunk_id = f"script_{script_data.get('url', '').split('/')[-1]}_{i}"
                        
                        chunks.append({
                            "id": chunk_id,
                            "source": "script",
                            "title": f"{script_data.get('title', 'Untitled')} - Part {i+1}",
                            "url": script_data.get('url', ''),
                            "text": clean_text(chunk_text),
                            "meta": json.dumps({
                                "author": script_data.get('author', 'Unknown'),
                                "category": script_data.get('category', 'General'),
                                "tags": script_data.get('tags', []),
                                "chunk_index": i,
                                "total_chunks": len(code_chunks)
                            }),
                            "created_at": "CURRENT_TIMESTAMP"
                        })
                        
                except json.JSONDecodeError as e:
                    print(f"Error parsing line {line_num}: {e}")
                    continue
                except Exception as e:
                    print(f"Error processing line {line_num}: {e}")
                    continue
    
    except Exception as e:
        print(f"Error reading scripts file: {e}")
    
    return chunks

def process_docs_file(file_path: str) -> List[Dict]:
    """Process documentation from markdown file."""
    chunks = []
    
    if not os.path.exists(file_path):
        print(f"Docs file not found: {file_path}")
        return chunks
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split markdown into chunks
        doc_chunks = split_markdown(content)
        
        for i, chunk_text in enumerate(doc_chunks):
            if not chunk_text.strip():
                continue
                
            chunk_id = f"docs_razor_scripting_{i}"
            
            chunks.append({
                "id": chunk_id,
                "source": "docs",
                "title": f"Razor Scripting Documentation - Part {i+1}",
                "url": "",
                "text": clean_text(chunk_text),
                "meta": json.dumps({
                    "chunk_index": i,
                    "total_chunks": len(doc_chunks),
                    "document": "razor_scripting"
                }),
                "created_at": "CURRENT_TIMESTAMP"
            })
    
    except Exception as e:
        print(f"Error processing docs file: {e}")
    
    return chunks

def process_rules_file(file_path: str) -> List[Dict]:
    """Process rules from markdown file."""
    chunks = []
    
    if not os.path.exists(file_path):
        print(f"Rules file not found: {file_path}")
        return chunks
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split rules into chunks
        rule_chunks = split_markdown(content)
        
        for i, chunk_text in enumerate(rule_chunks):
            if not chunk_text.strip():
                continue
                
            chunk_id = f"rules_ai_rules_{i}"
            
            chunks.append({
                "id": chunk_id,
                "source": "rules",
                "title": f"AI Rules - Part {i+1}",
                "url": "",
                "text": clean_text(chunk_text),
                "meta": json.dumps({
                    "chunk_index": i,
                    "total_chunks": len(rule_chunks),
                    "rules_version": "rules-v1.0"
                }),
                "created_at": "CURRENT_TIMESTAMP"
            })
    
    except Exception as e:
        print(f"Error processing rules file: {e}")
    
    return chunks

def create_database_schema():
    """Create the database schema if it doesn't exist."""
    try:
        with engine.begin() as conn:
            # Create rag_chunks table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id TEXT PRIMARY KEY,
                    source TEXT CHECK (source IN ('script','docs','rules')),
                    title TEXT,
                    url TEXT,
                    text TEXT NOT NULL,
                    meta TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Create interactions table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS interactions (
                    id TEXT PRIMARY KEY,
                    question TEXT NOT NULL,
                    assistant_draft TEXT NOT NULL,
                    retrieved TEXT NOT NULL,
                    citations TEXT NOT NULL,
                    decision TEXT DEFAULT 'pending',
                    rating INTEGER,
                    reasons TEXT,
                    edits_diff TEXT,
                    rules_version TEXT DEFAULT 'rules-v1.0',
                    model_version TEXT DEFAULT 'gpt-4o-mini',
                    session_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            print("Database schema created successfully")
    except Exception as e:
        print(f"Error creating database schema: {e}")
        raise

def main():
    """Main ingestion function."""
    print("Starting AI data ingestion for consolidated system...")
    
    # Create database schema
    create_database_schema()
    
    # Clear existing data
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM rag_chunks"))
        print("Cleared existing chunks")
    
    all_chunks = []
    
    # Process scripts
    print(f"Processing scripts from: {SCRIPTS_PATH}")
    script_chunks = process_scripts_file(SCRIPTS_PATH)
    all_chunks.extend(script_chunks)
    print(f"Created {len(script_chunks)} script chunks")
    
    # Process documentation
    print(f"Processing docs from: {DOCS_PATH}")
    doc_chunks = process_docs_file(DOCS_PATH)
    all_chunks.extend(doc_chunks)
    print(f"Created {len(doc_chunks)} doc chunks")
    
    # Process rules
    print(f"Processing rules from: {RULES_PATH}")
    rule_chunks = process_rules_file(RULES_PATH)
    all_chunks.extend(rule_chunks)
    print(f"Created {len(rule_chunks)} rule chunks")
    
    if not all_chunks:
        print("No data to ingest!")
        return
    
    # Insert chunks into database
    print(f"Inserting {len(all_chunks)} chunks into database...")
    upsert_chunks(all_chunks)
    
    # Generate and save embeddings
    if USE_FAISS:
        print("Generating embeddings for FAISS...")
        texts = [chunk["text"] for chunk in all_chunks]
        
        # Generate embeddings in batches
        batch_size = 100
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
            
            try:
                batch_embeddings = embed_texts(batch_texts)
                all_embeddings.append(batch_embeddings)
            except Exception as e:
                print(f"Error processing batch {i//batch_size + 1}: {e}")
                continue
        
        if all_embeddings:
            # Combine all embeddings
            embeddings = np.vstack(all_embeddings)
            
            # Save embeddings to file
            embeddings_file = "data/embeddings.npy"
            os.makedirs(os.path.dirname(embeddings_file), exist_ok=True)
            np.save(embeddings_file, embeddings)
            print(f"Saved {len(embeddings)} embeddings to {embeddings_file}")
        else:
            print("No embeddings generated!")
    
    print("Ingestion completed successfully!")

if __name__ == "__main__":
    main()
