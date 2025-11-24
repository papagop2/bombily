'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getCurrentUser } from '@/lib/auth'
import LoginPage from '@/components/LoginPage'

export default function Home() {
  const router = useRouter()
  const { user, setUser } = useStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
          // Перенаправляем в зависимости от роли
          if (currentUser.role === 'admin') {
            router.push('/admin')
          } else if (currentUser.role === 'driver') {
            router.push('/driver')
          } else {
            router.push('/passenger')
          }
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Ошибка проверки аутентификации:', error)
        setLoading(false)
      }
    }
    
    checkAuth()
  }, [router, setUser])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-600">
        <div className="text-2xl font-bold text-white">Загрузка...</div>
      </div>
    )
  }

  return <LoginPage />
}

