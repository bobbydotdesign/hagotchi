import { createClient } from '@supabase/supabase-js'

// Get environment variables - Vite requires VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY

// Debug: Log what we're getting
if (typeof window !== 'undefined') {
  const debugInfo = {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ MISSING',
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : '❌ MISSING',
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    allViteVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD
  }
  console.log('🔍 Supabase config check:', debugInfo)
  console.log('Full URL:', supabaseUrl)
  console.log('Full Key (first 50 chars):', supabaseAnonKey ? supabaseAnonKey.substring(0, 50) : 'MISSING')
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

