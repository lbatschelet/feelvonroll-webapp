import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        issue: resolve(__dirname, 'issue/index.html'),
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    // Redirect /issue to /issue/ so the MPA entry resolves correctly
    middlewareMode: false,
  },
  plugins: [
    {
      name: 'mpa-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          if (req.url === '/issue') {
            res.writeHead(301, { Location: '/issue/' })
            res.end()
            return
          }
          // Dev convenience for iOS-home-screen-friendly path routes:
          // serve the main app entry for /kiosk/<station>, /station/<station>, /s/<station>.
          if (url.startsWith('/kiosk/') || url.startsWith('/station/') || url.startsWith('/s/')) {
            req.url = '/'
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url || ''
          if (url.startsWith('/kiosk/') || url.startsWith('/station/') || url.startsWith('/s/')) {
            req.url = '/'
          }
          next()
        })
      },
    },
  ],
})
