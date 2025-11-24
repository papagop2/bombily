import { supabase } from './supabase'
import type { User, UserRole } from './supabase'
import { ensurePhoneE164, phoneToEmail } from './userUtils'

interface DriverDetails {
  vehicleModel: string
  vehicleColor: string
  vehiclePlate: string
  sbpRecipientName: string
  sbpPhone: string
  sbpBank: string
}

interface RegisterUserPayload {
  phone: string
  password: string
  role: UserRole
  name?: string
  cityId?: string | null
  proposedCityName?: string | null
  driverDetails?: DriverDetails
}

async function attachCityName(user: User | null): Promise<User | null> {
  if (!user || !user.city_id) {
    return user
  }

  const { data } = await supabase
    .from('cities')
    .select('name')
    .eq('id', user.city_id)
    .single()

  return { ...user, city_name: data?.name ?? null }
}

// Регистрация пользователя
export async function registerUser(payload: RegisterUserPayload): Promise<User> {
  const { phone, password, role, name, cityId, proposedCityName, driverDetails } = payload
  const normalizedPhone = ensurePhoneE164(phone)
  const email = phoneToEmail(normalizedPhone)

  const { data: firstUserResult, error: firstUserError } = await supabase.rpc('is_first_user')

  if (firstUserError) {
    throw new Error(`Ошибка проверки пользователей: ${firstUserError.message}`)
  }

  const isFirstUser = Boolean(firstUserResult)
  const finalRole = isFirstUser ? 'admin' : role

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: normalizedPhone,
        role: finalRole,
      },
    },
  })

  if (signUpError || !signUpData.user) {
    throw new Error(`Ошибка регистрации: ${signUpError?.message ?? 'Не удалось создать пользователя'}`)
  }

  const authUser = signUpData.user

  const { error: profileError } = await supabase.from('users').insert({
    id: authUser.id,
    phone: normalizedPhone,
    role: finalRole,
    name,
    city_id: cityId ?? null,
    proposed_city_name: proposedCityName ?? null,
    vehicle_model: driverDetails?.vehicleModel ?? null,
    vehicle_color: driverDetails?.vehicleColor ?? null,
    vehicle_plate: driverDetails?.vehiclePlate ?? null,
    sbp_recipient_name: driverDetails?.sbpRecipientName ?? null,
    sbp_phone: driverDetails?.sbpPhone ?? null,
    sbp_bank: driverDetails?.sbpBank ?? null,
    is_first_user: isFirstUser,
  })

  if (profileError) {
    throw new Error(`Ошибка создания профиля: ${profileError.message}`)
  }

  if (proposedCityName) {
    await supabase.from('city_proposals').insert({
      user_id: authUser.id,
      proposed_name: proposedCityName.trim(),
      status: 'pending',
    })
  }

  const profile = await fetchAndCacheUser(authUser.id)
  if (!profile) {
    throw new Error('Не удалось загрузить профиль пользователя после регистрации')
  }
  return profile
}

// Вход пользователя
export async function loginUser(phone: string, password: string): Promise<User | null> {
  const normalizedPhone = ensurePhoneE164(phone)
  const email = phoneToEmail(normalizedPhone)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return null
  }

  return fetchAndCacheUser(data.user.id)
}

// Получение текущего пользователя
export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null

  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  if (!userId) {
    localStorage.removeItem('current_user')
    return null
  }

  const cached = localStorage.getItem('current_user')
  if (cached) {
    try {
      const parsed: User = JSON.parse(cached)
      if (parsed.id === userId) {
        return parsed
      }
    } catch (error) {
      console.warn('Не удалось распарсить current_user из localStorage', error)
      localStorage.removeItem('current_user')
    }
  }

  return fetchAndCacheUser(userId)
}

// Выход
export async function logout() {
  await supabase.auth.signOut()
  if (typeof window !== 'undefined') {
    localStorage.removeItem('current_user')
  }
}

async function fetchAndCacheUser(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    console.error('Не удалось получить профиль пользователя', error)
    return null
  }

  const enriched = await attachCityName(data)

  if (enriched && typeof window !== 'undefined') {
    localStorage.setItem('current_user', JSON.stringify(enriched))
  }

  return enriched
}

