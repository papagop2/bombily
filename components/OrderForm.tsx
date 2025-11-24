'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/supabase'
import { playNotification } from '@/lib/audio'
import ScheduledTimePicker from './ScheduledTimePicker'
import { useStore } from '@/lib/store'

interface OrderFormProps {
  type: 'taxi' | 'cargo' | 'delivery'
  userId: string
  onOrderCreated: (order: Order) => void
}

export default function OrderForm({ type, userId, onOrderCreated }: OrderFormProps) {
  const [fromAddress, setFromAddress] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [comment, setComment] = useState('')
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)
  const [useScheduled, setUseScheduled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useStore()

  const typeLabels = {
    taxi: 'Такси',
    cargo: 'Грузовое такси',
    delivery: 'Доставка',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!fromAddress || !toAddress) {
      setError('Заполните адреса')
      setLoading(false)
      return
    }

    try {
      if (!user?.city_id) {
        setError('Ваш город ещё не подтвержден администратором.')
        setLoading(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          type,
          city_id: user.city_id,
          from_address: fromAddress,
          to_address: toAddress,
          comment: comment || null,
          scheduled_time: useScheduled && scheduledTime ? scheduledTime : null,
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) throw insertError

      if (data) {
        onOrderCreated(data)
        setFromAddress('')
        setToAddress('')
        setComment('')
        setScheduledTime(null)
        setUseScheduled(false)
        
        // Уведомление
        await playNotification(`Заказ ${typeLabels[type]} создан`)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка создания заказа')
    } finally {
      setLoading(false)
    }
  }

  if (!user?.city_id) {
    return (
      <div className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Город не подтвержден</h2>
        <p className="text-sm text-black">
          Мы получили ваше предложение по городу. Как только администратор его добавит, вы сможете создавать заказы.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg mb-6"
    >
      <h2 className="text-2xl font-bold mb-4">Новый заказ: {typeLabels[type]}</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-black font-bold mb-2">Откуда</label>
          <input
            type="text"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
            placeholder="Адрес отправления"
          />
        </div>

        <div>
          <label className="block text-black font-bold mb-2">Куда</label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
            placeholder="Адрес назначения"
          />
        </div>

        <div>
          <label className="block text-black font-bold mb-2">Комментарий</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none resize-none"
            placeholder="Дополнительная информация"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useScheduled}
              onChange={(e) => setUseScheduled(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-black font-bold">Вызов по времени</span>
          </label>
          
          {useScheduled && (
            <div className="mt-2">
              <ScheduledTimePicker
                value={scheduledTime}
                onChange={setScheduledTime}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500 text-white p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-black py-3 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Создание...' : 'Создать заказ'}
        </button>
      </form>
    </motion.div>
  )
}

