# Hetzner TCP Proxy Setup (Beginner Guide)

Step-by-step guide to run the **PowerDon WsCharge TCP proxy** on a cheap Hetzner VPS so cabinets can stay connected 24/7. Your **Next.js app stays on Vercel**; only the proxy runs on Hetzner.

**Time:** about 30–45 minutes the first time.

**Related:** [VERCEL_ENV.md](./VERCEL_ENV.md), [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md), [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md)

---

## What you are building

```text
Charging cabinet  --TCP 8088-->  Hetzner VPS (tcp-proxy)
                                      |
                                      v
                              Vercel (your-app.vercel.app)
                              /api/stations/message

Vercel (health & commands)  --HTTP 8089-->  Hetzner VPS
```

| Port | Who connects | Purpose |
|------|----------------|---------|
| **8088** | Cabinets | WsCharge binary protocol |
| **8089** | Vercel (`TCP_PROXY_URL`) | Health + send borrow/inventory commands |
| **22** | You (SSH) | Server administration |

---

## Before you start (checklist)

- [ ] PowerDon app deployed on **Vercel** (you have `https://something.vercel.app`)
- [ ] Supabase migrations applied (`005`–`008`)
- [ ] A **shared secret** for the proxy (you will generate one below)
- [ ] Hetzner account (credit card or PayPal)
- [ ] SSH client: **Windows Terminal**, **PuTTY**, or VS Code Remote SSH

---

## Part 1 — Create the Hetzner server

### 1. Sign up

1. Go to [https://www.hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Create an account and verify email.
3. Open **Hetzner Cloud Console**.

### 2. Create a project

1. Click **New Project** (e.g. name it `powerdon`).
2. Stay inside that project for all steps below.

### 3. Add an SSH key (recommended)

Using a key is safer than only a password.

**On your PC (PowerShell):**

```powershell
ssh-keygen -t ed25519 -C "powerdon-hetzner" -f "$env:USERPROFILE\.ssh\powerdon_hetzner"
```

Press Enter for no passphrase (or set one if you prefer).

Copy the **public** key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\powerdon_hetzner.pub"
```

In Hetzner: **Security → SSH keys → Add SSH key** → paste → save.

### 4. Create the server (Cloud Server)

1. **Servers → Add Server**
2. **Location:** pick closest to your cabinets (e.g. `Nuremberg` / `Falkenstein` for EU; `Ashburn` if available and cabinets are in US).
3. **Image:** **Ubuntu 24.04**
4. **Type:** **CX22** or **CAX11** (shared vCPU, ~2 GB RAM) — enough for the proxy.
5. **Networking:** IPv4 **enabled** (you need a public IP for cabinets).
6. **SSH keys:** select the key you added.
7. **Name:** `powerdon-tcp-proxy`
8. Click **Create & Buy now**

### 5. Note your server IP

On the server list, copy the **IPv4** address (example: `95.217.xxx.xxx`). Call this **`VPS_IP`** below.

---

## Part 2 — Firewall (Hetzner + Ubuntu)

### 6. Hetzner Cloud Firewall (console)

1. **Firewalls → Create Firewall**
2. Name: `powerdon-proxy`
3. **Inbound rules** (add these):

| Source | Port | Protocol | Description |
|--------|------|----------|-------------|
| `0.0.0.0/0` | `22` | TCP | SSH (your IP only if you know it) |
| `0.0.0.0/0` | `8088` | TCP | Cabinets |
| `0.0.0.0/0` | `8089` | TCP | Vercel → proxy health/commands |

4. **Outbound:** allow all (default).
5. **Apply to:** attach to server `powerdon-tcp-proxy`.

### 7. First login with SSH

**Windows PowerShell:**

```powershell
ssh -i "$env:USERPROFILE\.ssh\powerdon_hetzner" root@VPS_IP
```

Replace `VPS_IP` with your real IP. Type `yes` if asked about host key.

You should see a `root@...` prompt.

---

## Part 3 — Install software on the server

Run these commands **on the VPS** (as `root`).

### 8. Update the system

```bash
apt update && apt upgrade -y
```

### 9. Install Node.js 20

```bash
apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # should show v20.x
npm -v
```

### 10. Install PM2 (keeps proxy running after reboot)

```bash
npm install -g pm2
```

---

## Part 4 — Deploy the PowerDon proxy code

### 11. Clone your repository

```bash
cd /opt
git clone https://github.com/okparamichael7/powerdon-rental-app.git
cd powerdon-rental-app
```

If the repo is private, use a deploy key or copy files with `scp` instead.

### 12. Install dependencies

```bash
npm ci
```

This installs everything the project needs (including `tsx` for the proxy).

### 13. Generate a shared secret

On the **VPS**:

```bash
openssl rand -hex 32
```

Copy the output. You will use it as **`STATION_PROXY_TOKEN`** on both Hetzner and Vercel.

Example (do not use this one):

```text
a1b2c3d4e5f6...
```

---

## Part 5 — Configure environment on Hetzner

### 14. Create the proxy env file

```bash
nano /opt/powerdon-rental-app/.env.proxy
```

Paste (edit the values in ALL CAPS):

```env
# --- TCP proxy only (Hetzner) ---
TCP_PORT=8088
TCP_HOST=0.0.0.0
WS_PORT=8089

# Your Vercel app URL (no trailing slash)
API_BASE_URL=https://YOUR-APP.vercel.app

# Same secret on Vercel as STATION_PROXY_TOKEN
STATION_PROXY_TOKEN=PASTE_YOUR_OPENSSL_SECRET_HERE
API_AUTH_TOKEN=PASTE_SAME_SECRET_AGAIN

WSCHARGE_ENABLED=true
NODE_ENV=production
LOG_LEVEL=info
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

**Important:** Do **not** put Supabase or Stripe keys on Hetzner unless you have a special reason. The proxy only talks to Vercel.

---

## Part 6 — Start the proxy with PM2

### 15. Start the process

```bash
cd /opt/powerdon-rental-app
set -a && source .env.proxy && set +a
pm2 start npm --name powerdon-tcp-proxy -- run tcp-proxy
pm2 save
pm2 startup
```

`pm2 startup` prints a command — **copy and run that command** (it enables auto-start on reboot).

### 16. Check that it is running

```bash
pm2 status
pm2 logs powerdon-tcp-proxy --lines 30
```

You should see logs like TCP listening on **8088** and HTTP on **8089**.

### 17. Test health from the server

```bash
curl -s http://127.0.0.1:8089/health | head
```

You should get JSON with `"status":"healthy"` or similar.

### 18. Test from your PC

On **your Windows PC** (replace IP):

```powershell
curl http://VPS_IP:8089/health
```

If this fails, check Hetzner firewall rules and that PM2 shows `online`.

---

## Part 7 — Configure Vercel

In **Vercel → Project → Settings → Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `TCP_PROXY_URL` | `http://VPS_IP:8089` (use your real IP) |
| `STATION_PROXY_TOKEN` | **Same** secret as on Hetzner |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-APP.vercel.app` |

Plus all other required vars from [VERCEL_ENV.md](./VERCEL_ENV.md).

**Redeploy** Vercel after saving env vars.

### Verify Vercel sees the proxy

Open:

```text
https://YOUR-APP.vercel.app/api/health
```

Look for `tcp-proxy` healthy (or degraded if no cabinet connected) and `wscharge` section.

---

## Part 8 — Point the cabinet at Hetzner

On the cabinet (vendor tool, SMS, or protocol command `0x63`):

| Setting | Value |
|---------|--------|
| Server IP | `VPS_IP` (Hetzner IPv4) |
| Port | `8088` |

Not your Vercel URL. Not port 3000.

After power-on, check:

```bash
pm2 logs powerdon-tcp-proxy --lines 50
```

You should see a new TCP connection and login traffic.

In **Admin → Hardware** on Vercel app, station should show **online**.

---

## Part 9 — Quick reference

| Item | Value |
|------|--------|
| SSH | `ssh -i ~/.ssh/powerdon_hetzner root@VPS_IP` |
| Proxy logs | `pm2 logs powerdon-tcp-proxy` |
| Restart proxy | `pm2 restart powerdon-tcp-proxy` |
| Proxy env file | `/opt/powerdon-rental-app/.env.proxy` |
| Health URL | `http://VPS_IP:8089/health` |
| Cabinet target | `VPS_IP:8088` |

---

## Troubleshooting

### Cannot SSH

- Check server is running in Hetzner console.
- Confirm firewall allows port **22**.
- Verify IP and SSH key.

### `curl http://VPS_IP:8089/health` fails from PC

- PM2 running? `pm2 status`
- Hetzner firewall allows **8089** inbound?
- On VPS: `curl http://127.0.0.1:8089/health` — if local works but remote fails, it is firewall.

### Proxy runs but Vercel health says tcp-proxy unhealthy

- `TCP_PROXY_URL` must be `http://VPS_IP:8089` (not `localhost`).
- `STATION_PROXY_TOKEN` on Vercel must **match** Hetzner exactly.
- Redeploy Vercel after env change.

### Cabinets connect but login fails (401)

- Token mismatch between Hetzner `STATION_PROXY_TOKEN` and Vercel.
- Restart proxy after env change: `pm2 restart powerdon-tcp-proxy`

### Station offline in admin

- Cabinet must use **8088** on Hetzner IP.
- Check `pm2 logs` for incoming connections.
- Confirm `API_BASE_URL` in `.env.proxy` is correct Vercel URL.

### After changing `.env.proxy`

```bash
cd /opt/powerdon-rental-app
set -a && source .env.proxy && set +a
pm2 restart powerdon-tcp-proxy
```

---

## Optional next steps

- **DNS:** Point `proxy.yourdomain.com` A-record to `VPS_IP`, use `TCP_PROXY_URL=https://proxy.yourdomain.com` with nginx + TLS (advanced).
- **Updates:** `cd /opt/powerdon-rental-app && git pull && npm ci && pm2 restart powerdon-tcp-proxy`
- **Monitoring:** Hetzner alerts + `pm2 monit`

---

## Cost expectation

A small CX22/CAX11 server is typically **a few euros per month**. You only pay Hetzner for the VPS; Vercel and Supabase are billed separately.

---

## Summary

1. Create Hetzner Ubuntu server with public IPv4.
2. Open ports **8088** and **8089**.
3. Install Node + PM2, clone repo, `npm ci`.
4. Set `.env.proxy` with `API_BASE_URL` (Vercel) and `STATION_PROXY_TOKEN`.
5. `pm2 start` → `pm2 save` → `pm2 startup`.
6. Set Vercel `TCP_PROXY_URL` + same token → redeploy.
7. Configure cabinet to **VPS_IP:8088**.

You now have an always-on hardware bridge while the app stays on Vercel.
