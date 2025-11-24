import { describe, expect, it } from 'vitest'
import { ensurePhoneE164, phoneToEmail } from '@/lib/userUtils'

describe('user utils', () => {
  it('normalizes phone numbers to E.164', () => {
    expect(ensurePhoneE164('+7 (999) 123-45-67')).toBe('+79991234567')
    expect(ensurePhoneE164('89991234567')).toBe('+79991234567')
    expect(ensurePhoneE164('123456')).toBe('+123456')
  })

  it('builds deterministic pseudo-email from phone', () => {
    expect(phoneToEmail('+7 (999) 123-45-67')).toBe('79991234567@bombily.local')
  })
})

