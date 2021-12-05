# Typescript Support

## type ModelRepository

Some IDE (like VSCode) can provide typescript hints.
For the ORM config, if you use `models` to register your Models, the type of `ModelRepository` can be determined automatically.

<CodeGroup>
  <CodeGroupItem title="TS" active>

```ts
import Product from './models/product'

const orm = new ORM({
    models: {
        Product
    }
})

// p: ModelRepository<typeof Product>
let repo = orm.getContext().repos.Product
```
  </CodeGroupItem>
  <CodeGroupItem title="JS">

```js

const orm = new ORM({
    models: {
        Product: require('./models/product')
    }
})

// p: ModelRepository<typeof Product>
let repo = orm.getContext().repos.Product
```
  </CodeGroupItem>
</CodeGroup>


But the Type of the respository cannot be determined if `modelsPath` is used for Model registration.
If you want the typescript hints provided by your IDE, you have to get the `ModelRepository` by Model class.



<CodeGroup>
  <CodeGroupItem title="TS" active>

```ts
import Product from './models/product'

const orm = new ORM({
    modelsPath: './models'
})

// p: ModelRepository<typeof Product>
let p = orm.getContext().getRepository(Product)

```
  </CodeGroupItem>
  <CodeGroupItem title="JS">

```js
const orm = new ORM({
    modelsPath: './models'
})
// p: ModelRepository<typeof Product>
let p = orm.getContext().getRepository(require('./models/product'))
```
  </CodeGroupItem>
</CodeGroup>

## type ModelRecord

## Circular dependencies


