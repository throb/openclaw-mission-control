# BobBot Mission Control - Architecture

## Overview

Web-based mission control for OpenClaw agent orchestration. Beautiful, secure, performant.

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14 (App Router) | SSR, API routes, modern React |
| UI | shadcn/ui + Tailwind | Apple-quality components, dark mode |
| Database | PostgreSQL | Concurrent access, JSON support, production-grade |
| ORM | Prisma | Type-safe, migrations, great DX |
| Auth | NextAuth.js + TOTP | 2FA, session management |
| Editor | Monaco Editor | VSCode-quality editing |
| Real-time | Server-Sent Events | Live updates without WebSocket complexity |

## Security Model

### Access Control
- **Port**: 18742 (non-standard to avoid port scans)
- **Auth**: Email/password + mandatory TOTP 2FA
- **Sessions**: JWT with short expiry, refresh tokens
- **Rate Limiting**: Per-IP and per-user limits

### API Key Security
- Encrypted at rest (AES-256-GCM)
- Master key from environment variable
- Keys never logged or exposed in responses
- Audit trail for all key access

### Network
- HTTPS required (Let's Encrypt or Cloudflare)
- CORS restricted to known origins
- CSP headers configured
- No sensitive data in URLs

## Database Schema (Core Entities)

```
Agent
├── id, name, description
├── agentMdContent (versioned)
├── soulMdContent (versioned)
├── status (active/paused)
└── createdAt, updatedAt

Project
├── id, name, description
├── agents[] (many-to-many)
└── boards[]

Board (Kanban)
├── id, name, projectId
├── columns[] (todo, in_progress, review, done)
└── tasks[]

Task
├── id, title, description
├── boardId, columnId
├── assignedAgentId
├── priority (P0-P4)
├── threads[] (conversations)
└── attachments[] (images, videos)

Thread
├── id, taskId
├── messages[]
└── participants[]

CronJob
├── id, name, schedule
├── agentId
├── payload
├── enabled
└── lastRun, nextRun

Model
├── id, provider, name
├── apiKeyEncrypted
├── isDefault
└── config (JSON)

FileVersion
├── id, filePath
├── content, contentHash
├── agentId (who made change)
├── createdAt
└── parentVersionId (for revert chain)
```

## Directory Structure

```
bobbot/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── setup-2fa/
│   │   └── verify/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard shell
│   │   ├── page.tsx            # Overview
│   │   ├── agents/
│   │   │   ├── page.tsx        # Agent list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx    # Agent detail
│   │   │   │   └── edit/       # Edit agent.md
│   │   ├── projects/
│   │   │   ├── page.tsx        # Project list
│   │   │   └── [id]/
│   │   │       └── board/      # Kanban view
│   │   ├── cron/
│   │   │   └── page.tsx        # Cron management
│   │   ├── models/
│   │   │   └── page.tsx        # Model/key management
│   │   └── settings/
│   │       ├── page.tsx
│   │       └── soul/           # Edit SOUL.md
│   └── api/
│       ├── auth/
│       ├── agents/
│       ├── projects/
│       ├── tasks/
│       ├── cron/
│       └── models/
├── components/
│   ├── ui/                     # shadcn components
│   ├── editor/                 # Monaco wrapper
│   ├── kanban/                 # Board components
│   ├── feedback/               # Image/video upload
│   └── layout/                 # Shell, nav, etc.
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── db.ts                   # Prisma client
│   ├── crypto.ts               # Key encryption
│   ├── openclaw.ts             # OpenClaw API client
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── .env.example                # Template (no secrets!)
├── .gitignore                  # MUST ignore .env
├── docker-compose.yml          # PostgreSQL
└── package.json
```

## Phases

### Phase 1: Foundation (P0)
- [ ] Project scaffolding (Next.js, Tailwind, shadcn)
- [ ] PostgreSQL + Prisma setup
- [ ] Auth with 2FA
- [ ] Basic dashboard layout

### Phase 2: Agent Management (P1)
- [ ] Agent CRUD
- [ ] Monaco editor for agent.md
- [ ] File versioning system
- [ ] SOUL.md editing

### Phase 3: Kanban System (P1)
- [ ] Projects CRUD
- [ ] Board with drag-and-drop
- [ ] Task management
- [ ] Agent assignment
- [ ] Threaded conversations

### Phase 4: Feedback & Media (P2)
- [ ] Image paste/upload
- [ ] Video upload support
- [ ] Feedback interface
- [ ] Media storage (local or S3)

### Phase 5: Cron & Models (P2)
- [ ] Cron job viewer/editor
- [ ] Model management
- [ ] Encrypted API key storage
- [ ] Integration with OpenClaw config

### Phase 6: Polish & Mobile (P3)
- [ ] Performance optimization
- [ ] Mobile-responsive design
- [ ] Real-time updates
- [ ] Audit logging

## Environment Variables

```bash
# .env.example (safe to commit)
DATABASE_URL="postgresql://user:pass@localhost:5432/bobbot"
NEXTAUTH_URL="https://your-domain:18742"
NEXTAUTH_SECRET="generate-with-openssl-rand"
ENCRYPTION_KEY="32-byte-hex-key-for-api-keys"
```

## Deployment

1. PostgreSQL via Docker or managed service
2. Next.js via PM2 or Docker
3. Nginx reverse proxy with SSL
4. Firewall: only 443 and 18742 open
