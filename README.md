

!!!!!!!! Don't Use it !!!!!!!!
It is a Proof of Concept right now.


# Introduction

- Rethink the ORM. 
- Better maintenance. Reduce duplicated data logics
- Efficient in data query execution. Reduce Request Response Tme
- It relies on the popular package Knex (SQL builder). It allows us to build data logics without any limitation. 

# Features
- For entity schema, we can define "ComputedField" (or called ComputedProperty), it is like a sql template/builder. 
  - It is like "Prepared SQL Statement" which contains custom pre-defined logics but also accepts parameters. 
  - During data query, the ComputedField is optionally selected and it even can be extended.
  - "HasMany", "belongsTo" Logics are pre-defined in term of ComputedField for usage.
- Developed in typescript.
- (Soon) Data caching
- (soon) Better Integration with GraphQL and Rest Server

# Data Query Examples

```
/**
  * Basic query
  */
let records0 = await Shop.find()
console.log('queried0:', records0)

/**
  * find records in coding style 1
  */
let records1 = await Shop.find( (stmt, root) => {
    return stmt.where(root.id, '>', 1).limit(5)
})
console.log('queried1:', records1)

/**
  *  find records in coding style 2
  */
let s = Shop.selector()
let records2 = await select(s.all).where(s.id, '>', 1)
console.log('queried2:', records2)


/**
  * find records with relations (computed field)
  * !important: computed field is a function call
  */
let records3 = await Shop.find( (stmt, root) => {
    return stmt.select(root.all, root.$.products()).where(root.id, '=', 1)
})
console.log('queried3:', records3)


/**
  * find records with multiple level of relations
  */
let records4 = await Shop.find( (stmt, shop) => {
    return stmt.select(shop.all, shop.$.products( (stmt2, prd) => {
        return stmt2.select(prd.all, prd.$.colors()).limit(2)
    })).where(shop.id, '=', 1)
})
console.log('queried4:', records4)

```


# Why we need it?


Let's say we have data models Shop, Product, Color.
A shop has many products and each product has many colors.
For traditional ORM, we have to select
```
  Shop.find().with('products.colors') 
```
It generates several SQL statements
```
   Select id FROM shop;  
   // result: 1, 2, 3

   Select id FROM Product where shopId IN (1, 2, 3);
    // result: 1, 2, 3, 4, 5

   Select id FROM Color where productId IN (1, 2, 3, 4, 5);
   // result: 1, 2
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


# Concepts:

## ComputedFunction
  It is a data selection logics

## NamedProperty
  Represent the property of an entity
  It declared the name and the data type( e.g. entity type or primitive types)
  It can be a real table field or a virtual field (computedField)
  If it is a computedField, it embedded ComputedFunction
  
## CompiledNamedProperty
  It is a compiled version of NamedProperty
  It embedded runtime information such as the alias name of the property's Parent. These information is important for Table Joining


