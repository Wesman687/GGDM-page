import json
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from ai_settings import DB_DSN

engine = create_engine(DB_DSN, future=True)

def log_interaction(rec: dict) -> str:
    """Log an interaction to the database."""
    try:
        with engine.begin() as conn:
            # Generate a UUID for the interaction
            import uuid
            interaction_id = str(uuid.uuid4())
            
            conn.execute(text("""
              INSERT INTO interactions
              (id, question, assistant_draft, retrieved, citations, decision, rating, reasons, edits_diff, rules_version, model_version, session_id)
              VALUES (:id, :q, :draft, :retr, :cites, :decision, :rating, :reasons, :diff, :rv, :mv, :session_id)
            """), {
              "id": interaction_id,
              "q": rec["question"],
              "draft": json.dumps(rec["assistant_draft"]),
              "retr": json.dumps(rec["retrieved"]),
              "cites": json.dumps(rec["citations"]),
              "decision": rec.get("decision", "pending"),
              "rating": rec.get("rating"),
              "reasons": json.dumps(rec.get("reasons")) if rec.get("reasons") else None,
              "diff": rec.get("edits_diff"),
              "rv": rec.get("rules_version", "rules-v1.0"),
              "mv": rec.get("model_version", "gpt-4o-mini"),
              "session_id": rec.get("session_id")
            })
        return interaction_id
    except SQLAlchemyError as e:
        print(f"Database error logging interaction: {e}")
        raise

def update_feedback(interaction_id: str, decision: str, rating: int = None, reasons: list = None, edits_diff: str = None) -> bool:
    """Update feedback for an interaction."""
    try:
        with engine.begin() as conn:
            conn.execute(text("""
              UPDATE interactions
              SET decision=:d, rating=:r, reasons=:reasons, edits_diff=:diff
              WHERE id=:id
            """), {
              "d": decision, 
              "r": rating, 
              "reasons": json.dumps(reasons) if reasons else None, 
              "diff": edits_diff, 
              "id": interaction_id
            })
        return True
    except SQLAlchemyError as e:
        print(f"Database error updating feedback: {e}")
        return False

def get_interaction_stats(days: int = 30) -> dict:
    """Get interaction statistics for the last N days."""
    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
              SELECT 
                COUNT(*) as total_interactions,
                COUNT(CASE WHEN decision = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN decision = 'declined' THEN 1 END) as declined,
                COUNT(CASE WHEN decision = 'edited' THEN 1 END) as edited,
                COUNT(CASE WHEN decision = 'pending' THEN 1 END) as pending,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_count
              FROM interactions
              WHERE created_at >= datetime('now', '-{} days')
            """.format(days))).fetchone()
            
            return {
                "total_interactions": result.total_interactions or 0,
                "approved": result.approved or 0,
                "declined": result.declined or 0,
                "edited": result.edited or 0,
                "pending": result.pending or 0,
                "avg_rating": float(result.avg_rating) if result.avg_rating else 0.0,
                "rated_count": result.rated_count or 0
            }
    except SQLAlchemyError as e:
        print(f"Database error getting stats: {e}")
        return {}

def get_recent_interactions(limit: int = 50) -> list:
    """Get recent interactions for admin review."""
    try:
        with engine.begin() as conn:
            results = conn.execute(text("""
              SELECT id, created_at, question, decision, rating, rules_version, model_version
              FROM interactions
              ORDER BY created_at DESC
              LIMIT :limit
            """), {"limit": limit}).fetchall()
            
            return [
                {
                    "id": str(row.id),
                    "created_at": row.created_at,
                    "question": row.question,
                    "decision": row.decision,
                    "rating": row.rating,
                    "rules_version": row.rules_version,
                    "model_version": row.model_version
                }
                for row in results
            ]
    except SQLAlchemyError as e:
        print(f"Database error getting recent interactions: {e}")
        return []
