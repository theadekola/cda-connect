import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  envPrefix:['VITE_','EXPO_PUBLIC_'],
  plugins:[
    react(),
    VitePWA({
      registerType:'autoUpdate',
      includeAssets:['icons/icon-192.png','icons/icon-512.png'],
      manifest:{
        name:'CDA Connect',short_name:'CDA Connect',description:'Community workspace for CDA members',
        theme_color:'#0F8A43',background_color:'#EEF3F8',display:'standalone',start_url:'/',scope:'/',
        icons:[
          {src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},
          {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'},
          {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
        ],
      },
      workbox:{
        maximumFileSizeToCacheInBytes:12*1024*1024,
        navigateFallback:'/index.html',
        cleanupOutdatedCaches:true,
        clientsClaim:true,
        skipWaiting:true,
        runtimeCaching:[
          {urlPattern:({url})=>url.pathname.startsWith('/api/'),handler:'NetworkOnly'},
          {urlPattern:({request})=>request.destination==='image',handler:'CacheFirst',options:{cacheName:'cda-images',expiration:{maxEntries:150,maxAgeSeconds:2592000}}},
        ],
      },
    }),
  ],
  resolve:{
    extensions:['.web.tsx','.web.ts','.tsx','.ts','.web.jsx','.web.js','.jsx','.js','.json'],
    alias:[
      {find:'@',replacement:path.resolve(import.meta.dirname,'src')},
      {find:'@/components/InAppAudioCall',replacement:path.resolve(import.meta.dirname,'src/components/InAppAudioCall.web.tsx')},
    ],
  },
  build:{outDir:'dist-web',sourcemap:true},
});
