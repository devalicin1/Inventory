import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore'

// Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyAwnlW9z3YNBg4nbKO4jbwHVLqRC9BEuBQ',
  authDomain: 'inventory-ce0c2.firebaseapp.com',
  projectId: 'inventory-ce0c2',
  storageBucket: 'inventory-ce0c2.firebasestorage.app',
  messagingSenderId: '289537497017',
  appId: '1:289537497017:web:825334baafd0f555a60868',
  measurementId: 'G-X2DBY1NHKN',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function seedDemoData() {
  const workspaceId = 'demo-workspace'
  const userId = 'demo-user-123' // Match the userId from App.tsx

  console.log('Seeding demo data...')

  try {
    // Create workspace
    await setDoc(doc(db, 'workspaces', workspaceId), {
      name: 'Demo Manufacturing Co.',
      currency: 'USD',
      timezone: 'America/New_York',
      plan: {
        tier: 'free-dev',
        limits: {
          users: 10,
          skus: 1000
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId
    })

    // Create user
    await setDoc(doc(db, 'workspaces', workspaceId, 'users', userId), {
      role: 'owner',
      permissions: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId
    })

    // Create locations
    const locations = [
      { id: 'loc-1', name: 'Main Warehouse', type: 'warehouse', parentPath: '', fullPath: 'Main Warehouse', isActive: true },
      { id: 'loc-2', name: 'Production Floor', type: 'production', parentPath: '', fullPath: 'Production Floor', isActive: true },
      { id: 'loc-3', name: 'Quality Control', type: 'qc', parentPath: '', fullPath: 'Quality Control', isActive: true }
    ]

    for (const location of locations) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'locations', location.id), {
        ...location,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    // Create products
    const products = [
      {
        id: 'prod-1',
        name: 'Widget A',
        sku: 'WID-A-001',
        uom: 'pcs',
        minStock: 10,
        reorderPoint: 5,
        trackSerials: false,
        trackBatches: true,
        defaultLocationId: 'loc-1',
        status: 'active',
        images: []
      },
      {
        id: 'prod-2',
        name: 'Widget B',
        sku: 'WID-B-002',
        uom: 'pcs',
        minStock: 20,
        reorderPoint: 10,
        trackSerials: false,
        trackBatches: true,
        defaultLocationId: 'loc-1',
        status: 'active',
        images: []
      },
      {
        id: 'comp-1',
        name: 'Component C',
        sku: 'COMP-C-003',
        uom: 'kg',
        minStock: 5,
        reorderPoint: 2,
        trackSerials: false,
        trackBatches: false,
        defaultLocationId: 'loc-1',
        status: 'active',
        images: []
      }
    ]

    for (const product of products) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'products', product.id), {
        ...product,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    // Create BOMs
    const boms = [
      {
        id: 'bom-1',
        productId: 'prod-1',
        version: '1.0',
        lines: [
          { componentId: 'comp-1', qtyPer: 0.5, scrapPct: 5 }
        ]
      },
      {
        id: 'bom-2',
        productId: 'prod-2',
        version: '1.0',
        lines: [
          { componentId: 'comp-1', qtyPer: 1.0, scrapPct: 10 }
        ]
      }
    ]

    for (const bom of boms) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'boms', bom.id), {
        ...bom,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    // Create workflows
    const workflows = [
      {
        id: 'wf-1',
        name: 'Production Tasks',
        entity: 'task',
        isDefault: true,
        stages: [
          { id: 'open', name: 'Open', color: '#6B7280', isTerminal: false, wipLimit: 10 },
          { id: 'progress', name: 'In Progress', color: '#3B82F6', isTerminal: false, wipLimit: 5 },
          { id: 'blocked', name: 'Blocked', color: '#EF4444', isTerminal: false, wipLimit: 3 },
          { id: 'done', name: 'Done', color: '#10B981', isTerminal: true }
        ]
      }
    ]

    for (const workflow of workflows) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'workflows', workflow.id), {
        ...workflow,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    // Create initial stock
    const stockItems = [
      {
        id: 'stock-1',
        productId: 'comp-1',
        locationId: 'loc-1',
        batchId: null,
        serialId: null,
        qtyOnHand: 100,
        avgCost: 5.50
      }
    ]

    for (const stock of stockItems) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'stock', stock.id), {
        ...stock,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    // Create demo tasks
    const tasks = [
      {
        id: 'task-1',
        title: 'Cut materials for Widget A',
        description: 'Cut 100 pieces of material according to specifications',
        workflowId: 'wf-1',
        stageId: 'open',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'Open',
        links: { productId: 'prod-1' }
      },
      {
        id: 'task-2',
        title: 'Assemble Widget B components',
        description: 'Assemble 50 units of Widget B',
        workflowId: 'wf-1',
        stageId: 'progress',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'med',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        status: 'InProgress',
        links: { productId: 'prod-2' }
      },
      {
        id: 'task-3',
        title: 'Quality check Widget A',
        description: 'Perform quality inspection on completed Widget A units',
        workflowId: 'wf-1',
        stageId: 'blocked',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'urgent',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: 'Blocked',
        links: { productId: 'prod-1' }
      },
      {
        id: 'task-4',
        title: 'Package completed items',
        description: 'Package and label completed Widget B units',
        workflowId: 'wf-1',
        stageId: 'done',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'low',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: 'Done',
        links: { productId: 'prod-2' }
      },
      {
        id: 'task-5',
        title: 'Prepare materials for next production run',
        description: 'Gather and prepare all materials needed for upcoming production batch',
        workflowId: 'wf-1',
        stageId: 'open',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'med',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        status: 'Open',
        links: {}
      }
    ]

    for (const task of tasks) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'tasks', task.id), {
        ...task,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      })
    }

    console.log('Demo data seeded successfully!')
    console.log('Workspace ID:', workspaceId)
    console.log('User ID:', userId)
    console.log(`Created ${tasks.length} demo tasks`)

  } catch (error) {
    console.error('Error seeding data:', error)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoData()
}

export { seedDemoData }
