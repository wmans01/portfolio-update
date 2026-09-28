import { defineConfig } from 'vite'
import { resolve } from 'path'

function redirectPlayerPath(server) {
  server.middlewares.use((request, response, next) => {
    if (request.url === '/ltp' || request.url?.startsWith('/ltp?')) {
      response.writeHead(308, { Location: `/ltp/${request.url.slice(4)}` })
      response.end()
      return
    }
    next()
  })
}

export default defineConfig({
  plugins: [{
    name: 'redirect-player-path',
    configureServer: redirectPlayerPath,
    configurePreviewServer: redirectPlayerPath,
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dpm: resolve(__dirname, 'dpm/index.html'),
        ltp: resolve(__dirname, 'ltp/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
      },
    },
  },
})
