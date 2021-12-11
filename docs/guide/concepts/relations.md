
# Relations

- `Models` can define `ComputeProperty` which related to other Models.
- These Relation `ComputeProperty`'s `CompiledComputeValueGetterDefinition` accept `findOptions` as arguments, it allows filtering or ordering the records of the related Models by your `findOptions`.
- For `Model`, there are several function to create Relation `ComputeProperty`
1. `.belongsTo()`
2. `.hasMany()`
3. `.hasManyThrough()`

::: tip
For `findOptions`, please see [findOptions](./model-api.md#findoptions).
:::

### belongsTo

| Arguments       | type           | default value|
| :------------- |:-------------|:-----------|
| Related Model     | `Model` |  |
| Name of the FieldProperty of current Model       | `string` | |
| Name of the FieldProperty of related Model       | `string` | "id" |

```js{5}
export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    //define a computeProperty as "belongsTo" relation
    shop = Product.belongsTo(Shop, 'shopId', 'id')
}

export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    //define a computeProperty as "hasMany" relation
    products = Shop.hasMany(Product, 'shopId', 'id')
}
```


### hasMany

| Arguments       | type           | default value|
| :------------- |:-------------|:-----------|
| Related Model     | `Model` |  |
| Name of the FieldProperty of related Model       | `string` | |
| Name of the FieldProperty of current Model       | `string` | "id" |

```js{11}
export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    //define a computeProperty as "belongsTo" relation
    shop = Product.belongsTo(Shop, 'shopId', 'id')
}

export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    //define a computeProperty as "hasMany" relation
    products = Shop.hasMany(Product, 'shopId', 'id')
}
```


### hasManyThrough
