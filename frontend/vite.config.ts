import {fileURLToPath} from 'node:url';
import {releaseMetadata,releasePlugin} from './buildIdentity.mjs';
import {languagePlugin} from './languagePlugin';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const release=releaseMetadata(fileURLToPath(new URL('.',import.meta.url)));
export default defineConfig({define:{__CDA_BUILD_ID__:JSON.stringify(release.sourceId)},plugins:[languagePlugin(),react(),releasePlugin(release)],build:{target:['es2020','safari15'],outDir:'dist',sourcemap:false,rollupOptions:{output:{entryFileNames:'assets/app-[hash].js',chunkFileNames:'assets/[name]-[hash].js',assetFileNames:'assets/[name]-[hash][extname]'}}},server:{port:5173}});
