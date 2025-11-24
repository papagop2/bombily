'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import Layout from '@/components/Layout'
import OrderList from '@/components/OrderList'
import { motion } from 'framer-motion'
import type { Order, User } from '@/lib/supabase'
import { playNotification } from '@/lib/audio'
import StatusNotification from '@/components/StatusNotification'
import PhoneCopy from '@/components/PhoneCopy'

const driverStatusMessages: Record<string, (order: Order) => string | null> = {
  accepted: () => 'Статус изменён на «Принят». Сообщите пассажиру, что вы в деле.',
  en_route: () => 'Статус «В пути» активирован. Следите за временем прибытия.',
  arrived: () => 'Вы отметили прибытие. Пассажиру отправлено уведомление.',
  passenger_on_way: () => 'Пассажир подтвердил, что выходит. Ожидайте возле адреса.',
  completed: () => 'Заказ завершён. Проверьте оплату по СБП.',
  cancelled: () => 'Заказ отменён. Можно выбрать другой.',
  pending: () => null,
}

export default function DriverPage() {
  const router = useRouter()
  const { user, setUser, orders, setOrders } = useStore()
  const [activeTab, setActiveTab] = useState<'available' | 'my' | 'history'>('available')
  const [loading, setLoading] = useState(true)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.role !== 'driver') {
        router.push('/')
        return
      }
      setUser(currentUser)
      await loadOrders(currentUser)
      setLoading(false)
    }
    init()
  }, [router, setUser])

  const triggerNotification = useCallback(
    async (text: string) => {
      setNotificationMessage(text)
      await playNotification(text)
    },
    []
  )

  useEffect(() => {
    if (!user?.city_id) return

    const channel = supabase
      .channel('driver_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `city_id=eq.${user.city_id}`,
        },
        async (payload) => {
          await loadOrders(user)
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order
            if (newOrder.status === 'pending' && !newOrder.driver_id) {
              await playNotification('Новый заказ доступен в вашем городе.')
            }
            return
          }

          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as Order
            const oldOrder = payload.old as Order | null
            if (
              newOrder.driver_id === user.id &&
              oldOrder?.status !== newOrder.status
            ) {
              const message = driverStatusMessages[newOrder.status]?.(newOrder)
              if (message) {
                await triggerNotification(message)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [triggerNotification, user])

  const handleNotificationClose = useCallback(() => {
    setNotificationMessage(null)
    window.location.reload()
  }, [])

  const loadOrders = async (currentUser: User | null) => {
    if (!currentUser?.city_id) return

    const { data: available } = await supabase
      .from('orders')
      .select(`
        *,
        passenger_profile:users!orders_user_id_fkey(id, name, phone),
        city:cities(id, name)
      `)
      .eq('status', 'pending')
      .is('driver_id', null)
      .eq('city_id', currentUser.city_id)
      .order('created_at', { ascending: false })

    const { data: myOrders } = await supabase
      .from('orders')
      .select(`
        *,
        passenger_profile:users!orders_user_id_fkey(id, name, phone),
        city:cities(id, name)
      `)
      .eq('driver_id', currentUser.id)
      .order('created_at', { ascending: false })

    setAvailableOrders((available || []) as unknown as Order[])
    setOrders((myOrders || []) as unknown as Order[])
  }

  const handleAction = async (orderId: string, action: string) => {
    if (!user) return
    const updates: Record<string, any> = {}

    if (action === 'accept') {
      updates.driver_id = user.id
      updates.status = 'accepted'
    }
    if (action === 'start') {
      updates.status = 'en_route'
    }
    if (action === 'arrive') {
      updates.status = 'arrived'
    }
    if (action === 'complete') {
      updates.status = 'completed'
    }
    if (action === 'cancel') {
      updates.status = 'cancelled'
      updates.driver_id = null
    }

    updates.updated_at = new Date().toISOString()

    await supabase.from('orders').update(updates).eq('id', orderId)
    await loadOrders(user)

  }

  const myOrders = useMemo(
    () => orders.filter((o) => o.driver_id === user?.id && o.status !== 'completed'),
    [orders, user?.id]
  )

  const historyOrders = useMemo(
    () => orders.filter((o) => o.driver_id === user?.id && o.status === 'completed'),
    [orders, user?.id]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-600">
        <div className="text-2xl font-bold text-white">Загрузка...</div>
      </div>
    )
  }

  if (!user?.city_id) {
    return (
      <Layout title="Водитель">
        <div className="bg-white text-black p-6 rounded-lg border-4 border-black">
          <h2 className="text-2xl font-bold mb-2">Город не подтверждён</h2>
          <p>Дождитесь, когда администратор добавит ваш город. После этого заказы станут доступны.</p>
        </div>
      </Layout>
    )
  }

  const renderDriverCard = (order: Order) => {
    const passenger = order.passenger_profile
    const cityName = order.city?.name || '—'
    const baseInfo = (
      <div className="space-y-1 text-sm">
        <p>🚕 {order.type === 'cargo' ? 'Грузовое' : order.type === 'delivery' ? 'Доставка' : 'Такси'}</p>
        <p>🏙 Город: {cityName}</p>
        <p>📍 Откуда: {order.from_address}</p>
        <p>📍 Куда: {order.to_address}</p>
        {passenger && (
          <>
            <p>👤 Пассажир: {passenger.name || '—'}</p>
            <p className="flex items-center gap-2">
              <span>📞 Связь:</span> <PhoneCopy value={passenger.phone} />
            </p>
          </>
        )}
      </div>
    )

    let statusBlock: JSX.Element | null = null
    const actions: { label: string; action: string; style: string }[] = []

    switch (order.status) {
      case 'accepted':
        statusBlock = <p>Статус: ✅ Принят. При начале движения нажмите 🚀.</p>
        actions.push({ label: '🚀 Выехал', action: 'start', style: 'bg-green-500' })
        actions.push({ label: 'Отменить', action: 'cancel', style: 'bg-red-500' })
        break
      case 'en_route':
        statusBlock = <p>Статус: ✅ Вы в пути. По приезду нажмите 🎯.</p>
        actions.push({ label: '🎯 Прибыл', action: 'arrive', style: 'bg-blue-500' })
        actions.push({ label: 'Отменить', action: 'cancel', style: 'bg-red-500' })
        break
      case 'arrived':
        statusBlock = (
          <p>
            Статус: ✅ Вы на месте. Клиент уведомлён. После завершения поездки нажмите ✅.
          </p>
        )
        actions.push({ label: '✅ Завершить', action: 'complete', style: 'bg-black' })
        break
      case 'passenger_on_way':
        statusBlock = (
          <p>
            Пассажир нажал «🚶 Выхожу». Дождитесь посадки и завершите поездку.
          </p>
        )
        actions.push({ label: '✅ Завершить', action: 'complete', style: 'bg-black' })
        break
      default:
        statusBlock = <p>Статус: {order.status}</p>
    }

    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg space-y-3"
      >
        <h3 className="text-xl font-bold">Заказ #{order.id.slice(0, 6)}</h3>
        {baseInfo}
        <div className="text-sm">{statusBlock}</div>
        {actions.length > 0 && (
          <div className="flex flex-col gap-2">
            {actions.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleAction(order.id, btn.action)}
                className={`${btn.style} text-white py-2 px-4 rounded-lg font-bold hover:opacity-90 transition-colors`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <Layout title="Водитель">
      <div className="space-y-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'available' ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            Доступные ({availableOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'my' ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            Мои заказы ({myOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'history' ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            История ({historyOrders.length})
          </button>
        </div>

        {activeTab === 'available' && (
          <OrderList orders={availableOrders} showActions={true} onAction={handleAction} />
        )}

        {activeTab === 'my' && (
          <div className="space-y-4">
            {myOrders.length === 0 && (
              <div className="bg-white text-black p-4 rounded-lg border-4 border-black text-center">
                Нет активных заказов
              </div>
            )}
            {myOrders.map((order) => renderDriverCard(order))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyOrders.length === 0 && (
              <div className="bg-white text-black p-4 rounded-lg border-4 border-black text-center">
                История пуста
              </div>
            )}
            {historyOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg space-y-2"
              >
                <h3 className="text-xl font-bold">Заказ #{order.id.slice(0, 6)}</h3>
                <p>🚕 {order.type === 'cargo' ? 'Грузовое' : order.type === 'delivery' ? 'Доставка' : 'Такси'}</p>
                <p>📍 Откуда: {order.from_address}</p>
                <p>📍 Куда: {order.to_address}</p>
                <div className="space-y-1 text-sm">
                  <p>✅ Выполненный заказ. СБП данные были показаны клиенту.</p>
                  <p>👤 Имя получателя: {user?.sbp_recipient_name || '—'}</p>
                  <p className="flex items-center gap-2">
                    <span>💳 Номер СБП:</span> <PhoneCopy value={user?.sbp_phone ?? null} />
                  </p>
                  <p>🏦 Банк: {user?.sbp_bank || '—'}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {notificationMessage && (
        <StatusNotification message={notificationMessage} onClose={handleNotificationClose} />
      )}
    </Layout>
  )
}

