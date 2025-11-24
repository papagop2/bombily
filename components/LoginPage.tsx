'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { loginUser, registerUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { UserRole, City } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setCities: setGlobalCities } = useStore()
  const [isLogin, setIsLogin] = useState(true)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('passenger')
  const [cities, setCities] = useState<City[]>([])
  const [cityMode, setCityMode] = useState<'select' | 'propose'>('select')
  const [cityId, setCityId] = useState<string | null>(null)
  const [proposedCity, setProposedCity] = useState('')
  const [driverVehicleModel, setDriverVehicleModel] = useState('')
  const [driverVehicleColor, setDriverVehicleColor] = useState('')
  const [driverVehiclePlate, setDriverVehiclePlate] = useState('')
  const [driverSbpName, setDriverSbpName] = useState('')
  const [driverSbpPhone, setDriverSbpPhone] = useState('')
  const [driverSbpBank, setDriverSbpBank] = useState('')
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCities() {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Ошибка загрузки городов', error)
      }

      setCities(data || [])
      setGlobalCities(data || [])
      if (data && data.length > 0) {
        setCityId(data[0].id)
      }
      setCitiesLoading(false)
    }

    fetchCities()
  }, [setGlobalCities])

  const resetDriverFields = () => {
    setDriverVehicleModel('')
    setDriverVehicleColor('')
    setDriverVehiclePlate('')
    setDriverSbpName('')
    setDriverSbpPhone('')
    setDriverSbpBank('')
  }

  useEffect(() => {
    if (role !== 'driver') {
      resetDriverFields()
    }
  }, [role])

  const validateDriverFields = () => {
    if (role !== 'driver') return true
    if (
      !driverVehicleModel.trim() ||
      !driverVehicleColor.trim() ||
      !driverVehiclePlate.trim() ||
      !driverSbpName.trim() ||
      !driverSbpPhone.trim() ||
      !driverSbpBank.trim()
    ) {
      setError('Заполните все данные автомобиля и СБП для водителя')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const user = await loginUser(phone, password)
        if (user) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('current_user', JSON.stringify(user))
          }
          setUser(user)
          
          if (user.role === 'admin') {
            router.push('/admin')
          } else if (user.role === 'driver') {
            router.push('/driver')
          } else {
            router.push('/passenger')
          }
        } else {
          setError('Неверный телефон или пароль')
        }
      } else {
        if (cityMode === 'select' && !cityId) {
          setError('Выберите город')
          setLoading(false)
          return
        }
        if (cityMode === 'propose' && !proposedCity.trim()) {
          setError('Укажите название города')
          setLoading(false)
          return
        }
        if (!validateDriverFields()) {
          setLoading(false)
          return
        }

        const user = await registerUser({
          phone,
          password,
          role,
          name,
          cityId: cityMode === 'select' ? cityId : null,
          proposedCityName: cityMode === 'propose' ? proposedCity.trim() : null,
          driverDetails: role === 'driver'
            ? {
                vehicleModel: driverVehicleModel.trim(),
                vehicleColor: driverVehicleColor.trim(),
                vehiclePlate: driverVehiclePlate.trim(),
                sbpRecipientName: driverSbpName.trim(),
                sbpPhone: driverSbpPhone.trim(),
                sbpBank: driverSbpBank.trim(),
              }
            : undefined,
        })
        if (typeof window !== 'undefined') {
          localStorage.setItem('current_user', JSON.stringify(user))
        }
        setUser(user)
        
        if (user.role === 'admin') {
          router.push('/admin')
        } else if (user.role === 'driver') {
          router.push('/driver')
        } else {
          router.push('/passenger')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white text-black p-8 rounded-lg border-4 border-black shadow-lg">
          <h1 className="text-4xl font-bold text-center mb-2">Бомбилы</h1>
          <p className="text-center text-black mb-6">Такси • Грузовое такси • Доставка</p>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${
                isLogin
                  ? 'bg-primary text-black'
                  : 'bg-gray-300 text-black'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${
                !isLogin
                  ? 'bg-primary text-black'
                  : 'bg-gray-300 text-black'
              }`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-black font-bold mb-2">Имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Ваше имя"
                />
              </div>
            )}

            <div>
              <label className="block text-black font-bold mb-2">Телефон</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div>
              <label className="block text-black font-bold mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                placeholder="Минимум 6 символов"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-black font-bold mb-2">Роль</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                >
                  <option value="passenger">Пассажир</option>
                  <option value="driver">Водитель</option>
                </select>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCityMode('select')}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold border-2 border-black ${
                      cityMode === 'select' ? 'bg-black text-white' : 'bg-gray-200 text-black'
                    }`}
                  >
                    Выбрать город
                  </button>
                  <button
                    type="button"
                    onClick={() => setCityMode('propose')}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold border-2 border-black ${
                      cityMode === 'propose' ? 'bg-black text-white' : 'bg-gray-200 text-black'
                    }`}
                  >
                    Моего города нет
                  </button>
                </div>

                {cityMode === 'select' ? (
                  <div>
                    <label className="block text-black font-bold mb-2">Город</label>
                    {citiesLoading ? (
                      <div className="text-sm">Загрузка городов...</div>
                    ) : cities.length ? (
                      <select
                        value={cityId || ''}
                        onChange={(e) => setCityId(e.target.value)}
                        className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                      >
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-red-600">
                        Нет активных городов. Предложите свой город, и администратор добавит его.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-black font-bold mb-2">Предложите свой город</label>
                    <input
                      type="text"
                      value={proposedCity}
                      onChange={(e) => setProposedCity(e.target.value)}
                      className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                      placeholder="Название города"
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Администратор рассмотрит предложение, отредактирует и добавит город в список.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isLogin && role === 'driver' && (
              <div className="space-y-3 border border-dashed border-gray-400 p-3 rounded-lg bg-gray-50">
                <p className="text-sm font-bold">Данные для сопровождения заказа</p>
                <input
                  type="text"
                  value={driverVehicleModel}
                  onChange={(e) => setDriverVehicleModel(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Марка авто (пример: Ford Focus)"
                />
                <input
                  type="text"
                  value={driverVehicleColor}
                  onChange={(e) => setDriverVehicleColor(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Цвет авто (пример: Синий)"
                />
                <input
                  type="text"
                  value={driverVehiclePlate}
                  onChange={(e) => setDriverVehiclePlate(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Гос. номер (пример: А777АА)"
                />
                <input
                  type="text"
                  value={driverSbpName}
                  onChange={(e) => setDriverSbpName(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Имя получателя СБП"
                />
                <input
                  type="text"
                  value={driverSbpPhone}
                  onChange={(e) => setDriverSbpPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Телефон СБП"
                />
                <input
                  type="text"
                  value={driverSbpBank}
                  onChange={(e) => setDriverSbpBank(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                  placeholder="Банк для СБП"
                />
              </div>
            )}

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
              {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

