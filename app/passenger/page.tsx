'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import Layout from '@/components/Layout'
import OrderForm from '@/components/OrderForm'
import OrderList from '@/components/OrderList'
import DeliveryStore from '@/components/DeliveryStore'
import type { City, Order } from '@/lib/supabase'
import { playNotification } from '@/lib/audio'
import StatusNotification from '@/components/StatusNotification'
import PhoneCopy from '@/components/PhoneCopy'

const ACTIVE_STATUSES = ['pending', 'accepted', 'en_route', 'arrived', 'passenger_on_way']

const passengerStatusMessages: Record<string, (order: Order) => string | null> = {
  accepted: () => 'Ваш заказ принят. Водитель уже назначен и готовится к выезду.',
  en_route: () => 'Водитель выехал к вам. Отслеживайте его движение в приложении.',
  arrived: () => 'Водитель прибыл и ожидает вас у указанного адреса.',
  completed: () => 'Поездка завершена. Пожалуйста, уточните сумму и оплатите переводом.',
  passenger_on_way: () => null,
  pending: () => null,
  cancelled: () => null,
}

export default function PassengerPage() {
  const router = useRouter()
  const { user, setUser, orders, setOrders, addOrder, cities, setCities } = useStore()
  const [activeTab, setActiveTab] = useState<'taxi' | 'cargo' | 'delivery' | 'orders' | 'history'>('taxi')
  const [loading, setLoading] = useState(true)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.role !== 'passenger') {
        router.push('/')
        return
      }
      setUser(currentUser)
      await loadOrders(currentUser.id)
      setLoading(false)
    }
    init()
  }, [router, setUser])

  useEffect(() => {
    if (cities.length > 0) return
    async function loadCities() {
      const { data } = await supabase.from('cities').select('*').eq('is_active', true).order('name')
      setCities((data || []) as City[])
    }
    loadCities()
  }, [cities.length, setCities])

  const triggerNotification = useCallback(
    async (text: string) => {
      setNotificationMessage(text)
      await playNotification(text)
    },
    []
  )

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('passenger_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          await loadOrders(user.id)
          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as Order
            const oldOrder = payload.old as Order | null
            if (oldOrder?.status !== newOrder.status) {
              const message = passengerStatusMessages[newOrder.status]?.(newOrder)
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

  const loadOrders = async (userId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        driver_profile:users!orders_driver_id_fkey(id, name, phone, vehicle_model, vehicle_color, vehicle_plate, sbp_recipient_name, sbp_phone, sbp_bank),
        passenger_profile:users!orders_user_id_fkey(id, name, phone, city_id),
        city:cities(id, name),
        shop:shops(id, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки заказов', error)
      return
    }

    setOrders((data || []) as unknown as Order[])
  }

  const handleOrderCreated = (order: Order) => {
    addOrder(order)
    setActiveTab('orders')
  }

  const handlePassengerReady = async (orderId: string) => {
    await supabase
      .from('orders')
      .update({ status: 'passenger_on_way', passenger_confirmed: true })
      .eq('id', orderId)
    if (user) {
      await loadOrders(user.id)
    }
    await triggerNotification('Вы уведомили водителя, что выходите. Страница скоро обновится.')
  }

  const userCityName = useMemo(() => {
    if (!user?.city_id) return user?.city_name || null
    const city = cities.find((c) => c.id === user.city_id)
    return city?.name || user?.city_name || null
  }, [user, cities])

  const passengerOrders = useMemo(() => orders.filter((order) => order.user_id === user?.id), [orders, user?.id])

  const activeOrder = useMemo(
    () => passengerOrders.find((order) => ACTIVE_STATUSES.includes(order.status)),
    [passengerOrders]
  )

  const activeOrdersList = useMemo(
    () => passengerOrders.filter((order) => order.status !== 'completed'),
    [passengerOrders]
  )

  const historyOrders = useMemo(
    () => passengerOrders.filter((order) => order.status === 'completed'),
    [passengerOrders]
  )

  const renderPassengerStatus = (order: Order) => {
    const driver = order.driver_profile
    const cityName = order.city?.name || userCityName || '—'
    const baseInfo = (
      <>
        <p>🚕 {order.type === 'cargo' ? 'Грузовое такси' : order.type === 'delivery' ? 'Доставка' : 'Такси'}</p>
        <p>📍 Город: {cityName}</p>
        <p>📍 Откуда: {order.from_address}</p>
        <p>📍 Куда: {order.to_address}</p>
      </>
    )

    const driverInfo = driver && (
      <>
        <p>👤 Водитель: {driver.name || '—'}</p>
        <p>🚙 Авто: {driver.vehicle_color || '—'} {driver.vehicle_model || '—'} ({driver.vehicle_plate || '—'})</p>
        <p className="flex items-center gap-2">
          <span>📞 Связь:</span> <PhoneCopy value={driver.phone} />
        </p>
        <p className="flex items-center gap-2">
          <span>💳 СБП:</span> <PhoneCopy value={driver.sbp_phone} />{' '}
          <span className="text-sm text-black/70">({driver.sbp_bank || 'банк не указан'})</span>
        </p>
      </>
    )

    switch (order.status) {
      case 'pending':
        return (
          <>
            {baseInfo}
            <p>Статус: ожидаем отклика водителя.</p>
          </>
        )
      case 'accepted':
        return (
          <>
            {baseInfo}
            {driverInfo}
            <p>Статус: водитель подтвердил заказ. Ожидайте выезда.</p>
          </>
        )
      case 'en_route':
        return (
          <>
            {baseInfo}
            {driverInfo}
            <p>Статус: водитель едет к вам.</p>
          </>
        )
      case 'arrived':
        return (
          <>
            {baseInfo}
            {driverInfo}
            <p>Статус: водитель на месте и ожидает вас. Бесплатное ожидание — 3 минуты.</p>
            {!order.passenger_confirmed && (
              <button
                onClick={() => handlePassengerReady(order.id)}
                className="mt-4 w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-900 transition-colors"
              >
                🚶 Выхожу
              </button>
            )}
          </>
        )
      case 'passenger_on_way':
        return (
          <>
            {baseInfo}
            {driverInfo}
            <p>Статус: вы уведомили водителя, что выходите. Он ожидает у подъезда.</p>
          </>
        )
      case 'completed':
        return (
          <>
            {baseInfo}
            {driverInfo}
            <p>Статус: поездка завершена. Проверьте данные для оплаты ниже.</p>
          </>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-600">
        <div className="text-2xl font-bold text-white">Загрузка...</div>
      </div>
    )
  }

  return (
    <Layout title="Пассажир">
      <div className="space-y-6">
        {userCityName && (
          <div className="bg-white text-black p-4 rounded-lg border-4 border-black">
            <p className="font-bold">Ваш город: {userCityName}</p>
          </div>
        )}

        {activeOrder && (
          <div className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-2">
            <h3 className="text-xl font-bold">Статус заказа #{activeOrder.id.slice(0, 6)}</h3>
            {renderPassengerStatus(activeOrder)}
            {activeOrder.status === 'completed' && activeOrder.driver_profile && (
              <div className="text-sm space-y-1 border-t border-dashed border-gray-400 pt-3">
                <p>Спасибо, что выбрали Бомбилы!</p>
                <p>Оплатите поездку через СБП:</p>
                <p>👤 Имя: {activeOrder.driver_profile.sbp_recipient_name || '—'}</p>
                <p className="flex items-center gap-2">
                  <span>💳 Телефон:</span> <PhoneCopy value={activeOrder.driver_profile.sbp_phone} />{' '}
                  <span className="text-black/70">{activeOrder.driver_profile.sbp_bank || 'банк не указан'}</span>
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['taxi', 'cargo', 'delivery', 'orders', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
                activeTab === tab ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              {tab === 'taxi' && 'Такси'}
              {tab === 'cargo' && 'Грузовое'}
              {tab === 'delivery' && 'Доставка'}
              {tab === 'orders' && 'Мои заказы'}
              {tab === 'history' && 'История'}
            </button>
          ))}
        </div>

        {activeTab === 'taxi' && user && (
          <OrderForm type="taxi" userId={user.id} onOrderCreated={handleOrderCreated} />
        )}
        {activeTab === 'cargo' && user && (
          <OrderForm type="cargo" userId={user.id} onOrderCreated={handleOrderCreated} />
        )}
        {activeTab === 'delivery' && user && (
          <DeliveryStore userId={user.id} onOrderCreated={handleOrderCreated} />
        )}
        {activeTab === 'orders' && (
          <OrderList orders={activeOrdersList} showActions={false} />
        )}

        {activeTab === 'history' && (
          <OrderList orders={historyOrders} showActions={false} />
        )}
      </div>

      {notificationMessage && (
        <StatusNotification message={notificationMessage} onClose={handleNotificationClose} />
      )}
    </Layout>
  )
}

