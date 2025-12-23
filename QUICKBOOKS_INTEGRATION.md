# QuickBooks Integration Guide

This document explains how to set up and use the QuickBooks integration with your Inventory application.

> 📖 **Yeni başlıyorsanız**: Önce [QUICKBOOKS_SETUP_GUIDE.md](./QUICKBOOKS_SETUP_GUIDE.md) dosyasındaki adım adım kurulum rehberini takip edin!

## Implementation Status

### ✅ Completed Features

- [x] **Backend API Service** (`functions/src/quickbooks.ts`)
  - OAuth 2.0 authentication flow
  - Token management with automatic refresh
  - Product synchronization to QuickBooks
  - Inventory synchronization from QuickBooks
  - Invoice creation support

- [x] **Frontend API Client** (`apps/web/src/api/quickbooks.ts`)
  - QuickBooks connection management
  - Product synchronization functions
  - Inventory synchronization functions
  - Invoice creation functions

- [x] **Settings UI Integration** (`apps/web/src/routes/Settings.tsx`)
  - QuickBooks tab in Settings page
  - Connection status display
  - Configuration form (Client ID, Secret, Redirect URI, Environment)
  - Connect button with OAuth flow
  - Product sync button
  - Inventory sync button

- [x] **OAuth Callback Handler** (`apps/web/src/routes/QuickBooksCallback.tsx`)
  - Callback route handler
  - Authorization code processing
  - Success/error status display
  - Automatic redirect to settings

- [x] **Firebase Functions Endpoints**
  - `getQuickBooksAuthUrl`: Generate OAuth URL
  - `quickBooksOAuthCallback`: Handle OAuth callback
  - `saveQuickBooksConfig`: Save configuration
  - `getQuickBooksConfig`: Get connection status
  - `syncProductToQuickBooks`: Sync product to QuickBooks
  - `syncInventoryFromQuickBooks`: Sync inventory from QuickBooks
  - `getQuickBooksItems`: Get QuickBooks items
  - `createQuickBooksInvoice`: Create invoice

### 🚧 To Do / Future Enhancements

- [ ] **Error Handling Improvements**
  - [ ] Better error messages for API failures
  - [ ] Retry logic for failed syncs
  - [ ] Detailed sync logs/history

- [ ] **Sync Features**
  - [ ] Automatic scheduled sync (cron job)
  - [ ] Selective product sync (choose which products to sync)
  - [ ] Batch sync with progress indicator
  - [ ] Sync conflict resolution (when both systems have changes)
  - [ ] Two-way inventory sync (bidirectional)

- [ ] **Product Mapping**
  - [ ] Custom field mapping between systems
  - [ ] Category/Group mapping
  - [ ] Price list synchronization
  - [ ] Product image sync

- [ ] **Invoice Integration**
  - [ ] UI for creating invoices from sales orders
  - [ ] Automatic invoice creation on order completion
  - [ ] Invoice status tracking
  - [ ] Payment synchronization

- [ ] **Purchase Orders**
  - [ ] Sync purchase orders to QuickBooks
  - [ ] Receive purchase orders from QuickBooks
  - [ ] Vendor synchronization

- [ ] **Customer Management**
  - [ ] Sync customers to QuickBooks
  - [ ] Import customers from QuickBooks
  - [ ] Customer address synchronization

- [ ] **Reports & Analytics**
  - [ ] Sync status dashboard
  - [ ] Last sync timestamp
  - [ ] Sync history log
  - [ ] Failed sync items report

- [ ] **UI Improvements**
  - [ ] Sync progress bar with detailed status
  - [ ] Product mapping configuration UI
  - [ ] Sync schedule configuration
  - [ ] Connection test button

- [ ] **Testing**
  - [ ] Unit tests for sync functions
  - [ ] Integration tests with QuickBooks sandbox
  - [ ] E2E tests for OAuth flow

- [ ] **Documentation**
  - [ ] Video tutorial
  - [ ] Step-by-step setup guide with screenshots
  - [ ] Common use cases examples

## Overview

The QuickBooks integration allows you to:
- ✅ Sync products between your Inventory app and QuickBooks
- ✅ Sync inventory levels (one-way: QuickBooks → Inventory)
- 🚧 Create invoices in QuickBooks (API ready, UI pending)
- 🚧 Import QuickBooks items into your inventory (API ready, UI pending)

## Prerequisites

1. **QuickBooks Developer Account**: Sign up at [Intuit Developer](https://developer.intuit.com/)
2. **Create an App**: Create a new app in the Intuit Developer dashboard
3. **Get Credentials**: You'll need:
   - Client ID
   - Client Secret
   - Redirect URI (must match your app's callback URL)

## Setup Steps

### 1. Configure QuickBooks App in Intuit Developer

1. Go to [Intuit Developer Dashboard](https://developer.intuit.com/app/developer/dashboard)
2. Create a new app or select an existing one
3. Note your **Client ID** and **Client Secret**
4. Add your redirect URI (e.g., `https://yourdomain.com/quickbooks/callback`)

### 2. Configure in Your Application

#### Option A: Through Settings UI (Recommended)

1. Navigate to **Settings** in your application
2. Find the **QuickBooks Integration** section
3. Enter your:
   - Client ID
   - Client Secret
   - Redirect URI
   - Environment (Sandbox or Production)
4. Click **Save Configuration**

#### Option B: Direct API Call

```typescript
import { saveQuickBooksConfig } from './api/quickbooks'

await saveQuickBooksConfig(workspaceId, {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'https://yourdomain.com/quickbooks/callback',
  environment: 'sandbox', // or 'production'
})
```

### 3. Connect QuickBooks Account

1. After saving configuration, click **Connect to QuickBooks**
2. You'll be redirected to QuickBooks authorization page
3. Sign in with your QuickBooks account
4. Authorize the application
5. You'll be redirected back with an authorization code
6. The system will automatically exchange the code for access tokens

### 4. Verify Connection

Check the connection status in Settings. You should see:
- ✅ Connected
- Environment: Sandbox/Production
- Company ID (Realm ID)

## Usage

### Using the UI (Recommended)

1. Go to **Settings** → **QuickBooks** tab
2. Configure your QuickBooks credentials
3. Click **Connect to QuickBooks** to authorize
4. Use **Sync Products to QuickBooks** button to sync all products
5. Use **Sync Inventory from QuickBooks** button to update stock levels

### Using the API

#### Sync Product to QuickBooks

```typescript
import { syncProductToQuickBooks } from './api/quickbooks'

const quickBooksItemId = await syncProductToQuickBooks(workspaceId, {
  id: 'product-id',
  name: 'Product Name',
  sku: 'SKU-123',
  qtyOnHand: 100,
  pricePerBox: 29.99,
  uom: 'Box',
})
```

#### Sync Inventory from QuickBooks

```typescript
import { syncInventoryFromQuickBooks } from './api/quickbooks'

await syncInventoryFromQuickBooks(workspaceId)
```

This will:
- Fetch all inventory items from QuickBooks
- Match them with your products by SKU
- Update inventory levels in your system

**Note:** Currently this is one-way sync (QuickBooks → Inventory). Two-way sync is planned for future release.

### Create Invoice in QuickBooks

```typescript
import { createQuickBooksInvoice } from './api/quickbooks'

const invoiceId = await createQuickBooksInvoice(workspaceId, {
  TxnDate: '2024-01-15',
  DueDate: '2024-02-15',
  CustomerRef: {
    value: 'customer-id',
    name: 'Customer Name',
  },
  Line: [
    {
      DetailType: 'SalesItemLineDetail',
      Amount: 299.90,
      SalesItemLineDetail: {
        ItemRef: { value: 'item-id', name: 'Product Name' },
        UnitPrice: 29.99,
        Qty: 10,
      },
      Description: 'Product description',
    },
  ],
})
```

## API Reference

### Frontend Functions

All functions are available in `apps/web/src/api/quickbooks.ts`:

- `getQuickBooksAuthUrl(workspaceId)`: Get OAuth authorization URL
- `quickBooksOAuthCallback(workspaceId, authCode, realmId)`: Handle OAuth callback
- `saveQuickBooksConfig(workspaceId, config)`: Save configuration
- `getQuickBooksConfig(workspaceId)`: Get connection status
- `syncProductToQuickBooks(workspaceId, product, itemId?)`: Sync product
- `syncInventoryFromQuickBooks(workspaceId)`: Sync inventory
- `getQuickBooksItems(workspaceId)`: Get all QuickBooks items
- `createQuickBooksInvoice(workspaceId, invoice)`: Create invoice

### Backend Functions

All functions are available in `functions/src/quickbooks.ts` and exposed via Firebase Functions.

## Security Notes

- **Client Secret** is stored securely in Firestore (workspace settings)
- **Access Tokens** are automatically refreshed when expired
- **OAuth tokens** are stored per workspace, isolated from other workspaces
- Never expose Client Secret in frontend code

## Troubleshooting

### "QuickBooks not configured"
- Make sure you've saved the configuration with Client ID and Secret
- Check that the configuration was saved correctly in Firestore

### "Token expired" or "Unauthorized"
- The system should automatically refresh tokens
- If issues persist, disconnect and reconnect QuickBooks

### "Product not found" during sync
- Ensure products have matching SKUs between systems
- Check that the product exists in QuickBooks

### OAuth callback errors
- Verify redirect URI matches exactly in Intuit Developer dashboard
- Check that the callback URL is accessible
- Ensure the authorization code hasn't expired (codes expire quickly)

## Testing

Use **Sandbox** environment for testing:
1. Set `environment: 'sandbox'` in configuration
2. Use sandbox QuickBooks account for testing
3. Switch to `production` when ready for live use

## Rate Limits

QuickBooks API has rate limits:
- **500 requests per minute** per company
- **10000 requests per day** per company

The integration handles rate limiting automatically with retries.

## Current Limitations

1. **One-way inventory sync**: Currently only syncs from QuickBooks to Inventory app
2. **Manual sync**: No automatic scheduled sync (requires manual button click)
3. **SKU matching only**: Products must have matching SKUs for proper sync
4. **No conflict resolution**: If both systems have changes, QuickBooks data takes precedence
5. **No sync history**: No log of what was synced and when

## Support

For QuickBooks API issues, refer to:
- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs)
- [Intuit Developer Support](https://help.developer.intuit.com/)

## Contributing

To add new features to the QuickBooks integration:

1. Backend changes: Edit `functions/src/quickbooks.ts`
2. Frontend API: Edit `apps/web/src/api/quickbooks.ts`
3. UI changes: Edit `apps/web/src/routes/Settings.tsx` (QuickBooksTab component)
4. Add Firebase Function: Edit `functions/src/index.ts`
5. Update this document with new features

