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
            {
              text: 'Concepts',
              children: [
                '/guide/concepts/schema-property',
                '/guide/concepts/database-context',
                '/guide/concepts/model-api',
                '/guide/concepts/query-builder'
              ]
            },
            {
              text: 'Examples',
              children: [
                '/guide/examples/access-control'
              ]
            }
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