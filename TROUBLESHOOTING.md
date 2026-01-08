# Hagotchi Troubleshooting Guide

Lessons learned from debugging session - January 2026.

---

## Issue 1: "Loading habits..." stuck forever

### Symptoms
- App shows "loading habits..." indefinitely
- Console may show no errors, or "Session check timed out"

### Root Cause
`supabase.auth.getSession()` can hang when localStorage has corrupted session data.

### Solution
**Don't use `getSession()` at all.** Use only `onAuthStateChange()` which is the Supabase-recommended pattern:

```javascript
// BAD - can hang with corrupted localStorage
supabase.auth.getSession().then(({ data: { session } }) => {
  // ...
});

// GOOD - always fires, even with bad state
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'INITIAL_SESSION') {
    // This provides the initial session state
  }
  // Handle auth...
});
```

### Quick Fix
If stuck, clear localStorage:
```javascript
localStorage.clear();
location.reload();
```

---

## Issue 2: Wrong Supabase API Key in Vercel

### Symptoms
- WebSocket errors with malformed URL
- API key in error contains `%0A` (newline) or wrong value
- Works locally but not in production

### Root Cause
Vercel environment variable has:
- Trailing newline/whitespace
- Wrong key entirely (e.g., `sb_publishable_...` instead of JWT)

### Solution
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Check `VITE_SUPABASE_ANON_KEY` - should be a JWT starting with `eyJ...`
3. Remove any trailing whitespace/newlines
4. Redeploy after fixing

### Correct Key Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
```

NOT:
```
sb_publishable_xxxxx  (wrong format)
eyJhbG...xxxxx\n      (has newline)
```

---

## Issue 3: Iframe/Cursor Preview Issues

### Symptoms
- App works in browser but not in Cursor's browser preview
- Session not persisting in iframe

### Root Cause
Iframes have isolated localStorage/cookies. The session in your main browser is NOT shared with iframe previews.

### Solution
This is expected behavior. You need to log in separately within the iframe preview. The session won't sync between main browser and iframe.

---

## Issue 4: Slow Habit Loading / Fetch Timeout

### Symptoms
- "Fetch timeout" error after 30 seconds
- Very slow initial load

### Root Cause
- Free Supabase projects "sleep" after inactivity (cold start)
- Slow network connection
- No local caching

### Solution
Implemented local caching:
1. Habits cached in `localStorage` as `habito_habits_cache`
2. Cached data shows immediately on load
3. Fresh data fetches in background and updates UI
4. 30-second timeout prevents infinite hanging

### Check Supabase Project
If consistently slow:
1. Check if project is paused in Supabase Dashboard
2. Consider upgrading from free tier
3. Check Database → Logs for errors

---

## Issue 5: Realtime Not Syncing Across Tabs

### Symptoms
- Changes in one browser don't appear in another
- Console shows "realtime: connection failed"

### Solution
1. Go to Supabase Dashboard → Database → Publications
2. Click on `supabase_realtime`
3. Ensure `habits` table is included
4. All toggles (INSERT, UPDATE, DELETE) should be enabled

---

## General Debugging Tips

### Clear All Local State
```javascript
// Run in browser console
Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
localStorage.removeItem('lastVisit');
localStorage.removeItem('habito_habits_cache');
location.reload();
```

### Check Supabase Connection
```javascript
// Run in browser console
import { supabase } from './src/lib/supabase';
const { data, error } = await supabase.from('habits').select('count');
console.log({ data, error });
```

### Verify Environment Variables
The app logs `✅ Supabase connected: Yes` in dev mode if configured correctly.

Required env vars:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key (JWT format)

---

## Architecture Notes

### Auth Flow
```
onAuthStateChange fires
    ↓
INITIAL_SESSION event (has current session or null)
    ↓
Set user state
    ↓
If user exists: fetch habits (with timeout + caching)
    ↓
Set loading = false
```

### Caching Strategy
- Habits cached to `habito_habits_cache` in localStorage
- On load: show cache immediately, fetch fresh data in background
- Cache updates on any habit change
- Cache cleared on logout
