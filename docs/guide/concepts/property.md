
# Property

- It represents a property of `Model`
- A `Property` has `PropertType` that represents the data type of that property.
- The Model class or Model instance provides methods such as `.field()` and `.compute()` to create Property instance.

There are two kinds of Property of a Model
| Name        | Description           |
| :------------- |:-------------|
| FieldProperty      | a field of a table. |
| ComputeProperty      | a virtual field computed using other fields or SQL functions      |




## FieldProperty

- It represents a field of a table and is defined in `Model` class.
- It can be created by method `.field()` that accepts `PropertyType` constructor or `PropertType` instance. Please see [PropertType](./property-type) for details.

### Usage

Define various properties with different types and options.

Example: 
```js{2-3,5-6,8-9}
export default class MyModel extends Model {
  // Nullable Integer
  prop1 = this.field(NumberType)

  // Nullable varchar(50)
  prop2 = this.field(new StringType({length: 50}))

  // Non-nullable varchar(255)
  prop3 = this.field(StringTypeNotNull)
}

```

In case, the field name can be overrided by a given name.

Example:
```js
export default class MyModel extends Model {
  // the table field name would be 'p_r_o_p_1'
  prop1 = this.field(NumberType).setFieldName('p_r_o_p_1')
} 
```

## ComputeProperty

It represent a value calculated by using other `FieldProperty` or SQL functions.
It consists of a `ComputeFunction` that defines how to create a Scalar.

## ComputeFunction
It defines how to create a Scalar.


## Relation Property

### belongsTo

### hasMany

### hasManyThrough



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

