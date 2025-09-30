import numpy as np
import faiss
import json
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from openai import OpenAI
from ai_settings import DB_DSN, EMBED_MODEL, MAX_CONTEXT_CHARS, TOP_K, USE_FAISS

engine = create_engine(DB_DSN, future=True)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Global FAISS index
faiss_index = None
chunk_mapping = {}  # Maps FAISS index to chunk data

def initialize_faiss():
    """Initialize FAISS index and load existing data."""
    global faiss_index, chunk_mapping
    
    if not USE_FAISS:
        return
    
    # Create FAISS index for cosine similarity
    faiss_index = faiss.IndexFlatIP(1536)  # text-embedding-3-small dimension
    
    # Load existing chunks and embeddings
    try:
        with engine.begin() as conn:
            chunks = conn.execute(text("SELECT id, source, title, url, text, meta FROM rag_chunks")).fetchall()
            
            if chunks:
                # Load embeddings from a separate file
                embeddings_file = "backend/ai/data/embeddings.npy"
                if os.path.exists(embeddings_file):
                    embeddings = np.load(embeddings_file)
                    faiss_index.add(embeddings.astype('float32'))
                    
                    # Rebuild chunk mapping
                    for i, chunk in enumerate(chunks):
                        chunk_mapping[i] = {
                            "id": chunk.id,
                            "source": chunk.source,
                            "title": chunk.title,
                            "url": chunk.url,
                            "text": chunk.text,
                            "meta": json.loads(chunk.meta) if chunk.meta else {}
                        }
                    
                    print(f"Loaded {len(chunks)} chunks into FAISS index")
                else:
                    print("No embeddings file found. Run ingestion first.")
    except Exception as e:
        print(f"Error initializing FAISS: {e}")

def embed_query(query: str) -> np.ndarray:
    """Generate embedding for a query string."""
    try:
        response = client.embeddings.create(
            model=EMBED_MODEL, 
            input=[query]
        )
        return np.array(response.data[0].embedding, dtype="float32")
    except Exception as e:
        print(f"Error generating embedding: {e}")
        raise

def retrieve(query: str, k: int = None) -> list:
    """Retrieve relevant chunks for a query using FAISS similarity."""
    if k is None:
        k = TOP_K
    
    if not USE_FAISS:
        # Fallback to simple text search
        return retrieve_text_search(query, k)
    
    global faiss_index, chunk_mapping
    
    if faiss_index is None:
        initialize_faiss()
    
    if faiss_index.ntotal == 0:
        return []
    
    try:
        # Generate query embedding
        qv = embed_query(query)
        
        # Normalize for cosine similarity
        qv = qv / np.linalg.norm(qv)
        
        # Search FAISS index
        scores, indices = faiss_index.search(qv.reshape(1, -1), min(k, faiss_index.ntotal))
        
        rows = []
        total_chars = 0
        
        for score, idx in zip(scores[0], indices[0]):
            if idx in chunk_mapping:
                chunk_data = chunk_mapping[idx].copy()
                chunk_data["score"] = float(score)
                
                # Stop if we're approaching context limit
                if total_chars + len(chunk_data["text"]) > MAX_CONTEXT_CHARS:
                    break
                
                rows.append(chunk_data)
                total_chars += len(chunk_data["text"])
        
        return rows
        
    except Exception as e:
        print(f"Error during FAISS retrieval: {e}")
        return retrieve_text_search(query, k)

def retrieve_text_search(query: str, k: int) -> list:
    """Fallback text search when FAISS is not available."""
    try:
        # Simple text search in SQLite
        sql = """
          SELECT id, source, title, url, text, meta
          FROM rag_chunks
          WHERE text LIKE :query OR title LIKE :query
          ORDER BY LENGTH(text) DESC
          LIMIT :k
        """
        
        rows = []
        total_chars = 0
        
        with engine.begin() as conn:
            for row in conn.execute(text(sql), {"query": f"%{query}%", "k": k}):
                if total_chars + len(row.text) > MAX_CONTEXT_CHARS:
                    break
                
                chunk_data = {
                    "id": row.id,
                    "source": row.source,
                    "title": row.title,
                    "url": row.url,
                    "text": row.text,
                    "meta": json.loads(row.meta) if row.meta else {},
                    "score": 0.5  # Default score for text search
                }
                rows.append(chunk_data)
                total_chars += len(row.text)
        
        return rows
        
    except Exception as e:
        print(f"Error during text search: {e}")
        return []

def format_context(chunks: list) -> str:
    """Format retrieved chunks into context string."""
    if not chunks:
        return "No relevant context found."
    
    context_parts = []
    for chunk in chunks:
        source_label = {
            'script': 'Script',
            'docs': 'Documentation', 
            'rules': 'Rules'
        }.get(chunk['source'], chunk['source'].title())
        
        context_parts.append(f"[{source_label}] {chunk['title']}\n{chunk['text']}")
    
    return "\n\n---\n\n".join(context_parts)

def generate_citations(chunks: list) -> list:
    """Generate citation list from retrieved chunks."""
    citations = []
    seen_urls = set()
    
    for chunk in chunks:
        if chunk['url'] and chunk['url'] not in seen_urls:
            citations.append({
                "url": chunk['url'],
                "title": chunk['title']
            })
            seen_urls.add(chunk['url'])
    
    return citations

def get_chunk_stats() -> dict:
    """Get statistics about stored chunks."""
    try:
        with engine.begin() as conn:
            # Get total counts by source
            result = conn.execute(text("""
              SELECT 
                source,
                COUNT(*) as count,
                AVG(LENGTH(text)) as avg_length
              FROM rag_chunks
              GROUP BY source
            """)).fetchall()
            
            stats = {
                "total_chunks": sum(row.count for row in result),
                "by_source": {
                    row.source: {
                        "count": row.count,
                        "avg_length": float(row.avg_length) if row.avg_length else 0
                    }
                    for row in result
                }
            }
            
            return stats
            
    except SQLAlchemyError as e:
        print(f"Database error getting chunk stats: {e}")
        return {"total_chunks": 0, "by_source": {}}
