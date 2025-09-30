import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

# Database Configuration - Use main database
DB_DSN = os.getenv("DATABASE_URL", "sqlite:///./suggestions.db")

# File Paths
RULES_PATH = os.getenv("RULES_PATH", "ai/rules/RULES.md")
SCRIPTS_PATH = os.getenv("SCRIPTS_PATH", "ai/data/scripts.jsonl")
DOCS_PATH = os.getenv("DOCS_PATH", "ai/data/docs/razor_scripting.md")

# AI Configuration
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "16000"))
TOP_K = int(os.getenv("TOP_K", "8"))

# Validation
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Use FAISS for vector storage if SQLite
USE_FAISS = "sqlite" in DB_DSN.lower()
