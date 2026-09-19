import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Relative base so the same bundle works on Vercel (served from /) and on
// GitHub Pages (served from /<repo>/). Routing is hash based for the same
// reason, so no server rewrite rules are required on either host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
