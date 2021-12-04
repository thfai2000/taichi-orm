
# Relations

Typical use cases are querying Related Entities and filtering related Entities
Let's say a Product belongs to a Shop. 
We can define ComputeProperty called 'shop' or 'products' on these two Models using our built-in functions such as 'belongsTo' and 'hasMany'.

```ts
export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    color = this.field(StringType)
    //define a computeProperty as "belongsTo" relation
    shop = Product.belongsTo(Shop, 'shopId', 'id')
}

export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    location = this.field(StringType)
    //define a computeProperty as "hasMany" relation
    products = Shop.hasMany(Product, 'shopId', 'id')
}
```

Simply get array of `Shop` objects, each `products` key with value of array of `Product`
```ts
// Simply select shop, each with array of products
let shops = await Shop.find({
  selectProps: ['products']
})
```

These ComputeFunctions are special because their arguments are `FindOption`. The related Entity can be queried and filtered according to the `FindOption`
```ts
// find shops with related products which are only in color 'red'
let shops = await Shop.find({
  select: {
    // select the computed property 'products'
    products: {
      where: {
        color: 'red'
      }
    }
  },
  where: {
    //...
  }
})
```

Example: use it in `where`
```ts
// find all products which belongs to Shop with location 'Hong Kong'
let products = await Product.find({
  where: ({root}) => root.shop({
    where: {
      location: 'Hong Kong'
    }
  }).exists()
})

// another approach (if the 'hasMany' relationship is not defined in Model Schema)
await Product.find({
  where: ({root, Exists}) => Exists( Shop.dataset({
    where: {
      shopId: root.id,
      location: 'Hong Kong'
    }
  }))
})
```

Besides, the funtion call of `ComputeProperty` returns a `Scalar` that can be transformed into subquery like "SELECT count(*) FROM ..."
```ts
// find all shops which has more than 5 products
let shops = await Shop.find({
  where: ({root}) => root.products().count().greaterThan(5)
})

// another approach (if the 'hasMany' relationship is not defined in Model Schema)
let shops = await Shop.find({
  where: ({root}) => Product.dataset({
    where: {
      shopId: root.id
    }
  }).toDScalar().count().greaterThan(5)
})
```


