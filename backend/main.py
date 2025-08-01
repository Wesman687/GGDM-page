from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from routes.github import router as github_router
from routes.suggestions import router as suggestions_router
from routes.admin import router as admin_router
from routes.dockmasters import router as dockmasters_router

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Dockmaster Suggestion Portal API",
    description="Backend API for managing Dockmaster suggestions and GitHub integration",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "https://localhost:3000", 
        "https://ggdm-page.vercel.app",
        "https://ggdm-page-gwzhqi1g5-wesman687s-projects.vercel.app",
        "https://*.vercel.app"
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

@app.get("/")
async def root():
    return {"message": "Dockmaster Suggestion Portal API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7000)
