# Schema
It represents a dictionary of properties.

`Dataset`, `ModelRepository` or `Model` can produce a `Schema`.

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

A datasource instance provides an object `$` having values of `Scalar` or `ComputeFunctions` which represents the properties of the Schema.

Example:
```

```
