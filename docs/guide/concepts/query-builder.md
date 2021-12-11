# Query Builder

Taichi Query Builder doesn't like `Knex.QueryBuilder`. It is more high-level in usage because it use the defined `Schema` and `Property` to build Query. It means that the actual table names and actual field names are abstracted and taken care by ORM. Besides, the `ComputeValueGetterDefinition` can be used in building your Query.

The `DatabaseContext` provides several kinds of `Query Builder` for querying, creating, updating and deleting data:
- Scalar
- Dataset
- InsertStatement
- UpdateStatement
- DeleteStatement

For Example: 
```js
// access the query builders
const {
    dataset, 
    scalar,
    insert,
    del,
    update,
    repos: {Shop, Product} 
} = orm.getContext()
```


## Scalar
It represent a SQL single value with a specifc type like number, string or date.

Example:
```js
scalar(`UPPERCASE(?)`, ['abcd'], StringType)
```

Dataset can be transformed into a Scalar with type `ArrayType`

```js
const scalar = Model1.dataset().toDScalar()
```


## Dataset
It is a query builder that represents the SELECT statement.


## InsertStatement
```js
const shop1 = await insert(Shop.schema()).values([{
    name: 'shop',
    hour: 5
}]).execute().getAffectedOne()
```

## UpdateStatement


The `where` is same as that of `Dataset`. You can use `PropertyValueGetters` to build the Where Clause.

```js{3}
const shop1 = await update()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .set({
            name: scalar('?',['Shop Name ABC'])
        }).execute()
```

## DeleteStatement


::: tip
The names of these operators and functions are first-letter captialized
:::


## Model API verus Query Builder

Although The Model API allows to use raw SQL, QueryBuilder is still necessary in some suitations: 

1. If you want to form unstructured records by joining two database tables, you need QueryBuilder. The common use case is producing metrics and reports. Model API form structured data that widely be used in building Restful API or GraphQL resolver.
2. Sometimes performance is critical. you need query builder to build optimised SQL (such as specifying Index Name).
3. Model.update() and Model.delete() will query the involved records before update or delete, and query the affected data again. But querybuilder allows to skip querying the affected records.