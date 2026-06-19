# Changelog

## v3.0.0 — Initial Release (2026-06-20)

### Added
- **Core Schema**: Full PostgreSQL schema with 7 tables, 14+ indexes, RLS policies, audit logging, and Vault integration
- **AI Brain Dump Parser**: Supabase Edge Function calling OpenRouter API with strict JSON schema mode
- **Calendar Workspace**: Natural language event parsing with pending approvals queue
- **Group Chat**: Real-time messaging via Supabase Realtime with long-press batch selection
- **Auth & Settings**: Email OTP magic link auth, timezone management, custom AI model configuration
- **Vault Key Storage**: User API keys encrypted at rest in Supabase Vault
- **Toast Notification System**: Global error/success/warning toast framework
- **Dark UI Theme**: Zinc/Slate minimalist design system with Tailwind CSS
- **Audit Logging**: Automatic logging of all CRUD operations on key tables
- **Space System**: Direct partner, group chat, and family circle support
- **Collaborative Calendar**: Per-space events with attendee status tracking

### Security
- Row-Level Security enabled on all 7 tables
- JWT verification on edge function
- Vault-encrypted API key storage
- Cascade cleanup on member leave (preserves event data for remaining members)
- Hallucination detection in AI parser output
