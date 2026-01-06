import { createClient } from '@supabase/supabase-js'

// Get environment variables - Vite requires VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY

// Debug logging (remove in production if desired)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('✅ Supabase connected:', supabaseUrl ? 'Yes' : 'No')
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables!
  
URL: ${supabaseUrl ? '✅ set' : '❌ MISSING'}
Key: ${supabaseAnonKey ? '✅ set' : '❌ MISSING'}

Please check:
1. Vercel → Settings → Environment Variables
2. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
3. Enable for Production, Preview, and Development
4. Redeploy after adding variables`
  
  console.error('❌', errorMsg)
  console.error('All env vars:', Object.keys(import.meta.env))
  
  // Don't throw - show user-friendly error instead
  if (typeof window !== 'undefined') {
    alert('Configuration Error: Supabase environment variables are missing. Please check Vercel settings.')
  }
}

// Use fallback or throw if still missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Check Vercel environment variables.')
}

// Realtime is not configured to avoid WebSocket connection errors
// The app works fine without realtime - updates happen on page refresh/actions
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

