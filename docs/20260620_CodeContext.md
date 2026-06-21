# 20260620_CodeContext

## 1. High-Level Architecture & System Design

### Core Purpose
MEMRYS is a privacy-first micro-social application built around private Spaces (Partners, Friends, Family), real-time chat, and an AI-powered collaborative calendar called "Brain Dump." Users can type natural language like "dinner with Vina Saturday 10pm" and have it parsed into structured calendar events via an OpenRouter-backed edge function. Data isolation is enforced at the database level through strict Row-Level Security (RLS) policies — every query to shared resources checks the caller's membership in the relevant space.

### System Data Flow

```
User Action (React 19 frontend)
        │
        ├── Authenticated via Supabase Auth (email/password JWT)
        │
        ├── Chat: INSERT → Supabase Realtime broadcasts to space members
        ├── Calendar: INSERT/UPDATE → RLS-gated PostgREST → timestamptz UTC rows
        ├── Friends: RPC calls → friend_connections table + search_users()
        └── Brain Dump: POST → Edge Function (Deno) → OpenRouter API → event JSON
                │
                └── Response validated → Pending Approvals queue → Accept → INSERT into calendar_events
```

### Module Topology

```
src/
├── main.tsx                          # Entry: ToastProvider → AuthProvider → App
├── App.tsx                           # Router: / → LandingPage, /login → AuthAndSettings, /app → AppLayout
├── pages/                            # Route-level entry points (Landing, Dashboard, Friends)
├── components/                       # Domain components (Calendar, Chat, Settings, Friends)
│   └── ui/                           # Atomic primitives (Button, Input, Modal, Badge, Toast, etc.)
├── context/                          # Cross-cutting state (AuthContext, ToastContext, TimeTreeContext)
├── hooks/                            # Data operations per domain (useBrainDump, useChat, useCalendarEvents, etc.)
├── lib/                              # Infrastructure (supabase client, ai-parser, constants)
└── types/                            # TypeScript interfaces (app.ts, supabase.ts)

supabase/
├── functions/parse-brain-dump/       # Deno edge function (8 versions deployed)
├── migrations/                       # SQL DDL + RLS + triggers (core_schema, friend_system)
└── config.toml                       # Supabase CLI project configuration
```

**Dependency Direction:** `pages → components → hooks → lib → types` (strictly layered). Context providers wrap all routes. Supabase client is a singleton in `lib/supabase.ts`. Database schema has 9 tables, 15+ indexes, full RLS enforcement, and a Vault-based API key encryption system.

---

## 2. Coding Standards, Guardrails & Engineering Hygiene

### Architecture Guardrails (from `docs/engineering_guardrails.md`)

The codebase has a formal guardrails document at `docs/engineering_guardrails.md` (429 lines) that defines hard compliance constraints across 6 domains:

| Guardrail Domain | Key Rules | Violation Risk |
|---|---|---|
| **TIMETREE CONTEXT ISOLATION** | `NavigationSidebar` is the master context controller. `currentSpace` must be `Space | null` (binary state). Personal calendar must always be accessible. URL `?tab=` and `?space=` are the single source of truth. | **HIGH** — sidebar must never use `useSearchParams` directly |
| **DUAL-STAGE ACCOUNT DELETION** | `delete_own_account()` RPC is the sole deletion gateway. FK cascades must fire: `profiles.id → SET NULL on events, CASCADE on members/messages/attendees/configs`. Spaces with >1 member must survive. | **CRITICAL** — direct `DELETE FROM profiles` from client is FORBIDDEN |
| **TIMEZONE NORMALIZATION** | All timestamps are `timestamptz` in DB. Frontend must use `useTimezone().toLocal()` for display. `profile.timezone` is the single source of truth (not browser timezone). | **HIGH** — RN-02: `CalendarView` currently uses raw `date-fns` without timezone conversion |
| **OAUTH SSO SCALING** | `profiles.id` must always equal `auth.users.id`. No provider-specific columns on `profiles`. `handle_new_user()` trigger must coalesce across OAuth naming conventions. | **MEDIUM** — trigger needs extension for `avatar_url` and `full_name` |
| **URL DEEP-LINKING** | Every app state must be encodable in `?tab=` and `?space=`. `activeTab` is derived from search params, not `useState`. | **MEDIUM** — `setActiveTab()` must call `setSearchParams()` |
| **COMPLIANCE ENFORCEMENT** | PRs must pass 8 code review gates (G-01 through G-08). Migrations must pass 5 migration guardrails (MG-01 through MG-05). TypeScript must compile clean. | **GATE** — `npx tsc --noEmit` must pass before merge |

### Code Hygiene

- **No `hygiene.MD` file exists** in the repository. The closest equivalent is `docs/engineering_guardrails.md` which serves as the formal compliance framework.
- **TypeScript strict mode** is enabled (`tsconfig.json: "strict": true, "noUnusedLocals": false, "noFallthroughCasesInSwitch": true`). Pre-existing type errors are permitted if unchanged.
- **Linting:** `eslint` is listed in `package.json` scripts (`"lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"`) but no eslint config file was found in the repo — the command may not execute without configuration.
- **Build verification:** `"build": "tsc -b && vite build"` — both TypeScript compilation and Vite bundling are required.
- **Custom CSS classes** in `index.css` (`@layer components`): `.glass-surface`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input-field`, `.badge-*` — all new components should use these shared classes rather than inline Tailwind for consistency.
- **Documentation standard:** All changelogs go in `docs/changelog/YYYYMMDD_descriptive_title.md`. Architecture docs in `docs/architecture/`. Patterns in `docs/patterns/`. Guardrails in `docs/guardrails/`.
- **Supabase migration naming:** `YYYYMMDDHHMMSS_descriptive_name.sql` format with idempotent `DROP IF EXISTS` patterns.

### Known Non-Compliance (from Risk Register)

| ID | Issue | Severity | File |
|---|---|---|---|
| RN-01 | Missing `spaces.created_by` NULLIFICATION guard in `delete_own_account` RPC | HIGH | Migration |
| RN-02 | `CalendarView` uses raw `date-fns` without timezone conversion | HIGH | `CalendarView.tsx:166` |
| RN-03 | `EventModal` uses `new Date().toISOString()` instead of `fromZonedTime()` | HIGH | `EventModal.tsx` |
| RN-04 | Dual delete account implementations in `AuthAndSettings.tsx` and `SettingsView.tsx` | MEDIUM | Both files |
| RN-05 | `TimezonePicker` IANA full list on login route is grandfathered | LOW | `TimezonePicker.tsx` |
| RN-06 | `DashboardPage` broad event query with no space filter | LOW | `DashboardPage.tsx` |

---

## 3. Deep-Dive Module & Feature Breakdown

### 3.1 Auth & Session Management (`AuthContext` + `AuthAndSettings`)

- **Responsibility:** User authentication (email/password), session lifecycle, profile hydration, forgot password, account deletion.
- **Key Components:**
  - `src/context/AuthContext.tsx` lines 6-14 (interface), 18-87 (provider), 83-86 (hook)
  - `src/components/AuthAndSettings.tsx` lines 1-435 (auth form + settings UI)
  - `src/hooks/useProfile.ts` lines 1-22 (profile CRUD)
  - `src/lib/supabase.ts` lines 1-17 (client singleton)
- **Critical Internal Logic:**
  - `AuthProvider` (line 18) calls `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange` (line 48). When session changes, it fetches the user's profile from `public.profiles` via `fetchProfile()` (line 24).
  - `signUp()` (line 62) calls `supabase.auth.signUp()` with `display_name` in `options.data`, which feeds the `handle_new_user()` database trigger (core schema line 108) that auto-creates the profile row.
  - `signIn()` (line 69) uses `supabase.auth.signInWithPassword()`. The `resetPassword()` (line 76) uses `supabase.auth.resetPasswordForEmail()` with redirect.
  - `AuthAndSettings` has dual-mode (line 435): renders `AuthView` (sign in/sign up tabs + forgot password) when unauthenticated, or the Settings panel (Account/Timezone/AI Models tabs) when authenticated.
- **Dependencies:** `lib/supabase.ts`, `types/app.ts` (Profile)

### 3.2 Navigation & Space Context (`TimeTreeContext` + `AppLayout` + `NavigationSidebar`)

- **Responsibility:** Master navigation controller. Manages `activeTab` and `currentSpace` as binary state. Drives URL deep-linking via `?tab=` and `?space=`.
- **Key Components:**
  - `src/context/TimeTreeContext.tsx` lines 1-138 (full context provider)
  - `src/components/AppLayout.tsx` lines 1-124 (layout shell with `ContentRouter`)
  - `src/components/NavigationSidebar.tsx` lines 1-257 (left sidebar nav)
- **Critical Internal Logic:**
  - `TimeTreeProvider` (line 30) reads `searchParams` from `useSearchParams()` (React Router). The `activeTab` is derived from `tabFromParam(searchParams.get('tab'))` (lines 38-40) — the URL is the single source of truth.
  - `currentSpace` is computed reactively: when `?space=` param changes, it matches against `spacesList` (lines 80-92). If the space ID doesn't match any known space or is absent, `currentSpace = null` (personal calendar mode).
  - `setActiveTab(tab, spaceId?)` (line 94) calls `setSearchParams()` to update the URL. The `spacesList` is fetched via a Supabase query that finds all spaces where the user is a member OR creator (lines 48-68).
  - `NavigationSidebar` (line 43) uses `useTimeTree()` to drive navigation. It renders: brand header → identity → nav items (Dashboard, Calendar, Friends) → Shared Calendars list (colored dots per type) → "Create Space" → user footer.
  - `AppLayout` (line 85-124) has `ContentRouter` that switches on `activeTab` → renders `CalendarWorkspace`, `GroupChatView`, `FriendsPage`, `DashboardPage`, or `SettingsView`.
- **Dependencies:** `lib/supabase.ts`, `AuthContext`, `types/app.ts` (Space), `CalendarWorkspace`, `GroupChatView`, `NavigationSidebar`

### 3.3 Calendar & Event System (`CalendarWorkspace` + `CalendarView` + `EventModal`)

- **Responsibility:** Dual-mode calendar interface: Brain Dump (natural language → AI parsing → pending approvals) and Calendar View (month grid with manual event creation).
- **Key Components:**
  - `src/components/CalendarWorkspace.tsx` lines 1-220 (tab controller + brain dump orchestration)
  - `src/components/CalendarView.tsx` lines 1-246 (month grid, event pills, day detail)
  - `src/components/EventModal.tsx` lines 1-142 (manual event creation form)
  - `src/components/PendingApprovals.tsx` lines 1-104 (tag + accept/reject queue)
  - `src/components/BrainDumpInput.tsx` lines 1-74 (textarea + model selector)
  - `src/hooks/useCalendarEvents.ts` lines 1-62 (CRUD + refetch)
  - `src/hooks/useBrainDump.ts` lines 1-125 (parse → results → accept lifecycle)
- **Critical Internal Logic:**
  - `CalendarWorkspace` (line 46) reads forwarded text from chat via `useLocation().state.forwardedText`. The `handleParse` function (line 39) resolves the API key with a 3-tier priority: per-model Vault key → global OpenRouter key → any saved key → env var.
  - `useBrainDump.parse()` (line 17) calls `parseBrainDump()` from `lib/ai-parser.ts`, which POSTs to the Supabase Edge Function with the JWT. The edge function returns structured `ParsedEventPayload[]` which populates the `results` state.
  - `PendingApprovals` (line 14) renders each parsed event with color-coded tag buttons (Personal/Partner/Family/Friend). Accept calls `onAccept(event, tag)` which inserts into DB via `useBrainDump.acceptEvent()` and refreshes the calendar via `fetchEvents()`.
  - `CalendarView` (line 16) builds a month grid using `date-fns` (`startOfMonth`, `endOfMonth`, `eachDayOfInterval`). Event pills are color-coded by `metadata.tag`. Click a day → expands detail panel. Double-click → opens `EventModal`.
  - `EventModal` (line 19) has fields: title, description, all-day toggle, start/end datetime-local inputs, space selector. On save, it converts local datetime to UTC via `new Date(startStr).toISOString()` — **KNOWN ISSUE RN-03**: should use `fromZonedTime()` from `date-fns-tz` instead.
- **Dependencies:** `useCalendarEvents`, `useBrainDump`, `useModelConfigs`, `useTimezone`, `AuthContext`, `ToastContext`, `lib/supabase`, `lib/ai-parser`, `date-fns`, `date-fns-tz`

### 3.4 Edge Function: Brain Dump Parser (`parse-brain-dump`)

- **Responsibility:** Accept natural language text, call OpenRouter with strict JSON schema, validate and return structured calendar events.
- **Key Components:**
  - `supabase/functions/parse-brain-dump/index.ts` lines 1-393 (full function)
  - `src/lib/ai-parser.ts` lines 1-31 (frontend HTTP caller)
- **Critical Internal Logic:**
  - **CORS (line 96):** Returns 204 with `corsHeaders()` for OPTIONS preflight. All 7+ Response objects include `...corsHeaders()` spread.
  - **API Key Resolution (lines 130-189):** 3-tier chain: (1) `api_key` from request body (user's global key from Settings), (2) `model_config_id` → fetches decrypted key from Supabase Vault via RPC, (3) `OPENROUTER_API_KEY` env var fallback.
  - **OpenRouter Call (lines 222-261):** POSTs to `https://openrouter.ai/api/v1/chat/completions` with `response_format: JSON_SCHEMA` (strict). Retries on 429 with exponential backoff (`1s * 2^attempt`, max 8s) up to `MAX_RETRIES=3`. If a model exhausts retries, tries the next from `FALLBACK_MODELS: ["google/gemma-2-27b-it", "meta-llama/llama-3.1-8b-instruct", "mistralai/mistral-nemo"]`.
  - **System Prompt (line 161):** Includes `refDateDisplay` (with day-of-week, e.g., `2026-06-19 (Friday)`) to prevent AI weekday confusion. Instructs activity-based duration inference: dinner=2h, movie=2.5h, meeting=1h, workout=1.5h, default=2h.
  - **Validation (lines 282-302):** Each AI-returned event passes `isValidISO()` (now relaxed to only check `!isNaN(new Date(dateStr).getTime())`) and `isWithinWindow()` (±365 day hallucination guard). Invalid events are filtered with warnings.
- **Dependencies:** `jsr:@supabase/functions-js/edge-runtime.d.ts`, `jsr:@supabase/supabase-js@2` (for Vault RPC calls), OpenRouter API

### 3.5 Database Schema & RLS

- **Responsibility:** Multi-tenant data isolation via PostgreSQL Row-Level Security. 9 tables covering profiles, spaces, memberships, chat, calendar events, attendees, model configs, friend connections, and audit logs.
- **Key Components:**
  - `supabase/migrations/20260620000000_core_schema.sql` lines 1-257 (full migration)
  - `supabase/migrations/20260621000000_friend_system.sql` lines 1-73 (friend system)
- **Critical Internal Logic:**
  - **RLS Helper (line 163):** `is_space_member(check_space_id, check_user_id)` — SECURITY DEFINER function that queries `space_members` bypassing RLS to prevent infinite recursion. Used in all policies that check membership.
  - **Profile Cascade (line 11):** `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` — deleting an auth user cascades to all dependent tables. `calendar_events.created_by` uses `ON DELETE SET NULL` (events survive). `spaces.created_by` uses `NO ACTION` (requires explicit UPDATE guard in account deletion RPC — RN-01).
  - **Space Member Cleanup (lines 119-134):** `cleanup_attendees_on_leave()` trigger — when a `space_members` row is deleted, removes the user's `calendar_event_attendees` rows for events in that space, ensuring no orphaned attendance records.
  - **Vault RPCs (lines 135-178):** `store_model_key()`, `get_decrypted_model_key()`, `delete_model_key()` — three SECURITY DEFINER functions that manage API keys in Supabase Vault. Keys are encrypted at rest, decrypted on-demand, never stored in queryable columns.
  - **Audit Logging (lines 180-205):** `audit_trigger_func()` fires on INSERT/UPDATE/DELETE to `calendar_events`, `chat_messages`, `space_members`, `user_model_configs` — logs operation, table, record ID, user ID, and old/new JSON data.
  - **Friend System (friend migration lines 1-73):** `friend_connections` table with `friend_status` ENUM (pending/accepted/rejected/blocked). `search_users()` SECURITY DEFINER function joins `profiles.display_name` with `auth.users.email` for dual search. UNIQUE constraint on `(requester_id, recipient_id)` prevents duplicate requests. CHECK constraint prevents self-requests.
- **Dependencies:** Supabase PostgreSQL, `pgcrypto`, `uuid-ossp`, `supabase_vault` extensions

### 3.6 Real-time Chat (`GroupChatView` + `useChat`)

- **Responsibility:** Real-time group messaging within a shared space. Supports long-press message selection and batch forwarding to the Brain Dump parser.
- **Key Components:**
  - `src/components/GroupChatView.tsx` lines 1-205 (full chat view)
  - `src/components/ChatMessageCell.tsx` lines 1-88 (individual message with selection)
  - `src/components/BatchActionBar.tsx` lines 1-27 (forward toolbar)
  - `src/hooks/useChat.ts` lines 1-84 (realtime subscription + send)
- **Critical Internal Logic:**
  - `useChat` (line 13) subscribes to `postgres_changes` on `chat_messages` with `INSERT` event and `space_id=eq.${spaceId}` filter. New messages trigger a profile fetch for sender display name (lines 51-66).
  - `sendMessage()` (line 71) does a simple INSERT and returns `{ error }`. Messages are appended to local state via the Realtime subscription, not optimistically.
  - `ChatMessageCell` (line 20) implements long-press detection (600ms timer on `onMouseDown`/`onTouchStart`, canceled on `onMouseUp`/`onTouchEnd`). Right-click (`onContextMenu`) also enters selection mode.
  - `GroupChatView` (line 53) auto-scrolls to bottom via `messagesEndRef` when `autoScroll` is true (disabled when user has scrolled up >100px). A floating "↓" button appears when auto-scroll is off.
  - Batch selection (line 93): `toggleSelect` manages a `Set<string>` of selected message IDs. When the selection set becomes empty, selection mode ends. "Forward to Brain Dump" concatenates selected messages as `Sender: text\n...` and navigates to `/calendar` with `state: { forwardedText }`.
- **Dependencies:** `useChat`, `AuthContext`, `ToastContext`, `lib/supabase`, `types/app` (ChatMessageWithSender)

### 3.7 Friend System (`useFriends` + `FriendList` + `AddFriendModal`)

- **Responsibility:** Send, accept, reject, remove, and block friend connections. Search users by display name or email.
- **Key Components:**
  - `src/hooks/useFriends.ts` lines 1-122 (full CRUD + search)
  - `src/components/FriendList.tsx` lines 1-123 (renders by status: pending/accepted/blocked)
  - `src/components/AddFriendModal.tsx` lines 1-90 (search + send request)
  - `src/pages/FriendsPage.tsx` lines 1-89 (page shell + modal trigger)
- **Critical Internal Logic:**
  - `fetchConnections()` (line 22) queries `friend_connections` with `or(requester_id.eq.{uid},recipient_id.eq.{uid})`. For each result, it fetches the OTHER user's profile (display_name, avatar_url) and enriches the connection object into `FriendConnectionWithProfile`.
  - Connections are split into three arrays: `friends` (status=accepted), `pending` (status=pending where recipient_id=user), `blocked` (status=blocked). This categorization is done client-side after fetch.
  - `searchUsers(query)` (line 50) calls `supabase.rpc('search_users', { search_query: query })` — the database function (friend migration line 20) does `ILIKE '%query%'` on both `profiles.display_name` and `auth.users.email`, returning up to 20 results. Results are filtered client-side to exclude the current user.
  - `FriendList` (line 14) has three sections: "Pending Requests" (with Accept/Decline buttons), "Friends" (with Chat/Block/Remove), "Blocked" (with Unblock). Empty states use the `EmptyState` component with contextual messaging.
  - `AddFriendModal` (line 6) searches as the user types, shows results with "Add" button per user. Sends request on click, removes from results on success.
  - `FriendsPage` (line 7) has an "Add Friend" button that opens the modal. The `handleChatWithFriend` function (line 40) creates or finds a `direct_partner` space via a query/insert pattern and navigates to it.
- **Dependencies:** `lib/supabase`, `AuthContext`, `ToastContext`, `types/app` (FriendConnection, UserSearchResult)

### 3.8 AI Model Configuration (`useModelConfigs` + `ModelConfigPanel`)

- **Responsibility:** Manage custom AI model API keys via Supabase Vault. Store, retrieve, test, and delete keys. Set default model.
- **Key Components:**
  - `src/hooks/useModelConfigs.ts` lines 1-93 (Vault CRUD + key retrieval)
  - `src/components/ModelConfigPanel.tsx` lines 1-293 (full settings UI)
- **Critical Internal Logic:**
  - `fetchConfigs()` (line 11) reads `user_model_configs` for the authenticated user. The RLS policy ensures user isolation (`user_id = auth.uid()`).
  - `store_model_key` RPC (database schema line 135) calls `vault.create_secret()` to encrypt the raw API key, then inserts a row in `user_model_configs` with the `vault_key_id` reference. The raw key never appears in a queryable column.
  - `get_decrypted_model_key` RPC (database schema line 148) verifies ownership (`auth.uid() = user_id`), then reads back the decrypted secret from `vault.decrypted_secrets`. The key is returned to the caller and used in-memory for the OpenRouter API call, never persisted in session state.
  - `ModelConfigPanel` (line 14) has three sections: (1) Built-in model (Gemma 2 27B — always available), (2) OpenRouter Global Key — text input + Test + Save buttons with success/error indicators, (3) Custom models list — each with default star, delete button.
  - **Test Connection (line 44):** Calls OpenRouter's `/api/v1/auth/key` endpoint directly from the frontend. If the HTTP response is 200, the key is valid. Save is disabled if test fails (`testState === 'error'`). The test result auto-clears after 4 seconds.
  - The "Add Model" modal (line 169) allows selecting a provider (OpenAI/Anthropic/Google/OpenRouter) and model ID (preset list or custom input). Has its own Test Connection button before saving.
- **Dependencies:** `lib/supabase`, `ToastContext`, `types/app` (UserModelConfig, AIProvider), `lib/constants` (PROVIDER_PRESETS, DEFAULT_MODEL_ID)

### 3.9 Timezone System (`useTimezone` + `TimezonePicker`)

- **Responsibility:** Centralized timezone conversion. Display UTC timestamps in the user's configured timezone. Provide timezone selection UI.
- **Key Components:**
  - `src/hooks/useTimezone.ts` lines 1-66 (conversion utilities)
  - `src/components/TimezonePicker.tsx` lines 1-49 (searchable selector)
  - `src/lib/constants.ts` line 45 (`IANA_TIMEZONES`)
- **Critical Internal Logic:**
  - `useTimezone()` (line 6) reads `profile?.timezone ?? 'UTC'` as the single source of truth. It wraps `date-fns-tz` functions:
    - `toLocal(utcIso, format?)` — uses `toZonedTime(parseISO(utcIso), tz)` + `format()`.
    - `toLocalDate(utcIso)` — returns a Date object in the user's timezone.
    - `toUTC(localIso)` — uses `fromZonedTime(parseISO(localIso), tz)`.
    - `formatEventTime(start, end, isAllDay)` — formats a user-friendly time range.
  - `TimezonePicker` (line 7) renders a search input that filters `IANA_TIMEZONES` (400+ entries from `Intl.supportedValuesOf('timeZone')`), capped at 200 results, then passes the filtered list to a `Select` component.
  - **KNOWN ISSUE RN-05:** The full IANA list is grandfathered for the login route (`AuthAndSettings.tsx`) but is FORBIDDEN in the main app shell (`/app/*` routes). Settings views must use the hardcoded `MAJOR_TIMEZONES` array (9 entries: UTC, America/New_York, America/Chicago, America/Los_Angeles, Europe/London, Europe/Paris, Asia/Singapore, Asia/Tokyo, Australia/Sydney).
- **Dependencies:** `date-fns`, `date-fns-tz`, `AuthContext`, `lib/constants` (IANA_TIMEZONES)

---

## 4. Impact Assessment Rules for Major Changes

Before refactoring or changing any core logic, verify the following:

### Pre-Change Checklist

- [ ] **RN-02 / RN-03 Timezone Fix Priority:** If modifying `CalendarView.tsx` or `EventModal.tsx`, prioritize fixing the timezone conversion bugs (use `useTimezone().toLocal()` instead of raw `format(parseISO(...), ...)` and `fromZonedTime()` instead of `new Date().toISOString()`).
- [ ] **RN-04 Delete Account Consolidation:** Before touching `AuthAndSettings.tsx` or `SettingsView.tsx`, verify both files have the same account deletion flow. Extract into a shared `useDeleteAccount()` hook.
- [ ] **RLS Policy Recursion:** Any new RLS policy that queries `space_members` MUST use `is_space_member(space_id, auth.uid())` helper, NOT a direct `EXISTS(SELECT 1 FROM space_members ...)` subquery. Violation causes infinite recursion → 500 errors on all dependent queries.
- [ ] **API Key Security:** No migration or feature may store raw API keys in a queryable column. Always use `vault.create_secret()` + `vault_key_id` reference. The `user_model_configs.vault_key_id` column is the only allowed storage mechanism.
- [ ] **Event Cascade Integrity:** A user leaving a space must trigger `cleanup_attendees_on_leave()`. A user deleting their account must cascade through all tables EXCEPT `calendar_events.created_by` (which should SET NULL). Verify the `delete_own_account` RPC includes the `UPDATE spaces SET created_by = NULL` guard (RN-01).
- [ ] **Privacy-First Data Model:** `chat_messages` for shared spaces cascade DELETE on user deletion (messages belong to sender). `calendar_events` SET NULL on creator deletion (events belong to the space). These are intentional design decisions — do not change.
- [ ] **Navigation State:** Any new tab or navigation feature must route through `TimeTreeContext.setActiveTab()` which calls `setSearchParams()`. Direct `useSearchParams` manipulation in sidebar components is FORBIDDEN (TC-IR-01). New tabs must be added to `ContentRouter` switch in `AppLayout.tsx:85-124` (TC-IR-02).
- [ ] **Brain Dump Model Fallback:** The edge function's `FALLBACK_MODELS` array must only contain models that exist on OpenRouter AND support `structured_outputs`. Adding a model that doesn't exist will cause 404 errors. Adding a model without `structured_outputs` support will cause schema validation failures.
- [ ] **TypeScript Compilation:** `npx tsc --noEmit` must pass before any merge. The build script is `"build": "tsc -b && vite build"`.
- [ ] **Supabase Advisor:** After any DDL migration, run both `supabase-memrys_get_advisors(type: 'security')` and `supabase-memrys_get_advisors(type: 'performance')` to catch RLS gaps or missing indexes.
- [ ] **Migration Guardrails (MG-01 through MG-05):**
  - No migration may change `calendar_events.created_by` FK away from `ON DELETE SET NULL`
  - No migration may remove `on_auth_user_created` trigger from `auth.users`
  - No migration may add provider-specific columns to `public.profiles`
  - No migration may change `profiles.id` from `uuid PRIMARY KEY REFERENCES auth.users(id)`
  - No migration may change `timestamptz` to `timestamp` (without tz) on any existing column
