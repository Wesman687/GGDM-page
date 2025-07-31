# 🚢 Dockmaster Suggestion Portal

A web application for viewing, suggesting, and managing Dockmasters (DMs) in a shared GitHub repository.

## 🏗️ Project Structure

```
dm-portal/
├── frontend/        # Next.js (React + TypeScript + Tailwind)
├── backend/         # FastAPI (Python)
└── README.md        # This file
```

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Environment Variables

### Backend (.env)
```
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=LeoPiro
GITHUB_REPO_NAME=GG_Dms
GITHUB_FILE_PATH=GG DOCKMASTERS.txt
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
```

## 🎯 Features

- ✅ View current Dockmasters from GitHub
- ✅ Submit suggestions to add/remove DMs
- ✅ Admin panel for reviewing suggestions
- ✅ Automatic GitHub PR creation
- ⚙️ Optional Discord OAuth integration

## 🛠️ Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python
- **Database**: JSON file (MVP)
- **Auth**: Discord OAuth2 (optional)
- **GitHub**: GitHub REST API
