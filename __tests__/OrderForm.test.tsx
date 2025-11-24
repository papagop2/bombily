import React from 'react'
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderForm from '@/components/OrderForm'
import { useStore } from '@/lib/store'
import type { User } from '@/lib/supabase'

const baseUser: User = {
  id: 'test-user',
  phone: '+70000000000',
  role: 'passenger',
  created_at: new Date().toISOString(),
  is_first_user: false,
}

describe('OrderForm', () => {
  afterEach(() => {
    useStore.setState({ user: null })
  })

  it('shows warning when city is not confirmed', () => {
    useStore.setState({ user: { ...baseUser, city_id: null } })
    render(<OrderForm type="taxi" userId="test-user" onOrderCreated={() => {}} />)
    expect(screen.getByText(/Город не подтвержден/)).toBeInTheDocument()
  })
})

