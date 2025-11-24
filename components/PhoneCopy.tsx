'use client'

import { useCallback, useState } from 'react'

interface PhoneCopyProps {
  value?: string | null
}

export default function PhoneCopy({ value }: PhoneCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!value) return

    const text = value.trim()
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.warn('Не удалось скопировать телефон, отображаю подсказку', error)
    } finally {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [value])

  if (!value) {
    return <span className="text-black/70">—</span>
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-black/20 px-3 py-1 text-sm font-semibold text-black transition hover:bg-yellow-200"
      title="Нажмите, чтобы скопировать номер"
    >
      {value}
      {copied && <span className="ml-2 text-xs text-green-600">Скопировано</span>}
    </button>
  )
}



