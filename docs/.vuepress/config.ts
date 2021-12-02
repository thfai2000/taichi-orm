import { defineUserConfig } from 'vuepress'
import type { DefaultThemeOptions } from 'vuepress'

export default defineUserConfig<DefaultThemeOptions>({
  lang: 'en-US',
  title: 'Taichi ORM',
  description: 'A developer-friendly SQL ORM',
  themeConfig: {
    repo: 'thfai2000/taichi-orm',
    navbar: [
      // NavbarItem
      {
        text: 'Guide',
        link: '/guide/',
      },
      // NavbarGroup
      {
        text: 'Group',
        children: ['/group/foo.md', '/group/bar.md'],
      }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          children: [
            '/guide/README.md', 
            '/guide/getting-started.md',
            '/guide/concepts',
            '/guide/model-api'
          ]
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          children: [
            '/reference/scalar.md', 
            '/reference/config.md'],
        },
      ],
    },
  },
})