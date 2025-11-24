'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { requestAudioPermission, initAudioContext } from '@/lib/audio'

interface AudioContextType {
  permissionGranted: boolean
  requestPermission: () => Promise<void>
}

const AudioContext = createContext<AudioContextType>({
  permissionGranted: false,
  requestPermission: async () => {},
})

export function useAudioPermission() {
  return useContext(AudioContext)
}

export function AudioPermissionProvider({ children }: { children: React.ReactNode }) {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)

  useEffect(() => {
    initAudioContext()
    
    // Проверяем, было ли уже запрошено разрешение
    const hasRequested = localStorage.getItem('audio_permission_requested')
    
    if (!hasRequested) {
      setShowPermissionModal(true)
    } else {
      requestAudioPermission().then((granted) => {
        setPermissionGranted(granted)
      })
    }
  }, [])

  const handleRequestPermission = async () => {
    const granted = await requestAudioPermission()
    setPermissionGranted(granted)
    setShowPermissionModal(false)
    localStorage.setItem('audio_permission_requested', 'true')
  }

  const handleDeny = () => {
    setShowPermissionModal(false)
    localStorage.setItem('audio_permission_requested', 'true')
  }

  if (showPermissionModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white border-4 border-black rounded-lg p-6 max-w-md w-full animate-fade-in">
          <h2 className="text-2xl font-bold text-black mb-4">
            Разрешение на аудио уведомления
          </h2>
          <p className="text-black mb-6">
            Для получения уведомлений о новых заказах необходимо разрешить воспроизведение звука.
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleRequestPermission}
              className="flex-1 bg-primary text-black py-3 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
            >
              Разрешить
            </button>
            <button
              onClick={handleDeny}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-700 transition-colors"
            >
              Отказать
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AudioContext.Provider value={{ permissionGranted, requestPermission: handleRequestPermission }}>
      {children}
    </AudioContext.Provider>
  )
}

