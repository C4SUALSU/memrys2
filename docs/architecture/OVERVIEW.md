# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite + React 19)               │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐               │
│  │ Calendar │  │   Chat    │  │   Settings   │               │
│  │Workspace │  │   View    │  │   & Auth     │               │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘               │
│       │              │               │                        │
│  ┌────┴──────┬───────┴───────┬───────┴────────┐               │
│  │  Hooks    │  Context     │      Lib        │               │
│  │ useChat   │  AuthContext │  supabase.ts    │               │
│  │ useBrain..│  ToastCtx    │  ai-parser.ts   │               │
│  └────┬──────┴───────┬───────┴───────┬────────┘               │
│       │              │               │                        │
│       │    Supabase Client (JWT)      │                        │
└───────┼──────────────┼───────────────┼────────────────────────┘
        │              │               │
        ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐        │
│  │ Postgres │  │ Realtime  │  │  Edge Functions       │        │
│  │  Tables  │  │  Pub/Sub  │  │  parse-brain-dump     │        │
│  │  + RLS   │  │ Broadcast │  │   → OpenRouter API     │        │
│  │  + Vault │  │  PRESENCE │  └──────────────────────┘        │
│  └──────────┘  └───────────┘                                   │
│  ┌──────────┐  ┌───────────┐                                   │
│  │   Auth   │  │  Storage  │                                   │
│  │ MagicLink│  │ (future)  │                                   │
│  └──────────┘  └───────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

## Stack Decisions

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + Vite | Latest React, fast HMR |
| Styling | Tailwind CSS 3.4 | Utility-first, dark theme built-in |
| Icons | Lucide React | Tree-shakeable, consistent icon set |
| Dates | date-fns + date-fns-tz | Immutable, tree-shakeable, IANA tz support |
| Routing | React Router v7 | File-based optional, state-passing for cross-page data |
| Database | Supabase PostgreSQL | Managed Postgres with realtime |
| Auth | Supabase Auth | Magic link OTP, future OAuth |
| Realtime | Supabase Realtime | Postgres CDC for chat + calendar |
| Secrets | Supabase Vault | Encrypted at rest, access-controlled |
| AI | OpenRouter via Edge Function | Multi-model routing, JSON schema enforced |
| Runtime | Deno Edge | Globally distributed, low latency |

## Key Design Decisions

1. **Privacy-first**: RLS enforced at database level, not application level
2. **Soft cleanup**: When a member leaves, only their attendance data is removed; events and messages remain for remaining members
3. **Stateless AI**: Edge function is fully stateless; each call is independent. "Reset" is a frontend-only concept
4. **Model flexibility**: Users bring their own API keys; encrypted in Vault; system provides free Gemma fallback
5. **Batch forwarding**: Chat messages can be selected and forwarded to the parser, bridging social context with calendar planning
