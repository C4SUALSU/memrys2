# MEMRYS2 v3.1 — Engineering Guardrails & Security Contract

**Classification:** HARD COMPLIANCE CONSTRAINT FRAMEWORK  
**Applies to:** All code generation iterations, refactors, migrations, and feature additions  
**Version:** 3.1  
**Last Updated:** 2026-06-21  

---

## Table of Contents

1. [TIMETREE CONTEXT ISOLATION RULE](#1-timetree-context-isolation-rule)
2. [DUAL-STAGE ACCOUNT DELETION PROTOCOL](#2-dual-stage-account-deletion-protocol)
3. [TIMEZONE NORMALIZATION & STREAMLINING POLICIES](#3-timezone-normalization--streamlining-policies)
4. [OAUTH SSO FUTURE SCALING GATEWAY](#4-oauth-sso-future-scaling-gateway)
5. [KNOWN NON-COMPLIANCE & RISK REGISTER](#5-known-non-compliance--risk-register)
6. [COMPLIANCE ENFORCEMENT GATES](#6-compliance-enforcement-gates)

---

## 1. TIMETREE CONTEXT ISOLATION RULE

### 1.1 Master Context Controller

The **Left Navigation Sidebar** (`src/components/NavigationSidebar.tsx:43-257`) is the absolute master context controller of the application layout shell (`src/components/AppLayout.tsx`). It exclusively drives navigation state via `useTimeTree()` context (`src/context/TimeTreeContext.tsx`).

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TC-IR-01 | Every navigation action in the sidebar MUST call `setActiveTab()` or `setCurrentSpace()` from `TimeTreeContext`. Direct manipulation of `useSearchParams` in the sidebar is FORBIDDEN. | `NavigationSidebar.tsx` | Ensures URL ↔ state bidirectionality is maintained exclusively by `TimeTreeContext` |
| TC-IR-02 | `AppLayout` MUST remain the sole rendering orchestrator. The `ContentRouter` switch-case (lines 85-124) MUST be the only mechanism that maps `activeTab` → component rendering. | `AppLayout.tsx:85-124` | Prevents side-channel routing bypasses |
| TC-IR-03 | `TimeTreeProvider` MUST wrap ONLY the `/app` route subtree. It MUST NOT be lifted to `App.tsx` or `main.tsx`. | `AppLayout.tsx:15-21` | Prevents context pollution outside the authenticated shell |

### 1.2 Binary State Context Layout

The application MUST always support exactly two context states:

| `currentSpace` value | Meaning | Entry Route | Behavior |
|----------------------|---------|-------------|----------|
| `null` | Personal Calendar (isolated) | `/app?tab=calendar` or `/app` | `CalendarWorkspace` queries `space_id IS NULL` events. No shared space features rendered. Chat tab shows EmptyState. |
| `Space` (non-null) | Shared collaborative group | `/app?tab=calendar&space=<id>` | `CalendarWorkspace` scopes queries to `space_id = currentSpace.id`. Chat tab renders `GroupChatView`. |

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TC-BS-01 | `currentSpace` MUST be typed as `Space \| null` with `null` being the personal-calendar sentinel. No other sentinel values (empty string, magic UUID) are permitted. | `src/context/TimeTreeContext.tsx:11` | Ensures binary state semantics |
| TC-BS-02 | `CalendarWorkspace` MUST accept `currentSpace: Space \| null` as its only routing prop. Event fetching MUST branch on `currentSpace?.id ?? null`. | `CalendarWorkspace.tsx` | Scopes queries correctly for personal vs shared |
| TC-BS-03 | `GroupChatView` MUST accept `currentSpace: Space` (non-nullable). The null state guard MUST be handled by `ContentRouter` which renders `EmptyState` instead. | `AppLayout.tsx:101-109` | Chat is meaningless without a space context |

### 1.3 Un-nested User Routing Guarantee

**HARD REQUIREMENT:** A user belonging to zero shared groups (`spacesList.length === 0`) MUST land on and be able to fully operate their Personal Calendar view immediately after authentication completes, with zero routing blocks, redirect loops, or gate checks.

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TC-UR-01 | `TimeTreeContext` initial state: `currentSpace` MUST start as `null`. This is the unconditional default — not derived from auth or spaces list. | `TimeTreeContext.tsx:36` | Ensures personal calendar default |
| TC-UR-02 | The `NavigationSidebar` personal calendar button (`setCurrentSpace(null)`) MUST always be visible and clickable, regardless of `spacesList` content. | `NavigationSidebar.tsx:149-159` | Personal calendar is always accessible |
| TC-UR-03 | NO route guard, authentication middleware, or layout wrapper may redirect away from `/app?tab=calendar` when `currentSpace === null` and `activeTab === 'calendar'`. | `AppLayout.tsx` | Prevents dead-end routing for solo users |

### 1.4 URL Deep-Linking Invariant

Every application state MUST be fully encodable in URL search parameters (`?tab=` and `?space=`). The `TimeTreeContext` MUST treat `useSearchParams` as the source of truth for `activeTab` and compute `currentSpace` reactively from the space parameter.

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TC-DL-01 | `activeTab` MUST be derived from `searchParams.get('tab')`, not from `useState`. The `tabFromParam()` parser function (lines 21-27) is the ONLY acceptable mapping. | `TimeTreeContext.tsx:38-40` | URL is single source of truth |
| TC-DL-02 | `currentSpace` MUST be recomputed whenever `searchParams` OR `spacesList` changes (the URL space ID is matched against `spacesList`). | `TimeTreeContext.tsx:80-92` | Prevents stale space references after deletion |
| TC-DL-03 | `setActiveTab()` MUST call `setSearchParams()` to update the URL. Side-effect-free tab changes (without URL update) are FORBIDDEN. | `TimeTreeContext.tsx:94-103` | Deep-link integrity |

---

## 2. DUAL-STAGE ACCOUNT DELETION PROTOCOL

### 2.1 Primary Execution Gateway

All user-initiated account purges MUST route through the high-security RPC function `public.delete_own_account()` (`supabase/migrations/04_fix_delete_account_rpc.sql`).

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| AD-PG-01 | Frontend deletion calls MUST use only `supabase.rpc('delete_own_account')` with zero arguments. Direct `DELETE FROM profiles` or `DELETE FROM auth.users` from client code is FORBIDDEN. | `SettingsView.tsx:80-91`, `AuthAndSettings.tsx:32-45` | SECURITY DEFINER isolation |
| AD-PG-02 | The RPC function MUST preserve `SECURITY DEFINER` + `SET search_path = public, auth` attributes. Any modification to these settings is a BREACH. | `04_fix_delete_account_rpc.sql` | Prevents privilege escalation and schema injection |
| AD-PG-03 | The function MUST be `REVOKE`d from `PUBLIC` and `GRANT`ed only to `authenticated` role. | `04_fix_delete_account_rpc.sql:42-43` | Principle of least privilege |
| AD-PG-04 | Frontend type MUST enforce `Args: Record<string, never>; Returns: boolean` — zero arguments enforced at compile time. | `src/types/supabase.ts:243-246` | TypeScript contract enforcement |

### 2.2 Ground-Truth Cascade Rule

When a profile row is deleted (`DELETE FROM public.profiles WHERE id = current_user_id`), the following foreign key cascades MUST fire automatically:

| Table | FK Column | Cascade Type | Behavior |
|-------|-----------|-------------|----------|
| `space_members` | `user_id` | `ON DELETE CASCADE` | User removed from all space memberships |
| `calendar_event_attendees` | `user_id` | `ON DELETE CASCADE` | User removed from all event attendance |
| `chat_messages` | `sender_id` | `ON DELETE CASCADE` | User's chat messages deleted |
| `user_model_configs` | `user_id` | `ON DELETE CASCADE` | User's AI model configs deleted |
| `friend_connections` | `requester_id` / `recipient_id` | `ON DELETE CASCADE` | User's friend connections deleted |
| `calendar_events` | `created_by` | `ON DELETE SET NULL` | Events preserved, creator nullified |
| `profiles` | `id` | `ON DELETE CASCADE` (from `auth.users`) | Auth user record deletion propagates down |

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| AD-GC-01 | `calendar_events.created_by` FK MUST use `ON DELETE SET NULL`. Any migration that reverts this to `NO ACTION` or `CASCADE` is a BREACH. | `20260622000000_timetree_cleanup.sql:3-7` | Shared event preservation |
| AD-GC-02 | `spaces.created_by` FK MUST retain `NO ACTION` (or be altered to `ON DELETE SET NULL`). The RPC function body MUST include an explicit `UPDATE public.spaces SET created_by = NULL WHERE created_by = current_user_id` guard. | Core schema line 23; RPC function | **KNOWN ISSUE:** Current deployed RPC is missing this guard (see Section 5) |
| AD-GC-03 | The trigger `on_space_member_deleted` calling `cleanup_attendees_on_leave()` MUST remain intact. When a space membership is deleted (by any mechanism), the user's attendee records for events in that space MUST be cleaned up. | `20260620000000_core_schema.sql:119-134` | Prevents orphaned attendance records |

### 2.3 Shared Preservation Rule

If a deleting user is NOT the sole remaining member of a shared space, the space's events and messages MUST survive.

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| AD-SP-01 | The RPC function MUST NOT delete `spaces` where `COUNT(space_members) > 1` after the caller's membership would be removed. Only single-occupancy spaces are eligible for deletion. | RPC function loop | Shared data preservation |
| AD-SP-02 | `calendar_events.created_by` MUST become `NULL` (via `SET NULL`) — events remain visible to other space members through the RLS policy `is_space_member(space_id, auth.uid())`. | FK constraint | Event continuity |
| AD-SP-03 | `chat_messages` for shared spaces MUST be deleted (via `CASCADE` on `sender_id`). This is intentional: message ownership is absolute, not detachable. | Core schema line 38 | Chat privacy — messages belong to sender |

### 2.4 Empty Space Pruning Rule

The RPC function MUST programmatically audit and purge any space that becomes completely unpopulated after the caller departs.

**Hard Constraints:**

| ID | Constraint | Algorithm | Location |
|----|------------|-----------|----------|
| AD-EP-01 | For each space the user belongs to: if `COUNT(space_members WHERE space_id = v_space_id) = 1` (the caller is the sole member), `DELETE FROM public.spaces WHERE id = v_space_id`. | O(n) over caller's spaces | RPC function loop |
| AD-EP-02 | The space deletion cascades: `space_members` → `chat_messages` → `calendar_events` → `calendar_event_attendees` are all atomically removed. No explicit per-table cleanup is needed. | CASCADE chain | Atomic space teardown |

### 2.5 Frontend Deletion Contract

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| AD-FC-01 | The delete confirmation modal MUST require the user to type the exact phrase `"DELETE MY ACCOUNT"` (case-sensitive). The destructive button MUST remain `disabled` until the match is exact. | `SettingsView.tsx:277-317` | Prevents accidental deletion |
| AD-FC-02 | On successful RPC return, the flow MUST call `signOut()` then `navigate('/')`. The `.catch(() => {})` on signOut is REQUIRED (auth session may already be invalid server-side). | `SettingsView.tsx:80-91` | Graceful post-deletion navigation |
| AD-FC-03 | Modal state (`showDeleteModal`, `deleteConfirmText`, `deleting`) MUST be fully reset on both cancel and backdrop close. Modals MUST NOT persist state across open/close cycles. | `SettingsView.tsx` | State hygiene |

---

## 3. TIMEZONE NORMALIZATION & STREAMLINING POLICIES

### 3.1 Database Storage Standard

All timestamp columns MUST use PostgreSQL `timestamptz` (TIMESTAMP WITH TIME ZONE). Values are normalized to UTC internally on write and served as UTC ISO 8601 strings on read.

**Hard Constraints:**

| ID | Constraint | Tables | Rationale |
|----|-----------|--------|-----------|
| TZ-DB-01 | All `start_time` and `end_time` columns MUST remain `timestamptz NOT NULL`. No migration may change these to `timestamp` (without tz) or `date`. | `calendar_events` | UTC-normalized storage invariant |
| TZ-DB-02 | All `created_at`, `updated_at`, `joined_at` columns MUST remain `timestamptz DEFAULT now()`. | All tables with timestamp columns | Consistent audit trail |
| TZ-DB-03 | The `profiles.timezone` column MUST remain `text NOT NULL DEFAULT 'UTC'`. | `profiles` | Fallback safety for missing preferences |

### 3.2 Frontend Timezone Display Rules

#### 3.2.1 Timezone Source of Truth

The user's timezone preference SHALL be read exclusively from the hydrated `userProfile.timezone` field, accessed through the `useTimezone()` hook (`src/hooks/useTimezone.ts`).

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TZ-FE-01 | `useTimezone()` MUST read `profile?.timezone ?? 'UTC'` as the single source of truth. No component may read `Intl.DateTimeFormat().resolvedOptions().timeZone` as a fallback when profile is loaded. | `useTimezone.ts:8` | User preference overrides browser default |
| TZ-FE-02 | Browser timezone MUST be used ONLY while `profile` is still null (auth loading state). Once `profile` resolves, `profile.timezone` takes exclusive precedence. | `useTimezone.ts` | Consistent user experience across devices |

#### 3.2.2 Static Timezone List Requirement

The frontend MUST present timezone selection through a curated list of major global financial timezones. Dynamic generation of full IANA zone lists via `Intl.supportedValuesOf('timeZone')` at runtime is STRICTLY BANNED in the production settings UI.

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TZ-SL-01 | `SettingsView.tsx` MUST use the `MAJOR_TIMEZONES` hardcoded array (9 entries). No import of `IANA_TIMEZONES` or `Intl.supportedValuesOf('timeZone')` is permitted in `SettingsView.tsx`. | `SettingsView.tsx:14-24` | Performance — prevents 400+ zone render on settings load |
| TZ-SL-02 | The `MAJOR_TIMEZONES` list MUST contain only these 9 entries: `UTC`, `America/New_York`, `America/Chicago`, `America/Los_Angeles`, `Europe/London`, `Europe/Paris`, `Asia/Singapore`, `Asia/Tokyo`, `Australia/Sydney`. Extensions require Architecture Board approval. | `SettingsView.tsx:14-24` | Curated financial timezones only |
| TZ-SL-03 | `AuthAndSettings.tsx` MAY use the `TimezonePicker` component with the full `IANA_TIMEZONES` list (via `Intl.supportedValuesOf('timeZone')`) ONLY because it lives on the `/login` route which is not performance-sensitive. This is a GRANDFATHERED EXCEPTION. | `src/components/TimezonePicker.tsx`, `src/lib/constants.ts:45` | Legacy exception — not to be replicated |
| TZ-SL-04 | Any NEW settings/timezone component MUST use the `MAJOR_TIMEZONES` pattern. Use of the `TimezonePicker` component in authenticated app routes (`/app/*`) is FORBIDDEN. | — | Prevents performance regression in main app shell |

#### 3.2.3 Date Conversion Pipeline

All date/time display MUST flow through this pipeline:

```
DB (timestamptz UTC)
    ↓ (ISO 8601 string)
useTimezone().toLocal(utcIso, format?)
    ↓ (date-fns-tz toZonedTime + format)
User-local formatted string
```

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TZ-CV-01 | ALL components displaying user-facing times MUST use `useTimezone().toLocal()` or `useTimezone().formatEventTime()`. Direct calls to `format(parseISO(...), ...)` without timezone conversion are FORBIDDEN. | All display components | **ENFORCEMENT GATE** — current `CalendarView.tsx` uses raw `date-fns` (see Section 5) |
| TZ-CV-02 | Event creation MUST convert user-local input to UTC via `fromZonedTime()` from `date-fns-tz`, NOT via `new Date().toISOString()` which uses the browser timezone offset. | `EventModal.tsx` | **ENFORCEMENT GATE** — current implementation has this bug (see Section 5) |
| TZ-CV-03 | `useTimezone()` MUST export these functions exclusively: `toLocal`, `toLocalDate`, `toUTC`, `formatEventTime`, `nowInTz`, `timezoneLabel`, `relativeTime`. No function may be added without Architecture Board review. | `useTimezone.ts` | API surface stability |

### 3.3 Brain Dump Edge Function Timezone Contract

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| TZ-ED-01 | The Edge Function MUST receive `user_timezone` in the request body and fall back to `'UTC'` if absent. | `parse-brain-dump/index.ts:116,126` | AI must compute relative dates in user's timezone |
| TZ-ED-02 | The AI system prompt MUST instruct the model to compute relative dates in the user's timezone but output ONLY valid ISO 8601 UTC datetime strings. | `parse-brain-dump/index.ts:210` | UTC-normalized storage invariant |
| TZ-ED-03 | The `user_timezone` value passed from the frontend MUST be `profile?.timezone ?? 'UTC'` from `useTimezone()`. | `CalendarWorkspace.tsx` (brain dump call site) | Consistency with user preference |

---

## 4. OAUTH SSO FUTURE SCALING GATEWAY

### 4.1 Identity Anchoring Invariant

To ensure Google OAuth SSO can be cleanly introduced later, the profile entity mapping MUST remain decoupled from the login strategy.

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| OA-ID-01 | The `profiles` table PK MUST remain `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`. No new identity columns (provider-specific user IDs, email-as-PK) may be introduced as the primary key. | `20260620000000_core_schema.sql:11-12` | Auth-agnostic identity anchoring |
| OA-ID-02 | `profiles.id` MUST always equal `auth.users.id`. No migration may introduce a separate application-level user ID that decouples from `auth.users`. | Core schema | 1:1 identity mapping invariant |
| OA-ID-03 | The `on_auth_user_created` trigger (`public.handle_new_user()`) MUST remain as `AFTER INSERT ON auth.users`. This trigger fires identically for email/password and OAuth sign-ups. | `20260620000000_core_schema.sql:114-117` | Universal profile creation |

### 4.2 Trigger Dependency Rule

The database trigger `on_auth_user_created` calling `handle_new_user()` is the CRITICAL PATH for OAuth readiness.

**Hard Constraints:**

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| OA-TR-01 | The `handle_new_user()` function MUST populate `display_name` from `raw_user_meta_data`. It MUST be extended to coalesce across OAuth provider naming conventions (`display_name`, `full_name`, `name`) before falling back to the email prefix. | `20260620000000_core_schema.sql:108-109` | **REQUIRED FOR OAUTH** — Google returns `full_name`, not `display_name` |
| OA-TR-02 | The `handle_new_user()` function MUST be extended to populate `avatar_url` from `raw_user_meta_data` (checking `avatar_url`, `picture`, `avatar` in that order). | Core schema trigger | **REQUIRED FOR OAUTH** — Google returns `picture` in metadata |
| OA-TR-03 | The trigger function MUST remain `SECURITY DEFINER SET search_path = ''`. It MUST NOT use `search_path = public, auth` (unlike the delete function) because it's an internal trigger, not an RPC. | `20260620000000_core_schema.sql:112` | Internal trigger isolation |
| OA-TR-04 | NO frontend code may assume `profile` exists synchronously after sign-up. The trigger is asynchronous relative to the auth response. All components MUST handle `profile === null` gracefully (loading spinner or skeleton). | `AuthContext.tsx` | OAuth redirect flow may race with trigger execution |

### 4.3 OAuth Integration Surface (Future)

When Google OAuth SSO is introduced, these are the constrained integration points:

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| OA-IS-01 | OAuth login MUST call `supabase.auth.signInWithOAuth({ provider: 'google' })`. The `redirectTo` MUST be `window.location.origin + '/app'`. | New method in `AuthContext.tsx` | Consistent redirect target |
| OA-IS-02 | OAuth buttons MUST be added ONLY to `AuthAndSettings.tsx` (the `/login` route). They MUST NOT appear in the main app shell. | `AuthAndSettings.tsx` | Login surface only |
| OA-IS-03 | `detectSessionInUrl: true` (already set in `supabase.ts:8`) MUST remain enabled. OAuth callbacks deliver the session via URL hash fragment. | `src/lib/supabase.ts:8` | Required for OAuth callback detection |
| OA-IS-04 | NO OAuth-specific columns may be added to `public.profiles`. OAuth provider metadata lives in `auth.users.raw_user_meta_data` only. | — | Profile schema remains auth-strategy-agnostic |

### 4.4 Profile Update Surface

The existing `useProfile` hook (`src/hooks/useProfile.ts`) is OAuth-ready for profile updates:

| ID | Constraint | Location | Rationale |
|----|------------|----------|-----------|
| OA-PU-01 | `updateProfile()` MUST accept partial `Profile` updates (`display_name`, `timezone`, `avatar_url`). Current OOB updates are `display_name` and `timezone` only. | `useProfile.ts` | Future OAuth users can update name/avatar post-signup |
| OA-PU-02 | `avatar_url` updates from the frontend MUST be permitted. The column is nullable and the current trigger does not populate it — OAuth users will receive their provider avatar, email/password users will have `NULL` until they set one. | `profiles` table | Parity between auth methods |

---

## 5. KNOWN NON-COMPLIANCE & RISK REGISTER

This section documents deviations from the guardrails that exist in the current codebase. Each entry includes a severity rating and required remediation.

### RN-01: Missing `spaces.created_by` NULLIFICATION GUARD (HIGH)

| Attribute | Detail |
|-----------|--------|
| **Affected File** | `supabase/migrations/04_fix_delete_account_rpc.sql` |
| **Risk** | If the calling user created a shared space that has other active members, `DELETE FROM public.profiles` will trigger a FK violation on `spaces_created_by_fkey` (`ON DELETE NO ACTION`). Account deletion will fail with a 500 error. |
| **Root Cause** | The fix migration dropped the original 5-phase function and recreated it without the `UPDATE public.spaces SET created_by = NULL` guard. |
| **Remediation** | Add `UPDATE public.spaces SET created_by = NULL WHERE created_by = current_user_id;` to the RPC function body BEFORE the `DELETE FROM public.profiles` statement. |
| **Detection** | `SELECT COUNT(*) FROM public.spaces WHERE created_by = <user_id>` before triggering deletion for any user who has created spaces with members > 1. |

### RN-02: CalendarView Uses Raw `date-fns` Without Timezone Conversion (HIGH)

| Attribute | Detail |
|-----------|--------|
| **Affected File** | `src/components/CalendarView.tsx` (lines ~176, ~224) |
| **Risk** | Event times display in the browser's local timezone, NOT the user's configured `profile.timezone`. A user in Tokyo with their browser set to New York will see Eastern Time. |
| **Root Cause** | The component calls `format(parseISO(ev.start_time), 'h:mm a')` directly on UTC ISO strings. `date-fns` `format()` uses the local `Date` object which reflects browser timezone. |
| **Remediation** | Replace all `format(parseISO(...), ...)` calls with `useTimezone().toLocal()` or `useTimezone().formatEventTime()`. |
| **Impact** | All calendar event chip labels and detail headers. |

### RN-03: EventModal Uses `new Date().toISOString()` for UTC Conversion (HIGH)

| Attribute | Detail |
|-----------|--------|
| **Affected File** | `src/components/EventModal.tsx` |
| **Risk** | When saving an event, user-local datetime input is converted to UTC using `new Date(startStr).toISOString()`, which uses the browser's timezone offset. If user's profile timezone differs from browser timezone, the event is stored at the wrong UTC time. |
| **Root Cause** | Using browser `Date` constructor instead of `date-fns-tz` `fromZonedTime()`. |
| **Remediation** | Replace `new Date(startStr).toISOString()` with `fromZonedTime(startStr, tz).toISOString()` where `tz` comes from `useTimezone()`. |

### RN-04: Dual Delete Account Implementations (MEDIUM)

| Attribute | Detail |
|-----------|--------|
| **Affected Files** | `src/components/AuthAndSettings.tsx:32-45`, `src/components/SettingsView.tsx:80-91` |
| **Risk** | Two identical implementations of the account deletion flow exist. If the RPC signature or post-deletion flow changes, one will become stale. |
| **Remediation** | Extract into a shared hook: `useDeleteAccount()` that encapsulates `rpc()` → `signOut()` → `navigate('/')`. Both components consume the hook. |

### RN-05: TimezonePicker IANA Full List in Settings Context (LOW)

| Attribute | Detail |
|-----------|--------|
| **Affected File** | `src/components/TimezonePicker.tsx` (imports `IANA_TIMEZONES` from `constants.ts`) |
| **Risk** | The `TimezonePicker` generates 400+ IANA zones at runtime via `Intl.supportedValuesOf('timeZone')`. This component is used in `AuthAndSettings.tsx` (login route) which is grandfathered, but the pattern must not spread to the main app shell. |
| **Remediation** | No immediate action — grandfathered. All new settings views MUST use `MAJOR_TIMEZONES`. |

### RN-06: DashboardPage Broad Event Query (LOW)

| Attribute | Detail |
|-----------|--------|
| **Affected File** | `src/pages/DashboardPage.tsx` |
| **Risk** | Fetches events across ALL spaces with no space filter and `limit: 20`. In high-usage scenarios, this may become a performance bottleneck or miss events from large spaces. |
| **Remediation** | Monitor. Add pagination or per-space limits if performance degrades. |

---

## 6. COMPLIANCE ENFORCEMENT GATES

### 6.1 Code Review Gates

Every PR, migration, or refactor MUST pass these gates:

| Gate | Check | Tool / Method |
|------|-------|---------------|
| G-01 | NO new imports of `Intl.supportedValuesOf` in `/app` route components | Manual review + grep |
| G-02 | NO direct `DELETE FROM` profiles or auth.users in client code | Grep for `from\('profiles'\)\.delete\|from\('auth\.users'\)` |
| G-03 | `currentSpace` type remains `Space \| null` (no new sentinels) | TypeScript type check |
| G-04 | `NavigationSidebar` does not import or use `useSearchParams` | Manual review |
| G-05 | `handle_new_user()` trigger coalesces across OAuth display_name conventions if modified | Code review of trigger changes |
| G-06 | All new display components use `useTimezone().toLocal()` for time formatting | Manual review |
| G-07 | `delete_own_account` RPC preserves `SECURITY DEFINER` + `search_path` | Migration review |
| G-08 | OAuth-related changes touch ONLY `AuthAndSettings.tsx` and `AuthContext.tsx` (NOT the app shell) | Manual review |

### 6.2 Migration Guardrails

| ID | Rule |
|----|------|
| MG-01 | No migration may change `calendar_events.created_by` FK away from `ON DELETE SET NULL`. |
| MG-02 | No migration may remove the `on_auth_user_created` trigger from `auth.users`. |
| MG-03 | No migration may add provider-specific columns to `public.profiles`. |
| MG-04 | No migration may change `profiles.id` from `uuid PRIMARY KEY REFERENCES auth.users(id)`. |
| MG-05 | No migration may change `timestamptz` to `timestamp` (without tz) on any existing column. |

### 6.3 TypeScript Compilation Gate

Before merging any change:

```bash
npx tsc --noEmit
```

The build MUST pass without NEW type errors. Pre-existing errors (missing declaration files for `lucide-react`, `date-fns`) are permitted only if unchanged.

### 6.4 Supabase Advisor Gate

After any DDL migration:

1. Run `supabase-memrys_get_advisors` with `type: 'security'`
2. Run `supabase-memrys_get_advisors` with `type: 'performance'`
3. Review and remediate all findings before deployment

---

## Appendix A: Key File Index

| File | Role |
|------|------|
| `src/components/AppLayout.tsx` | Master layout shell + ContentRouter |
| `src/components/NavigationSidebar.tsx` | Left nav sidebar (context controller) |
| `src/context/TimeTreeContext.tsx` | State management for tab/space/routing |
| `src/context/AuthContext.tsx` | Auth state + session management |
| `src/hooks/useTimezone.ts` | Central timezone conversion hook |
| `src/hooks/useProfile.ts` | Profile read/update operations |
| `src/components/CalendarView.tsx` | Calendar grid — **needs timezone fix** |
| `src/components/EventModal.tsx` | Event creation — **needs timezone fix** |
| `src/components/SettingsView.tsx` | Settings panel with `MAJOR_TIMEZONES` |
| `src/components/TimezonePicker.tsx` | Legacy IANA full-list picker (grandfathered) |
| `src/components/AuthAndSettings.tsx` | Login page + legacy settings |
| `src/lib/constants.ts` | `IANA_TIMEZONES` generation (grandfathered) |
| `src/types/app.ts` | Domain type definitions |
| `src/types/supabase.ts` | Supabase type definitions (RPC contract) |
| `supabase/migrations/20260620000000_core_schema.sql` | Core schema + triggers + RLS |
| `supabase/migrations/20260622000000_timetree_cleanup.sql` | FK realignment + original RPC |
| `supabase/migrations/04_fix_delete_account_rpc.sql` | Current deployed RPC (missing spaces.created_by guard) |

## Appendix B: Foreign Key Cascade Map

```
auth.users.id
  │ ON DELETE CASCADE
  ▼
public.profiles.id
  │
  ├── ON DELETE CASCADE → space_members.user_id
  │                       └── cleanup_attendees_on_leave() trigger → calendar_event_attendees (space-scoped)
  ├── ON DELETE CASCADE → calendar_event_attendees.user_id
  ├── ON DELETE CASCADE → chat_messages.sender_id
  ├── ON DELETE CASCADE → user_model_configs.user_id
  ├── ON DELETE CASCADE → friend_connections.requester_id / recipient_id
  ├── ON DELETE SET NULL → calendar_events.created_by
  ├── NO ACTION          → spaces.created_by  (requires explicit UPDATE guard in RPC)
  └── NO ACTION          → audit_log.user_id  (preserved for audit trail)

spaces.id
  ├── ON DELETE CASCADE → space_members.space_id
  ├── ON DELETE CASCADE → chat_messages.space_id
  └── ON DELETE CASCADE → calendar_events.space_id
                            └── ON DELETE CASCADE → calendar_event_attendees.event_id
```

## Appendix C: OAuth Readiness Checklist

- [ ] **Trigger Extension**: `handle_new_user()` coalesces `display_name`, `full_name`, and `name` from `raw_user_meta_data`
- [ ] **Trigger Extension**: `handle_new_user()` populates `avatar_url` from `raw_user_meta_data`
- [ ] **OAuth Method**: `AuthContext.tsx` exposes `signInWithOAuth(provider)` calling `supabase.auth.signInWithOAuth()`
- [ ] **UI**: OAuth buttons added to `AuthAndSettings.tsx` on the `/login` route
- [ ] **Redirect**: OAuth `redirectTo` set to `window.location.origin + '/app'`
- [ ] **Supabase Project Config**: Google provider enabled in Supabase Dashboard Auth settings
- [ ] **Supabase Project Config**: Authorized redirect URIs configured (production + local development)
- [ ] **Edge Function**: `verify_jwt: true` remains — OAuth users receive valid JWTs
- [ ] **RLS**: All policies use `auth.uid()` which works identically for email/password and OAuth users
- [ ] **Profile Null Handling**: All components handle `profile === null` gracefully during OAuth redirect race
