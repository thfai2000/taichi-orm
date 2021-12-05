# Scalar Transformation

A Scalar can transformed into another Scalar in different type/value.

```ts
    let ctx = orm.getContext()
    let {Shop} = ctx.repos

    // find shops with its products that average price are between 20 and 30
    let shops = await Shop.find({
      where: ({root}) => root.products().transform(ds => 
        ds.select(({root}) => ({average: ctx.scalar('AVG(??)', [root.price]) }) )
        .toDScalarWithType(NumberNotNullType)
      ).between(20, 30)
    })
```
The above codes is using `Scalar.transform()` to find all shops with its products that average price are between 20 and 30. 

Explain:
The method call of `products` ComputeProperty returns a Scalar.
That Scalar is in ArrayType but is transformed into a NumberType.
The `Scalar.transform()` expose the original source 'Dataset' that allows modification.
Dataset is a query builder that allow you to select any value.
In this case, we use raw SQL `DatabaseContext.scalar()` (Just like Knex.raw) in the SELECT statement.




## Define ComputeProperty based on another ComputeProperty

A more advanced usage.
ComputeProperty is very flexible. You can define it based on another existing ComputeProperty or FieldProperty

```ts
export default class Shop extends Model {
    id = this.field(PrimaryKeyType)
    location = this.field(StringType)
}

export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')

    // define a relation based on 'shop' with additional where clause
    shopInHongKong = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
        (parent, args?): any => {
        // the shop Scalar is transformed into another Scalar. 
        // The original dataset ('ds') is modified by adding where clause
        return parent.$.shop(args).transform( ds => {
            return ds.andWhere({
              location: 'Hong Kong'
            }).toScalar()
        })
    })
}
```



```ts
// find all products which belong to Shop with location 'Hong Kong'
let products = await Product.find({
  where: ({root}) => root.shopInHongKong().exists()
})
```

