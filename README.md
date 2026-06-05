# DeskLink

**Production-grade remote desktop platform** — simpler and more accessible than AnyDesk for non-technical users.

## Features

- 🖥️ **Cross-platform** — Windows and macOS support
- 🔗 **Device ID connection** — Easy 9-character IDs (e.g., `DL-7K2-MN9-4X`)
- 🔐 **Temporary passcodes** — Auto-rotating, rate-limited, PBKDF2-hashed
- 📡 **WebRTC P2P** — Direct peer-to-peer with TURN fallback
- 🏢 **Office Network Mode** — Unattended access with access rules
- 🔄 **Auto-reconnect** — Survives network switches seamlessly
- 📊 **Session logging** — Full audit trail for compliance
- 🤖 **AI Diagnostics** — Intelligent connection troubleshooting

## Architecture

```
Client App ←→ Signaling Server (WebSocket) ←→ Host Agent
     ↕                                            ↕
     └─────── WebRTC P2P (or TURN relay) ─────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL, Redis, coturn)

### Setup

```bash
# 1. Clone and install
npm install

# 2. Start infrastructure
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3. Copy environment
cp .env.example .env

# 4. Run database migrations
npm run db:migrate

# 5. Seed development data
npm run db:seed

# 6. Start development servers
npm run dev
```

## Project Structure

```
desklink/
├── packages/
│   ├── common/             # Shared types & utilities
│   ├── signaling-server/   # WebSocket signaling service
│   ├── api-server/         # REST API (Fastify)
│   └── client-ui/          # React UI components
├── apps/
│   ├── host-agent/         # Tauri desktop: Host Agent
│   └── client-app/         # Tauri desktop: Client App
├── infra/
│   ├── docker/             # Docker Compose configs
│   ├── coturn/             # TURN server config
│   └── terraform/          # Infrastructure as Code
└── docs/                   # Architecture documentation
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Signaling** | Node.js, TypeScript, WebSocket (`ws`) |
| **API** | Fastify, Drizzle ORM, PostgreSQL |
| **Cache/State** | Redis 7 |
| **Desktop Apps** | Tauri v2 (Rust + React) |
| **NAT Traversal** | coturn (TURN/STUN) |
| **Build** | Turborepo, npm workspaces |

## License

Proprietary — All rights reserved.
