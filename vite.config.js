import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Bergerie Languedocienne - Aïd',
        short_name: 'Aïd Manager',
        description: 'Gestion des réservations et retraits pour l\'Aïd',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // C'est ça qui enlève la barre d'URL du navigateur
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png', // On va créer ces images juste après
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})