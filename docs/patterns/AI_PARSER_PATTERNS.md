# AI Parser Patterns

## Model Routing

The Brain Dump parser supports multiple AI models via OpenRouter:

1. **Default (Free)**: `google/gemma-4-26b-a4b-it:free` — no API key needed
2. **Custom Models**: Users configure their own OpenAI/Anthropic/Google keys in Settings

### Flow
```
User types brain dump → Selects model → Frontend sends to edge function
                                                │
                                    ┌───────────┴───────────┐
                                    │ model_config_id set?    │
                                    │   YES → Fetch key from  │
                                    │          Vault via RPC  │
                                    │   NO  → Use env var     │
                                    │          OPENROUTER_KEY │
                                    └───────────┬───────────┘
                                                ▼
                                        OpenRouter API
                                                │
                                                ▼
                                    JSON Schema response
                                                │
                                                ▼
                                    Validate + filter
                                    ±365 day window guard
```

## Prompt Engineering

### System prompt structure
1. Define role: "precise calendar event extraction engine"
2. Anchor date: absolute reference point for relative calculations
3. Timezone awareness: all relative dates calculated in user's TZ
4. Defaults: 9 AM - 10 AM if no time specified
5. Edge cases: all-day events, non-event text, implicit events
6. Format: strict ISO 8601 UTC output

### JSON Schema (OpenRouter `response_format`)
```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "calendar_extraction",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "events": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" },
              "start_time": { "type": "string" },
              "end_time": { "type": "string" },
              "is_all_day": { "type": "boolean" }
            },
            "required": ["title", "description", "start_time", "end_time", "is_all_day"]
          }
        }
      },
      "required": ["events"]
    }
  }
}
```

## Safety Guarantees

### Hallucination Detection
Events with dates >365 days from reference date are automatically filtered.

### Rate Limit Handling
- 429 from OpenRouter → user sees "rate limited, retry after Xs"
- Context limit → user sees "input too long, try shorter or reset"

### Input Validation
- Max input length handled by model context window
- Client-side: `useBrainDump` rejects empty input before API call
- Server-side: edge function validates required fields
