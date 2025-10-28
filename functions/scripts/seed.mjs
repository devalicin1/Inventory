import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

async function seed() {
  const workspaceId = 'demo-workspace'
  const userId = 'demo-user'

  console.log('Seeding workspace:', workspaceId)

  await db.doc(`workspaces/${workspaceId}`).set({
    name: 'Demo Manufacturing Co.',
    currency: 'USD',
    timezone: 'America/New_York',
    plan: { tier: 'free-dev', limits: { users: 10, skus: 1000 } },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
  }, { merge: true })

  await db.doc(`workspaces/${workspaceId}/users/${userId}`).set({
    role: 'owner',
    permissions: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
  }, { merge: true })

  const locations = [
    { id: 'loc-1', name: 'Main Warehouse', type: 'warehouse', parentPath: '', fullPath: 'Main Warehouse', isActive: true },
    { id: 'loc-2', name: 'Production Floor', type: 'production', parentPath: '', fullPath: 'Production Floor', isActive: true },
    { id: 'loc-3', name: 'Quality Control', type: 'qc', parentPath: '', fullPath: 'Quality Control', isActive: true },
  ]
  for (const loc of locations) {
    await db.doc(`workspaces/${workspaceId}/locations/${loc.id}`).set({
      ...loc,
      workspaceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    }, { merge: true })
  }

  const products = [
    { id: 'prod-1', name: 'Widget A', sku: 'WID-A-001', uom: 'pcs', minStock: 10, reorderPoint: 5, trackSerials: false, trackBatches: true, defaultLocationId: 'loc-1', status: 'active', images: [] },
    { id: 'prod-2', name: 'Widget B', sku: 'WID-B-002', uom: 'pcs', minStock: 20, reorderPoint: 10, trackSerials: false, trackBatches: true, defaultLocationId: 'loc-1', status: 'active', images: [] },
    { id: 'comp-1', name: 'Component C', sku: 'COMP-C-003', uom: 'kg', minStock: 5, reorderPoint: 2, trackSerials: false, trackBatches: false, defaultLocationId: 'loc-1', status: 'active', images: [] },
  ]
  for (const p of products) {
    await db.doc(`workspaces/${workspaceId}/products/${p.id}`).set({
      ...p,
      workspaceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    }, { merge: true })
  }

  const boms = [
    { id: 'bom-1', productId: 'prod-1', version: '1.0', lines: [{ componentId: 'comp-1', qtyPer: 0.5, scrapPct: 5 }] },
    { id: 'bom-2', productId: 'prod-2', version: '1.0', lines: [{ componentId: 'comp-1', qtyPer: 1.0, scrapPct: 10 }] },
  ]
  for (const bom of boms) {
    await db.doc(`workspaces/${workspaceId}/boms/${bom.id}`).set({
      ...bom,
      workspaceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    }, { merge: true })
  }

  await db.doc(`workspaces/${workspaceId}/workflows/wf-1`).set({
    name: 'Production Tasks',
    entity: 'task',
    isDefault: true,
    stages: [
      { id: 'open', name: 'Open', color: '#6B7280', isTerminal: false, wipLimit: 10 },
      { id: 'progress', name: 'In Progress', color: '#3B82F6', isTerminal: false, wipLimit: 5 },
      { id: 'blocked', name: 'Blocked', color: '#EF4444', isTerminal: false, wipLimit: 3 },
      { id: 'done', name: 'Done', color: '#10B981', isTerminal: true },
    ],
    workspaceId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
  }, { merge: true })

  await db.doc(`workspaces/${workspaceId}/stock/stock-1`).set({
    productId: 'comp-1',
    locationId: 'loc-1',
    batchId: null,
    serialId: null,
    qtyOnHand: 100,
    avgCost: 5.5,
    workspaceId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
  }, { merge: true })

  console.log('Seed completed.')
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})


