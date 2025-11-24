import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Типы для базы данных
export type UserRole = 'passenger' | 'driver' | 'admin'

export interface User {
  id: string
  phone: string
  role: UserRole
  name?: string | null
  city_id?: string | null
  city_name?: string | null
  proposed_city_name?: string | null
  vehicle_model?: string | null
  vehicle_color?: string | null
  vehicle_plate?: string | null
  sbp_recipient_name?: string | null
  sbp_phone?: string | null
  sbp_bank?: string | null
  created_at: string
  is_first_user: boolean
}

export interface Order {
  id: string
  user_id: string
  driver_id?: string | null
  city_id?: string | null
  shop_id?: string | null
  type: 'taxi' | 'cargo' | 'delivery'
  from_address: string
  to_address: string
  comment?: string
  scheduled_time?: string
  status: 'pending' | 'accepted' | 'en_route' | 'arrived' | 'passenger_on_way' | 'completed' | 'cancelled'
  passenger_confirmed?: boolean
  driver_profile?: DriverProfile | null
  passenger_profile?: PassengerProfile | null
  city?: City | null
  shop?: Shop | null
  created_at: string
  updated_at: string
}

export interface City {
  id: string
  name: string
  is_active: boolean
  delivery_fee?: number
  created_at: string
}

export interface CityProposal {
  id: string
  user_id: string
  proposed_name: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface DriverProfile {
  id: string
  name?: string | null
  phone?: string | null
  vehicle_model?: string | null
  vehicle_color?: string | null
  vehicle_plate?: string | null
  sbp_recipient_name?: string | null
  sbp_phone?: string | null
  sbp_bank?: string | null
}

export interface PassengerProfile {
  id: string
  name?: string | null
  phone?: string | null
  city_id?: string | null
}

export interface Shop {
  id: string
  name: string
  description?: string | null
  city_id: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  shop_id: string
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  category: string
  name: string
  description?: string | null
  price: number
  image_url?: string | null
  in_stock: boolean
  created_at: string
}

export interface AppSettings {
  id: number
  markup_percent: number
}

export interface DeliveryItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  created_at: string
}

