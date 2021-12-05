# Typescript Support


## type ModelRepository

Some IDE (like VSCode) can provide typescript hints if the types are well-determined.
![Typescript hints](../images/properties-suggestion.png)

For the `ORMConfig`, if you use `models` to register your Models, the type of `ModelRepository` can be determined automatically.

<CodeGroup>
  <CodeGroupItem title="TS" active>

```ts{5}
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

```js{3}
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


But the `type` of the respository cannot be determined if `modelsPath` is used for Model registration.
If you want the typescript hints shown propertly, you have to get the `ModelRepository` by Model class so that the `type` can be inferred.


<CodeGroup>
  <CodeGroupItem title="TS" active>

```ts{8}
import Product from './models/product'

const orm = new ORM({
    modelsPath: './models'
})

// p: ModelRepository<typeof Product>
let p = orm.getContext().getRepository(Product)

```
  </CodeGroupItem>
  <CodeGroupItem title="JS">

```js{5}
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


