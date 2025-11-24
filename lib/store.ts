import { create } from 'zustand'
import type { User, Order, City, Shop, AppSettings } from './supabase'

type OrdersUpdater = Order[] | ((orders: Order[]) => Order[])

interface AppState {
  user: User | null
  orders: Order[]
  cities: City[]
  shops: Shop[]
  settings: AppSettings | null
  setUser: (user: User | null) => void
  setOrders: (orders: OrdersUpdater) => void
  setCities: (cities: City[]) => void
  setShops: (shops: Shop[]) => void
  setSettings: (settings: AppSettings | null) => void
  addOrder: (order: Order) => void
  updateOrder: (orderId: string, updates: Partial<Order>) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  orders: [],
  cities: [],
  shops: [],
  settings: null,
  setUser: (user) => set({ user }),
  setOrders: (orders) =>
    set((state) => ({
      orders: typeof orders === 'function' ? (orders as (prev: Order[]) => Order[])(state.orders) : orders,
    })),
  setCities: (cities) => set({ cities }),
  setShops: (shops) => set({ shops }),
  setSettings: (settings) => set({ settings }),
  addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),
  updateOrder: (orderId, updates) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, ...updates } : order
      ),
    })),
}))

