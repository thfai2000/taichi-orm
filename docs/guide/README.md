# Introduction


A new way to deal with your Data Logic of SQL Databse. You can define a virtual field called `ComputeProperty` (that actually is SQL statement) for a data model.


- The common data logics in form of `ComputeProperty` of Data Model become more reusable.
- The codes of data query become more human readable because complex data logics can be abstracted in `ComputeProperty`.
- Simlple but flexible Model API. Without using `QueryBuilder`, `Model API` is powerful enough to build complex logics by extending or modifying the `ComputeProperty`.
- Developed in **Typescript** but you can use it without typescript compiler.
- Common relation logics such as `HasMany` and `belongsTo` are can be defined in form of `ComputeProperty`. And the related Models are queried in one single Sql call.

In below sections, We will explain the ORM stuff using E-commerce-like database as an example.

## ComputeProperty

Imagine an E-commerce system. A product (Model) has various fields like `availableStart`, `availableEnd` and `remainingStock`. See below code.


```ts{10-16}
export default class Product extends Model {

    //define field properties here
    id = this.field(PrimaryKeyType)
    availableStart = this.field(DateNotNullType)
    availableEnd = this.field(DateNotNullType)
    remainingStock = this.field(NumberNotNullType)

    //define ComputeProperty based on the value of FieldProperty
    isActive = Product.compute((parent) => {
        return new Scalar<BooleanNotNull, any>(context => context.op.And(
            parent.$.availableStart.lessThan( new Date() ),
            parent.$.availableEnd.greaterThan( new Date() ),
            parent.$.remainingStock.greaterThan(0)
        ))
    })
}
```
We define the schema with a `isActive` ComputeProperty which combines the values of other `FieldProperty`. It means a product is active when the current time are within these dates and the remainingStock are not zero.

That `ComputeProperty` consists of `ComputeFunction` that defines how to make a SQL value (we called `Scalar`). The variable `parent` represents the Datasource of `Product` Model. The `FieldProperty` can be accessible through the `parent` variables.



After the schema is defined, we can query the records like this:
```ts
const activeProducts = await Product.find({
  where: {
    isActive: true
  }
})
```
Above is the `ModelRepository.find()` function that accepts one argument `FindOptions` (Just like the other ORM). 
The `where` part specifies the data filtering condition.
You can use the `isActive` ComputeProperty simply just like a normal field in the `where` object.


Besides, `ComputeFunction` can accept argument. 
Below variable `spare` is the argument. The argument of `ComputeFunction` must be optional.

```ts
export default class Product extends Model {
  
  // 'Enough' means at least certain amount of stock
  hasEnoughStock = Product.compute((parent, spare: number | undefined= 2)
  : CFReturn<boolean> => {
    return parent.remainingStock.greaterThan(spare)
  }
}
```

Then you can use the `ComputeFunction` with passing an argument:


```ts
//use ComputeFunction argument
const products = await Product.find({
  where: ({root}) => root.hasEnoughStock(5) //at least 5 remainings
})
```

Or use it like a normal field:

```ts
const products = await Product.find({
  where: {
    hasEnoughStock: true
  }
})
```
::: tip
If you use it as object Key, the argument of that `ComputeFunction` will be given as undefined.
:::



## Why TaiChi?


### Retrieve relations by single SQL statement

For some traditional ORM, querying the relation data of Model is not efficient. If the data query consist of multiple Entity, it executes SQL SELECT statement one by one. Usually, it produce several SQL query. But Why can't we query all these data from database in just one single call.

Let's say we have data models `Shop`, `Product`, `Color`.
A shop has many products and each product has many colors.
For traditional ORM, when we select Entity and its relation like this.
```js
const shops = await Shop.find().with('products.colors')
```

It generates several SQL statements
```sql:no-line-numbers
   Select id FROM shop;  
   # result: 1, 2, 3

   Select id FROM Product where shopId IN (1, 2, 3);
   # result: 1, 2, 3, 4, 5

   Select id FROM Color where productId IN (1, 2, 3, 4, 5);
   # result: 1, 2
```
But actually we can query the data in only one SQL statement instead:
```sql:no-line-numbers
  SELECT shop.id, 
    (SELECT JSON_ARRAYAGG(JSON_Array(id, colors))
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
It may be more efficient than the traditional way. taichi-orm is currently using this approach.


### Better control on relation records

For some traditional ORM, it is not easy to apply filters on the pivot table of `manyToMany` relationship" because the Model definition is abstracted.
But our Model API allows us applying additional where clause during query. See below code examples.

Models:
```js
class Color extends Model {
  id = this.field(PrimaryKeyType)
  //possible values: 'red', 'blue'...
  code = this.field(new StringNotNullType({length: 50}))
}

class Product extends Model{
  id= this.field(PrimaryKeyType)
  //One Product has many Colors
  colors = Product.hasManyThrough(
      ProductColor, Color, 'id', 'colorId', 'productId')
}

// it represents the pivot table
// there is a column 'type' which means the color type of the product
class ProductColor extends Model{
  id= this.field(PrimaryKeyType)
  colorId = this.field(NumberNotNullType)
  productId = this.field(NumberNotNullType)
  //possible values: 'main', 'minor'
  type = this.field(new StringNotNullType({length: 50}))
}
```

Query example 1:
Select all Products with the filtered Colors that are in red and is the main color of that product.
```js{4-7}
await Product.find({
  select: {
    colors: {
      // root is Color table, through is pivot table
      where: ({root, through, And}) => And(
        root.code: 'red',     // Color.code = 'red'
        through.type: 'main'  // ProductColor.type = 'main'
      )
    }
  }
})
```
Query example 2:
Select any Products which have Colors that are in red and is the main color of that product.
```js{7-10}
await Product.find({
  select: {
    colors: {}
  },
  // root is Product table
  where: ({root}) => root.colors({
    // root is Color table, through is pivot table
    where: ({root, through, And}) => And(
      root.code: 'red',     // Color.code = 'red'
      through.type: 'main'  // ProductColor.type = 'main'
    )
  })
})
```

### More Adaptive on changes of the business Requirements

traditionally, when building a system , it starts from simple requirement, usually the simple Object API of ORM can cater most of the use case. But when the requirements changes, you may find that only sql query builder or native sql can fulfill your businesss needs, so you have to rewrite the data logics from code from Model API to query builder.

One of the typical cases is a e-shop app. In early stage, your product page simply lists out the products by product creation date in ascending order (with pagination). As a developer, we usually use the Object API to cater that. But later the product owner ask you to list products by more complex logics like “Order By price of the products but Order By promotion date of the products if today is that promotion date”.

The traditional Model API cannot cater this because the FindOption accepts array of field names only, we need raw SQL to achieve this requirement.

But Taichi Model API is more adaptive, in this case, you just need to modify the OrderBy of the FindOption.

Before:
```js{3}
const products = await Product.find(
  {
    orderBy: ['price']
    limit: 50
  }
)

```

After:
```js{3-12}
const products = await Product.find(
  {
    orderBy: ({root, If, Now}) => ([
      { 
        value: If( 
          root.promotionDate.equals(Now),
          -1,
          root.price     
          ),
        order: 'asc'
      }
    ]),
    limit: 50
  }
)
```

<!-- 
## Quick Example

First, you have to declare your Models. 
Here we declare a simple `FieldProperty` 'id' and a `ComputeProperty` 'products'.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{1-12} js{4-5}](./quick-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{1-12} ts{4-5}](./quick-example1.ts)

  </CodeGroupItem>
</CodeGroup>

::: tip
You can declare one Model in one single file and import them when you use them.
:::


Second, we configure our ORM by registering Models and setup sql connection.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{17-27} js](./quick-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{17-27} ts](./quick-example1.ts)

  </CodeGroupItem>
</CodeGroup>


Then, you can use the Model API for data insertion and query.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{29-44} js{9,15}](./quick-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{29-44} ts{9,15}](./quick-example1.ts)

  </CodeGroupItem>
</CodeGroup>



Full Code Here
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code js](./quick-example1.js)

  </CodeGroupItem>

  <CodeGroupItem title="TS">

@[code ts](./quick-example1.ts)

  </CodeGroupItem>
</CodeGroup> -->