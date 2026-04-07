import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // NOUVEAU : On force la séparation de la librairie exceljs pour alléger le fichier principal
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          exceljs: ['exceljs'] 
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 8000000, // Limite montée à 8 Mo
      },
      manifest: {
        name: 'Abattoir Aïd',
        short_name: 'Abattoir',
        description: 'Application de réservation pour l\'abattoir',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});