// Управление аудио уведомлениями

let audioContext: AudioContext | null = null
let audioPermissionGranted = false

// Инициализация аудио контекста
export function initAudioContext() {
  if (typeof window === 'undefined') return
  
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch (e) {
    console.error('Ошибка инициализации аудио контекста:', e)
  }
}

// Запрос разрешения на воспроизведение аудио
export async function requestAudioPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  
  if (!audioContext) {
    initAudioContext()
  }
  
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
      audioPermissionGranted = true
      return true
    } catch (e) {
      console.error('Ошибка запроса разрешения на аудио:', e)
      return false
    }
  }
  
  audioPermissionGranted = true
  return true
}

// Воспроизведение текста через Web Speech API
export async function playNotification(text: string) {
  if (typeof window === 'undefined') return
  
  if (!audioPermissionGranted) {
    const granted = await requestAudioPermission()
    if (!granted) {
      console.warn('Разрешение на аудио не получено')
      return
    }
  }
  
  if ('speechSynthesis' in window) {
    // Останавливаем предыдущие сообщения
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ru-RU'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    
    window.speechSynthesis.speak(utterance)
  }
}

// Проверка наличия разрешения
export function hasAudioPermission(): boolean {
  return audioPermissionGranted
}



