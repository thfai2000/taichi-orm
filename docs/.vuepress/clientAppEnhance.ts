import { defineClientAppEnhance } from '@vuepress/client'
import Playground from './components/Playground.vue'

export default defineClientAppEnhance(({ app, router, siteData }) => {
  app.component('Playground', Playground)
})