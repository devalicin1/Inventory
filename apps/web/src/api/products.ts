import { db, storage } from '../lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { generateQRCodeDataURL } from '../utils/qrcode'
import { generateBarcodeDataURL } from '../utils/barcode'
import { sanitizeForFirestore, coerceNumberOrNull } from '../utils/sanitize'

export interface ProductInput {
  name: string
  sku: string
  uom: string
  minStock: number
  reorderPoint: number
  status: 'active' | 'inactive'
  groupId?: string | null
  imageFile?: File | null
  imageFiles?: File[] | null
  // Inventory & pricing
  quantityBox?: number
  minLevelBox?: number
  pricePerBox?: number
  pcsPerBox?: number
  // Rich info
  category?: string
  subcategory?: string
  materialSeries?: string
  boardType?: string
  gsm?: string
  dimensionsWxLmm?: string
  cal?: string
  tags?: string[]
  notes?: string
}

export interface Product extends ProductInput {
  id: string
  imageUrl?: string
  galleryUrls?: string[]
  qrUrl?: string
  barcodeUrl?: string
  createdAt?: any
  updatedAt?: any
  qtyOnHand?: number
  totalValue?: number
}

export async function listProducts(workspaceId: string): Promise<Product[]> {
  const productsCol = collection(db, 'workspaces', workspaceId, 'products')
  const qy = query(productsCol, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[]
}

export interface Group {
  id: string
  name: string
  parentId?: string | null
}

export async function listGroups(workspaceId: string): Promise<Group[]> {
  const groupsCol = collection(db, 'workspaces', workspaceId, 'groups')
  const qy = query(groupsCol, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Group[]
}

export async function createProduct(workspaceId: string, input: ProductInput): Promise<Product> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create a product')
  }
  const productsCol = collection(db, 'workspaces', workspaceId, 'products')
  const now = serverTimestamp()
  const basePayload = {
    name: input.name?.trim(),
    sku: input.sku?.trim(),
    uom: input.uom?.trim(),
    minStock: Number.isFinite(Number(input.minStock)) ? Number(input.minStock) : 0,
    reorderPoint: Number.isFinite(Number(input.reorderPoint)) ? Number(input.reorderPoint) : 0,
    status: input.status,
    groupId: input.groupId ?? null,
    quantityBox: Number.isFinite(Number(input.quantityBox)) ? Number(input.quantityBox) : 0,
    minLevelBox: Number.isFinite(Number(input.minLevelBox)) ? Number(input.minLevelBox) : 0,
    pricePerBox: coerceNumberOrNull(input.pricePerBox) ?? 0,
    pcsPerBox: Number.isFinite(Number(input.pcsPerBox)) ? Number(input.pcsPerBox) : 0,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    materialSeries: input.materialSeries ?? null,
    boardType: input.boardType ?? null,
    gsm: input.gsm ?? null,
    dimensionsWxLmm: input.dimensionsWxLmm ?? null,
    cal: input.cal ?? null,
    tags: (input.tags ?? []).filter(Boolean),
    notes: input.notes ?? null,
    qtyOnHand: 0,
    createdAt: now,
    updatedAt: now,
  }

  const sanitized = sanitizeForFirestore(basePayload)
  console.log('createProduct sanitized payload ->', sanitized)
  let docRef
  try {
    docRef = await addDoc(productsCol, sanitized as any)
  } catch (err) {
    console.error('createProduct addDoc failed:', err)
    throw err
  }

  let imageUrl: string | undefined
  const galleryUrls: string[] = []
  if (input.imageFile) {
    const imgRef = ref(storage, `workspaces/${workspaceId}/products/${docRef.id}/image`)
    const imgBytes = await input.imageFile.arrayBuffer()
    await uploadBytes(imgRef, new Uint8Array(imgBytes), { contentType: input.imageFile.type || 'image/jpeg' })
    imageUrl = await getDownloadURL(imgRef)
  }
  if (input.imageFiles && input.imageFiles.length > 0) {
    for (let i = 0; i < input.imageFiles.length; i++) {
      const f = input.imageFiles[i]
      const gRef = ref(storage, `workspaces/${workspaceId}/products/${docRef.id}/gallery/${i}`)
      const bytes = await f.arrayBuffer()
      await uploadBytes(gRef, new Uint8Array(bytes), { contentType: f.type || 'image/jpeg' })
      galleryUrls.push(await getDownloadURL(gRef))
    }
  }

  const qrData = await generateQRCodeDataURL(input.sku || docRef.id)
  const barcodeData = await generateBarcodeDataURL(input.sku || docRef.id)

  const qrRef = ref(storage, `workspaces/${workspaceId}/products/${docRef.id}/qr.png`)
  const barRef = ref(storage, `workspaces/${workspaceId}/products/${docRef.id}/barcode.png`)

  // Convert data URLs to bytes
  async function uploadDataUrl(storageRef: any, dataUrl: string) {
    const res = await fetch(dataUrl)
    const buf = await res.arrayBuffer()
    await uploadBytes(storageRef, new Uint8Array(buf), { contentType: 'image/png' })
    return await getDownloadURL(storageRef)
  }

  const [qrUrl, barcodeUrl] = await Promise.all([
    uploadDataUrl(qrRef, qrData),
    uploadDataUrl(barRef, barcodeData),
  ])

  const afterCreateUpdate = sanitizeForFirestore({
    imageUrl: imageUrl ?? null,
    galleryUrls,
    qrUrl,
    barcodeUrl,
    totalValue: (Number(input.quantityBox) || 0) * (coerceNumberOrNull(input.pricePerBox) ?? 0),
    updatedAt: serverTimestamp(),
  })
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'products', docRef.id), afterCreateUpdate)
  } catch (err) {
    console.error('createProduct updateDoc (images/qr/barcode) failed:', err, afterCreateUpdate)
    throw err
  }

  return {
    id: docRef.id,
    ...input,
    imageUrl,
    galleryUrls,
    qrUrl,
    barcodeUrl,
    qtyOnHand: 0,
    totalValue: (input.quantityBox || 0) * (input.pricePerBox || 0),
  }
}

export async function updateProduct(
  workspaceId: string,
  id: string,
  input: Partial<ProductInput>
): Promise<void> {
  const target = doc(db, 'workspaces', workspaceId, 'products', id)

  // Handle optional new images
  let imageUrl: string | undefined
  const galleryUrls: string[] = []

  if (input.imageFile) {
    const imgRef = ref(storage, `workspaces/${workspaceId}/products/${id}/image`)
    const imgBytes = await input.imageFile.arrayBuffer()
    await uploadBytes(imgRef, new Uint8Array(imgBytes), { contentType: input.imageFile.type || 'image/jpeg' })
    imageUrl = await getDownloadURL(imgRef)
  }
  if (input.imageFiles && input.imageFiles.length > 0) {
    for (let i = 0; i < input.imageFiles.length; i++) {
      const f = input.imageFiles[i]
      const gRef = ref(storage, `workspaces/${workspaceId}/products/${id}/gallery/${i}`)
      const bytes = await f.arrayBuffer()
      await uploadBytes(gRef, new Uint8Array(bytes), { contentType: f.type || 'image/jpeg' })
      galleryUrls.push(await getDownloadURL(gRef))
    }
  }

  // Recompute total value if price or quantity changed
  const totalValue = (Number(input.quantityBox) || 0) * (coerceNumberOrNull(input.pricePerBox) ?? 0)

  const updatePayload = sanitizeForFirestore({
    ...(input as any),
    ...(imageUrl ? { imageUrl } : {}),
    ...(galleryUrls.length ? { galleryUrls } : {}),
    ...(input.quantityBox !== undefined || input.pricePerBox !== undefined
      ? { totalValue }
      : {}),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(target, updatePayload as any)
}


