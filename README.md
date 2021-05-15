

!!!!!!!! Don't Use it !!!!!!!!
It is still under heavy development. 
Please feel free to express your ideas.

# Introduction

- Rethink the ORM. 
- Better maintenance. Reduce duplicated data logics
- Efficient in data query execution. Reduce Request Response Tme
- It relies on the popular package Knex (**SQL builder**). It allows us to build data logics without any limitation. 

# Features
- For entity schema, we can define **ComputedField** (or called **ComputedProperty**), it is like a sql template/builder. 
  - It is like "Prepared SQL Statement" which contains custom pre-defined logics but also accepts parameters. 
  - During data query, the ComputedField is optionally selected and it even can be extended.
  - "HasMany", "belongsTo"... logics are pre-defined in term of ComputedField for usage.
- Developed in **Typescript**.
- (Soon) Data caching
- (soon) Better Integration with **GraphQL** and **Restful** Server

# Why we need it?

Problems of some traditional ORM:
- It allows applying filter on entity of relation, but cannot apply filters on the pivot table of *ManyToMany* relationship".
- In the schema, we usually can declare to use some common relation like *hasMany*, *belongsTo* etc. Why don't it allow us to define custom relation of which data logics can be re-use many times in the business logics.
- Query the relation data is not efficient. If the data query consist of multiple Entity, it query the database tables one by one. Usually, it produce several SQL query. Why can't we query all these data from database in just one single call. It is just like the different approach between *GraphQL* and *Restful*.

##More explaination:

Let's say we have data models Shop, Product, Color.
A shop has many products and each product has many colors.
For traditional ORM, we have to select Entity and its relation like this.
```javascript
Shop.find().with('products.colors')
```
It generates several SQL statements
```sql
   Select id FROM shop;  
   # result: 1, 2, 3

   Select id FROM Product where shopId IN (1, 2, 3);
   # result: 1, 2, 3, 4, 5

   Select id FROM Color where productId IN (1, 2, 3, 4, 5);
   # result: 1, 2
```
But actually we can query the data in only one SQL statement instead:
```
  SELECT shop.id, 
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'colors', colors))
        FROM
        (
          SELECT product.id, 
            (....same way...) AS colors
          FROM product WHERE product.id = shop.id
        ) AS t
    ) AS `products` 
  FROM shop;

```
The trick is using the SQL server build-in function to construct JSON objects.
It is more efficient than the traditional way.

More information can be found here:
https://github.com/typeorm/typeorm/issues/3857#issuecomment-840397366


# Data Query Examples

```javascript
//Basic query
await Shop.find() // result: [Shop, Shop]

// find records in coding Nested Style
let records1 = await Shop.find( (stmt, root) => {
    return stmt.where(root.id, '>', 1).limit(5)
})

// find records in coding Normal Style
let s = Shop.selector()
let records2 = await select(s.all).where(s.id, '>', 1)


/**
  * find records with relations (computed field)
  * 'root' is a selector that access the entity information
  * 'root.$' can access one computedField named 'products' which are predefined in the entity schema
  */
await Shop.find( (stmt, root) => {
    return stmt.select(root.all, root.$.products()).where(root.id, '=', 1)
})

/**
  * find records with multiple level of relations
  * The Shop relates Product and Product relates Color.
  */
await Shop.find( (stmt, shop) => {
    return stmt.select(shop.all, shop.$.products( (stmt2, prd) => {
        return stmt2.select(prd.all, prd.$.colors()).limit(2)
    })).where(shop.id, '=', 1)
})

```

TODO: some examples of schema, applying both filters and arguments on ComputedField


# Concepts:

- ComputedFunction
  - It is a data selection logics

- NamedProperty
  - Represent the property of an entity
  - It declared the name and the data type( e.g. entity type or primitive types)
  - It can be a real table field or a virtual field (computedField)
  - If it is a computedField, it embedded ComputedFunction
  
- CompiledNamedProperty
  - It is a compiled version of NamedProperty
  - It embedded runtime information such as the alias name of the property's Parent. These information is important for Table Joining


# Development?

We needs some passionate developers. If you are interested and agreed with the ideas, you may join our project. You can talk in the discussion board.

# How to start 
Currently, I work one the ORM together with the example because the example can proof the concept of the ORM.
Tests will be added in the future once the specification is confirmed.

```bash
git clone ...

# Start the project. It is built by typescript
npm run dev

# Start another terminal.  Work on the example and the ORM at the same time
cd examples/basic
npm run dev

# Start one more terminal. It starts a database server
docker-compose up
```




