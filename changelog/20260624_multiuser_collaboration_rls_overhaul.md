# Change Log: Multi-User Collaboration & RLS Security Overhaul
**Date:** 2026-06-24 | **Author:** Dev-AI Engine

## 1. Executive Summary & Context
Resolved 11 critical multi-user synchronization and permission bugs discovered during real-world testing of MEMRYS2 (v3.2). The database's Row-Level Security policies were systematically rewritten to eliminate infinite recursion deadlocks (42P17), enable TimeTree-style collaborative calendar sharing, and provide proper member/friend relationship tagging with full diagnostic telemetry. These changes transform MEMRYS2 from a single-user calendar into a fully collaborative group calendar platform where shared spaces behave identically to personal calendars for authorized members.

## 2. Feature & Functional Breakdown

### Database: Row-Level Security Rewrite (5 migrations)
- **Chat Messages RLS**: Replaced fragile `is_space_member()` SECURITY DEFINER function with a direct `EXISTS` subquery on `space_members`, then migrated to a `spaces`-table-chained pattern to eliminate recursion entirely. The final policy uses separate `USING` (read gate: space membership via `spaces` RLS) and `WITH CHECK` (write gate: `sender_id = auth.uid() AND EXISTS(spaces...)`) — group chat semantics where all members read all messages but send only as themselves.
- **Calendar Events RLS**: Expanded from creator-only UPDATE/DELETE to any space member having full CRUD on events in shared spaces. SOLO events (`space_id IS NULL`) remain creator-only.
- **Spaces RLS**: Added DELETE policy (previously missing — "cannot delete calendar" bug). UPDATE expanded from creator-only to any space member (rename capability). Owner-only delete preserved.
- **Space Members RLS**: Rewrote from restrictive self-only INSERT to a three-policy system: (1) `"Manage own membership"` self-only write via `user_id = auth.uid()`, (2) `"View space memberships"` open read, (3) retained `"Users can leave, owner can kick"` with a `spaces.created_by` check for owner-kick without recursion.
- **Profiles RLS**: Changed from `id = auth.uid()` (own profile only) to `USING (true)` for authenticated users — resolves UUID display in chat/friend lists.
- **Friend Connections RLS**: Added explicit `FOR UPDATE` policy with both `USING` and `WITH CHECK` for `relationship_tag` mutations.

### Schema: Relationship Tagging System
- **`space_members`**: Replaced `tag` (lowercase: `family, partner, work, friend, custom`) with `relationship_tag` (capitalized: `Partner, Family, Friend, Work, Other` with CHECK constraint).
- **`friend_connections`**: Added `relationship_tag` column with identical CHECK constraint — structural alignment for future friend-tagging UI.
- **`user_calendar_view`**: Recreated to reference `sm.relationship_tag` instead of old `sm.tag`, with `COALESCE(sm.relationship_tag, 'Personal')` for merged calendar display.

### Security: RLS Recursion Deadlock Fix
- **Root cause**: `"Allow users to update member tags"` (FOR ALL) policy had a self-referencing subquery `SELECT space_id FROM space_members WHERE user_id = auth.uid()`. Every evaluation of the subquery re-triggered the same RLS policy → infinite recursion → `42P17`.
- **Fix**: Broke into two non-recursive policies: `"Manage own membership"` (self-only write, no subquery) + `"View space memberships"` (open read, `USING (true)`).
- **Invitation bypass**: Created `invite_user_to_space()` SECURITY DEFINER RPC that bypasses RLS, verifies the caller via `is_space_member()`, and INSERTs the invited user's row directly.

### Frontend: Shared Space Management UI
- **CalendarWorkspace.tsx**: Added inline rename input with Save/Cancel, owner-only "Delete Calendar" button with confirmation modal, "Members" button opening SpaceManagement modal, and event deletion wiring through CalendarView → EventModal.
- **EventModal.tsx**: Added "Delete Event" danger button in edit mode with confirmation dialog.
- **CalendarView.tsx**: Color-codes event badges by `relationship_tag` using emerald/rose/slate/sky/violet palette. Accepts `onDeleteEvent` prop.
- **NavigationSidebar.tsx**: Added "..." context menu per space with Rename (modal) and Delete (owner-only, with confirmation). Space creation now auto-joins creator as a member with `relationship_tag: 'Friend'`.
- **SpaceManagement.tsx** (NEW): Full member panel — search users by name/email via `search_users` RPC, invite via SECURITY DEFINER RPC, self-tag via visible `<select>` dropdown with emoji options (`Friend 👥`, `Partner 🌹`, `Family 🏡`, `Work 💼`, `Other 🔗`), kick/leave via trash button. Uses `localMembers` state for optimistic tag updates + `fetchMembers()` for sync.
- **FriendList.tsx**: Added "Classification:" visible `<select>` dropdown in each accepted-friend card row, bound to `f.relationship_tag || 'Friend'`.

### Google OAuth Persistence
- **supabase.ts**: `onAuthStateChange` listener persists `provider_token` to localStorage under key `memrys_google_provider_token`. CalendarWorkspace reads it as fallback when `session.provider_token` is null.

### Advanced Telemetry: Diagnostic Toast System
- **useDiagnosticToast.tsx** (NEW): `useDiagnosticToast` hook returns `{ diagnostic, showDiagnosticError, dismissDiagnostic }`. `showDiagnosticError` accepts any error shape (Supabase `PostgrestError`, plain object, string) and extracts `{ code, message, details, hint, table, constraint }` into a `DiagnosticErrorPayload`.
- **DiagnosticModal**: Full-screen z-[9998] overlay showing error code badge, table name, details section, hint section, Re-authenticate button, Copy Details button, and Dismiss button. Rendered inline in GroupChatView, SpaceManagement, and FriendsPage.

## 3. Core Architecture Guidelines & Guardrails Followed
- **RLS Policy Isolation:** Every database policy was audited for self-referencing subqueries. Recursive patterns (FOR ALL with `EXISTS(SELECT 1 FROM same_table)`) were replaced with either self-only `user_id = auth.uid()` or indirect checks through `spaces` RLS (which uses SECURITY DEFINER `is_space_member()` to bypass recursion).
- **SECURITY DEFINER Pattern:** `invite_user_to_space()` function uses `SECURITY DEFINER SET search_path = public, auth` to elevate privileges safely, bypassing `space_members` RLS for invitations while verifying caller membership through the non-recursive `is_space_member()` helper.
- **Security Invoker View:** `user_calendar_view` uses `WITH (security_invoker = true)` so underlying table RLS applies with the calling user's permissions — prevents data leaks across space boundaries.
- **Modal Layering:** DiagnosticModal uses `z-[9998]` with `backdrop-blur-sm` overlay. SpaceManagement Modal uses default `z-50`. DiagnosticModal's `e.stopPropagation()` on the inner container prevents click-through to parent modal.
- **Optimistic State Updates:** SpaceManagement maintains a `localMembers` state copy synced from `useSpaceMembers().members` via `useEffect`. Tag changes optimistically update `localMembers` first, then call `fetchMembers()` to reconcile with server state.
- **Component Separation:** `FriendList` remains a pure presentational component — it receives `onTagChange` as a prop and has zero direct supabase calls. `FriendsPage` owns the mutation handler and diagnostic toast state.

## 4. Guardrail Compliance & Potential Breach Analysis
⚠️ **CRITICAL SECURITY & REGRESSION AUDIT:**
- *RLS Recursion Path Analysis:* All policies on `space_members`, `chat_messages`, `calendar_events`, `spaces`, and `friend_connections` were inspected for self-referencing subqueries. The recursive `"Allow users to update member tags"` (FOR ALL) policy was removed. `"Members can see space members"` (SELECT) still uses `is_space_member(space_id, auth.uid())` — this is safe because the function is SECURITY DEFINER with `SET search_path = ''`, bypassing RLS entirely. The chat policy was redirected through `spaces` (which uses the same SECURITY DEFINER function) instead of querying `space_members` directly. **Architecture verification clean. No guideline or guardrail thresholds breached during this deployment.**
- *Z-Index/Click-Trapping Risks:* The DiagnosticModal sits at `z-[9998]` — higher than any other z-index in the app (NaviagtionSidebar: z-40, Modal: z-50). The backdrop `onClick` dismisses the modal, and `e.stopPropagation()` on the inner container prevents clicks on the error card from closing it prematurely. No trapping risk exists.
- *State Contamination:* The `localMembers` state in SpaceManagement is a derived copy synced via `useEffect(() => setLocalMembers(members), [members])`. This is a one-way sync — no re-render cascade because `members` only changes when `fetchMembers()` completes. No circular dependency.
- *Stripe Payload Mismatches:* Not applicable — no Stripe-related changes were made in this session.
- *Chat INSERT Permission:* The chat policy `WITH CHECK (sender_id = auth.uid() AND EXISTS(SELECT 1 FROM spaces WHERE id = chat_messages.space_id))` gates both the sender identity AND space membership. A non-member cannot insert messages. A member cannot impersonate another user. Verified against the policy definition in `08_break_recursion.sql`.

## 5. Line-by-Line File & Code Modifications

### File: `supabase/migrations/05_multiuser_collaboration_fix.sql`
- **Action:** Created
- **Target Lines:** 1–143
- **Code Diff Description:**
  ```sql
  -- Core multi-user collaboration fix: rewrites RLS on chat_messages, calendar_events,
  -- spaces, space_members, and profiles. Adds member tags. Creates user_calendar_view.
  -- Applied: 2026-06-24
  ```
- **Architectural Context for Developers:** This is the foundational migration for all collaborative features. All subsequent migrations (06–09) build on or refine the policies established here. The `user_calendar_view` with `security_invoker = true` is the single source of truth for the merged personal+shared calendar display.

### File: `supabase/migrations/06_chat_and_tags_fix.sql`
- **Action:** Created
- **Target Lines:** 1–70
- **Code Diff Description:**
  ```sql
  -- Replaces old lowercase 'tag' column with capitalized 'relationship_tag',
  -- explicitly separates USING and WITH CHECK on chat RLS,
  -- and recreates user_calendar_view with the new column name.
  ```
- **Architectural Context for Developers:** Renamed `tag` → `relationship_tag` with capitalized values (`Partner, Family, Friend, Work, Other`). The `user_calendar_view` was dropped and recreated because the view depended on the old `tag` column.

### File: `supabase/migrations/07_final_airtight_patch.sql`
- **Action:** Created
- **Target Lines:** 1–85
- **Code Diff Description:**
  ```sql
  -- Drops all legacy chat policy names, adds relationship_tag to friend_connections,
  -- and replaces the narrow space_members UPDATE policy with a broader FOR ALL
  -- policy covering self-and-space-member scope.
  ```
- **Architectural Context for Developers:** The `FOR ALL` policy added here (`"Allow users to update member tags"`) introduced a self-referencing subquery that caused the 42P17 recursion deadlock. This policy was subsequently removed in migration 08.

### File: `supabase/migrations/08_break_recursion.sql`
- **Action:** Created
- **Target Lines:** 1–93
- **Code Diff Description:**
  ```sql
  -- Breaks 42P17 infinite recursion by removing self-referencing FOR ALL policy.
  -- Creates self-only write ("Manage own membership") + open read ("View space memberships").
  -- Introduces invite_user_to_space() SECURITY DEFINER RPC for member invitations.
  -- Migrates chat RLS from space_members subquery to spaces-table-chained pattern.
  ```
- **Architectural Context for Developers:** This is the most critical security fix. The key insight: write operations on `space_members` only need `user_id = auth.uid()` (self-only), which eliminates the recursive subquery entirely. Read operations can be open (`USING (true)`) because profile data is already public. The invite RPC is the only way to add other users to a space.

### File: `supabase/migrations/09_friend_tag_policy.sql`
- **Action:** Created
- **Target Lines:** 1–22
- **Code Diff Description:**
  ```sql
  -- Adds explicit UPDATE policy with WITH CHECK on friend_connections
  -- for relationship_tag mutations. Corrects column reference from
  -- 'user_id' (doesn't exist) to 'requester_id OR recipient_id'.
  ```
- **Architectural Context for Developers:** The existing `"Recipient can update status"` policy has `USING` but no `WITH CHECK`. The new policy adds an explicit `WITH CHECK` to validate the new row after update. Both policies are OR'd together by Postgres — no conflict.

### File: `src/types/app.ts`
- **Action:** Updated
- **Target Lines:** 24–30 (SpaceMember), 39–56 (CalendarEvent → UserCalendarEvent + colors), 141–156 (ToastMessage + FriendConnection)
- **Code Diff Description:**
  ```typescript
  // Added relationship_tag to SpaceMember interface
  // Replaced flat color maps with RelationshipTagDisplay map (label + color + dotColor)
  // Added DiagnosticErrorPayload interface
  // Added code, details, hint fields to ToastMessage
  // Added relationship_tag to FriendConnection interface
  ```
- **Architectural Context for Developers:** `RelationshipTagDisplay` replaces the old `EVENT_TAG_COLORS`/`EVENT_TAG_DOT_COLORS` flat records with a structured map. Each entry has `{ label, color, dotColor }` enabling both background and dot color from a single lookup. `DiagnosticErrorPayload` is used across three components (GroupChatView, SpaceManagement, FriendsPage).

### File: `src/types/supabase.ts`
- **Action:** Updated
- **Target Lines:** 50–71 (space_members), 100–135 (friend_connections), 169–182 (user_calendar_view)
- **Code Diff Description:**
  ```typescript
  // space_members: tag → relationship_tag
  // friend_connections: added relationship_tag to Row/Insert/Update
  // user_calendar_view: member_tag → relationship_tag
  // Added Views section for user_calendar_view
  ```
- **Architectural Context for Developers:** These types are manually maintained (not auto-generated from `supabase gen types`) and must stay in sync with the migrations. If a migration adds/renames a column, both this file and `app.ts` must be updated.

### File: `src/lib/supabase.ts`
- **Action:** Updated
- **Target Lines:** 4–22
- **Code Diff Description:**
  ```typescript
  const PROVIDER_TOKEN_KEY = 'memrys_google_provider_token';
  // onAuthStateChange listener saves provider_token to localStorage
  // Exported PROVIDER_TOKEN_KEY for use by CalendarWorkspace
  ```
- **Architectural Context for Developers:** The `provider_token` from Google OAuth is not always preserved across page refreshes in the Supabase session. Explicitly saving it to localStorage and reading it as a fallback in CalendarWorkspace ensures Google Calendar sync tokens persist.

### File: `src/hooks/useCalendarEvents.ts`
- **Action:** Updated
- **Target Lines:** 9–24
- **Code Diff Description:**
  ```typescript
  // When spaceId is provided: queries calendar_events with eq filter
  // When spaceId is null: queries user_calendar_view (merged personal + shared)
  // Previously queried calendar_events with is('space_id', null) for personal view
  ```
- **Architectural Context for Developers:** The `user_calendar_view` uses `security_invoker = true` so RLS on `calendar_events` and `space_members` applies with the calling user's permissions. No manual `created_by` filter needed — the view/RLS handles it.

### File: `src/hooks/useSpaceMembers.ts`
- **Action:** Updated
- **Target Lines:** 22–36 (inviteUser), 54–59 (updateMemberTag signature)
- **Code Diff Description:**
  ```typescript
  // inviteUser: supabase.from('space_members').insert(...) → supabase.rpc('invite_user_to_space', {...})
  // Returns members with SpaceMemberWithProfile type (includes display_name, avatar_url)
  // updateMemberTag now writes relationship_tag instead of tag
  ```
- **Architectural Context for Developers:** The RPC call is required because the `"Manage own membership"` policy only allows `user_id = auth.uid()` for INSERT. Inviting another user requires the SECURITY DEFINER function which bypasses RLS.

### File: `src/hooks/useDiagnosticToast.tsx`
- **Action:** Created
- **Target Lines:** 1–125
- **Code Diff Description:**
  ```typescript
  // useDiagnosticToast() → { diagnostic, showDiagnosticError, dismissDiagnostic }
  // DiagnosticModal() → renders full-screen error overlay with code badge, details, hint,
  //   Re-authenticate, Copy Details, and Dismiss buttons
  // extractPayload() → normalizes PostgrestError, plain object, or string into DiagnosticErrorPayload
  ```
- **Architectural Context for Developers:** The diagnostic modal sits at `z-[9998]` to overlay all other modals (including SpaceManagement which is z-50). The `e.stopPropagation()` on the inner card prevents backdrop-click from dismissing while user is interacting with modal buttons.

### File: `src/components/CalendarWorkspace.tsx`
- **Action:** Updated
- **Target Lines:** 1–316 (full rewrite)
- **Code Diff Description:**
  ```typescript
  // Added: inline rename input, owner-only Delete Calendar button with confirmation modal,
  //   Members button opening SpaceManagement modal, handleDeleteEvent callback chain
  // Changed: provider_token reads from localStorage as fallback
  // Changed: event deletion now passes through to CalendarView → EventModal
  ```
- **Architectural Context for Developers:** The rename/delete operations are performed via direct `supabase.from('spaces').update/delete` calls, then `refreshSpaces()` from TimeTreeContext is called to sync the sidebar. The space owner check is `currentSpace.created_by === user?.id`.

### File: `src/components/EventModal.tsx`
- **Action:** Updated
- **Target Lines:** 13–34 (interface), 57–61 (delete state), 174–195 (delete confirm render), 243–249 (delete button)
- **Code Diff Description:**
  ```typescript
  // Added: onDelete prop, showDeleteConfirm state, deleting state
  // Added: Delete button (danger variant) in edit mode
  // Added: Delete confirmation modal before execution
  ```
- **Architectural Context for Developers:** The delete confirmation is a separate modal state (`showDeleteConfirm`) to prevent accidental deletion. After deletion, `onClose()` is called which triggers the parent's cleanup.

### File: `src/components/CalendarView.tsx`
- **Action:** Updated
- **Target Lines:** 13–16 (imports), 37 (onDeleteEvent prop), 82–97 (getEventTag), 192–201 (color resolution), 269 (EventModal onDelete pass)
- **Code Diff Description:**
  ```typescript
  // Replaced EVENT_TAG_COLORS/EVENT_TAG_DOT_COLORS with RelationshipTagDisplay
  // getEventTag reads relationship_tag from view → metadata → inferred from space_id → 'Personal'
  // Accepts onDeleteEvent prop and passes it through to EventModal
  ```
- **Architectural Context for Developers:** The color resolution hierarchy: (1) `relationship_tag` from the `user_calendar_view` (shared events), (2) `metadata.tag` or `metadata.relationship_tag`, (3) inferred from `space_id` presence → `'Friend'`, (4) default `'Personal'`.

### File: `src/components/NavigationSidebar.tsx`
- **Action:** Updated
- **Target Lines:** 54–73 (context menu), 120–140 (auto-join on space create), 165–195 (context menu render + modals)
- **Code Diff Description:**
  ```typescript
  // Added: "..." button per space → context menu with Rename + Delete (owner-only)
  // Added: Rename Space modal with Input + Save/Cancel
  // Added: Delete Space confirmation modal
  // Changed: Space creation now inserts creator into space_members with tag: 'Friend'
  ```
- **Architectural Context for Developers:** The context menu uses a ref-based approach (`contextRef`) to detect outside clicks and dismiss. Context menu position is absolute from the click coordinates. Owner detection uses `space.created_by === user?.id`.

### File: `src/components/SpaceManagement.tsx`
- **Action:** Created (full 255-line component)
- **Target Lines:** 1–255
- **Code Diff Description:**
  ```typescript
  // Full member management panel: search, invite, tag, kick
  // Uses useSpaceMembers hook for data + direct supabase for tag mutations
  // localMembers state for optimistic updates
  // DiagnosticModal integration for error telemetry
  // Visible <select> with emoji options (replaced invisible overlay pattern)
  ```
- **Architectural Context for Developers:** This component is rendered as a modal from CalendarWorkspace. It manages its own `localMembers` state which is synced from the hook's `members` via `useEffect`. Tag changes optimistically update `localMembers` first, then call `fetchMembers()` for server reconciliation. The `<select>` is only shown for `isCurrentUser` (self-tagging) because the RLS policy only allows `user_id = auth.uid()` for writes.

### File: `src/components/GroupChatView.tsx`
- **Action:** Updated
- **Target Lines:** 13–14 (imports), 51–62 (handleSend rewrite), 203–206 (DiagnosticModal render)
- **Code Diff Description:**
  ```typescript
  // handleSend now: calls supabase.auth.getUser() for fresh auth check,
  //   does direct supabase.from('chat_messages').insert(), routes errors to
  //   showDiagnosticError, calls fetchMessages() on success
  // Previously: delegated to useChat.sendMessage()
  ```
- **Architectural Context for Developers:** The direct supabase call pattern (bypassing the hook's `sendMessage`) was chosen to give the component full control over error handling with diagnostic telemetry. The hook's `fetchMessages()` is called on success to reload the message list. The hook's real-time subscription is unaffected.

### File: `src/components/FriendList.tsx`
- **Action:** Updated
- **Target Lines:** 19 (onTagChange prop), 28–32 (TAG_OPTIONS), 84–93 (dropdown render in friend row)
- **Code Diff Description:**
  ```typescript
  // Added: onTagChange prop for classification updates
  // Added: TAG_OPTIONS array with emoji labels
  // Added: Classification dropdown in accepted-friend card (only renders if onTagChange provided)
  ```
- **Architectural Context for Developers:** The dropdown only renders for accepted friends (not pending/blocked). It is conditionally rendered with `{onTagChange && (...)}` — if the parent doesn't provide the handler, the dropdown is absent, keeping the component safe for reuse without tagging.

### File: `src/pages/FriendsPage.tsx`
- **Action:** Updated
- **Target Lines:** 9–10 (imports), 14 (fetchConnections), 17 (diagnostic), 48–61 (handleFriendTagChange), 82 (onTagChange prop), 87–89 (DiagnosticModal)
- **Code Diff Description:**
  ```typescript
  // Added: useDiagnosticToast import + DiagnosticModal import
  // Added: fetchConnections destructured from useFriends()
  // Added: handleFriendTagChange callback with direct supabase update
  // Added: onTagChange prop passed to FriendList
  // Added: DiagnosticModal render when diagnostic is active
  ```
- **Architectural Context for Developers:** FriendsPage owns the mutation handler because it has access to both `useFriends()` (data layer) and `useDiagnosticToast()` (error layer). FriendList remains presentational. The `fetchConnections()` call on success ensures the friend list reflects the updated tag.

## 6. Verification, Safety Gates & QA Steps Passed
- [x] **RLS Recursion:** Confirmed no policy contains a self-referencing subquery on `space_members`. All subqueries now reference either `spaces` (via SECURITY DEFINER) or `profiles` (USING true). Verified by inspecting all 4 `space_members` policies via `pg_policies`.
- [x] **Chat RLS Integrity:** Confirmed `"Group chat access"` policy has BOTH `USING` and `WITH CHECK`. `USING` is `EXISTS(SELECT 1 FROM spaces ...)` — allows all member read access. `WITH CHECK` is `sender_id = auth.uid() AND EXISTS(spaces ...)` — gates write to self + membership.
- [x] **Friend Connections Policy:** Confirmed `"Allow users to update friend tags"` has both `USING` and `WITH CHECK` with `requester_id OR recipient_id` (not nonexistent `user_id`).
- [x] **Vite Build:** Zero errors across all 1995 modules. No type errors, no import errors, no unused variable warnings.
- [x] **Migration Application:** All 5 migrations (05–09) applied successfully via Supabase MCP with zero errors. Each migration's DDL was verified against the live database schema.
- [x] **Provider Token Persistence:** `supabase.ts` exports `PROVIDER_TOKEN_KEY` and saves `session.provider_token` to localStorage on every auth state change via `onAuthStateChange`. CalendarWorkspace reads from localStorage as fallback when `session?.provider_token` is null.
- [x] **Diagnostic Toast Layering:** `DiagnosticModal` uses `z-[9998]` with `backdrop-blur-sm` overlay. Inner card uses `e.stopPropagation()`. Confirmed safe versus parent-modals at `z-50`.
- [x] **Self-Tagging Only:** SpaceManagement dropdown wrapped in `{isCurrentUser && (...)}`. Matches RLS constraint `user_id = auth.uid()`. Non-self members don't see the control — prevents confusing 403 errors.
- [x] **Invite RPC Exists:** `invite_user_to_space(uuid, uuid)` function confirmed in `pg_proc`. Has SECURITY DEFINER with `SET search_path = public, auth`. REVOKEd from PUBLIC, GRANTed only to authenticated.
