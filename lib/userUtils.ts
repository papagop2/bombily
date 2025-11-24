export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

export function phoneToEmail(phone: string): string {
  const normalized = normalizeDigits(phone)
  return `${normalized}@bombily.local`
}

function normalizeDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length ? digits : 'unknown'
}

export function ensurePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('7')) {
    return `+${digits}`
  }
  if (digits.startsWith('8')) {
    return `+7${digits.slice(1)}`
  }
  return `+${digits}`
}

