import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'myShopCare',
        short_name: 'myShopCare',
        description: 'Your shop, simplified',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1f2e',
        theme_color: '#1a1f2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache the app shell + static assets so the app can repaint instantly
        // from cache instead of showing a blank screen while the OS-discarded
        // tab re-fetches everything over the network.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Never serve stale/cached responses for Supabase API calls — only
            // the static shell should be cached, not live business data.
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  server: { port: 5174 }
})