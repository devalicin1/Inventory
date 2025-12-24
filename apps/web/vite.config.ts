import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/__\/firebase/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      manifest: {
        name: 'Itory',
        short_name: 'Itory',
        description: 'Inventory Management System',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { 
            src: 'https://firebasestorage.googleapis.com/v0/b/inventory-ce0c2.firebasestorage.app/o/Logos%2Ficon.png?alt=media', 
            sizes: '192x192', 
            type: 'image/png',
            purpose: 'any'
          },
          { 
            src: 'https://firebasestorage.googleapis.com/v0/b/inventory-ce0c2.firebasestorage.app/o/Logos%2Ficon.png?alt=media', 
            sizes: '512x512', 
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  server: {
    historyApiFallback: true,
  },
})
