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
    // Redirect /issue to /issue/ so the MPA entry resolves correctly
    middlewareMode: false,
  },
  plugins: [
    {
      name: 'mpa-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/issue') {
            res.writeHead(301, { Location: '/issue/' })
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
})
