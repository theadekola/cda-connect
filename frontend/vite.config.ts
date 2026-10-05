import {languagePlugin} from './languagePlugin';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({define:{__CDA_BUILD_TIME__:JSON.stringify(new Date().toISOString())},plugins:[languagePlugin(),react()],build:{outDir:'dist',sourcemap:false,rollupOptions:{output:{entryFileNames:'assets/app-[hash].js',chunkFileNames:'assets/[name]-[hash].js',assetFileNames:'assets/[name]-[hash][extname]'}}},server:{port:5173}});
