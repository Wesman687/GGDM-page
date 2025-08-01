
# 🛠️ GGDM FastAPI Deployment Guide (Production with systemd + Logs)

This guide sets up and manages two FastAPI apps on your UVH instance:

- `main` app (port **6050**)
- `webhook` listener (port **6051**, GitHub auto-update)

---

## 📁 Folder Structure

```
/home/ubuntu/GGDM/
└── backend/
    ├── main.py
    ├── webhook.py
    ├── .venv/
    ├── start_main.sh
    ├── start_webhook.sh
    └── logs/
        ├── main.log
        ├── webhook.log
        └── webhook_events.log
```

---

## 🧩 1. Clone Only the `backend/` Folder (Sparse Checkout)

```bash
mkdir GGDM && cd GGDM
git init
git remote add origin https://github.com/Wesman687/GGDM-page.git
git config core.sparseCheckout true
echo "backend/*" >> .git/info/sparse-checkout
git pull origin master
```

---

## 🐍 2. Set Up Python Environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir logs
```

---

## 🔧 3. Create `start_main.sh`

```bash
#!/bin/bash
cd /home/ubuntu/GGDM/backend
source .venv/bin/activate
exec uvicorn main:app --host 0.0.0.0 --port 6050 --workers 2   >> logs/main.log 2>&1
```

```bash
chmod +x start_main.sh
```

---

## 🔧 4. Create `start_webhook.sh`

```bash
#!/bin/bash
cd /home/ubuntu/GGDM/backend
source .venv/bin/activate
exec uvicorn webhook:app --host 0.0.0.0 --port 6051 --workers 1   >> logs/webhook.log 2>&1
```

```bash
chmod +x start_webhook.sh
```

---

## 🧾 5. `webhook.py` Example with Logging

```python
# webhook.py
from fastapi import FastAPI, Request
import subprocess
from datetime import datetime

app = FastAPI()
LOG_FILE = "logs/webhook_events.log"

@app.post("/webhook")
async def webhook(request: Request):
    payload = await request.body()
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.utcnow()}] Webhook received. Triggering git pull...\n")
    subprocess.run(["git", "pull"], cwd="/home/ubuntu/GGDM")
    return {"status": "updated"}
```

---

## 🛠️ 6. Create `systemd` Services

### 📄 `/etc/systemd/system/ggdm-main.service`

```ini
[Unit]
Description=GGDM FastAPI Main Server
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/GGDM/backend
ExecStart=/home/ubuntu/GGDM/backend/start_main.sh
Restart=always
StandardOutput=append:/home/ubuntu/GGDM/backend/logs/main.log
StandardError=append:/home/ubuntu/GGDM/backend/logs/main.log

[Install]
WantedBy=multi-user.target
```

---

### 📄 `/etc/systemd/system/ggdm-webhook.service`

```ini
[Unit]
Description=GGDM Webhook Listener
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/GGDM/backend
ExecStart=/home/ubuntu/GGDM/backend/start_webhook.sh
Restart=always
StandardOutput=append:/home/ubuntu/GGDM/backend/logs/webhook.log
StandardError=append:/home/ubuntu/GGDM/backend/logs/webhook.log

[Install]
WantedBy=multi-user.target
```

---

## 🧩 7. Enable and Start Services

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable ggdm-main.service
sudo systemctl enable ggdm-webhook.service
sudo systemctl start ggdm-main.service
sudo systemctl start ggdm-webhook.service
```

---

## ✅ 8. Test

- App: `http://<your-ip>:6050`
- Webhook: `http://<your-ip>:6051/webhook`
- Logs: `tail -f logs/*.log`

---

## 🧼 9. Monitor Services

```bash
sudo systemctl status ggdm-main
sudo systemctl status ggdm-webhook
```

---

> This deployment is log-aware, autostarts on boot, and integrates webhook-triggered GitHub pull updates.
