# Scalar Transformation

A Scalar can transformed into another Scalar in different type/value.

```ts
    let ctx = orm.getContext()
    let {Shop} = ctx.repos

    // find shops with its products that average price are between 20 and 30
    let shops = await Shop.find({
      where: ({root}) => root.products().transform(ds => 
        ds.select(({root}) => ({average: ctx.scalar('AVG(??)', [root.price]) }) )
        .toDScalarWithType(NumberNotNullType)
      ).between(20, 30)
    })
```
The above codes is using `Scalar.transform()` to find all shops with its products that average price are between 20 and 30. 

Explain:
The method call of `products` ComputeProperty returns a Scalar.
That Scalar is in ArrayType but is transformed into a NumberType.
The `Scalar.transform()` expose the original source 'Dataset' that allows modification.
Dataset is a query builder that allow you to select any value.
In this case, we use raw SQL `DatabaseContext.scalar()` (Just like Knex.raw) in the SELECT statement.