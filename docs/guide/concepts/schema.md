# Schema
- It represents a dictionary of properties.
- `Dataset`, `ModelRepository` or `Model` can produce a `Schema`.

Examples:
```js
context.dataset().schema()

context.repos.Model1.schema()

require('./models/Model1').schema()

```

## Datasource

- It is produced from a `Schema` by giving a name (acts as table alias).
- It refers to a database table or a temporary table.
- It is used by the Query Builders' `from`, `innerJoin`, `leftJoin` and `rightJoin` functions.

Example: 
Below it makes a query with selecting fields from table `Model1` with alias `table_alias`.

```js{4,6-8}
const schema = context.repos.Model1.schema()

let queryBuilder = context.dataset()
    .from(schema.datasource('table_alias'))
    .select(
        'table_alias.id',
        'table_alias.field1',
        'table_alias.field2'
    )
```


There are many ways to create a datasource instance.

```js
Model1.schema().datasource(string)
//OR a shortcut:
Model1.datasource(string)

modelRepository1.schema().datasource(string)
//OR a shortcut:
modelRepository1.datasource(string)

dataset1.schema().datasource(string)
//OR a shortcut:
dataset1.datasource(string)
```

### ValueSelector (`$`)

A datasource instance provides an object `$` having values of `Scalar` or `CompiledComputeFunction` which represents the properties of the Schema.

::: tip
`Scalar` is a single SQL value that can be a field name or SQL functions.

Please see [Scalar](./query-builder.md#scalar) for more details.
:::

Examples:
```js
export default class MyModel extends Model {
  // Nullable Integer
  prop1 = this.field(NumberType)
  
  prop2 = this.compute( (parent) => parent.minus(3) )
}

const scalar1 = Model1.datasource('table1').$.prop1

const scalar2 = Model1.datasource('table1').$.prop2()

```

::: details
If the key of `$` refers to a `FieldProperty`'s name, the value will be a `Scalar`.

If it refers to a `ComputeProperty`'s name, the value is a Function (`CompiledComputeFunction`) that returns a `Scalar`.
:::

::: tip
Please see [Property](./property) for more explanation.
:::
