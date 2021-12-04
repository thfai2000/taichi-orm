
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


[View Full Document Here](https://thfai2000.github.io/taichi-orm)


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