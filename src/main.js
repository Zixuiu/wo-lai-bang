import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import IconFont from './components/icon-font/icon-font.vue'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.component('IconFont', IconFont)
  return {
    app
  }
}
