import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: Log what we're getting (don't log full key in production)
console.log('Supabase config check:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING',
  allEnvVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
})

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables. Please check your Vercel environment variables.'
  console.error(errorMsg, {
    url: supabaseUrl ? 'set' : 'missing',
    key: supabaseAnonKey ? 'set' : 'missing',
    allEnvVars: Object.keys(import.meta.env)
  })
  throw new Error(errorMsg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

