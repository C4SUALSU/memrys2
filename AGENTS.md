# Project: memrys2

## Supabase MCP

This project uses Supabase for its backend. The Supabase MCP is configured in `.opencode/opencode.json`.

### Adding a new Supabase project MCP

To add another Supabase project (e.g., wishes2vows) to the global config at `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "supabase-<project-name>": {
      "type": "remote",
      "url": "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions",
      "enabled": false,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:SUPABASE_PAT}"
      }
    }
  }
}
```

Replace `<PROJECT_REF>` with the project's Supabase reference ID.
Rename the key `supabase-<project-name>` to something unique (e.g., `supabase-wishes2vows`).

### Authentication

This config uses a Supabase Personal Access Token (PAT) for auth.

1. Go to https://supabase.com/dashboard/account/tokens
2. Create a new token with the necessary scopes
3. Set it as an environment variable:

```
$env:SUPABASE_PAT = "sbp_..."
```

Or add it permanently to your PowerShell profile.

### Supabase Agent Skills

Supabase agent skills are installed at `.agents/skills/`:
- `supabase` - general Supabase development guidance
- `supabase-postgres-best-practices` - Postgres best practices for Supabase
