# Select and Filter

## Select target model and relations

```js
// Simply select shop, each with array of products
let shops = await Shop.find({
  selectProps: ['products']
})
```


## Select target model and relations by `findOptions` 
```js
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

## Select target model with relations match criteria

```js

// find all products which belongs to a Shop
let products = await Product.find({
  where: ({root}) => root.shop().exists()
})

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

## Select target model with certain number of related records 

Besides, the funtion call of `ComputeProperty` returns a `Scalar` that can be transformed into subquery like "SELECT count(*) FROM ..."
```js
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