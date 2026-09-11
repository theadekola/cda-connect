import {languagePlugin} from './languagePlugin';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({define:{__CDA_BUILD_TIME__:JSON.stringify(new Date().toISOString())},plugins:[languagePlugin(),react()],build:{outDir:'dist',sourcemap:false,rollupOptions:{output:{entryFileNames:'assets/app.js',chunkFileNames:'assets/[name].js',assetFileNames:asset=>asset.names?.some(name=>name.endsWith('.css'))?'assets/app.css':'assets/[name][extname]'}}},server:{port:5173}});
