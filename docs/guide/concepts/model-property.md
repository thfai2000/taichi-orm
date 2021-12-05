
# Model and Property


## Model
It represents a database table.

## FieldProperty
It represents a field of a Model.


### specify the field name


## ComputeProperty
It represents a virtual field of a Model.
It consists of a `ComputeFunction` that defines how to create a Scalar.

### Define ComputeProperty based on another ComputeProperty

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


## ComputeFunction
It defines how to create a Scalar.


