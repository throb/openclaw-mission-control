# OpenClaw Mission Control

A self-hosted dashboard for managing AI agents, tasks, cron jobs, and integrations. Built with Next.js 14, Prisma, PostgreSQL, and Tailwind CSS.

## Quick Start

> **For AI assistants**: Follow these steps exactly. The app runs on port **18742**.

### Prerequisites

- **Node.js** >= 18
- **Docker** and **Docker Compose** (for PostgreSQL)
- **Git**

### 1. Clone the repo

```bash
git clone https://github.com/throb/openclaw-mission-control.git
cd openclaw-mission-control
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on `localhost:5432` (bound to localhost only).

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set these required values:

```env
# Database — if using the included docker-compose, set your DB_PASSWORD:
DATABASE_URL="postgresql://bobbot:YOUR_PASSWORD@localhost:5432/bobbot?schema=public"

# Auth — generate a random secret:
NEXTAUTH_URL="http://localhost:18742"
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"

# Encryption key for stored API keys — generate a random 32-byte hex key:
ENCRYPTION_KEY="<run: openssl rand -hex 32>"

# Admin email (used for first-user setup)
ADMIN_EMAIL="you@example.com"
```

You can set the Docker Compose DB password via the `DB_PASSWORD` env var (defaults to `changeme` if unset):

```bash
export DB_PASSWORD="your-secure-password"
docker compose up -d
```

### 5. Set up the database schema

```bash
npx prisma generate
npx prisma db push
```

### 6. Run the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:18742**.

### 7. (Optional) Production build

```bash
npm run build
npm run start
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 18742) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database browser |
| `npx prisma migrate dev` | Run database migrations |
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL 16 + Prisma ORM
- **UI**: Tailwind CSS, Radix UI, Lucide icons
- **Auth**: Session-based with bcrypt password hashing
- **AI**: Anthropic SDK
- **Editor**: Monaco (VS Code editor component)
