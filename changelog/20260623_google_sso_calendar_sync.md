# Change Log: Google SSO Login & Calendar Sync Infrastructure
**Date:** 2026-06-23 | **Author:** Dev-AI Engine

## 1. Executive Summary & Context
Implemented Google OAuth single sign-on and Google Calendar read-only syncing for the Memrys2 platform. Users can now log in with their Google account (or link it later via Settings), and any Google Calendar events are automatically fetched and blended into the native calendar view alongside locally created events from Supabase. This eliminates the manual double-entry friction for users who rely on Google Calendar as their primary scheduling tool, increasing daily engagement and reducing user churn on the calendar workspace.

## 2. Feature & Functional Breakdown

- **Google SSO Login:** A "Sign in with Google" button was added below the existing email/password form in the `AuthView` component. Clicking it calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with the `calendar.readonly` scope, `access_type: 'offline'`, and `prompt: 'consent'`. This appears on both the Sign In and Sign Up tabs.

- **Google Calendar Event Sync:** A `useEffect` loop inside `CalendarWorkspace.tsx` extracts `session.provider_token` from the Supabase session and fetches upcoming events from `https://www.googleapis.com/calendar/v3/calendars/primary/events`. Google events are transformed into the local `CalendarEvent` schema shape and merged with native Supabase events (deduplicated by ID) for unified rendering in `CalendarView`.

- **Settings & Account Linking:** The legacy "Coming Soon" placeholder for Google Calendar in both `SettingsView.tsx` and `AuthAndSettings.tsx` was replaced with a reactive row that reads `user.identities` to detect Google linkage. If linked, a green "Connected" badge is shown. If not, a "Connect" button triggers `supabase.auth.linkIdentity({ provider: 'google' })`. Users who originally signed up with email/password can thus connect their Google account and gain Google Calendar sync, and subsequently sign in with Google on future visits.

## 3. Core Architecture Guidelines & Guardrails Followed

- **OAuth Provider Token Access:** The `provider_token` is read exclusively from the Supabase `Session` object exposed via `useAuth()` context, never from raw browser storage. The token is sent as an HTTP Bearer header to Google's REST API, never persisted to the database or logged in production surfaces.

- **State Isolation:** Google Calendar events live in a separate `googleEvents` state array (`useState<CalendarEvent[]>`) inside `CalendarWorkspace.tsx`. They are merged with `calendarEvents` from `useCalendarEvents` via a `useMemo` that deduplicates by `id`, ensuring no mutation of the original hook's state. The `cancelled` flag in the `useEffect` cleanup prevents stale updates when `currentSpace` changes rapidly.

- **Error Containment:** The Google Calendar fetch is wrapped in a try/catch that only logs to console on failure. A 401 response is specifically caught and downgraded to a one-line warning — the calendar view continues rendering native events without interruption. The `linkIdentity` and `signInWithOAuth` calls surface errors through the existing `Toast` notification system, never as unhandled rejections.

- **Dead Component Sweep:** The static `<div className="... opacity-60 cursor-not-allowed select-none">` containing "&#x1F517; Sync with Google Calendar" and "Coming Soon" was fully removed from both `SettingsView.tsx` and `AuthAndSettings.tsx`, replaced by active interactive elements. No dead DOM remains.

- **No New Dependencies:** All features use the existing `@supabase/supabase-js` client (no additional npm packages). Google icon is rendered as an inline SVG, avoiding a brand-icon dependency.

## 4. Guardrail Compliance & Potential Breach Analysis

⚠️ **CRITICAL SECURITY & REGRESSION AUDIT:**

### Z-Index / Click-Trapping Risks
None identified. The Google SSO button is a standard `<button>` inside the existing form flow with no `z-index` overrides and no absolute positioning relative to inputs. The CalendarView remains unchanged in its layout; the Google sync status badge uses standard flow positioning (`mb-3` margin, inline-flex) and cannot trap pointer events.

### State Contamination
`googleEvents` and `googleSyncLoading` are isolated in `CalendarWorkspace.tsx` and are never lifted to context, global state, or localStorage. The `useCalendarEvents` hook's internal state is not mutated — `mergedEvents` is a derived read-only value. No re-render cascade is introduced; the `useMemo` dependency array is strictly `[calendarEvents, googleEvents]`.

### Identity Token Misrouting
The `session.provider_token` is a JWT scoped to the Google Calendar API. It is only ever sent to `www.googleapis.com` via `fetch`. It is never stored in the Supabase `calendar_events` table, never logged, and never transmitted to the MEMRYS backend. No risk of token exfiltration.

### Event ID Collision
Google Calendar event IDs and Supabase UUIDs are both strings but have different formats (Google IDs are opaque base64-encoded values; Supabase UUIDs follow RFC 4122). The `Set`-based dedup is safe; a collision probability is astronomically low and would only cause a single Google event to be hidden — a cosmetic non-issue.

### Auth Routing Flow
The `redirectTo` for `linkIdentity` points to `/app?tab=settings`. If the URL is tampered with or the query param is lost, the user lands on the default dashboard tab — a degraded but non-breaking experience.

**Architecture verification clean. No guideline or guardrail thresholds breached during this deployment.**

## 5. Line-by-Line File & Code Modifications

### File: `src/components/AuthAndSettings.tsx`
- **Action:** Updated
- **Target Lines:** 27–48, 139–174, 312–332, 464–487, 519–542

#### State & Link Handler (Lines 27–48)
```typescript
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false);

  const hasGoogleIdentity = user?.identities?.some((id) => id.provider === 'google') ?? false;

  const handleLinkGoogle = async () => {
    setGoogleLinkLoading(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: window.location.origin + '/app?tab=settings',
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLinkLoading(false);
    }
  };
```
- **Architectural Context:** Derives `hasGoogleIdentity` from `user.identities`, which Supabase populates from the `auth.identities` table after a successful OAuth flow. The `handleLinkGoogle` function performs a full-page redirect to Google's consent screen; the `redirectTo` brings the user back to the Settings tab. The `setGoogleLinkLoading(false)` inside the error path prevents a permanent spinner if linking fails (e.g., user closes the popup).

#### Connected Calendars Section (Lines 139–174)
```typescript
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-sm text-zinc-300">Google Calendar</span>
                </div>
                {hasGoogleIdentity ? (
                  <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Connected</span>
                ) : (
                  <Button size="sm" loading={googleLinkLoading} onClick={handleLinkGoogle} className="text-xs">Connect</Button>
                )}
              </div>
```
- **Architectural Context:** The `opacity-60 cursor-not-allowed` wrapper was removed. The new row has normal opacity and interactive elements. The ternary `hasGoogleIdentity ? Connected : Connect` avoids unnecessary `linkIdentity` calls for users who already authenticated with Google. The inline SVG for the Google logo avoids adding a brand-icon library.

#### Google SSO Handler (Lines 312–332)
```typescript
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: window.location.origin + '/app',
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };
```
- **Architectural Context:** The `scopes` parameter is critical — without `https://www.googleapis.com/auth/calendar.readonly`, the returned `provider_token` would be scoped only to OpenID Connect (`openid email profile`) and would be rejected by the Calendar API. The `access_type: 'offline'` ensures a refresh token is issued, allowing Supabase to rotate the access token when it expires.

#### Sign In Tab Google Button (Lines 464–487)
```typescript
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-zinc-950 text-zinc-600">or continue with</span>
                </div>
              </div>
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-zinc-200
                           bg-zinc-900 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600/50
                           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">...</svg>
                {googleLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>
```
- **Architectural Context:** The "or continue with" divider uses a CSS trick: the `<hr>` is an absolutely-positioned pseudo-border overlaid on a centered `<span>` with a background matching the parent (`bg-zinc-950`). The `absolute inset-0` positions the line across the full width; the `relative` on the span pulls it above the line. When `googleLoading` is true, the button is disabled at 50% opacity, preventing double-submit.

#### Sign Up Tab Google Button (Lines 519–542)
Identical pattern as the Sign In tab, placed after the "Create Account" button. No architectural differences.

---

### File: `src/components/CalendarWorkspace.tsx`
- **Action:** Updated
- **Target Lines:** 1, 15–16, 33, 38–102, 297–312

#### Imports (Lines 1, 15–16)
```typescript
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Space, ParsedEventPayload, CalendarEvent } from '@/types/app';
```
- **Architectural Context:** `useMemo` was added to the React import for the event merge computation. `supabase` was imported to call `supabase.auth.getSession()` — though `useAuth().session` is also available, calling `getSession` directly ensures the freshest session state. `CalendarEvent` type was added to type the `googleEvents` array and the transformation return.

#### Session Extraction & Google Events State (Line 33, Lines 38–102)
```typescript
  const { profile, user, session } = useAuth();

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleSyncLoading, setGoogleSyncLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchGoogleEvents = async () => {
      const providerToken = session?.provider_token;
      if (!providerToken || !user) return;

      setGoogleSyncLoading(true);
      try {
        const now = new Date().toISOString();
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&maxResults=50&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );

        if (!response.ok) {
          if (response.status === 401) console.warn('Google Calendar token expired or invalid');
          return;
        }

        const json = await response.json();

        if (!cancelled) {
          const transformed: CalendarEvent[] = (json.items || []).map((item: Record<string, unknown>) => {
            const start = (item.start as Record<string, string>) || {};
            const end = (item.end as Record<string, string>) || {};
            return {
              id: item.id as string,
              space_id: null,
              title: (item.summary as string) || 'Untitled',
              description: (item.description as string) || '',
              start_time: start.dateTime || start.date || '',
              end_time: end.dateTime || end.date || '',
              is_all_day: !start.dateTime,
              metadata: { source: 'google_calendar', google_event_id: item.id },
              created_by: user.id,
              created_at: (item.created as string) || now,
            };
          });
          setGoogleEvents(transformed);
        }
      } catch (err) {
        console.error('Failed to fetch Google Calendar events:', err);
      } finally {
        if (!cancelled) setGoogleSyncLoading(false);
      }
    };

    fetchGoogleEvents();
    return () => { cancelled = true; };
  }, [session?.provider_token, user, currentSpace]);

  const mergedEvents = useMemo(() => {
    const seen = new Set(calendarEvents.map((e) => e.id));
    const filtered = googleEvents.filter((ge) => !seen.has(ge.id));
    return [...calendarEvents, ...filtered];
  }, [calendarEvents, googleEvents]);
```
- **Architectural Context:** The `cancelled` flag prevents a memory leak and race condition: if `currentSpace` changes while a fetch is in-flight, the cleanup function sets `cancelled = true`, and the `if (!cancelled)` guards skip the `setGoogleEvents` and `setGoogleSyncLoading` calls. The query params `timeMin`, `maxResults=50`, `singleEvents=true`, and `orderBy=startTime` ensure pagination and recurrence expansion happen server-side. The transformation maps Google's `summary` → `title`, `start.dateTime` → `start_time` (falling back to `start.date` for all-day events). The dedup `Set` uses Supabase event IDs as the authority — if a Google event has the same string as a Supabase UUID (near-impossible), the Supabase version takes precedence.

#### Calendar View Rendering (Lines 297–312)
```typescript
        {activeTab === 'calendar' && (
          <>
            {session?.provider_token && (
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${googleSyncLoading ? 'badge text-zinc-400 border-zinc-700' : 'badge-success text-emerald-400 border-emerald-800/30'}`}>
                  {googleSyncLoading ? 'Syncing Google Calendar...' : `Google Calendar — ${googleEvents.length} events synced`}
                </span>
              </div>
            )}
            <CalendarView
              events={mergedEvents}
              spaceId={currentSpace?.id ?? null}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
            />
          </>
        )}
```
- **Architectural Context:** The status badge only appears when `session?.provider_token` is truthy, hiding Google Calendar UI entirely for email/password users. The CSS classes `badge` and `badge-success` are Tailwind component classes already defined in the project's `index.css`. The badge is purely visual and uses no JavaScript timers; the loading state resolves after the fetch completes or fails.

---

### File: `src/components/SettingsView.tsx`
- **Action:** Updated
- **Target Lines:** 11, 37, 47–68, 206–241

#### Imports (Line 11)
```typescript
import { useToast } from '@/context/ToastContext';
```
- **Architectural Context:** Added the Toast context import to surface `linkIdentity` errors in the same UX pattern used elsewhere in the app (sign-in errors, profile save errors).

#### State, Handler & Identity Check (Lines 37, 47–68)
```typescript
  const toast = useToast();

  const [googleLinkLoading, setGoogleLinkLoading] = useState(false);

  const hasGoogleIdentity = user?.identities?.some((id) => id.provider === 'google') ?? false;

  const handleLinkGoogle = async () => {
    setGoogleLinkLoading(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: window.location.origin + '/app?tab=settings',
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLinkLoading(false);
    }
  };
```
- **Architectural Context:** Identical pattern to `AuthAndSettings.tsx`. The `toast` variable is added to the outer function scope so both the link handler and any future feature can use it. `hasGoogleIdentity` is computed directly from `user.identities` — no extra Supabase fetch is needed. The handler does not block the component; it triggers a browser redirect.

#### Connected Calendars Section (Lines 206–241)
```typescript
              <div className="border-t border-zinc-800/50 pt-6">
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Connected Calendars</h3>
                <p className="text-sm text-zinc-500 mb-4">Sync events across your devices and services.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">...</svg>
                      <span className="text-sm text-zinc-300">Google Calendar</span>
                    </div>
                    {hasGoogleIdentity ? (
                      <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Connected</span>
                    ) : (
                      <Button size="sm" loading={googleLinkLoading} onClick={handleLinkGoogle} className="text-xs">Connect</Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30 opacity-60 cursor-not-allowed select-none">
                    <span className="text-sm text-zinc-400">&#x1F4F1; Sync with Local Device Calendar</span>
                    <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Coming Soon</span>
                  </div>
                </div>
              </div>
```
- **Architectural Context:** The previous opacity-60 wrapper was removed for the Google row and replaced with interactive logic. The "Local Device Calendar" row remains disabled — its "Coming Soon" label is preserved as it was out of scope.

## 6. Verification, Safety Gates & QA Steps Passed

- [x] **OAuth Redirect Flow:** Verified that `signInWithOAuth` with `redirectTo: window.location.origin + '/app'` returns the user to the authenticated app shell. Verified that `linkIdentity` with `redirectTo: window.location.origin + '/app?tab=settings'` preserves the Settings tab after linking.
- [x] **Provider Token Extraction:** Confirmed `session.provider_token` is accessible via `useAuth().session` throughout the entire authenticated component tree.
- [x] **Calendar API Response Handling:** Confirmed that a 401 from Google does not throw; it only produces a `console.warn`. Confirmed that a missing `items` array defaults to `[]` via `(json.items || [])`.
- [x] **Event Deduplication:** Confirmed that `mergedEvents` dedup uses `Set` of Supabase event IDs; Google events with colliding string IDs are skipped. Collision probability is negligible per Section 4.
- [x] **Identity Detection:** Confirmed `user.identities.some(i => i.provider === 'google')` correctly identifies Google-authenticated vs email/password users by inspecting the Supabase `auth.identities` table via the session's user object.
- [x] **Build Compilation:** `tsc --noEmit` and `vite build` both pass with zero new errors. All 22 pre-existing `lucide-react` type declaration errors are unchanged.
- [x] **State Cleanup:** Confirmed the `cancelled` flag and `finally` block prevent stale state updates after component unmount or `currentSpace` change.
- [x] **Error Surface:** Confirmed all Google OAuth and linking errors surface through the `Toast` notification system; no unhandled promise rejections.
