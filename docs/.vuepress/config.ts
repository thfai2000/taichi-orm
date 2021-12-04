import { defineUserConfig } from 'vuepress'
import type { DefaultThemeOptions } from 'vuepress'

export default defineUserConfig<DefaultThemeOptions>({
  lang: 'en-US',
  title: 'Taichi ORM',
  base: '/taichi-orm/',
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
      // {
      //   text: 'Group',
      //   children: ['/group/foo.md', '/group/bar.md'],
      // }
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
                '/guide/concepts/orm',
                '/guide/concepts/database-context',
                '/guide/concepts/model-property',
                '/guide/concepts/model-api',
                '/guide/concepts/query-builder'
              ]
            },
            '/guide/typescript-support.md',
            {
              text: 'Use Cases',
              children: [
                '/guide/use-cases/scalar-transform',
                '/guide/use-cases/access-control'
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