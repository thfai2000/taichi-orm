
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

- It represents a SQL value calculated by using other `FieldProperty` or SQL functions.
- It has a `ComputeFunction` that defines how to create a `Scalar` (a single SQL value).

### ComputeFunction
It defines how to create a Scalar.

### Usage

