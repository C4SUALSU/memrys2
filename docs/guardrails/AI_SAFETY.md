# AI Safety Guardrails

## Hallucination Detection

The edge function validates all AI-returned dates against a ±365 day window from the reference date.

```typescript
function isWithinWindow(dateStr, referenceDate, windowDays) {
  const ref = new Date(referenceDate).getTime();
  const date = new Date(dateStr).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return date >= ref - windowMs && date <= ref + windowMs;
}
```

Events outside this window are filtered with a warning, never silently accepted.

## Rate Limiting

### OpenRouter 429
- Edge function returns 429 with message: "AI service is rate limited. Please wait a moment and try again."
- Frontend shows error toast
- User must manually retry

### Context Length Exceeded
- Edge function detects 400 + "context_length" / "too long" in response
- Returns `{ reset_session: true }` flag
- Frontend shows: "Input is too long. Try shortening or reset session."
- User can click "Reset" to clear the textarea

## Input Validation

| Layer | Check |
|---|---|
| Frontend | Non-empty text before API call |
| Edge function | Text exists, is string, non-empty after trim |
| AI response | Content is valid JSON, matches schema |
| Event-level | Start/end are valid ISO 8601, within date window |
| Output | Only valid events returned; invalid ones filtered with warning |

## Model Availability

### Fallback chain
1. User's custom model (if model_config_id provided + key in Vault)
2. Default Gemma 4 (free tier, no key needed)
3. If no key at all + no default → error: "Add a model in Settings"

### Model failure modes
| Scenario | User Experience |
|---|---|
| Custom model key invalid/expired | Falls back to Gemma free |
| OpenRouter API down | Error toast: "AI service returned error 500" |
| Model responds with non-JSON | Warning: "AI returned invalid format" |
| Model returns empty events | Info: "No events found in your text" |

## Session Management

The edge function is **fully stateless** — each call is independent. There is no conversation history or context carried between requests.

- "Reset Session" is a frontend-only action: clears textarea + dismisses pending approvals
- No LLM conversation threads are maintained
- This prevents context drift, hallucination amplification, and token cost accumulation
