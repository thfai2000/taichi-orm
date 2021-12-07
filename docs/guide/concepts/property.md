
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
- It can be created by method `model.field()` that accepts `PropertyType` constructor or `PropertType` instance. Please see [PropertType](./property-type) for details.

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

Access Field Value using Datasource.$

Example:
```js
// It selects records with prop1 equals 5
await MyModelRepo.find({
  where: ({root}) => root.prop1.equals(5)
})
```


## ComputeProperty

- It represents a SQL value calculated by using other `FieldProperty` or SQL functions.
- It can be created by method `Model.compute()` that accepts a `ComputeFunction`. 
- `ComputeFunction` that defines how to create a `Scalar` (a single SQL value). Please see [PropertType](./property-type) for details.

### ComputeFunction

- It is a function accepts two arguments 
- returns a `Scalar` (a single SQL value)


| Function Arguments | Descriptions | Optional |
| --------- | -----------| ------ |
| parent    | `Datasource` of the current Model | No |
| arg       | Value given in execution | Yes |



A simple `ComputeFunction` Example:
```js
(parent, args) => {
    // add 5 to the number value of prop1
    return parent.prop1.add(5)
})
```

### CompiledComputeFunction

- It is a function that wraps the `Datasource` and call the `ComputeFunction`. 
- `Datasource.$` of a `Model` can access the `CompiledComputeFunction` of any `Property` of a `Model`
- Returns a `Scalar` (a single SQL value)

| Function Arguments | Descriptions | Optional |
| --------- | -----------| ------ |
| arg       | Value given in execution | Yes |


### Usage

#### Example 1:
Access the `CompiledComputeFunction`

```js{4-5,9}
class MyModel extends Model {
    prop1 = this.field(NumberType)
    prop2 = this.compute( 
      // add 5 to the number value of prop1
      (parent, arg) => parent.prop1.add(arg)
    )
}

const scalar = MyModel.datasource('alias1').$.prop2(5)

//Output SQL string: alias1.prop1 + 5
console.log(await scalar.toRaw() )
```


#### Example 2:
Use the `CompiledComputeFunction` in data query.

```js{11}
class MyModel extends Model {
    prop1 = this.field(NumberType)
    prop2 = this.compute( 
      // add 5 to the number value of prop1
      (parent, arg) => parent.prop1.add(arg)
    )
}

// It selects records with 
await MyModelRepo.find({
  where: ({root}) => root.prop2.equals(7))
})

```
::: details
The above codes, `root` is the `Datasource.$`. 
The `find()` method actually produce and execute the SQL:
```sql
SELECT root.prop1 
FROM MyModel AS root 
WHERE root.prop1 + 5 = 7
```
:::

