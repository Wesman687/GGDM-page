from fastapi import FastAPI, Request
import subprocess

app = FastAPI()

@app.post("/webhook")
async def webhook(request: Request):
    payload = await request.json()
    # Optional: validate the request (e.g., GitHub signature)
    subprocess.run(["git", "pull"], cwd="/home/ubuntu/GGDM")
    return {"status": "ok"}