# Query Builder

Taichi Query Builder doesn't like `Knex.QueryBuilder`. It is more high-level in usage because it use the defined `Schema` and `Property` to build Query. It means that the actual table names and actual field names are abstracted and taken care by ORM. Besides, the `ComputeFunction` can be used in building your Query.


There are several kinds of `Query Builder`



You can even use the `ComputeProperty`

```js


```


Although The Model API allows to use raw SQL, QueryBuilder is still necessary in some suitations: 

1. If you want to form unstructured records by joining two database tables, you need QueryBuilder. The common use case is producing metrics and reports. Model API form structured data that widely be used in building Restful API or GraphQL resolver.
2. Sometimes performance is critical. you need query builder to build optimised SQL (such as specifying Index Name).
3. Model.update() and Model.delete() will query the involved records before update or delete, and query the affected data again. But querybuilder allows to skip querying the affected records.

## Scalar
It represent a SQL single value with a specifc type like number, string or date.
Dataset can be transformed into a Scalar. For example, 'SELECT count(*) FROM table1' can act as a Scalar in number type.

## Dataset
It is a query builder and represents the SELECT statement.

## InsertStatement

## UpdateStatement

## DeleteStatement