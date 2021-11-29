
<p align="center">
  <img src="miscs/images/logo100x100.jpg" alt="taichi"/>
</p>
<p align="center">Tai Chi (太極)</p>
<p align="center">Emphasis on both hard and soft</p>
<br/>

A new way to deal with your Data Logic of SQL Databse. You can define a virtual field called `ComputeProperty` (that actually is SQL statement) for a data model.

# Introduction

- The common data logics in form of `ComputeProperty` of Data Model become more reusable.
- The codes of data query become more human readable because complex data logics can be abstracted in `ComputeProperty`.
- Flexible and strong Model API. Without using `QueryBuilder`, `Model.find()` is powerful enough to build complex logics by extending or modifying the `ComputeProperty`.
- Developed in **Typescript** but you can use it without typescript compiler.
- Common relation logics such as `HasMany` and `belongsTo` are can be defined in form of `ComputeProperty`. And the related Models are queried in one single Sql call.

In below sections, We will explain the ORM stuff using E-commerce-like database as an example.

## Basic usage of ComputeProperty

Imagine an E-commerce system. A product (Model) has various fields like `availableStart`, `availableEnd` and `remainingStock`.
A product is active when the current time are within these dates and the remainingStock are not zero.
We can define the schema like below (with a `isActive` ComputeProperty).
`ComputeProperty` consist of `ComputeFunction` that defines how to make a SQL value (we called `Scalar`).
The variable `parent` represents the Datasource of `Product` Model. 
The property `isActive` combines the values of other `FieldProperty`.

```ts
export default class Product extends Model {

    //define field properties here
    id = this.field(PrimaryKeyType)
    availableStart = this.field(DateNotNullType)
    availableEnd = this.field(DateNotNullType)
    remainingStock = this.field(NumberNotNullType)

    //define ComputeProperty based on the value of FieldProperty
    isActive = Product.compute((parent): CFReturn<boolean> => {
        return new Scalar(context => context.op.And(
            parent.selector.availableStart.lessThan( new Date() ),
            parent.selector.availableEnd.greaterThan( new Date() ),
            parent.selector.remainingStock.greaterThan(0)
        ))
    })
}
```

Below the `ModelRepository.find()` function accepts one argument `FindOptions` (Just like the other ORM). 
The `where` part specifies the data filtering condition.
You can use the `isActive` ComputeProperty simply just like a normal field (FieldProperty) in the `where` object.
```ts
let activeProducts = await Product.find({
  where: {
    isActive: true
  }
})
```

Besides, `ComputeFunction` can accept argument. 
Below variable `spare` is the argument. The argument of `ComputeFunction` must be optional.

```ts
export default class Product extends Model {
  
  // 'Enough' means at least certain amount of stock
  hasEnoughStock = Product.compute((parent, spare?: number): CFReturn<boolean> => {
    return parent.remainingStock.greaterThan(spare ?? 2)
  }
}
```

Then you can use it like a normal field or a method.
If you use it as object Key, the argument of that `ComputeFunction` is undefined.
You can only pass argument in using method.
```ts
await Product.find({
  where: {
    hasEnoughStock: true
  }
})

//another approach: use ComputeFunction argument
await Product.find({
  where: ({root}) => root.hasEnoughStock(5) //at least 5 remainings
})
```

The `FindOptions` consists of `where`, `orderBy`, `select`, `selectProps` etc.
You can querying the properties by specifying the ComputeProperty in `select` and `selectProps`.
`selectProps` is array of ComputeProperties whereas `select` is object with keys of ComputeProperties.
In the `select` object, the value of the key is the argument of that corresponding `ComputeFunction`.
```ts
let products = await Product.find({
  selectProps: ['isActive', 'hasEnoughStock'],
  where: {
    hasEnoughStock: true
  }
})

let products = await Product.find({
  select: {
    //pass 5 as the argument of the ComputeFunction
    hasEnoughStock: 5   
  },
  where: {
    hasEnoughStock: true
  }
})
```

## Using ComputeProperty as Related Entities 

Typical use cases are querying Related Entities and filtering related Entities
Let's say a Product belongs to a Shop. 
We can define ComputeProperty called 'shop' or 'products' on these two Models using our built-in functions such as 'belongsTo' and 'hasMany'.

```ts
export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    color = this.field(StringType)
    //define a computeProperty as "belongsTo" relation
    shop = Product.belongsTo(Shop, 'shopId', 'id')
}

export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    location = this.field(StringType)
    //define a computeProperty as "hasMany" relation
    products = Shop.hasMany(Product, 'shopId', 'id')
}
```

Simply get array of `Shop` objects, each `products` key with value of array of `Product`
```ts
// Simply select shop, each with array of products
let shops = await Shop.find({
  selectProps: ['products']
})
```

These ComputeFunctions are special because their arguments are `FindOption`. The related Entity can be queried and filtered according to the `FindOption`
```ts
// find shops with related products which are only in color 'red'
let shops = await Shop.find({
  select: {
    // select the computed property 'products'
    products: {
      where: {
        color: 'red'
      }
    }
  },
  where: {
    //...
  }
})
```

Example: use it in `where`
```ts
// find all products which belongs to Shop with location 'Hong Kong'
let products = await Product.find({
  where: ({root}) => root.shop({
    where: {
      location: 'Hong Kong'
    }
  }).exists()
})

// another approach (if the 'hasMany' relationship is not defined in Model Schema)
await Product.find({
  where: ({root, Exists}) => Exists( Shop.dataset({
    where: {
      shopId: root.id,
      location: 'Hong Kong'
    }
  }))
})
```

Besides, the funtion call of `ComputeProperty` returns a `Scalar` that can be transformed into subquery like "SELECT count(*) FROM ..."
```ts
// find all shops which has more than 5 products
let shops = await Shop.find({
  where: ({root}) => root.products().count().greaterThan(5)
})

// another approach (if the 'hasMany' relationship is not defined in Model Schema)
let shops = await Shop.find({
  where: ({root}) => Product.dataset({
    where: {
      shopId: root.id
    }
  }).toDScalar().count().greaterThan(5)
})
```

## Define ComputeProperty based on another ComputeProperty

A more advanced usage.
ComputeProperty is very flexible. You can define it based on another existing ComputeProperty or FieldProperty

```ts
export default class Shop extends Model {
    id = this.field(PrimaryKeyType)
    location = this.field(StringType)
}

export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')

    // define a relation based on 'shop' with additional where clause
    shopInHongKong = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
        (parent, args?): any => {
        // the shop Scalar is transformed into another Scalar. 
        // The original dataset ('ds') is modified by adding where clause
        return parent.selector.shop(args).transform( ds => {
            return ds.andWhere({
              location: 'Hong Kong'
            }).toScalar()
        })
    })
}
```

```ts
// find all products which belong to Shop with location 'Hong Kong'
let products = await Product.find({
  where: ({root}) => root.shopInHongKong().exists()
})
```


# Concepts

## Model
It represents a database table.

## ModelRepository
It is used for carry out `create`, `update`, `delete` operations on a Model.

## DatabaseContext
It consists of a set of ModelRepository

## ORM
It is a object with Database connection settings.
It manages DatabaseContext.

## Dataset
It is a query builder and represents the SELECT statement.

## Scalar
It represent a SQL single value with a specifc type like number, string or date.
Dataset can be transformed into a Scalar. For example, 'SELECT count(*) FROM table1' can act as a Scalar in number type.

## FieldProperty
It represents a field of a Model.

## ComputeProperty
It represents a virtual field of a Model.
It consists of a `ComputeFunction` that defines how to create a Scalar.

## ComputeFunction
It defines how to create a Scalar.

## Schema
It represents the properties of a Model or a Dataset.

## Datasource
It is used in data query. 
It has name (like table alias) that represents of a database table or a temporary table.
`Datasource.selector` is an object having keys of properties names and with values of corresponding Scalar or ComputeFunction.

# Advanced Example 1 - Scalar Transformation

A Scalar can transformed into another Scalar in different type/value.

```ts
    let ctx = orm.getContext()
    let {Shop} = ctx.models

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


# Advanced Example 2 - Access Control

Imagine your Entity Product can be accessible by certain users. You can define a property that indicate it is accessible or not.

```ts
export default class Product extends Model {

    id = this.field(PrimaryKeyType)

    isAccessibleByUserId = Product.compute((parent, arg?: number): CFReturn<boolean> => {
        // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
        return new DScalar(context => context.dataset()
          .from( UserProduct.datasource('up') )
          .where({
            'up.userId': arg,
            'up.productId': parent.id
          }).exists()
        )
    })
```

Then you can use it like a function.
```ts
  const currentUserId = 1

  let targetProducts = await Product.find({
    where: ({root, And}) => And(
      { isActive: true },
      root.isAccessibleByUserId(currentUserId)  // the function call return a boolean Scalar
    )
  })

```

If you find some logics are often repeated on many Models. It is suggested to create a util function. Let say you want all Entities has Role-Based Access Control. Here are the related tables Role, User, RoleEntity. 

User  
- id
- roleId

Role
- id

RoleEntity
- roleId
- entityName   (Model which that role can access)


We define a Model class as a base class of the other models you want to be protected with Access Control
```ts
//rbacModel.ts
export default class RBACModel extends Model {

    static propertyOfEditableByUserId(entityName: string){

      return Product.compute((parent, userId?: number): CFReturn<boolean> => {
          // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
          return new DScalar(context => context.dataset()
            .from( Role.datasource('role') )
            .innerJoin( User.datasource('user'), ({role, user}) => user.roleId.equals(role.id))
            .innerJoin( RoleEntity.datasource('re'), ({role, re}) => role.id.equals(re.roleId) )
            .where( ({re}) => re.entityName.equals( entityName ))
            .exists()
          )
      })
    }
}
```


```ts
//product.ts
export default class Product extends RBACModel {
  id = this.field(PrimaryKeyType)

  //use the static method to create a property
  isEditableByUserId = Product.propertyOfEditableByUserId('product')
}
```

```ts
  const currentUserId = 1

  let products = await Product.find({
    where: ({root}) => 
      root.isEditableByUserId(currentUserId)  // the function call return a boolean Scalar
  })
```


# Difference between traditional ORM

## Retrieve Entity and its related Entity in single SELECT statement

For some traditional ORM, querying the relation data of Model is not efficient. If the data query consist of multiple Entity, it executes SQL SELECT statement one by one. Usually, it produce several SQL query. But Why can't we query all these data from database in just one single call.

Let's say we have data models `Shop`, `Product`, `Color`.
A shop has many products and each product has many colors.
For traditional ORM, when we select Entity and its relation like this.
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
It may be more efficient than the traditional way. taichi-orm is currently using this approach.

## Filtering relation records

For some traditional ORM, it is not easy to apply filters on the pivot table of `manyToMany` relationship" because the Model definition is abstracted.
But our Model API allows us applying additional where clause during query. See below code examples.

```ts
class Color extends Model {
  id = this.field(PrimaryKeyType)
  //possible values: 'red', 'blue'...
  code = this.field(new StringNotNullType({length: 50}))
}

class Product extends Model{
  id= this.field(PrimaryKeyType)
  //One Product has many Colors
  colors = Product.hasManyThrough(ProductColor, Color, 'id', 'colorId', 'productId')
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

// select all Products with the filtered Colors that are in red and is the main color of that product.
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

// select any Products which have Colors that are in red and is the main color of that product.
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

# Getting start

WARNING: Don't use it for production
It is still under heavy development. The API specification can be changed in the future.
**The release target is Q1 of year 2022.**

1. Install the package
```bash
npm install --save taichi-orm
```

2. Install dependencies (if necessary)
```bash
npm install --save mysql
npm install --save pg
npm install --save sqlite3
```

3. define your Data Models (or in separates files) and setup database connection

Example:
```ts
// #index.ts
import { ORM, PrimaryKeyType, NumberType } from 'taichi-orm'

class ShopModel extends Model {
    id = this.field(PrimaryKeyType)
    products = ShopModel.hasMany(ProductModel, 'shopId')
}

class ProductModel extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = ProductModel.belongsTo(ShopModel, 'shopId')
}

(async() =>{

    // configure your orm
    const orm = new ORM({
        models: {Shop: ShopModel, Product: ProductModel},
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: ':memory:'
            }
        }
    })

    let {
        createModels,
        models: {Shop, Product} 
    } = orm.getContext()

    await createModels()

    let createdShop = await Shop.createOne({ id: 1 })
    let createdProducts = await Product.create([
      {shopId: createdShop.id, name: 'Product1'},
      {shopId: createdShop.id, name: 'Product2'}
    ])

    let allShops = await Shop.find()
    let allProducts = await Product.find()

})()
```

4. Start your program
```bash
node index.js
```

# Acknowledgement
Thanks Knex. The project is heavily using Knex.

# Development?

If you are interested and agreed with the ideas, you may join our project. You can talk in the discussion board.

```bash
git clone ...

# Start the project. It is built by typescript
npm run dev

# Start one more terminal. It starts a database server
docker-compose up

# Start another terminal. Run the unit tests
npm run test

```