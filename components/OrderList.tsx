'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { motion } from 'framer-motion'
import type { Order } from '@/lib/supabase'

interface OrderListProps {
  orders: Order[]
  showActions?: boolean
  onAction?: (orderId: string, action: string) => void
}

const typeLabels = {
  taxi: 'Такси',
  cargo: 'Грузовое такси',
  delivery: 'Доставка',
}

const statusLabels = {
  pending: 'Ожидает',
  accepted: 'Принят',
  en_route: 'В пути',
  arrived: 'Прибыл',
  passenger_on_way: 'Пассажир выходит',
  completed: 'Завершен',
  cancelled: 'Отменен',
}

const statusColors = {
  pending: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  en_route: 'bg-green-500',
  arrived: 'bg-purple-500',
  passenger_on_way: 'bg-teal-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
}

export default function OrderList({ orders, showActions = false, onAction }: OrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white text-black p-8 rounded-lg border-4 border-black text-center">
        <p className="text-lg">Нет заказов</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <motion.div
          key={order.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">{typeLabels[order.type]}</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-bold ${statusColors[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>
            <div className="text-sm text-black">
              {format(new Date(order.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div>
              <span className="font-bold text-black">Откуда: </span>
              <span className="text-black">{order.from_address}</span>
            </div>
            <div>
              <span className="font-bold text-black">Куда: </span>
              <span className="text-black">{order.to_address}</span>
            </div>
            {order.scheduled_time && (
              <div>
                <span className="font-bold text-black">Время вызова: </span>
                <span className="text-black">
                  {format(new Date(order.scheduled_time), 'd MMM yyyy, HH:mm', { locale: ru })}
                </span>
              </div>
            )}
            {order.comment && (
              <div>
                <span className="font-bold text-black">Комментарий: </span>
                <span className="text-black">{order.comment}</span>
              </div>
            )}
          </div>

          {showActions && onAction && order.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => onAction(order.id, 'accept')}
                className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-600 transition-colors"
              >
                Принять
              </button>
              <button
                onClick={() => onAction(order.id, 'cancel')}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-red-600 transition-colors"
              >
                Отменить
              </button>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
