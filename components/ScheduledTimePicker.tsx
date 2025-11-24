'use client'

import { useState, useEffect } from 'react'
import { format, addDays, addHours, isAfter, setHours as setHoursFn, setMinutes as setMinutesFn } from 'date-fns'
import { ru } from 'date-fns/locale'

interface ScheduledTimePickerProps {
  value: string | null
  onChange: (value: string | null) => void
}

export default function ScheduledTimePicker({ value, onChange }: ScheduledTimePickerProps) {
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow'>('today')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (value) {
      const date = new Date(value)
      const now = new Date()
      const tomorrow = addDays(now, 1)
      
      if (date.toDateString() === now.toDateString()) {
        setSelectedDay('today')
      } else if (date.toDateString() === tomorrow.toDateString()) {
        setSelectedDay('tomorrow')
      }
      
      setHours(date.getHours().toString().padStart(2, '0'))
      setMinutes(date.getMinutes().toString().padStart(2, '0'))
    }
  }, [value])

  const validateAndUpdate = (day: 'today' | 'tomorrow', h: string, m: string) => {
    setError('')
    
    const hoursNum = parseInt(h)
    const minutesNum = parseInt(m)
    
    if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 23) {
      setError('Часы должны быть от 0 до 23')
      onChange(null)
      return
    }
    
    if (isNaN(minutesNum) || minutesNum < 0 || minutesNum > 59) {
      setError('Минуты должны быть от 0 до 59')
      onChange(null)
      return
    }
    
    const now = new Date()
    let targetDate: Date
    
    if (day === 'today') {
      targetDate = setMinutesFn(setHoursFn(now, hoursNum), minutesNum)
      
      // Проверяем, что время не раньше чем через 2 часа
      const minTime = addHours(now, 2)
      
      if (!isAfter(targetDate, minTime)) {
        setError('Сегодня можно выбрать время не ранее чем через 2 часа от текущего времени')
        onChange(null)
        return
      }
      
      // Если выбранное время уже прошло сегодня, переключаем на завтра
      if (!isAfter(targetDate, now)) {
        setError('Выбранное время уже прошло. Выберите завтра.')
        onChange(null)
        return
      }
    } else {
      const tomorrow = addDays(now, 1)
      targetDate = setMinutesFn(setHoursFn(tomorrow, hoursNum), minutesNum)
    }
    
    onChange(targetDate.toISOString())
  }

  const handleDayChange = (day: 'today' | 'tomorrow') => {
    setSelectedDay(day)
    if (hours && minutes) {
      validateAndUpdate(day, hours, minutes)
    }
  }

  const handleHoursChange = (h: string) => {
    setHours(h)
    if (h && minutes) {
      validateAndUpdate(selectedDay, h, minutes)
    }
  }

  const handleMinutesChange = (m: string) => {
    setMinutes(m)
    if (hours && m) {
      validateAndUpdate(selectedDay, hours, m)
    }
  }

  const now = new Date()
  const tomorrow = addDays(now, 1)
  const minTimeToday = addHours(now, 2)

  return (
    <div className="bg-white text-black p-4 rounded-lg border-2 border-black space-y-4">
      <div>
        <label className="block text-sm font-bold mb-2 text-black">День</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDayChange('today')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${
              selectedDay === 'today'
                ? 'bg-black text-white'
                : 'bg-gray-300 text-black'
            }`}
          >
            Сегодня ({format(now, 'd MMM', { locale: ru })})
          </button>
          <button
            type="button"
            onClick={() => handleDayChange('tomorrow')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${
              selectedDay === 'tomorrow'
                ? 'bg-black text-white'
                : 'bg-gray-300 text-black'
            }`}
          >
            Завтра ({format(tomorrow, 'd MMM', { locale: ru })})
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-2 text-black">Время</label>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-xs mb-1 text-black">Часы (0-23)</label>
            <input
              type="number"
              value={hours}
              onChange={(e) => handleHoursChange(e.target.value)}
              min="0"
              max="23"
              className="w-full px-3 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none text-center font-bold"
              placeholder="00"
            />
          </div>
          <span className="text-2xl font-bold pt-6 text-black">:</span>
          <div className="flex-1">
            <label className="block text-xs mb-1 text-black">Минуты (0-59)</label>
            <input
              type="number"
              value={minutes}
              onChange={(e) => handleMinutesChange(e.target.value)}
              min="0"
              max="59"
              className="w-full px-3 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none text-center font-bold"
              placeholder="00"
            />
          </div>
        </div>
      </div>

      {selectedDay === 'today' && (
        <div className="text-xs text-black bg-primary p-2 rounded">
          Минимальное время: {format(minTimeToday, 'HH:mm')}
        </div>
      )}

      {error && (
        <div className="text-xs text-white bg-red-500 p-2 rounded">
          {error}
        </div>
      )}

      {value && !error && (
        <div className="text-xs text-black bg-green-200 p-2 rounded">
          Выбрано: {format(new Date(value), 'd MMM yyyy, HH:mm', { locale: ru })}
        </div>
      )}
    </div>
  )
}
