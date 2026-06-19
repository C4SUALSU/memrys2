# Data Flow

## Brain Dump Pipeline

```
User types text in CalendarWorkspace
        │
        ▼
BrainDumpInput component
        │
        ├─ onReset: clears textarea + results
        │
        └─ onParse: calls useBrainDump.parse()
                │
                ├─ Validates: user authenticated, text non-empty
                ├─ Sets isProcessing = true
                │
                ├─ Calls ai-parser.ts → POST /functions/v1/parse-brain-dump
                │       │
                │       ├─ Headers: Authorization: Bearer <JWT>
                │       ├─ Body: { text, user_timezone, current_reference_date, model_config_id? }
                │       │
                │       ▼
                │   Edge Function (Deno)
                │       │
                │       ├─ Extract JWT user_id
                │       ├─ If model_config_id → RPC get_decrypted_model_key → api_key
                │       ├─ Else → use OPENROUTER_API_KEY env + DEFAULT_MODEL
                │       ├─ Build system prompt with anchor date
                │       ├─ POST OpenRouter API with JSON schema
                │       ├─ Parse + validate response
                │       ├─ Filter hallucinated dates
                │       └─ Return { events[], warnings[] }
                │
                ▼
        BrainDumpResponse returned
                │
                ├─ On error → toast.error(), show error card
                ├─ On success → results = response.events
                │
                ▼
PendingApprovals renders each event
        │
        ├─ onAccept → useBrainDump.acceptEvent()
        │       ├─ INSERT into calendar_events
        │       ├─ INSERT into calendar_event_attendees (status='confirmed')
        │       └─ Remove from results array
        │
        └─ onReject → Remove from results array
```

## Chat → Calendar Forward Flow

```
GroupChatView
        │
        ├─ Long-press on message → enable selection mode
        ├─ Checkboxes appear on all messages
        ├─ User selects multiple messages
        │
        ▼
BatchActionBar (slides up from bottom)
        │
        └─ "Forward to Brain Dump" clicked
                │
                ├─ Concatenate: "Sender: message_text\nSender2: message_text2"
                ├─ navigate('/calendar', {
                │     state: { forwardedText, spaceId }
                │   })
                │
                ▼
CalendarWorkspace receives state
                │
                ├─ useEffect reads forwardedText
                ├─ Pre-fills BrainDumpInput textarea
                ├─ window.history.replaceState clears forwardedText from URL state
                │
                └─ User can edit + parse as normal
```

## Realtime Chat Flow

```
User A sends message
        │
        ├─ INSERT into chat_messages (via useChat.sendMessage)
        │
        ▼
Postgres CDC event fires
        │
        ├─ Realtime channel 'chat:{spaceId}' picks up INSERT
        │
        ▼
All connected clients (User B, User C, etc.)
        │
        ├─ on('postgres_changes', 'INSERT', ...) handler fires
        ├─ Fetches sender profile for display name
        └─ Appends to local messages state
```

## Auth Flow

```
User visits app (not authenticated)
        │
        ▼
AuthAndSettings renders email input
        │
        └─ User enters email → signInWithOtp(email)
                │
                ├─ supabase.auth.signInWithOtp({ email })
                │
                ▼
            Supabase sends magic link email
                │
                └─ User clicks link → redirects to /calendar
                        │
                        ├─ onAuthStateChange fires
                        ├─ AuthContext fetches session + profile
                        ├─ New user → trigger creates profile row
                        └─ App renders authenticated UI
```
