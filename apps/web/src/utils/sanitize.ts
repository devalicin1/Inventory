const isPlainObject = (v: any) => Object.prototype.toString.call(v) === '[object Object]'

const isFirestoreSentinel = (v: any) =>
  v &&
  typeof v === 'object' &&
  ((typeof (v as any)._methodName === 'string') ||
    (v.constructor && typeof v.constructor.name === 'string' && v.constructor.name.toLowerCase().includes('fieldvalue')))

export function sanitizeForFirestore<T>(value: T): T {
  if (isFirestoreSentinel(value)) return value

  if (Array.isArray(value)) {
    const arr = (value as any[])
      .map((x) => sanitizeForFirestore(x))
      .filter((x) => x !== undefined && !(typeof x === 'number' && !Number.isFinite(x as number)))
    return arr as unknown as T
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      if (typeof v === 'number' && !Number.isFinite(v)) continue
      out[k] = sanitizeForFirestore(v as any)
    }
    return out as T
  }

  return value
}

export function coerceNumberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

