'use client'

import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { logout } from '@/lib/auth'
import { motion } from 'framer-motion'

export default function Layout({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter()
  const { user } = useStore()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-600">
      <header className="bg-black text-white p-4 sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Бомбилы</h1>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-white">{user.name || user.phone}</span>
                <span className="text-xs bg-primary text-black px-2 py-1 rounded font-bold">
                  {user.role === 'admin' ? 'Админ' : user.role === 'driver' ? 'Водитель' : 'Пассажир'}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                >
                  Выход
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 pb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

