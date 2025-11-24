'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import Layout from '@/components/Layout'
import OrderList from '@/components/OrderList'
import { motion } from 'framer-motion'
import type { Order, User, Product, Category, City, CityProposal, Shop, AppSettings } from '@/lib/supabase'
import PhoneCopy from '@/components/PhoneCopy'

type CityProposalWithUser = CityProposal & {
  requester?: {
    id: string
    name?: string | null
    phone?: string | null
  }
}
import { playNotification } from '@/lib/audio'

type AdminBootstrapResponse = {
  orders: Order[]
  users: User[]
  products: Product[]
  categories: Category[]
  cities: City[]
  cityProposals: CityProposalWithUser[]
  shops: Shop[]
  settings: AppSettings | null
}

export default function AdminPage() {
  const router = useRouter()
  const {
    user,
    setUser,
    orders,
    setOrders,
    cities,
    setCities,
    shops,
    setShops,
    settings,
    setSettings,
  } = useStore()
  const [activeTab, setActiveTab] = useState<
    'orders' | 'users' | 'products' | 'categories' | 'shops' | 'cities' | 'proposals'
  >('orders')
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [cityProposals, setCityProposals] = useState<CityProposalWithUser[]>([])
  const [proposalNames, setProposalNames] = useState<Record<string, string>>({})
  const [showCityForm, setShowCityForm] = useState(false)
  const [editingCity, setEditingCity] = useState<City | null>(null)
  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [markupDraft, setMarkupDraft] = useState<number>(settings?.markup_percent ?? 0)
  const [productShopId, setProductShopId] = useState<string | null>(null)
  const [categoryShopId, setCategoryShopId] = useState<string | null>(null)
  const [cityFeeDrafts, setCityFeeDrafts] = useState<Record<string, string>>({})
  const statusLabelMap: Record<string, string> = {
    pending: 'Ожидает',
    accepted: 'Принят',
    en_route: 'В пути',
    arrived: 'Прибыл',
    passenger_on_way: 'Пассажир выходит',
    completed: 'Завершен',
    cancelled: 'Отменен',
  }
  const statusColorMap: Record<string, string> = {
    pending: 'bg-yellow-500',
    accepted: 'bg-blue-500',
    en_route: 'bg-green-500',
    arrived: 'bg-purple-500',
    passenger_on_way: 'bg-teal-500',
    completed: 'bg-gray-500',
    cancelled: 'bg-red-500',
  }

  const effectiveProductShopId = editingProduct?.shop_id || productShopId || shops[0]?.id || ''
  const availableProductCategories = categories.filter((cat) => cat.shop_id === effectiveProductShopId)

  const loadAllData = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) {
      throw new Error('Нет активной сессии Supabase')
    }
    const response = await fetch('/api/admin/bootstrap', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      throw new Error('Не удалось загрузить данные администратора')
    }
    const payload = (await response.json()) as AdminBootstrapResponse
    setOrders(payload.orders)
    setUsers(payload.users)
    setProducts(payload.products)
    setCategories(payload.categories)
    setCities(payload.cities as City[])
    setCityProposals(payload.cityProposals)
    setShops(payload.shops)
    setSettings(payload.settings)

    const feeDrafts: Record<string, string> = {}
    payload.cities.forEach((city) => {
      feeDrafts[city.id] = city.delivery_fee?.toString() ?? '0'
    })
    setCityFeeDrafts(feeDrafts)

    const proposalDrafts: Record<string, string> = {}
    payload.cityProposals.forEach((proposal) => {
      proposalDrafts[proposal.id] = proposal.proposed_name
    })
    setProposalNames(proposalDrafts)
  }, [setCategories, setCities, setOrders, setSettings, setShops])

  useEffect(() => {
    async function init() {
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.role !== 'admin') {
        router.push('/')
        return
      }
      setUser(currentUser)
      await loadAllData()
      setLoading(false)
    }
    init()
  }, [router, setUser, loadAllData])

  useEffect(() => {
    const drafts: Record<string, string> = {}
    cities.forEach((city) => {
      drafts[city.id] = city.delivery_fee?.toString() ?? '0'
    })
    setCityFeeDrafts(drafts)
  }, [cities])

  useEffect(() => {
    if (settings) {
      setMarkupDraft(settings.markup_percent)
    }
  }, [settings])

  useEffect(() => {
    if (!productShopId && shops.length) {
      setProductShopId(shops[0].id)
    }
    if (!categoryShopId && shops.length) {
      setCategoryShopId(shops[0].id)
    }
  }, [shops, productShopId, categoryShopId])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('admin_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order
            setOrders((prev) => {
              if (prev.some((order) => order.id === newOrder.id)) {
                return prev
              }
              return [newOrder, ...prev]
            })
            await playNotification(`Новый заказ: ${newOrder.type}`)
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order
            setOrders((prev) => prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, setOrders])

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) {
      setOrders(data)
    }
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) {
      setUsers(data)
    }
  }

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name')
    
    if (data) {
      setProducts(data)
    }
  }

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    
    if (data) {
      setCategories(data)
    }
  }

  const loadShopsData = async () => {
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false })
    if (data) {
      setShops(data as Shop[])
      if (!editingShop && data.length > 0) {
        setProductShopId((prev) => prev || data[0].id)
        setCategoryShopId((prev) => prev || data[0].id)
      }
    }
  }

  const loadSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (data) {
      setSettings(data as AppSettings)
      setMarkupDraft(data.markup_percent)
    }
  }

  const loadCitiesData = async () => {
    const { data } = await supabase
      .from('cities')
      .select('*')
      .order('name')

    if (data) {
      setCities(data as City[])
    }
  }

  const handleSaveCity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = (form.get('name') as string)?.trim()

    if (!name) {
      alert('Введите название города')
      return
    }

    if (editingCity) {
      const { error } = await supabase.from('cities').update({ name }).eq('id', editingCity.id)
      if (error) {
        alert('Ошибка: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase.from('cities').insert({ name })
      if (error) {
        alert('Ошибка: ' + error.message)
        return
      }
    }

    setShowCityForm(false)
    setEditingCity(null)
    await loadCitiesData()
  }

  const handleDeleteCity = async (cityId: string) => {
    if (!confirm('Удалить город?')) return
    const { error } = await supabase.from('cities').delete().eq('id', cityId)
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    await loadCitiesData()
  }

  const handleApproveProposal = async (proposal: CityProposalWithUser) => {
    const customName = (proposalNames[proposal.id] ?? proposal.proposed_name ?? '').trim()
    if (!customName) {
      alert('Введите название города перед добавлением')
      return
    }

    const { data: newCity, error } = await supabase
      .from('cities')
      .insert({ name: customName.trim() })
      .select()
      .single()

    if (error || !newCity) {
      alert('Ошибка добавления города: ' + error?.message)
      return
    }

    if (proposal.user_id) {
      await supabase
        .from('users')
        .update({ city_id: newCity.id, proposed_city_name: null })
        .eq('id', proposal.user_id)
    }

    await supabase.from('city_proposals').update({ status: 'approved' }).eq('id', proposal.id)
    await loadCitiesData()
    await loadCityProposals()
  }

  const handleRejectProposal = async (proposalId: string) => {
    if (!confirm('Отклонить предложение?')) return
    await supabase.from('city_proposals').update({ status: 'rejected' }).eq('id', proposalId)
    await loadCityProposals()
  }

  const handleAssignCity = async (userId: string, cityId: string | null) => {
    await supabase.from('users').update({ city_id: cityId }).eq('id', userId)
    await loadUsers()
  }

  const loadCityProposals = async () => {
    const { data } = await supabase
      .from('city_proposals')
      .select('*, requester:users!city_proposals_user_id_fkey(id, name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) {
      const formatted = data as unknown as CityProposalWithUser[]
      setCityProposals(formatted)
      const draftMap: Record<string, string> = {}
      formatted.forEach((proposal) => {
        draftMap[proposal.id] = proposal.proposed_name
      })
      setProposalNames(draftMap)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Удалить заказ?')) return
    
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
    
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setOrders(orders.filter(o => o.id !== orderId))
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Удалить пользователя?')) return
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
    
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setUsers(users.filter(u => u.id !== userId))
    }
  }

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const shopId = (formData.get('shop_id') as string) || editingProduct?.shop_id || productShopId
    const categoryId = formData.get('category') as string

    if (!shopId || !categoryId) {
      alert('Выберите магазин и категорию')
      return
    }

    const productData = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      price: parseFloat(formData.get('price') as string),
      image_url: (formData.get('image_url') as string) || null,
      shop_id: shopId,
      category: categoryId,
      in_stock: formData.get('in_stock') === 'on',
    }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)
        
        if (error) throw error
      }
      
      setShowProductForm(false)
      setEditingProduct(null)
      await loadProducts()
    } catch (error: any) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleSaveShop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const cityId = formData.get('city_id') as string

    if (!name || !cityId) {
      alert('Укажите название и город')
      return
    }

    try {
      if (editingShop) {
        const { error } = await supabase
          .from('shops')
          .update({ name, description, city_id: cityId })
          .eq('id', editingShop.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('shops')
          .insert({ name, description, city_id: cityId })
        if (error) throw error
      }
      setShowShopForm(false)
      setEditingShop(null)
      await loadShopsData()
    } catch (error: any) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Удалить магазин?')) return
    const { error } = await supabase.from('shops').delete().eq('id', shopId)
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    await loadShopsData()
  }

  const handleSaveMarkup = async () => {
    const normalized = Number(markupDraft) || 0
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 1, markup_percent: normalized })
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    setSettings({ id: 1, markup_percent: normalized })
    alert('Наценка сохранена')
  }

  const handleUpdateCityFee = async (cityId: string) => {
    const feeValue = Number(cityFeeDrafts[cityId] || 0)
    const { error } = await supabase
      .from('cities')
      .update({ delivery_fee: feeValue })
      .eq('id', cityId)
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    await loadCitiesData()
    alert('Тариф обновлён')
  }

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const shopId = (formData.get('shop_id') as string) || categoryShopId || editingCategory?.shop_id
    if (!shopId) {
      alert('Выберите магазин')
      return
    }

    const categoryData = {
      name: formData.get('name') as string,
      shop_id: shopId,
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categories')
          .insert(categoryData)
        
        if (error) throw error
      }
      
      setShowCategoryForm(false)
      setEditingCategory(null)
      await loadCategories()
    } catch (error: any) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Удалить товар?')) return
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
    
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setProducts(products.filter(p => p.id !== productId))
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Удалить категорию?')) return
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
    
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setCategories(categories.filter(c => c.id !== categoryId))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-600">
        <div className="text-2xl font-bold text-white">Загрузка...</div>
      </div>
    )
  }

  return (
    <Layout title="Администратор">
      <div className="space-y-6">
        {/* Табы */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'orders'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Заказы ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'users'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Пользователи ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'products'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Товары ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'categories'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Категории ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('shops')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'shops'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Магазины ({shops.length})
          </button>
          <button
            onClick={() => setActiveTab('cities')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'cities'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Города ({cities.length})
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === 'proposals'
                ? 'bg-black text-white'
                : 'bg-white text-black'
            }`}
          >
            Заявки городов ({cityProposals.length})
          </button>
        </div>

        {/* Контент */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.map(order => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      {order.type === 'taxi' ? 'Такси' : order.type === 'cargo' ? 'Грузовое такси' : 'Доставка'}
                    </h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-bold ${
                      statusColorMap[order.status] || 'bg-gray-400'
                    }`}>
                      {statusLabelMap[order.status] || order.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
                <div className="space-y-2">
                  <div><span className="font-bold">Откуда: </span>{order.from_address}</div>
                  <div><span className="font-bold">Куда: </span>{order.to_address}</div>
                  {order.comment && <div><span className="font-bold">Комментарий: </span>{order.comment}</div>}
                  <div><span className="font-bold">Создан: </span>{new Date(order.created_at).toLocaleString('ru-RU')}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="bg-white text-black p-4 rounded-lg border-4 border-black flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{u.name || u.phone}</div>
                    <div className="text-sm text-black flex items-center gap-2">
                      <PhoneCopy value={u.phone} />
                      <span>• {u.role}</span>
                    </div>
                    {u.proposed_city_name && (
                      <div className="text-xs text-orange-600">Предложенный город: {u.proposed_city_name}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold">Город:</label>
                  <select
                    value={u.city_id || ''}
                    onChange={(e) => handleAssignCity(u.id, e.target.value || null)}
                    className="flex-1 px-3 py-2 border-2 border-black rounded-lg bg-white text-black"
                  >
                    <option value="">Не указан</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setEditingProduct(null)
                setProductShopId(shops[0]?.id || null)
                setShowProductForm(true)
              }}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              + Добавить товар
            </button>

            {showProductForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black"
              >
                <h3 className="text-xl font-bold mb-4">
                  {editingProduct ? 'Редактировать товар' : 'Новый товар'}
                </h3>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div>
                    <label className="block font-bold mb-2 text-black">Магазин</label>
                    <select
                      name="shop_id"
                      value={effectiveProductShopId}
                      onChange={(e) => setProductShopId(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    >
                      <option value="" disabled>
                        Выберите магазин
                      </option>
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Название</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingProduct?.name}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Описание</label>
                    <textarea
                      name="description"
                      defaultValue={editingProduct?.description || ''}
                      rows={3}
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Цена</label>
                    <input
                      type="number"
                      name="price"
                      defaultValue={editingProduct?.price}
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Ссылка на изображение</label>
                    <input
                      type="url"
                      name="image_url"
                      defaultValue={editingProduct?.image_url || ''}
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Категория</label>
                    {availableProductCategories.length === 0 ? (
                      <div className="text-sm text-red-600">
                        Для выбранного магазина нет категорий. Добавьте категории во вкладке «Категории».
                      </div>
                    ) : (
                      <select
                        name="category"
                        defaultValue={editingProduct?.category || availableProductCategories[0]?.id}
                        required
                        className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                      >
                        {availableProductCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="in_stock"
                        defaultChecked={editingProduct?.in_stock ?? true}
                        className="w-5 h-5"
                      />
                      <span className="font-bold text-black">В наличии</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-black py-2 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductForm(false)
                        setEditingProduct(null)
                      }}
                      className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="space-y-2">
              {products.map(product => (
                <div key={product.id} className="bg-white text-black p-4 rounded-lg border-4 border-black flex items-center justify-between">
                  <div>
                    <div className="font-bold">{product.name}</div>
                    <div className="text-sm text-black">{product.price} ₽ • {categories.find(c => c.id === product.category)?.name}</div>
                    <div className="text-xs text-gray-600">
                      {shops.find((shop) => shop.id === product.shop_id)?.name || '—'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingProduct(product)
                        setProductShopId(product.shop_id)
                        setShowProductForm(true)
                      }}
                      className="bg-blue-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setEditingCategory(null)
                setCategoryShopId(shops[0]?.id || null)
                setShowCategoryForm(true)
              }}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              + Добавить категорию
            </button>

            {showCategoryForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black"
              >
                <h3 className="text-xl font-bold mb-4">
                  {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
                </h3>
                <form onSubmit={handleSaveCategory} className="space-y-4">
                  <div>
                    <label className="block font-bold mb-2 text-black">Магазин</label>
                    <select
                      name="shop_id"
                      value={editingCategory?.shop_id || categoryShopId || ''}
                      onChange={(e) => setCategoryShopId(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    >
                      <option value="" disabled>Выберите магазин</option>
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Название</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingCategory?.name}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-black py-2 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false)
                        setEditingCategory(null)
                      }}
                      className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="bg-white text-black p-4 rounded-lg border-4 border-black flex items-center justify-between">
                  <div>
                    <div className="font-bold">{category.name}</div>
                    <div className="text-xs text-gray-600">
                      {shops.find((shop) => shop.id === category.shop_id)?.name || '—'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(category)
                        setCategoryShopId(category.shop_id)
                        setShowCategoryForm(true)
                      }}
                      className="bg-blue-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="space-y-4">
            <div className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3">
              <h3 className="font-bold text-lg">Глобальная наценка на товары</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={markupDraft}
                  onChange={(e) => setMarkupDraft(Number(e.target.value))}
                  className="px-4 py-2 border-2 border-black rounded-lg w-32"
                />
                <span>%</span>
                <button
                  onClick={handleSaveMarkup}
                  className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingShop(null)
                setShowShopForm(true)
              }}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              + Добавить магазин
            </button>

            {showShopForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black"
              >
                <h3 className="text-xl font-bold mb-4">
                  {editingShop ? 'Редактировать магазин' : 'Новый магазин'}
                </h3>
                <form onSubmit={handleSaveShop} className="space-y-4">
                  <div>
                    <label className="block font-bold mb-2 text-black">Город</label>
                    <select
                      name="city_id"
                      defaultValue={editingShop?.city_id || user?.city_id || cities[0]?.id || ''}
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                      required
                    >
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Название</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingShop?.name || ''}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-black">Описание</label>
                    <textarea
                      name="description"
                      defaultValue={editingShop?.description || ''}
                      rows={3}
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-black py-2 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowShopForm(false)
                        setEditingShop(null)
                      }}
                      className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="space-y-2">
              {shops.map((shop) => {
                const cityName = cities.find((c) => c.id === shop.city_id)?.name || '—'
                return (
                  <div key={shop.id} className="bg-white text-black p-4 rounded-lg border-4 border-black flex items-center justify-between">
                    <div>
                      <div className="font-bold">{shop.name}</div>
                      <div className="text-sm text-gray-600">{cityName}</div>
                      {shop.description && <div className="text-xs text-gray-600">{shop.description}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingShop(shop)
                          setShowShopForm(true)
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDeleteShop(shop.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'cities' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setEditingCity(null)
                setShowCityForm(true)
              }}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              + Добавить город
            </button>

            {showCityForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-black p-6 rounded-lg border-4 border-black"
              >
                <h3 className="text-xl font-bold mb-4">
                  {editingCity ? 'Редактировать город' : 'Новый город'}
                </h3>
                <form onSubmit={handleSaveCity} className="space-y-4">
                  <div>
                    <label className="block font-bold mb-2 text-black">Название</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingCity?.name || ''}
                      required
                      className="w-full px-4 py-2 bg-white text-black rounded-lg border-2 border-black focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-black py-2 px-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCityForm(false)
                        setEditingCity(null)
                      }}
                      className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="space-y-2">
              {cities.map((city) => (
                <div key={city.id} className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{city.name}</div>
                      <div className="text-xs text-gray-600">{city.is_active ? 'Активен' : 'Скрыт'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCity(city)
                          setShowCityForm(true)
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDeleteCity(city.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold">Доставка и сборка:</label>
                    <input
                      type="number"
                      step="1"
                      value={cityFeeDrafts[city.id] ?? ''}
                      onChange={(e) =>
                        setCityFeeDrafts((prev) => ({ ...prev, [city.id]: e.target.value }))
                      }
                      className="px-3 py-1 border-2 border-black rounded-lg w-32"
                    />
                    <span>₽</span>
                    <button
                      onClick={() => handleUpdateCityFee(city.id)}
                      className="bg-black text-white px-3 py-1 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="space-y-4">
            {cityProposals.length === 0 && (
              <div className="bg-white text-black p-4 rounded-lg border-4 border-black text-center">
                Нет заявок от пользователей
              </div>
            )}
            {cityProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="bg-white text-black p-4 rounded-lg border-4 border-black space-y-3"
              >
                <div>
                  <p className="font-bold mb-1">Название города</p>
                  <input
                    type="text"
                    value={proposalNames[proposal.id] ?? proposal.proposed_name ?? ''}
                    onChange={(e) =>
                      setProposalNames((prev) => ({
                        ...prev,
                        [proposal.id]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border-2 border-black rounded-lg"
                  />
                </div>
                {proposal.requester && (
                  <p className="text-sm">
                    Пользователь: {proposal.requester.name || proposal.requester.phone}{' '}
                    (<PhoneCopy value={proposal.requester.phone} />)
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveProposal(proposal)}
                    className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-600 transition-colors"
                  >
                    Добавить
                  </button>
                  <button
                    onClick={() => handleRejectProposal(proposal.id)}
                    className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-red-600 transition-colors"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

