import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

// Polyfill require for vite-plugin-pwa in Node ESM
if (typeof globalThis.require === 'undefined') {
  // @ts-expect-error polyfill for vite-plugin-pwa
  globalThis.require = createRequire(import.meta.url);
}

// Ensure local temporary directory is used to avoid sandbox EPERM on AppData
const localTmp = path.resolve('.tmp');
if (!fs.existsSync(localTmp)) {
  fs.mkdirSync(localTmp, { recursive: true });
}
process.env.TEMP = localTmp;
process.env.TMP = localTmp;
// @ts-expect-error symbol temp directory cache for temp-dir package
global[Symbol.for('__RESOLVED_TEMP_DIRECTORY__')] = localTmp;

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Naatyavedam Library',
        short_name: 'Naatyavedam',
        description: 'Classical Kuchipudi Dance Music Library',
        theme_color: '#5E7A68',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['music', 'education', 'entertainment'],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'audio',
                accept: [
                  'audio/*',
                  'audio/mpeg',
                  'audio/mp3',
                  'audio/wav',
                  'audio/x-wav',
                  'audio/aac',
                  'audio/x-aac',
                  'audio/m4a',
                  'audio/x-m4a',
                  'audio/mp4',
                  'audio/ogg',
                  'audio/opus',
                  'audio/flac',
                  'audio/x-flac',
                  'audio/webm',
                  'audio/amr',
                  'audio/3gpp',
                  'application/ogg',
                  '.mp3',
                  '.m4a',
                  '.wav',
                  '.aac',
                  '.ogg',
                  '.opus',
                  '.flac',
                  '.mp4',
                  '.amr',
                  '.3gp',
                  '.weba',
                  '.webm',
                ],
              },
            ],
          },
        },
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['/sw-share-target.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'worker',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'asset-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
});
