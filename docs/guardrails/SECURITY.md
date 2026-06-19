# Security Architecture

## Authentication & Authorization

### Auth Method
- Email OTP (magic link) via Supabase Auth
- JWT-based sessions with auto-refresh
- Future: Google OAuth SSO (hooks in place)

### Row-Level Security (RLS)
Every table has RLS enabled. Users can only access their own data or data in spaces they belong to.

#### Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Own row | — (via trigger) | Own row | — (cascade) |
| `spaces` | Members + creator | Authenticated | Creator only | — |
| `space_members` | Members of that space | Self-join | — | Self-leave |
| `chat_messages` | Space members | Space members (self) | — | — |
| `calendar_events` | Creator or space members | Authenticated (self) | Creator only | Creator only |
| `calendar_event_attendees` | Own rows | Self | Self | Self |
| `user_model_configs` | Own rows | Self | Self | Self |
| `audit_log` | Own entries | System only | — | — |

## API Key Storage

### Vault Architecture
```
User submits API key in Settings
        │
        ▼
Frontend: supabase.rpc('store_model_key', {
  p_provider: 'openai',
  p_model_id: 'openai/gpt-4o',
  p_display_name: 'My GPT-4o',
  p_api_key: 'sk-...'
})
        │
        ▼
Postgres SECURITY DEFINER function:
  1. vault.create_secret(api_key, description) → vault_id
  2. INSERT user_model_configs (vault_key_id = vault_id)
  3. RETURN config_id
        │
        ▼
user_model_configs table:
  vault_key_id → uuid reference to vault.secret (NOT the raw key)

Edge function retrieves:
  1. supabase.rpc('get_decrypted_model_key', { p_config_id })
  2. Decrypts via vault.decrypted_secrets
  3. Returns plaintext → used in-memory → discarded after API call
```

## Data Protection

### Soft Deletion / Member Leave
When a user leaves a space:
1. Their `space_members` row is deleted
2. Trigger `cleanup_attendees_on_leave()` fires
3. Their `calendar_event_attendees` rows for events in that space are deleted
4. **The events and messages remain intact** for remaining members

### Profile Deletion
When a user deletes their profile (via `auth.users` cascade):
1. All FKs are `ON DELETE CASCADE` — their messages, attendee records, model configs are removed
2. Shared events they created remain (created_by becomes NULL via SET NULL or event stays)
3. Audit trail of their operations is preserved

## Edge Function Security

- `verify_jwt: true` — function only accessible to authenticated users
- API keys fetched from Vault via SECURITY DEFINER RPC
- Keys never logged or returned to client
- Input validated: required fields checked, text length sanity-checked
- OpenRouter calls use Authorization header, never exposed

## Transport Security

- All Supabase API calls over HTTPS
- All OpenRouter API calls over HTTPS
- JWT tokens transmitted via Authorization header only
- No secrets in client-side bundles (API keys in Vault, env vars server-side)
