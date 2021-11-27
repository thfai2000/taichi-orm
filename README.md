
A new way to deal with your Data Logic. You can define a virtual field called `ComputedProperty` which is subquery or sql operators in your Data Model.

# Introduction

- Introduce a concept `ComputeProperty` for Data Model
  - It is a Entity's property. It consist of data logics defined using Query Builder
  - Once you orgazine your data logics in form of `ComputeProperty` that is highly resuable and extensible
  - It is like "Prepared SQL Statement" which contains custom pre-defined logics but also accepts parameters.   
- Developed in **Typescript** but you can use it without typescript compiler.
- Common relation logics such as `HasMany` and `belongsTo` are can be defined in form of `ComputedProperty`. And the related Models are queried in one single Sql call. (Explain later)


## Basic Usage of ComputeProperty

Imagine an E-commerce system. A product (Model) has various fields like `availableStart`, `availableEnd` and `remainingStock`.
A product is active when the current time are within these dates and the remainingStock are not zero.
We can define the schema like this:
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
```


Then you can use it simply just like a normal field
```ts
  let activeProducts = await Product.find({
    where: {
      isActive: true
    }
  })
```

ComputeProperty can accept Argument. Below variable `spare` is the Argument. The Argument must be optional.

```ts
export default class Product extends Model {
  ...
  hasEnoughStock = Product.compute((parent, spare?: number): CFReturn<boolean> => {
    return parent.remainingStock.greaterThan(spare ?? 2)
  }
}
```

Then you can use it as a normal field or a method
```ts
  await Product.find({
    where: {
      hasEnoughStock: true
    }
  })

  await Product.find({
    where: ({root}) => root.hasEnoughStock(5) //at least 5 remaining
  })
```

ComputeProperties can be used in both `where` or `select` parts of the `FindOptions`, so that you can querying the properties or filtering by the properties' values.
```ts
  let products = await Product.find({
    selectProps: ['isActive', 'hasEnoughStock'],
    where: {
      hasEnoughStock: true
    }
  })
```

## Using ComputedProperty as Related Entities 

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

These ComputeProperty are special because their Argument are `FindOption`. The related Entity can be queried and filtered according to the `FindOption`
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

Besides, the funtion call of ComputeField returns a `Scalar` that can be transformed into subquery like 'SELECT count(*) FROM ...'
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
export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')

    // define a relation based on 'shop' with additional where clause
    shopInHongKong = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
        (context, parent, args?): any => {
        return parent.selector.shop(args).transform( ds => {
            return ds.andWhere({
              location: 'Hong Kong'
            }).toScalar()
        })
    })
}

export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    location = this.field(StringType)
}
```

```ts
  // find all products which belongs to Shop with location 'Hong Kong'
  let products = await Product.find({
    where: ({root}) => root.shopInHongKong().exists()
  })
```


# Advanced Example 1 - Access Control

Imagine your Entity Product can be accessible by certain users. You can define a property that indicate it is accessible or not.

```ts
export default class Product extends Model {

    id = this.field(PrimaryKeyType)

    isAccessibleByUserId = Product.compute((context, parent, arg?: number): CFReturn<boolean> => {
        // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
        return context.dataset()
          .from( UserProduct.datasource('up') )
          .where({
            'up.userId': arg,
            'up.productId': parent.id
          }).exists()
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

      return Product.compute((context, parent, userId?: number): CFReturn<boolean> => {
          // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
          return context.dataset()
            .from( Role.datasource('role') )
            .innerJoin( User.datasource('user'), ({role, user}) => user.roleId.equals(role.id))
            .innerJoin( RoleEntity.datasource('re'), ({role, re}) => role.id.equals(re.roleId) )
            .where( ({re}) => re.entityName.equals( entityName ))
            .exists()
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

For some traditional ORM, querying the relation data of Model is not efficient. If the data query consist of multiple Entity, it executes SQL SELECT statement one by one. Usually, it produce several SQL query. But Why can't we query all these data from database in just one single call. It is just like the different approach between *GraphQL* and *Restful*.

##More explaination:

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


For some traditional ORM, it is not easy to apply filters on the pivot table of `manyToMany` relationship" because the Model definition is stricted.
But using ComputeProperty, you can define a SubQuery (We called it Dataset) which can allow us applying additional where clause condition on demand.



# Getting Start

WARNING: Don't use it for production
It is still under heavy development. The API specification can be changed in the future.
The npm package doesn't work now. It is out-dated. **The release target is Q4 of year 2021.**

1. Install the package
```bash
npm install --save taichi-orm
```

2. Install dependencies
```bash
npm install --save mysql
npm install --save pg
npm install --save sqlite3
```

3. define your Data Models (or in separates files)
. call `configure` to use the setup the resposity and database connection

```javascript
// #index.js

(async() =>{

    // configure the orm
    const orm = new ORM({
        models: {Shop: ShopClass, Product: ProductClass},
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: ':memory:'
            }
        }
    })

    let {
        createModels,
        dataset, 
        scalar,
        insert,
        del,
        update,
        models: {Shop, Product} 
    } = orm.getContext()

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

We needs some passionate developers. If you are interested and agreed with the ideas, you may join our project. You can talk in the discussion board.

Currently, I work one the ORM together with the example because the example can proof the concept of the ORM.
Tests will be added in the future once the specification is confirmed.

```bash
git clone ...

# Start the project. It is built by typescript
npm run dev

# Start one more terminal. It starts a database server
docker-compose up

# Start another terminal. Run the unit tests
npm run test

```