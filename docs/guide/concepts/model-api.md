# Model API

- Model API (`ModelRepository` methods) is actually implemented by using Query Builder.
- But it provides a simpler way to carry out `create`, `update` and `delete` operations on a Model.

## `.createOne()`

- Creates one record of Model
Example:

```js
const createdRecord = await context.ModelRepo1.createOne(data)
```

## `.createEach()`

- Creates many record of Model
- The records are created one by one in multiple sql statements

Example:

```js
const createdRecords = await context.ModelRepo1.createEach(arrayOfData)
```

## `.update()`



## `delete()`

## `deleteOne()`

## `find()`

## `findOne()`

## `findOneOrNull()`


## `findOptions`


### `select`

### `selectProps`

### `where`

- Model API is implemented by using Query Builder.
- The `where` option is passed to the Builder. For more options, please see [where](./query-builder.md#where)
- But the target Model (table) is assigned a table alias with 'root'. About table alias, please see [Datasource](./schema.md#datasource).

Example: 
```js
const records = await context.ModelRepo1.find({
    where: ({root}) => root.id.equals(1)
})
```

It equals to `dataset`
```js
const records = await context.dataset()
    .from(ModelRepo1.datasource('root'))
    .where({ 
        'root.id': 1
    }).execute()
```