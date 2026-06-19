# Error Handling

## Toast Notification System

All user-facing errors are surfaced via toast notifications. This provides instant feedback without blocking the UI.

### Toast API
```typescript
const toast = useToast();
toast.success('Event added successfully');
toast.error('Failed to send message: rate limited');
toast.warning('2 events filtered out — dates out of range');
toast.info('No events found in your text');
```

### Toast Types

| Type | Color | Icon | Use Case |
|---|---|---|---|
| `success` | Emerald | CheckCircle | Successful operations |
| `error` | Red | AlertCircle | Failures, network errors, auth errors |
| `warning` | Amber | AlertTriangle | Partial failures, filtered results |
| `info` | Blue | Info | Neutral status updates |

### Auto-dismiss
- Default: 6 seconds
- Toasts stack at top-right (z-index: 9999)
- Animate in with `toastIn` keyframe
- Manual dismiss via X button

## Error Handling Protocol

### Hooks
Every async operation returns `{ error: string | null }`:
```typescript
const { error } = await sendMessage(text, userId);
if (error) toast.error(error);
```

### Edge Function
Returns structured errors:
```json
{
  "events": [],
  "error": "Human-readable description",
  "reset_session": true  // optional flag
}
```

### Error Categories

| Category | Frontend Action | User Sees |
|---|---|---|
| Network error | Retry suggestion toast | "Connection failed. Check your internet." |
| Auth error | Redirect to login | "Session expired. Please sign in again." |
| Rate limit (429) | Disable button, auto-retry hint | "Rate limited. Please wait a moment." |
| Context limit | Show reset suggestion | "Input too long. Try shorter or reset session." |
| AI malformed JSON | Show retry suggestion | "AI returned invalid format. Try again." |
| Hallucinated dates | Filter silently, show warning | "2 events filtered: dates out of range." |
| Vault key missing | Show settings link | "Model key unavailable. Check Settings." |
| DB constraint violation | Log + generic message | "Could not save. The item may already exist." |
| Validation error | Inline message | Specific guidance (e.g., "Email is required") |

## Audit Logging

All CRUD operations on key tables are automatically logged to `audit_log`:

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY,
  operation text,      -- INSERT, UPDATE, DELETE
  table_name text,     -- calendar_events, chat_messages, etc.
  record_id uuid,
  user_id uuid,
  old_data jsonb,      -- null for INSERT
  new_data jsonb,      -- null for DELETE
  created_at timestamptz
);
```

Triggers are attached to: `calendar_events`, `chat_messages`, `space_members`, `user_model_configs`.

## Retry Strategy

For transient failures:
1. Toast shows specific error
2. User can manually retry (clicking "Parse" again, "Send" again, etc.)
3. No automatic retries for write operations
4. Realtime subscriptions auto-reconnect via Supabase client
