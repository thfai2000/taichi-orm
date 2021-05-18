

A new way to deal with your Data Logic.


!!!!!!!! Don't Use it !!!!!!!!
It is still under heavy development. 
Please feel free to express your ideas.

# Introduction

- Introduce a concept `ComputedProperty`for Data Model
  - It is a Entity's property. It consist of data logics defined using SQL builder
  - Once you orgazine your data logics in form of `ComputedProp` that is highly resuable and extensible
  - It is like "Prepared SQL Statement" which contains custom pre-defined logics but also accepts parameters. 
  - Common relation logics such as `HasMany` and `belongsTo` are can be defined in form of `ComputedProperty`.
- Efficient in data query execution. 
  - Query all Entity and its relation data in one single SQL call.
- Developed in **Typescript**.
- (Soon) Data caching
- (soon) Better Integration with **GraphQL** and **Restful** Server

**Example**:
```javascript
// define a Data Model
class Shop extends Entity{

  static register(schema: Schema){

    // Normal Property that map to real table field
    schema.prop('location', Types.String(255))

    // Define a Computed Property using common relation template
    schema.computedProp('products', Types.Array(Product), 
      (shop, applyFilters) => shop.hasMany(Product, 'shopId', applyFilters) )

    // Define a Computed Property
    schema.computedProp('productCount', Types.Number(), (shop) => {
        let p = Product.selector()
        return select('COUNT(*)').from(p.source).where(shop.id, '=', p.shopId)
    })
  }

}

class Product extends Entity{
  static register(schema: Schema){
    ...
  }
}

// Query. Find a Shop with id=1 and its Products and total number of Products. 
await Shop.find( (stmt, root) => {
    // stmt is an instance of QueryBuilder. 
    // Now, we query both properties 'product' and 'productCount'
    return stmt.select(root.all, root.$.products(), root.$.productCount())
           .where(root.id, '=', 1)
})
// Output: [ Shop:{products:[...], productCount:5}, Shop:{products:[...], productCount:3} ...]
```
Explain: 
`root.$` is the dictionary of `computedProperty` of `Shop`. 
`root.$.products` locate the computedProperty


The data logics of Computed Property is **extensible**. Let's change the ComputedPRop in above example.
```javascript
// #models/Shop.js
...
// Define a Computed Property which accept "applyFilters"
schema.computedProp('productCount', Types.Number(),  (shop, applyFilters) => {
    let p = Product.selector()
    return applyFilters(p.count().where(shop.id, '=', p.shopId))
})
...

//Let's query Shops with productCount of which the products in specific category
await Shop.find( (stmt, root) => {
    // stmt is an instance of QueryBuilder
    return stmt.select(root.$.productCount( (pStmt, pRoot) => {
      pStmt.where(pRoot.category, '=', 'Food') 
    })).where(root.id, '=', 1)
})

```
Explain:
`applyFilters` can exposes the instance of the QueryBuilder


Note:
Inspired by **GraphQL**: `ComputedProperty` is similar to `GraphTypeResolver`.
Inspired by **Knex** (SQL builder). SQL builder allows us to build data logics without any limitation.


# Why we need it?

Problems of some traditional ORM:
- It allows applying filter on entity of relation, but cannot apply filters on the pivot table of `manyToMany` relationship".
- In the schema, we usually can declare to use some common relation such as `hasMany`, `belongsTo` etc. Why don't it allow us to define custom relation of which data logics can be re-use many times in the business logics.
- Query the relation data is not efficient. If the data query consist of multiple Entity, it query the database tables one by one. Usually, it produce several SQL query. Why can't we query all these data from database in just one single call. It is just like the different approach between *GraphQL* and *Restful*.

##More explaination:

Let's say we have data models `Shop`, `Product`, `Color`.
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
```sql
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


# Installation

!!!!!!!! Don't Use it !!!!!!!!
It is still under heavy development.
The npm package doesn't work now. It is out-dated. **The release target is Q4 of year 2021.**

1. Install the package
```bash
npm install --save llorm
```

2. define your Data Models (or in separates files)
3. call `configure` to use the setup the resposity and database connection

```javascript
// #index.js
import {configure, Entity, Schema, Types} from 'llorm'

class Shop extends Entity{
    static register(schema: Schema){
        schema.prop('location', Types.String(255))
        schema.computedProp('products', Types.Array(Product), (shop, injectFunc) => shop.hasMany(Product, 'shopId', injectFunc) )
    }
}

class Product extends Entity{
    static register(schema: Schema){
		schema.prop('name', Types.String(255, true))
		schema.prop('createdAt', Types.Date())
        schema.prop('shopId', Types.Number() )
		schema.computedProp('shop', Types.Object(Shop), (product, applyFilters) => product.belongsTo(Shop, 'shopId', applyFilters) )
	}
}

(async() =>{

    // configure the orm
    await configure({
        models: { Shop, Product },
        createModels: true,
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: "file:memDb1?mode=memory&cache=shared",
                flags: ['OPEN_URI', 'OPEN_SHAREDCACHE']
            }
        }
    })

    /**
     * Basic
     */
    let myShops = await Shop.find()
    console.log('HERE:', myShops)

})()
```

4. Start your program
```bash
node index.js
```

## Basic Usage
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

## Advanced Usage

TODO: some examples of schema, applying both filters and arguments on ComputedField

You can create an Entity like  Graphql `type Query`. You can select list of `Shop` and `Product` at the same time.
Let say we define the computedProperty 
- `myShops`
- `myShopCount`, 
- `myProducts`
- `myProductCount`

You can use the built in Entity called `Dual` to do this. `Dual` is a special entity that is without tableName.
```javascript
  await Dual.find( (stmt, s) => {
    return stmt.select( 
      s.derivedProp(new NamedProperty('myShops', ..., __computedFunc__) ),
      s.derivedProp(new NamedProperty('myShopCount', ..., __computedFunc__) ),
      s.derivedProp(new NamedProperty('myProducts', ..., __computedFunc__) ),
      s.derivedProp(new NamedProperty('myProductCount', ..., __computedFunc__) ),
    )
  
  })

```
Explain:
- Usually the database can optimize the query. The `shop` and `shopCount` actually shared the same base of data.
- Besides, you query all you want in one go. More efficient

In good practice, you should defined these logic into a schema, so that the query can be reusable

```javascript
class Query extends Dual {
  static register(schema) {
    schema.computedProp('myShops', ..., __computedFunc__)
    schema.computedProp('myShopCount', ..., __computedFunc__)
    ...
  }
}

class Shop extends Entity {
  static register(schema) {
    ...
  }
}

class Product extends Entity {
  static register(schema) {
    ...
  }
}

//query the data
let records = await Query.find((stmt, s)=> stmt.select(s.$myShops(), s.$myShopCount(),....))

```


# Concepts:

- `ComputedFunction`
  - It is a data selection logics
  - defined by SQL builder

- `NamedProperty`
  - Represent the property of a Data Model
  - It consists of the name and the data type (can be Entity or primitive types)
  - It can be a real table field or a virtual field `ComputedProperty`.
  
- `ComputedProperty`
  - It is a subClass of `NamedProperty`. 
  - It is virtual field.
  - But it embedded `ComputedFunction`

- `CompiledNamedProperty`
  - It is a compiled version of `NamedProperty`. A `NamedProperty` is not ready for query before it is compiled.
  - During the compilation, it embedded the runtime information such as the alias name of the property's Parent. These information is important for Table Joining.

- `Selector`
  - It is a dictionary that access runtime information and schema of a Entity. 
  - In below example, `root` is the selector instance of `Shop`
   - `root.all`: all properties of `Shop`
   - `root.id`: the primary key of `Shop`
   - `root.$`: dictionary of `computedProperty` of `Shop`
   - `root.$.products()` include the `computedProperty` named `products`
  ```javascript
  await Shop.find( (stmt, root) => {
    return stmt.select(root.all, root.$.products()).where(root.id, '=', 1)
  })
  ```

# Development?

We needs some passionate developers. If you are interested and agreed with the ideas, you may join our project. You can talk in the discussion board.

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



