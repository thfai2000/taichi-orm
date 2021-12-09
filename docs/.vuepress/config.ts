import { defineUserConfig } from 'vuepress'
import { path } from '@vuepress/utils'
import type { DefaultThemeOptions } from 'vuepress'

export default defineUserConfig<DefaultThemeOptions>({
  lang: 'en-US',
  title: 'Taichi ORM',
  base: '/taichi-orm/',
  description: 'A developer-friendly SQL ORM',
  markdown: {
    customComponent: undefined
  },
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
    
    sidebar: [
      {
        text: 'Guide',
        link: '/guide/',
        children: [
          '/guide/README.md',
          '/guide/getting-started.md',
          {
            text: 'Concepts',
            children: [
              '/guide/concepts/orm',
              '/guide/concepts/database-context',
              '/guide/concepts/schema',
              '/guide/concepts/model',
              '/guide/concepts/property',
              '/guide/concepts/property-type',
              '/guide/concepts/relations',
              '/guide/concepts/model-api',
              '/guide/concepts/query-builder'
            ]
          },
          {
            text: 'Query Examples',
            children: [
              '/guide/query-examples/operators'
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
      
      {text: 'Playground', link: '/playground'},
      
      {
        text: 'Reference',
        link: '/reference/',
        children: [
          '/reference/scalar.md', 
          '/reference/config.md'],
      },
      
    ],
  },
})