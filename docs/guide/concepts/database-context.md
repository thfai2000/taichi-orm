# DatabaseContext

You can get your `DatabaseContext` from your `ORM` instance.

```js{4}
// Assume that the orm instance is defined in your 'orm.js'
const orm = require('./orm')

const context = orm.getContext()
```

It allow you to specific the prefix of the table names. When the ORM resolve the table names to construct SQL, the prefix will be added during query. See below codes.

It may be useful in some special cases.

```js{2}
const context = orm.getContext({
    tablePrefix: 'store1_'
})
```

## Usage

### Get the `ModelRepository`

Get the `ModelRepository` by names
```js
const { Model1Repo, Model2Repo } = context.repos

const records = await Model1Repo.find()
```

Get the `ModelRepository` by Model Class

```js
const Model1Repo = context.getRepository( require('./models/model1') )

const records = await Model1Repo.find()
```

### Create Models

It creates tables in database
```js
await context.createModels()
```

### Execute SQL Statement

It actually runs the `Knex.Raw()` to execute SQL statement and returns raw records.
```js
const rawRecords = context.executeStatement('SELECT 1 FROM table1')
```

### Start Transaction

- It runs the callback function after the transaction started and return a `Promise` of the result.

- `trx` is the Knex Transaction instance that is used by Model API calls or Query Builder.

- Model API or Query Builders can run query with Transaction instance by using `usingConnection()`.

```js{1,8}
await context.startTransaction( (trx) => {
    let { Model1Repo } = context.repos
    return await Model1Repo.update({
                field1: newValue
            }, {
                id: 1
            }).usingConnection(trx)
})
```

### Query Builders

Context provides various kind of query builders for data query, insertion, updates and deletion. 

Please see [Query Builder](./query-builder) for more details.

```js
// build insert statement
context.insert(Model1).values([data])

// build update statement
context.update().set(data).from(Model1.datasource('alias'))

// build delete statement
context.del().from(Model1.datasource('alias'))

// build select statement
context.dataset().from(Model1.datasource('alias'))

// build raw sql
context.scalar('SELECT 1 FROM Model1 WHERE id = ?', [1])

```

```js
let records = await querybuilder.execute()
```

### SQL Operators and Functions

Context provides SQL Operators and Functions that can be accessed from `$`.


```js
console.log(context.$.And(1, 2).toString())
// Output: 1 And 2

console.log(context.$.Or(1, 2).toString())
// Output: 1 Or 2

console.log(context.$.Exists(Model1.dataset()).toString())
// Output: EXISTS (SELECT * FROM Model1)

console.log(context.$.Between(10, 20).toString())
// Output: BETWEEN 10 AND 20

console.log(context.$.Now())
// Output: BETWEEN 10 AND 20

```

::: tip
Please see reference for more operators and functions
:::

