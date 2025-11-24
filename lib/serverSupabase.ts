import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY не задан. Добавьте ключ сервисной роли в .env.local')
}

export function createServerSupabase() {
  return createClient(supabaseUrl, serviceRoleKey)
}

