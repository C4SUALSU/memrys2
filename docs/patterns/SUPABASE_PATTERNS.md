# Supabase Patterns

## Row-Level Security (RLS)

### EXISTS pattern for membership checks
Instead of deep subqueries, use flat EXISTS clauses:
```sql
CREATE POLICY "Members can read chat" ON chat_messages FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM space_members
    WHERE space_id = chat_messages.space_id AND user_id = auth.uid()
  ));
```

### Policy rules
1. Every table has RLS enabled
2. INSERT policies check `auth.uid() = created_by` or `user_id = auth.uid()`
3. SELECT policies for shared resources use EXISTS on `space_members`
4. No policy allows anonymous access

## Supabase Vault

### Storing secrets
```sql
SELECT vault.create_secret('my-api-key', 'Description') INTO vault_id;
```

### Retrieving secrets (via SECURITY DEFINER function)
```sql
SELECT decrypted_secret INTO plaintext FROM vault.decrypted_secrets WHERE id = vault_id;
```

### Pattern for user-owned secrets
1. User submits API key via frontend
2. Frontend calls `supabase.rpc('store_model_key', { ... })`
3. RPC function creates Vault secret + `user_model_configs` row
4. Edge function retrieves key via `supabase.rpc('get_decrypted_model_key', { ... })`
5. Raw key never stored in any query result accessible to client

## Realtime

### Channel naming convention
```
chat:{spaceId}         — chat messages for a space
calendar:{userId}      — user's personal calendar events
```

### Subscription pattern
```typescript
supabase
  .channel('chat:abc123')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `space_id=eq.abc123`
  }, (payload) => { ... })
  .subscribe();
```

## Migrations

### Naming convention
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

### Best practices
- Always idempotent (use `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`)
- Include RLS policies with the table definition
- Add indexes alongside table creation
- Use `SET search_path = ''` on SECURITY DEFINER functions
