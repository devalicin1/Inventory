import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'firebase/firestore'

/**
 * Recalculates qtyOnHand for all products based on their transaction history
 * Run this script to fix stock discrepancies
 */
async function recalculateAllProductStock(workspaceId: string) {
    console.log(`Starting stock recalculation for workspace: ${workspaceId}`)

    // Get all products
    const productsCol = collection(db, 'workspaces', workspaceId, 'products')
    const productsSnap = await getDocs(productsCol)

    console.log(`Found ${productsSnap.size} products`)

    let updated = 0
    let errors = 0

    for (const productDoc of productsSnap.docs) {
        const productId = productDoc.id
        const productData = productDoc.data()

        try {
            // Get all transactions for this product
            const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
            const txnsQuery = query(
                txnsCol,
                where('productId', '==', productId),
                orderBy('timestamp', 'asc')
            )
            const txnsSnap = await getDocs(txnsQuery)

            // Calculate total from transactions
            let calculatedQty = 0
            txnsSnap.docs.forEach(txnDoc => {
                const txn = txnDoc.data()
                calculatedQty += Number(txn.qty || 0)
            })

            const currentQty = productData.qtyOnHand || 0

            // Only update if there's a discrepancy
            if (calculatedQty !== currentQty) {
                console.log(`Product ${productData.sku || productId}: Current=${currentQty}, Calculated=${calculatedQty}, Transactions=${txnsSnap.size}`)

                const productRef = doc(db, 'workspaces', workspaceId, 'products', productId)
                await updateDoc(productRef, {
                    qtyOnHand: calculatedQty
                })

                updated++
            }
        } catch (error) {
            console.error(`Error processing product ${productId}:`, error)
            errors++
        }
    }

    console.log(`\nRecalculation complete:`)
    console.log(`- Products updated: ${updated}`)
    console.log(`- Errors: ${errors}`)
    console.log(`- Total processed: ${productsSnap.size}`)
}

// Usage example (you'll need to provide your workspace ID)
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'your-workspace-id-here'

recalculateAllProductStock(WORKSPACE_ID)
    .then(() => {
        console.log('Script completed successfully')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Script failed:', error)
        process.exit(1)
    })
