import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/serverSupabase'

export async function GET(request: Request) {
  const supabase = createServerSupabase()
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Требуется токен авторизации' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: authUser, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: 'Сессия недействительна' }, { status: 401 })
  }

  const userId = authUser.user.id
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const [orders, users, products, categories, cities, proposals, shops, settings] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('products').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('cities').select('*').order('name'),
    supabase
      .from('city_proposals')
      .select('*, requester:users!city_proposals_user_id_fkey(id, name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase.from('shops').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
  ])

  const hasError =
    orders.error ||
    users.error ||
    products.error ||
    categories.error ||
    cities.error ||
    proposals.error ||
    shops.error ||
    settings.error

  if (hasError) {
    return NextResponse.json(
      {
        error: 'Не удалось загрузить данные',
        details: hasError?.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    orders: orders.data ?? [],
    users: users.data ?? [],
    products: products.data ?? [],
    categories: categories.data ?? [],
    cities: cities.data ?? [],
    cityProposals: proposals.data ?? [],
    shops: shops.data ?? [],
    settings: settings.data ?? null,
  })
}

