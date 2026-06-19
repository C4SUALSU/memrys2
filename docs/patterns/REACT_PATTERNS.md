# React Patterns

This document outlines the React patterns used throughout Memrys to ensure consistency and maintainability.

## Component Architecture

### Presentational vs Container
- **Pages** (`src/pages/`) — Route-level components, thin wrappers
- **Feature Components** (`src/components/`) — Business logic + UI
- **UI Primitives** (`src/components/ui/`) — Reusable, stateless building blocks

### State Management
- **Context** for cross-cutting concerns: `AuthContext`, `ToastContext`
- **Hooks** for data fetching + caching: `useChat`, `useCalendarEvents`, etc.
- Local `useState` for component-specific UI state (form inputs, modals)

### Hook Pattern
All data hooks follow this structure:
```typescript
export function useXxx(id?: string) {
  const [data, setData] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => { ... }, [id]);
  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (params) => { ... }, []);
  const update = useCallback(async (id, updates) => { ... }, []);
  const remove = useCallback(async (id) => { ... }, []);

  return { data, loading, create, update, remove, fetch };
}
```

### Error Handling
Every async operation in hooks and components:
1. Returns `{ error: string | null }` contract
2. Dispatches descriptive toast via `useToast()` if in UI context
3. Logs to console for debugging

## Realtime Pattern
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`name:${id}`)
    .on('postgres_changes', { event: 'INSERT', schema, table, filter }, handler)
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [id]);
```

## Styling Conventions
- Tailwind utility classes only (no CSS modules)
- Shared design tokens in `index.css` via `@layer components`
- Glass-morphism surfaces: `.glass-surface`, `.glass-surface-hover`
- Dark mode always on (`class="dark"` on `<html>`)
