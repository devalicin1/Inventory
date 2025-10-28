import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

export async function createProductionOrder(input: any) {
  const fn = httpsCallable(functions, 'createProductionOrder')
  const res = await fn(input)
  return res.data
}

