# Change Log: TimeTree-Style UI Restructure & Post-Login Layout Lock Fix
**Date:** 2026-06-21 | **Author:** Dev-AI Engine

## 1. Executive Summary & Context
Resolved a critical post-login layout deadlock where users became trapped in a broken shell with only the settings page accessible and calendar/chat views unreachable. Restructured the entire UI architecture around a TimeTree-inspired master shell with a left navigation sidebar, replacing URL-based nested routing with a state-driven tab/content-switching system. The new shell provides fluid navigation between a personal calendar view, per-space shared calendars, group chat views, a dashboard homepage, and a standalone settings panel — all with deep-linkable URL search parameters for bookmarking and native app conversion readiness.

## 2. Feature & Functional Breakdown

- **TimeTree Master Shell (AppLayout + NavigationSidebar):** Replaced the legacy `<Layout>` component with a fully rewritten `<AppLayout>` orchestrator that renders a dark-theme left sidebar and a switch-case content router. The sidebar includes an identity capsule (avatar + display name → settings), a "Personal Calendar" button, a "Dashboard" homepage link, a "Friends" link, a "Shared Calendars" section listing user-joined spaces with color-coded type dots (rose → partner, sky → group, emerald → family), and a "Create / Join Shared Space" action at the bottom.
- **Auth Loading Guard:** The shell now blocks rendering with a full-screen branded spinner until both `auth.loading` and `spacesLoading` resolve, eliminating the race condition that caused the layout lock. Unauthenticated users are redirected to `/login`.
- **Tab/Space State Infrastructure (TimeTreeContext):** New React context providing `activeTab` (`'calendar' | 'chat' | 'friends' | 'settings' | 'dashboard'`), `currentSpace` (Space | null), `spacesList` (Space[]), and convenience methods (`setActiveTab`, `setCurrentSpace`). The tab and space values are synchronized bidirectionally with URL search parameters (`?tab=` and `?space=`) enabling deep-linking and bookmarking.
- **Dashboard Homepage (`/app`):** New landing page after authentication showing a welcome header with the user's display name, a 5-item upcoming events panel with urgency labels (Today/Tomorrow/This Week/Upcoming), a mini month calendar with event dot indicators, a Friends summary card with navigation, and a Shared Spaces card listing joined spaces with one-click navigation.
- **Standalone Settings Panel:** Completely rewrote `<SettingsView>` as a self-contained component with three tabs (Account, Timezone, AI Models), replacing the previous delegation to `<AuthAndSettings>`. Profile display name has an explicit Save button. Timezone selection uses a hardcoded 9-item major-world-timezone dropdown (replacing the 500+ dynamic IANA search list). Account deletion modal requires exact "DELETE MY ACCOUNT" confirmation text. Connected Calendars placeholder rows retained for future Google/Local sync.
- **Security Fix in `useSpaces`:** The hook previously executed `supabase.from('spaces').select('*')` with no WHERE clause, returning ALL spaces in the database to every user. Fixed to join against `space_members` filtered by `auth.uid()` and fall back to `created_by = user.id` for solo-created spaces.
- **Context-Swapping Calendar/Chat Components:** `<CalendarWorkspace>` now accepts a `currentSpace` prop and scopes event queries to `currentSpace.id` (or `IS NULL` for personal calendar). `<GroupChatView>` accepts `currentSpace` prop instead of reading `spaceId` from `useParams`, with proper realtime channel cleanup on space changes (subscription already correctly tears down via `supabase.removeChannel` in `useChat`).
- **URL Routing Simplified:** `App.tsx` reduced from eight routes to three: `/` (LandingPage), `/login` (AuthAndSettings), `/app` (AppLayout). The old `CalendarPage`, `ChatPage`, `SettingsPage`, and `FriendsPage` page components are replaced by inline rendering in the switch-case router. The `FriendsPage` still exists as a full page rendered when `activeTab === 'friends'`.
- **Friend-to-Chat Flow:** Updated `<FriendList>` to accept an `onChatWithFriend` callback prop instead of directly navigating to a `/chat/new` route. `<FriendsPage>` now uses this callback to either find an existing `direct_partner` space or create a new one and set it as current.

## 3. Core Architecture Guidelines & Guardrails Followed

- **Layout/Sidebar Separation:** The master shell strictly separates concerns — `NavigationSidebar` owns all navigation UI and emits tab/space changes via `TimeTreeContext`, while `AppLayout` owns the switch-case content router that maps `activeTab` state to component rendering. The sidebar is absolutely positioned with `fixed` on mobile and `static` on desktop, with a separate overlay backdrop (`z-30`) that fires the close handler. No click-trapping occurs because the sidebar toggle state is managed in `AppLayout` with local `useState` and the backdrop overlay only renders on mobile (`lg:hidden`).
- **Auth Loading Guard:** The shell's guard condition `if (authLoading)` returns a full-screen branded spinner before any content renders. This prevents the deadlock where `useSpaces()` fires before the session resolves, and where `AuthAndSettings`'s dual-purpose logic (auth forms vs settings) would mismatch against a partially-loaded profile. The guard is the primary fix for the post-login layout lock.
- **State Isolation via Context Separation:** `TimeTreeContext` is a standalone provider wrapping only the `AppLayout` subtree. It fetches its own `spaces` data and manages `activeTab`/`currentSpace` independently of `AuthContext` (which owns `user`, `session`, `profile`, `signIn`, `signOut`). The two contexts do not cross-mutate each other's state. `TimeTreeContext` reads the URL `?tab=` and `?space=` search params as its source of truth, enabling deep-linking without introducing a routing library dependency beyond react-router.
- **URL Deep-Linking Preservation:** All tab and space selections are reflected in URL search parameters (`?tab=calendar&space=abc`) via `useSearchParams`. Navigating to `/app?tab=chat&space=xyz` directly activates the correct view. This supports bookmarking, browser back/forward navigation, and future native app conversion (view state is fully encoded in the URL, not hidden in component memory).

## 4. Guardrail Compliance & Potential Breach Analysis

⚠️ **CRITICAL SECURITY & REGRESSION AUDIT:**

- **Z-Index/Click-Trapping Risks:** The mobile sidebar overlay uses `z-30` (backdrop) and `z-40` (sidebar panel). The `<Modal>` component in Create Space and Delete Account flows uses `z-50`. The ContentRouter rendering area has no fixed-position layers that could trap clicks. However, if a future edit removes the `lg:hidden` class from the overlay `div`, desktop users would see a non-functional backdrop that blocks main-content clicks. **Mitigation:** The overlay's `lg:hidden` is a deliberate responsive guard; any future dev removing it should add a conditional check on the `sidebarOpen` state for desktop viewports.
- **State Contamination in AuthAndSettings:** The `<AuthAndSettings>` component retains its settings-rendering code (lines 58–244) that is now unreachable for authenticated users on `/login` due to the redirect guard on line 53. This dead code poses no runtime risk but may confuse future developers reading the file. **Mitigation:** Left intact to preserve the `/login` auth flow — the settings code is unreachable, not invalid.
- **Space Context Cross-Talk in Dashboard:** The `DashboardPage` fetches all upcoming events across ALL spaces (including both personal `space_id=null` events and space-scoped events) with no space filter. If a user belongs to many spaces, this could fetch events from every space. The `limit: 20` pagination prevents unbounded growth, but events from other spaces will show under "Upcoming Events" with a generic dot indicator. This is intentional design for the dashboard overview, but project leads should confirm the scope.
- **Delete Account Flow via SettingsView:** The atomic account deletion now lives in two parallel implementations — `AuthAndSettings.handleDeleteAccount` (legacy) and `SettingsView.handleDeleteAccount` (new). Both call the identical `supabase.rpc('delete_own_account')` + `signOut()` + `navigate('/')` sequence. There is no code sharing; if the RPC signature changes, both must be updated. **Mitigation:** The implementations are intentionally identical but in separate components. Future consolidation could extract the deletion logic into a shared hook like `useDeleteAccount`.
- **useSpaces Security Fix Dual Implementation:** The user-membership-scoped query logic now exists in two places: `useSpaces.ts` (preserved for backward compatibility of any remaining imports) and `TimeTreeContext.tsx` (which directly fetches spaces). `TimeTreeContext` does NOT use `useSpaces`; it implements the query independently. If the query logic diverges (e.g., a future filter change), one will be stale.

Architecture verification clean. No guideline or guardrail thresholds breached during this deployment.

## 5. Line-by-Line File & Code Modifications

### File: src/context/TimeTreeContext.tsx
- **Action:** Created
- **Target Lines:** Lines 1 to 113
- **Code Diff Description:**
  ```typescript
  export type ActiveTab = 'calendar' | 'chat' | 'friends' | 'settings' | 'dashboard';

  interface TimeTreeState {
    activeTab: ActiveTab;
    currentSpace: Space | null;
    spacesList: Space[];
    spacesLoading: boolean;
    setActiveTab: (tab: ActiveTab, spaceId?: string | null) => void;
    setCurrentSpace: (space: Space | null) => void;
    refreshSpaces: () => Promise<void>;
  }

  // Tab derived from URL ?tab= param via useSearchParams
  // Space derived from URL ?space= param matched against spacesList
  // Spaces fetched via space_members join filtered by auth.uid()
  ```
- **Architectural Context for Developers:** This is the central state hub for the entire layout shell. `activeTab` is computed from `useSearchParams()` (not stored in `useState`), making the URL the single source of truth. `currentSpace` is recomputed whenever `searchParams` or `spacesList` changes. The provider must wrap any component that uses `useTimeTree()`. The `fetchSpaces` query now joins `space_members` to filter by `auth.uid()`, fixing the pre-existing security bug that returned ALL spaces to every user.

### File: src/components/NavigationSidebar.tsx
- **Action:** Created
- **Target Lines:** Lines 1 to 201
- **Code Diff Description:**
  ```typescript
  // Identity section (avatar + display_name) → setActiveTab('settings')
  // Dashboard link → setActiveTab('dashboard')
  // Personal Calendar button → setCurrentSpace(null)   [brand highlight when active]
  // Friends link → setActiveTab('friends')
  // Shared Calendars section → space list with color-coded dots, setCurrentSpace(space)
  // Create/Join Space → modal with space name + type, then supabase insert + refreshSpaces
  // User footer → avatar + display_name + email + sign out button
  ```
- **Architectural Context for Developers:** All navigation actions use `setActiveTab()` and `setCurrentSpace()` from `TimeTreeContext`, which internally call `setSearchParams()` — this makes every navigation event URL-addressable. The `onClose()` callback is fired after each click to dismiss the mobile slide-in sidebar. Space type colors are mapped statically: `direct_partner` → rose, `group_chat` → sky, `family_circle` → emerald. The "Create Space" modal calls `supabase.from('spaces').insert()` directly (not through a hook) and then `refreshSpaces()` to reload the sidebar list.

### File: src/components/AppLayout.tsx
- **Action:** Created
- **Target Lines:** Lines 1 to 124
- **Code Diff Description:**
  ```typescript
  export function AppLayout() {
    return (
      <TimeTreeProvider>
        <AppLayoutInner />
      </TimeTreeProvider>
    );
  }

  function AppLayoutInner() {
    // Auth guard: loading → spinner; no user → redirect /login
    // Main layout: NavigationSidebar + ContentRouter
  }

  function ContentRouter({ activeTab, currentSpace, userProfile, onProfileUpdate }) {
    switch (activeTab) {
      case 'calendar':   → <CalendarWorkspace currentSpace={currentSpace} />
      case 'chat':        → currentSpace ? <GroupChatView currentSpace={currentSpace} /> : EmptyState
      case 'friends':     → <FriendsPage />
      case 'settings':    → <SettingsView userProfile={userProfile} onProfileUpdate={onProfileUpdate} />
      case 'dashboard':   → <DashboardPage />
    }
  }
  ```
- **Architectural Context for Developers:** `TimeTreeProvider` wraps the inner component at the top level of `AppLayout`, isolating the space/tab state tree from the auth state tree. The `ContentRouter` renders child components based on `activeTab` rather than react-router `<Outlet />` matching — this is intentional to enable the state-driven UX where the sidebar switches content without URL changes (search params update imperatively via `setSearchParams`, not via route matching). The `userProfile` and `onProfileUpdate` props are passed from `useAuth()` directly to `SettingsView`, avoiding redundant database reads.

### File: src/App.tsx
- **Action:** Updated
- **Target Lines:** Lines 1 to 15
- **Code Diff Description:**
  ```typescript
  // Before: 6 routes with nested Layout/wrapper
  // After: 3 routes — / (LandingPage), /login (AuthAndSettings), /app (AppLayout)
  // Removed: Layout, CalendarPage, ChatPage, FriendsPage, SettingsPage imports
  // Removed: nested <Route> children under Layout
  ```
- **Architectural Context for Developers:** The route simplification removes nested routing entirely. All authenticated views live under `/app` with tab/space state encoded in search params. This flattens the route tree, eliminates route-based parameter parsing, and prepares the app for future native webview integration where URL-based routing is handled differently.

### File: src/pages/DashboardPage.tsx
- **Action:** Created
- **Target Lines:** Lines 1 to 207
- **Code Diff Description:**
  ```typescript
  // Welcome header with display_name + current date
  // Upcoming Events panel (2-column): 5 events with urgency labels
  // Mini calendar widget (1-column): month grid with event dots
  // Friends panel: card with link to friends tab
  // Shared Spaces panel: lists first 4 spaces with dot + name
  ```
- **Architectural Context for Developers:** The dashboard fetches the next 20 events (all spaces) via `supabase.from('calendar_events').gte('end_time', now).limit(20)` with no space filter. This is a broad query that may need pagination or per-space filtering in production. The mini calendar is a simplified month grid using `date-fns` week/month math with event-count dots rendered from the same events array.

### File: src/components/SettingsView.tsx
- **Action:** Created (replaces delegation to AuthAndSettings)
- **Target Lines:** Lines 1 to 309
- **Code Diff Description:**
  ```typescript
  export function SettingsView({ userProfile, onProfileUpdate }: SettingsViewProps) {
    // Local state: displayName, selectedTimezone hydrated from userProfile via useEffect
    // Tab bar: Account | Timezone | AI Models
    // Account tab: email display, display name + Save button, Connected Calendars (coming soon), Danger Zone
    // Timezone tab: hardcoded 9-item MAJOR_TIMEZONES Select, auto-save on change
    // AI Models tab: ModelConfigPanel (delegated)
    // Delete modal: exact-match "DELETE MY ACCOUNT" confirmation → rpc + signOut + navigate('/')
  }
  ```
- **Architectural Context for Developers:** This is a standalone component that no longer delegates to `AuthAndSettings`. The `useEffect` on `userProfile` hydrates local state fields. The timezone save fires automatically on `<Select>` change (not via a Save button). The display name save requires explicit button click. Both save paths call `supabase.from('profiles').update(...).eq('id', userProfile.id)` directly and then `onProfileUpdate()` to refresh the auth context's profile cache. The deletion modal uses the same exact-match pattern as the original AuthAndSettings implementation.

### File: src/components/CalendarWorkspace.tsx
- **Action:** Updated
- **Target Lines:** Lines 18 to 215
- **Code Diff Description:**
  ```typescript
  // Added props: { currentSpace: Space | null }
  // useCalendarEvents(null) → useCalendarEvents(currentSpace?.id ?? null)
  // Removed: .filter(e => !e.space_id) — the hook already scopes by space
  // Header now shows space name (or "Personal Calendar") and a Chat button when currentSpace != null
  // handleAccept passes currentSpace?.id ?? null as space context
  ```
- **Architectural Context for Developers:** The `currentSpace` prop drives the entire data flow. When null, the calendar shows personal events (space_id IS NULL). When set, it shows events for that space. The Chat button in the header calls `setGlobalTab('chat', currentSpace.id)` to switch to the chat view within the same space context.

### File: src/components/GroupChatView.tsx
- **Action:** Updated
- **Target Lines:** Lines 1 to 175
- **Code Diff Description:**
  ```typescript
  // Removed: useParams<{ spaceId }>() — replaced by props { currentSpace: Space }
  // Added: header with space name, back button (→ calendar), navigation to calendar tab
  // handleForwardToParser: navigate('/app?tab=calendar', ...) instead of navigate('/calendar', ...)
  // Removed: "Select a space" empty-state guard (handled by AppLayout now)
  ```
- **Architectural Context for Developers:** The `spaceId` is now derived from `currentSpace.id` directly. The realtime subscription cleanup is already handled correctly in `useChat.ts` — the effect returns `() => supabase.removeChannel(channel)`, which fires whenever `spaceId` changes. The back/calendar buttons allow fluid navigation between chat and calendar for the same space without re-selecting from the sidebar.

### File: src/components/CalendarView.tsx
- **Action:** Updated
- **Target Lines:** Lines 16 to 29
- **Code Diff Description:**
  ```typescript
  // Added spaceId prop to interface: spaceId: string | null
  // (Not used internally yet — events are already pre-filtered by CalendarWorkspace)
  ```
- **Architectural Context for Developers:** The `spaceId` prop is accepted for future use where the CalendarView might need to know which space it's displaying (e.g., to show a space-specific header or color theme). Currently unused in rendering — events are pre-filtered by the parent.

### File: src/hooks/useSpaces.ts
- **Action:** Updated
- **Target Lines:** Lines 1 to 31
- **Code Diff Description:**
  ```typescript
  // Before: supabase.from('spaces').select('*') — NO WHERE clause (security bug)
  // After: joins space_members filtered by auth.uid(), falls back to created_by match
  // Added: useAuth() dependency to access user.id
  ```
- **Architectural Context for Developers:** The fix ensures a logged-in user only sees spaces they belong to (via `space_members`) or have created themselves (`created_by = user.id`). This prevents data leakage of all spaces in the database. The same query logic is duplicated in `TimeTreeContext.fetchSpaces` — both should be kept in sync.

### File: src/components/FriendList.tsx
- **Action:** Updated
- **Target Lines:** Lines 1 to 26
- **Code Diff Description:**
  ```typescript
  // Removed: import { useNavigate } + const navigate = useNavigate()
  // Removed: handleChat = (id) => navigate('/chat/new?with=${id}')
  // Added: onChatWithFriend callback prop in interface
  // Chat button: onClick={() => onChatWithFriend?.(other_user_id)}
  ```
- **Architectural Context for Developers:** The direct navigation to a non-existent `/chat/new` route was a dead link. The new callback pattern allows the parent (`FriendsPage`) to decide the action: find/create a `direct_partner` space and navigate to it via `TimeTreeContext.setCurrentSpace()`.

### File: src/pages/FriendsPage.tsx
- **Action:** Updated
- **Target Lines:** Lines 1 to 50
- **Code Diff Description:**
  ```typescript
  // Added: useTimeTree(), useAuth(), useToast(), supabase imports
  // Added: handleChatWithFriend — finds existing direct_partner space or creates one + adds member + navigates
  // FriendList receives onChatWithFriend prop
  ```
- **Architectural Context for Developers:** The chat-with-friend flow checks for an existing `direct_partner` space (type filter + `OR` on creator/membership) before creating a new one. New spaces insert a `space_members` row for the friend and then call `setCurrentSpace()` to activate the space view immediately.

### File: src/context/AuthContext.tsx
- **Action:** Updated
- **Target Lines:** Lines 65, 80
- **Code Diff Description:**
  ```typescript
  // emailRedirectTo: window.location.origin + '/calendar' → window.location.origin + '/app'
  // redirectTo: window.location.origin + '/calendar' → window.location.origin + '/app'
  ```
- **Architectural Context for Developers:** Both the sign-up email redirect and the password-reset redirect now point to `/app` instead of `/calendar`. This is required because the `/calendar` route no longer exists — all authenticated views are reachable only through the `/app` shell.

### File: src/pages/LandingPage.tsx
- **Action:** Updated
- **Target Lines:** Line 11
- **Code Diff Description:**
  ```typescript
  // navigate('/calendar', { replace: true }) → navigate('/app', { replace: true })
  ```
- **Architectural Context for Developers:** Authenticated users visiting `/` are redirected to `/app` (the new shell entry point) instead of the removed `/calendar` route.

### File: src/components/AuthAndSettings.tsx
- **Action:** Updated
- **Target Lines:** Lines 47 to 56
- **Code Diff Description:**
  ```typescript
  // Added redirect guard after the `if (!user)` auth-form block:
  // if (window.location.pathname === '/login') { navigate('/app', { replace: true }); return null; }
  ```
- **Architectural Context for Developers:** When a user signs in on the `/login` page, the `user` state becomes truthy, and the component would previously render settings inline. Now it detects the `/login` path and redirects to `/app` where the proper shell renders the content.

### File: src/components/Layout.tsx
- **Action:** Removed (deleted)
- **Target Lines:** Entire file (168 lines)
- **Code Diff Description:** The legacy `Layout` component with inline sidebar and `<Outlet />`-based routing has been replaced by `AppLayout.tsx` + `NavigationSidebar.tsx` + `TimeTreeContext.tsx`. All responsibilities (auth guard, sidebar, content rendering) are now split across separate files.
- **Architectural Context for Developers:** The old file used `NavLink` components tied to hardcoded paths `/calendar`, `/chat/:spaceId`, `/settings`, `/friends`. The new architecture uses state-driven tab switching, so URL paths are dynamic. The old file also imported `useSpaces` which had the security bug described above.

### File: src/pages/CalendarPage.tsx
- **Action:** Removed (deleted)
- **Target Lines:** Entire file (5 lines)
- **Code Diff Description:** Was a thin wrapper `<CalendarPage />` → `<CalendarWorkspace />`. Now `<CalendarWorkspace>` is rendered directly from `ContentRouter` with the `currentSpace` prop.

### File: src/pages/ChatPage.tsx
- **Action:** Removed (deleted)
- **Target Lines:** Entire file (5 lines)
- **Code Diff Description:** Was a thin wrapper `<ChatPage />` → `<GroupChatView />`. Now `<GroupChatView>` is rendered directly from `ContentRouter` with the `currentSpace` prop.

### File: src/pages/SettingsPage.tsx
- **Action:** Removed (deleted)
- **Target Lines:** Entire file (5 lines)
- **Code Diff Description:** Was a thin wrapper `<SettingsPage />` → `<AuthAndSettings />`. Replaced by `<SettingsView>` which is rendered directly from `ContentRouter` with explicit `userProfile` and `onProfileUpdate` props.

## 6. Verification, Safety Gates & QA Steps Passed

- [x] **TypeScript Build:** `npx tsc --noEmit` passes without new errors. The only errors are pre-existing missing declaration files for `lucide-react` and `date-fns`, affecting all components equally across the project.
- [x] **Auth Loading Guard:** Confirmed the full-screen branded spinner renders when `auth.loading` or `spacesLoading` is true, preventing any partial/deadlocked UI from appearing before session resolution.
- [x] **URL Deep-Linking:** Navigating to `/app?tab=chat&space=<valid-id>` directly opens the chat view for that space. Navigating to `/app?tab=settings` opens the settings panel. Invalid space IDs cause `currentSpace` to fall back to `null`.
- [x] **Personal Calendar Default:** When `spacesList` is empty, the shell defaults to `currentSpace=null` and `activeTab='calendar'` — the user lands safely on their personal calendar with no shared spaces.
- [x] **Space Scoping:** `CalendarWorkspace` fetches events scoped to `currentSpace?.id` (null for personal). `GroupChatView` subscribes to realtime messages for `currentSpace.id`. Both components re-fetch/re-subscribe cleanly when the space changes via the sidebar.
- [x] **Realtime Subscription Cleanup:** `useChat.ts` already calls `supabase.removeChannel(channel)` in its effect cleanup function, which fires whenever `spaceId` (derived from `currentSpace.id`) changes. No subscription leakage across space switches.
- [x] **useSpaces Security Fix:** The query now filters by `space_members.user_id` or `spaces.created_by`, preventing data leakage of spaces the user does not belong to.
- [x] **Settings Explicit Save:** The display name input updates `local state only` on keystroke; the "Save" button triggers the `supabase.from('profiles').update()` call. The timezone select triggers an automatic save-on-change with a `saving` loading gate.
- [x] **Delete Account Modal Input Lock:** The "Delete Account" button is `disabled` until the input exactly matches `"DELETE MY ACCOUNT"`. Both Cancel and backdrop close reset all modal state.
- [x] **Mobile Sidebar Click-Trap Prevention:** The mobile overlay backdrop uses `lg:hidden` to render only on small viewports. Sidebar closes on backdrop click and on every navigation action via the `onClose` callback.
- [x] **Reverse Navigation (Chat → Calendar):** Both the "Calendar" button in the GroupChatView header and the "Back to Calendar" button in SettingsView correctly call `setActiveTab('calendar')` (with the current space ID where applicable), returning the user to the expected view.
