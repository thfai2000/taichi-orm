# Model

- It represents a database table.
- It used as a parent class for your data models. Your models should `extends` `Model` and be defined with `Properties`.
- All `Models` have to be registered before using them. Please see [Register Models](./orm.md#register-models)

## Usage

Example:
```js
class MyModel extends Model {
    //define Property instance here
}
```

### Define FieldProperty

The method `.field()` of `Model` instance creates a `FieldProperty` (represents a table field).

Example:
```js
class MyModel extends Model {
    //define a non-nullable varchar type data
    prop1 = this.field(StringNotNullType)
}
```

::: tip
Please read the [FieldProperty](./property.md#fieldproperty) for more details
:::


### Define ComputeProperty

The method `.compute()` of `Model` instance creates a `ComputeProperty` that represent a value calculated by using other `FieldProperty` or SQL functions.

Example:
```js{3-6}
class MyModel extends Model {
    prop1 = this.field(NumberType)
    prop2 = this.compute( (parent)=> {
        // add 5 to the number value of prop1
        return parent.prop1.add(5)
    })
}
```

::: tip
Please read the [FieldProperty](./property.md#computeproperty) for more details
:::

### Define Relations

`Model` class provides various methods to define relations.

Example:
```js{5}
const Shop = require('./shop')

class Product extends Model {
    //define a belongsto Relation
    shop = Product.belongsTo(Shop)
}
```
::: tip
Please read the [Relations](./relations) for more details
:::




