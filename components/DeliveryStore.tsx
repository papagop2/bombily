'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Product, Category, Order, DeliveryItem, Shop, AppSettings } from '@/lib/supabase'
import { playNotification } from '@/lib/audio'
import ScheduledTimePicker from './ScheduledTimePicker'
import { useStore } from '@/lib/store'

interface DeliveryStoreProps {
  userId: string
  onOrderCreated: (order: Order) => void
}

interface CartItem {
  product: Product
  quantity: number
  displayPrice: number
}

interface SearchResult extends Product {
  shop: Shop
}

const DEFAULT_MARKUP = 0

export default function DeliveryStore({ userId, onOrderCreated }: DeliveryStoreProps) {
  const {
    user,
    cities,
    shops: storeShops,
    settings,
    setShops,
    setSettings,
  } = useStore()

  const [shops, setLocalShops] = useState<Shop[]>(storeShops)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(storeShops[0]?.id || null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)
  const [useScheduled, setUseScheduled] = useState(false)
  const [loadingShops, setLoadingShops] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const userCity = useMemo(
    () => cities.find((city) => city.id === user?.city_id),
    [cities, user?.city_id]
  )
  const deliveryFee = userCity?.delivery_fee || 0
  const markupPercent = settings?.markup_percent ?? DEFAULT_MARKUP
  const markupMultiplier = 1 + markupPercent / 100

  useEffect(() => {
    if (!settings) {
      fetchSettings()
    }
  }, [settings])

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (data) {
      setSettings(data as AppSettings)
    } else {
      setSettings({ id: 1, markup_percent: DEFAULT_MARKUP })
    }
  }

  useEffect(() => {
    if (!user?.city_id) {
      setLoadingShops(false)
      return
    }
    const cityId = user.city_id
    if (storeShops.length) {
      const filtered = storeShops.filter((shop) => shop.city_id === cityId)
      setLocalShops(filtered)
      setSelectedShopId((prev) => prev || filtered[0]?.id || null)
      setLoadingShops(false)
      return
    }
    async function loadShops() {
      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('city_id', cityId)
        .order('name')
      if (data) {
        setLocalShops(data as Shop[])
        setShops(data as Shop[])
        setSelectedShopId(data[0]?.id || null)
      }
      setLoadingShops(false)
    }
    loadShops()
  }, [user?.city_id, storeShops, setShops])

  useEffect(() => {
    if (storeShops.length) {
      setLocalShops(storeShops)
      if (!selectedShopId) {
        setSelectedShopId(storeShops[0].id)
      }
    }
  }, [storeShops, selectedShopId])

  useEffect(() => {
    if (!selectedShopId) {
      setCategories([])
      setProducts([])
      return
    }
    loadCategories(selectedShopId)
    loadProducts(selectedShopId)
  }, [selectedShopId])

  const loadCategories = async (shopId: string) => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    setCategories((data || []) as Category[])
    setCategoryFilter(null)
  }

  const loadProducts = async (shopId: string) => {
    setLoadingProducts(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('in_stock', true)
      .order('name')
    setProducts((data || []) as Product[])
    setLoadingProducts(false)
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!globalSearch.trim()) {
        setGlobalResults([])
        setSearchLoading(false)
        return
      }
      fetchGlobalResults()
    }, 350)
    return () => clearTimeout(handler)
  }, [globalSearch, shops])

  const fetchGlobalResults = async () => {
    if (!user?.city_id) return
    if (!shops.length) return
    setSearchLoading(true)
    const shopIds = shops.map((shop) => shop.id)
    const { data } = await supabase
      .from('products')
      .select('*, shop:shops(*)')
      .eq('in_stock', true)
      .in('shop_id', shopIds)
      .ilike('name', `%${globalSearch}%`)
      .limit(20)
    setGlobalResults((data || []) as unknown as SearchResult[])
    setSearchLoading(false)
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = categoryFilter ? product.category === categoryFilter : true
      const matchesSearch = shopSearch
        ? product.name.toLowerCase().includes(shopSearch.toLowerCase())
        : true
      return matchesCategory && matchesSearch
    })
  }, [products, categoryFilter, shopSearch])

  const cartShopId = cart[0]?.product.shop_id || null

  const addToCart = (product: Product) => {
    if (cartShopId && product.shop_id !== cartShopId) {
      alert('В одном заказе можно добавлять товары только из одного магазина.')
      return
    }
    const displayPrice = Math.ceil(product.price * markupMultiplier)
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1, displayPrice }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cart.length === 0) {
      alert('Корзина пуста')
      return
    }
    if (!cartShopId) {
      alert('Выберите магазин')
      return
    }
    const formData = new FormData(e.currentTarget)
    const toAddress = formData.get('to_address') as string
    const comment = formData.get('comment') as string
    const finalScheduledTime = useScheduled && scheduledTime ? scheduledTime : null

    try {
      if (!user?.city_id) {
        alert('Ваш город ещё не подтвержден администратором.')
        return
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          type: 'delivery',
          city_id: user.city_id,
          shop_id: cartShopId,
          from_address: 'Магазин',
          to_address: toAddress,
          comment: comment || null,
          scheduled_time: finalScheduledTime,
          status: 'pending',
        })
        .select()
        .single()

      if (orderError) throw orderError

      const deliveryItems: Omit<DeliveryItem, 'id' | 'created_at'>[] = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.displayPrice,
      }))

      const { error: itemsError } = await supabase.from('delivery_items').insert(deliveryItems)
      if (itemsError) throw itemsError

      setCart([])
      setShowOrderForm(false)
      onOrderCreated(order as Order)
      await playNotification('Заказ доставки создан')
    } catch (error: any) {
      console.error('Ошибка создания заказа:', error)
      alert('Ошибка создания заказа: ' + error.message)
    }
  }

  const itemsTotal = cart.reduce((sum, item) => sum + item.displayPrice * item.quantity, 0)
  const totalWithFee = itemsTotal + (cart.length > 0 ? Math.ceil(deliveryFee) : 0)

  if (!user?.city_id) {
    return (
      <div className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Город не подтвержден</h2>
        <p className="text-sm text-black">
          Мы ожидаем подтверждение города администратором. После добавления города вы сможете оформить заказ.
        </p>
      </div>
    )
  }

  if (showOrderForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <button
          onClick={() => setShowOrderForm(false)}
          className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
        >
          ← Назад к корзине
        </button>
        <div className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Оформление заказа</h2>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label className="block text-black font-bold mb-2">Адрес доставки</label>
              <input
                type="text"
                name="to_address"
                required
                className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                placeholder="Куда доставить"
              />
            </div>

            <div>
              <label className="block text-black font-bold mb-2">Комментарий</label>
              <textarea
                name="comment"
                rows={3}
                className="w-full px-4 py-3 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none resize-none"
                placeholder="Дополнительная информация"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="use_scheduled"
                  checked={useScheduled}
                  onChange={(e) => setUseScheduled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-black font-bold">Вызов по времени</span>
              </label>
              {useScheduled && (
                <div className="mt-2">
                  <ScheduledTimePicker value={scheduledTime} onChange={setScheduledTime} />
                  <input type="hidden" name="scheduled_time" value={scheduledTime || ''} />
                </div>
              )}
            </div>

            <div className="bg-primary text-black p-4 rounded-lg border-2 border-black space-y-2">
              <div className="font-bold mb-2">Состав заказа:</div>
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span>{item.product.name} x{item.quantity}</span>
                  <span>{item.displayPrice * item.quantity} ₽</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-black pt-2">
                <span>Доставка и сборка</span>
                <span>{Math.ceil(deliveryFee)} ₽</span>
              </div>
              <div className="mt-1 pt-2 border-t-2 border-black flex justify-between font-bold text-lg">
                <span>Итого:</span>
                <span>{totalWithFee} ₽</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-black py-3 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
            >
              Создать заказ
            </button>
          </form>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3">
        <h3 className="font-bold text-lg">Поиск товаров</h3>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
          placeholder="Поиск по всем магазинам города"
        />
        {searchLoading && <p className="text-sm">Поиск...</p>}
        {!searchLoading && globalResults.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {globalResults.map((result) => {
              const displayPrice = Math.ceil(result.price * markupMultiplier)
              return (
                <div key={result.id} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                  <div>
                    <p className="font-bold text-sm">{result.name}</p>
                    <p className="text-xs text-gray-600">{result.shop.name}</p>
                    <p className="text-xs text-gray-600">{displayPrice} ₽</p>
                  </div>
                  <button
                    onClick={() => addToCart(result)}
                    className="bg-black text-white px-3 py-1 rounded-lg text-sm font-bold"
                  >
                    В корзину
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3">
        <h3 className="font-bold text-lg">Магазины в вашем городе</h3>
        {loadingShops ? (
          <p>Загрузка...</p>
        ) : shops.length === 0 ? (
          <p>Администратор еще не добавил магазины в вашем городе.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap ${
                  selectedShopId === shop.id ? 'bg-black text-white' : 'bg-gray-200 text-black'
                }`}
              >
                {shop.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedShopId && (
        <div className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-4 py-2 rounded-lg font-bold ${
                categoryFilter === null ? 'bg-black text-white' : 'bg-gray-300 text-black'
              }`}
            >
              Все категории
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-4 py-2 rounded-lg font-bold ${
                  categoryFilter === cat.id ? 'bg-black text-white' : 'bg-gray-300 text-black'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
            placeholder="Поиск внутри магазина"
          />
        </div>
      )}

      {selectedShopId && (
        <div>
          {loadingProducts ? (
            <div className="text-center py-8">Загрузка товаров...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 bg-white text-black rounded-lg border-4 border-black">
              Нет товаров по заданным фильтрам
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product) => {
                const displayPrice = Math.ceil(product.price * markupMultiplier)
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white text-black p-4 rounded-lg border-4 border-black"
                  >
                    {product.image_url && (
                      <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-200">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <h4 className="font-bold mb-1">{product.name}</h4>
                    {product.description && (
                      <p className="text-sm text-black mb-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-black">{displayPrice} ₽</span>
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-primary text-black px-3 py-1 rounded-lg font-bold hover:bg-yellow-400 transition-colors text-sm"
                      >
                        В корзину
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {cart.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-white text-black border-t-4 border-black p-4 shadow-2xl space-y-3"
        >
          <h3 className="font-bold">Корзина ({cart.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between bg-primary text-black p-2 rounded border-2 border-black"
              >
                <span className="flex-1 text-sm">{item.product.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 bg-black text-white rounded font-bold"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 bg-black text-white rounded font-bold"
                  >
                    +
                  </button>
                  <span className="w-16 text-right font-bold">{item.displayPrice * item.quantity} ₽</span>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-500 font-bold ml-2"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-700">
            <p>Товары: {itemsTotal} ₽</p>
            <p>Доставка и сборка: {Math.ceil(deliveryFee)} ₽</p>
          </div>
          <div className="flex items-center justify-between font-bold text-lg">
            <span>Итого:</span>
            <span>{totalWithFee} ₽</span>
          </div>
          <button
            onClick={() => setShowOrderForm(true)}
            className="w-full bg-primary text-black py-3 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
          >
            Оформить заказ
          </button>
        </motion.div>
      )}
    </div>
  )
}

