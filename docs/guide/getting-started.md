# Getting Started


## Prerequisites

You have installed Nodejs with Version >= 12

## Installation

Following steps will guide you to create the necessary files in your project directory.

```:no-line-numbers
├─ models         # model files
│  ├─ shop.js
|  ├─ product.js
├─ orm.js         # your orm configuration
├─ index.js       # your program
└─ package.json
```

Step 1: Create and change into a new directory

```bash
mdir my-project
cd my-project
```

Step 2: Initialize your project
```
npm init
```

Step 3: Install TaiChi ORM and its dependencies
```bash
npm install --save taichi-orm knex
```

Step 4: Install the SQL client (mysql, postgresql or sqlite)
<CodeGroup>
  <CodeGroupItem title="Mysql" active>

```bash
npm install --save mysql2
```

  </CodeGroupItem>
  <CodeGroupItem title="Postgresql">

```bash
npm install --save pg
```

  </CodeGroupItem>

  <CodeGroupItem title="sqlite">

```bash
npm install --save sqlite3
```

  </CodeGroupItem>

</CodeGroup>

Step 5: Create `models` folder for your Model files.

```bash
mkdir models
```


Step 6: Create Model files inside `models` folders

```js
//File: models/shop.js
const { Model, PrimaryKeyType} = require('taichi-orm')
const Product = require('./product')

module.exports = class Shop extends Model {
    id = this.field(PrimaryKeyType)
    products = Shop.hasMany(Product, 'shopId')
}
```


```js
//File: models/product.js
const { Model, PrimaryKeyType, NumberType } = require('taichi-orm')
const Shop = require('./shop')

module.exports = class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId')
}
```

Step 7: Create a file named 'orm.js'. It contains settings of your ORM. Here we use 'sqlite3' as example.

```js
//File: orm.js
const { ORM } = require('taichi-orm')
const Shop = require('./models/shop')
const Product = require('./models/product')

// configure your orm
module.exports = new ORM({
    // register the models here
    models: {Shop, Product},
    // knex config with client sqlite3 / mysql / postgresql
    knexConfig: {
        client: 'sqlite3',
        connection: {
            filename: ':memory:'
        }
    }
})
```
::: tip
You can also register your Models with directory paths. Please see [Register Model](./concepts/orm.md#register-models)
:::


Step 8: Create a file named 'index.js'.
```js
const orm = require('./orm')

(async() =>{
  let {
      createModels,
      repos: {Shop, Product} 
    } = orm.getContext()

    // create the tables (if necessary)
    await createModels()

    let createdShop = await Shop.create([{ id: 1 }, {id: 2}])
    let createdProducts = await Product.create([
      {shopId: createdShop.id, name: 'Product1'},
      {shopId: createdShop.id, name: 'Product2'}
    ])

    //Find Shop with Id 2 and with related products
    let foundShop2 = await Shop.find({
      selectProps: ['products']
      where: {id: 2}
    })

    console.log('Found', foundShop2)

})()
```

Step 9: Run your program

```bash
node index.js
```

Output:
```

```