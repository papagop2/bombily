'use client'

import { useEffect } from 'react'

interface StatusNotificationProps {
  message: string
  onClose: () => void
}

export default function StatusNotification({ message, onClose }: StatusNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-black bg-white p-6 text-black shadow-2xl">
        <h3 className="mb-3 text-xl font-bold">Уведомление</h3>
        <p className="mb-4 text-base">{message}</p>
        <p className="mb-4 text-xs text-gray-600">
          Страница будет обновлена автоматически через 5 секунд бездействия.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-black py-2 text-center font-bold text-white transition hover:bg-gray-900"
        >
          Ок
        </button>
      </div>
    </div>
  )
}



