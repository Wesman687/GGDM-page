from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime

from routes.github import router as github_router
from routes.suggestions import router as suggestions_router
from routes.admin import router as admin_router
from routes.dockmasters import router as dockmasters_router
from routes.scripts import router as scripts_router
from routes.scripts_additional import router as scripts_additional_router
from routes.items import router as items_router
from routes.ai_items import router as ai_items_router
from routes.ai_uncertainty import router as ai_uncertainty_router
from routes.ai_intents import router as ai_intents_router

# AI imports
from ai_models import AskRequest, AskResponse, FeedbackRequest, FeedbackResponse
from ai_rag import retrieve, format_context, generate_citations, initialize_faiss
from ai_lint import lint_razor, extract_code_from_response
from ai_db import log_interaction, update_feedback, get_interaction_stats, get_recent_interactions
from ai_settings import RULES_PATH, OPENAI_MODEL
from ai_enhanced_rules import load_enhanced_rules, get_item_suggestions, validate_item_reference

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Dockmaster Suggestion Portal API",
    description="Backend API for managing Dockmaster suggestions, GitHub integration, and AI-powered Razor scripting assistance",
    version="1.0.0"
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize AI systems on startup
@app.on_event("startup")
async def startup_event():
    """Initialize AI systems on startup."""
    try:
        initialize_faiss()
        print("AI systems initialized successfully")
    except Exception as e:
        print(f"Warning: AI systems initialization failed: {e}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "https://localhost:3000", 
        "https://ggdm-page.vercel.app",
    ],  # Add your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(github_router, prefix="/api/github", tags=["github"])
app.include_router(suggestions_router, prefix="/api/suggestions", tags=["suggestions"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(dockmasters_router, prefix="/api/dockmasters", tags=["dockmasters"])
app.include_router(scripts_router, prefix="/api/scripts", tags=["scripts"])
app.include_router(scripts_additional_router, prefix="/api/scripts", tags=["scripts"])
app.include_router(items_router, prefix="/api", tags=["items"])
app.include_router(ai_items_router, prefix="/api", tags=["ai-items"])
app.include_router(ai_uncertainty_router, prefix="/api", tags=["ai-uncertainty"])
app.include_router(ai_intents_router, prefix="/api", tags=["ai-intents"])

@app.get("/")
async def root():
    return {"message": "Dockmaster Suggestion Portal API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# AI Service Functions
def load_rules() -> str:
    """Load rules from file."""
    try:
        with open(RULES_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return """# Razor Scripting Rules

- Prefer clear, minimal Razor; avoid unnecessary loops.
- After any `gumpresponse` you MUST add `waitforgump` or `wft`.
- Long loops require sleeps (`wait 200–650`) to avoid client lockups.
- Use `@clearignore` before ignore-heavy scans; pair with `@ignore` consistently.
- Don't assume items exist; guard with `if findtype ... as var`.
- Never hardcode user-specific IDs unless provided; use @setvar! and comments.
- Close control structures: `endif`, `endwhile`.
- When modifying containers, verify with `insysmsg` if relevant.
- Add a comment header with purpose, inputs, and pre-reqs.
"""

def call_llm(prompt: str, model: str = None) -> str:
    """Call OpenAI API with the given prompt."""
    if model is None:
        model = OPENAI_MODEL
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a UO Outlands Razor scripting assistant. Provide clear, working Razor scripts with explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

# AI Endpoints
@app.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """Ask a question and get AI response with RAG."""
    try:
        # Retrieve relevant chunks
        chunks = retrieve(request.question, request.k)
        
        # Format context
        context = format_context(chunks)
        
        # Load rules
        rules = load_enhanced_rules()
        
        # Create prompt
        prompt = f"""Follow these rules strictly:
{rules}

User question:
{request.question}

Relevant materials:
{context}

IMPORTANT INSTRUCTIONS:
- If you find relevant existing scripts in the materials above, analyze them and consider adapting their patterns
- Look for scripts that solve similar problems and use their approaches as inspiration
- If you're unsure about a specific implementation, reference the existing scripts for guidance
- Always follow the patterns and best practices shown in the existing scripts
- If multiple scripts show different approaches, choose the most appropriate one for the user's needs
- Use the item names and IDs from the rules section above for all item references
- If you need an item not listed in the rules, ask the user for the item name, ID, or hue

Respond with:
1) A concise explanation (<=8 lines) mentioning if you found relevant existing scripts to reference
2) A code block with final Razor code that incorporates best practices from existing scripts
3) A short checklist of caveats

Format your response with clear sections and use ```razor for code blocks."""

        # Get AI response
        answer = call_llm(prompt)
        
        # Extract code from response
        code = extract_code_from_response(answer)
        
        # Lint the code
        lint_issues = lint_razor(code)
        
        # Generate citations
        citations = generate_citations(chunks)
        
        # Log interaction
        interaction_id = log_interaction({
            "question": request.question,
            "assistant_draft": {"explanation": answer, "code": code},
            "retrieved": chunks,
            "citations": citations,
            "rules_version": request.rules_version or "rules-v1.0",
            "model_version": OPENAI_MODEL,
            "session_id": request.session_id
        })
        
        return AskResponse(
            id=interaction_id,
            answer=answer,
            code=code,
            lint_issues=lint_issues,
            citations=citations,
            rules_version=request.rules_version or "rules-v1.0",
            model_version=OPENAI_MODEL,
            context_used=chunks
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@app.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """Submit feedback for an interaction."""
    try:
        success = update_feedback(
            request.id,
            request.decision,
            request.rating,
            request.reasons,
            request.edits_diff
        )
        
        if success:
            return FeedbackResponse(ok=True, message="Feedback submitted successfully")
        else:
            raise HTTPException(status_code=500, detail="Failed to update feedback")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")

@app.get("/ai/stats")
async def get_ai_stats():
    """Get AI interaction statistics."""
    try:
        stats = get_interaction_stats(days=30)
        return {
            "interactions": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

@app.get("/ai/interactions")
async def get_ai_interactions(limit: int = 50):
    """Get recent AI interactions for admin review."""
    try:
        interactions = get_recent_interactions(limit)
        return {
            "interactions": interactions,
            "count": len(interactions),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting interactions: {str(e)}")

@app.get("/ai/items/suggestions")
async def get_item_suggestions_endpoint(query: str):
    """Get item suggestions based on partial name."""
    try:
        suggestions = get_item_suggestions(query)
        return {
            "suggestions": [{"name": name, "item_id": item_id, "usage_count": usage_count} 
                           for name, item_id, usage_count in suggestions],
            "query": query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting suggestions: {str(e)}")

@app.get("/ai/items/validate")
async def validate_item_endpoint(name: str, item_id: int = None):
    """Validate if an item reference exists in the database."""
    try:
        validation = validate_item_reference(name, item_id)
        return validation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating item: {str(e)}")

@app.get("/ai/rules/items")
async def get_dynamic_item_rules():
    """Get the current dynamic item rules for AI."""
    try:
        from ai_enhanced_rules import generate_dynamic_item_rules
        rules = generate_dynamic_item_rules()
        return {"rules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting item rules: {str(e)}")

@app.get("/ai/items/context/{item_name}")
async def get_item_context_for_ai_endpoint(item_name: str):
    """Get comprehensive context about an item for AI usage."""
    try:
        from ai_enhanced_rules import get_item_context_for_ai
        context = get_item_context_for_ai(item_name)
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting item context: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7000)
