# Getting Started


## Prerequisites

You have installed Nodejs with Version >= 14

## Installation

Following steps will guide you to create the necessary files in your project directory.

<CodeGroup>
  <CodeGroupItem title="TS" active>

```:no-line-numbers
├─ src
│  ├─ models         # model files
│  │  ├─ shop.ts
│  │  └─ product.ts
│  ├─ index.ts       # your program
│  └─ orm.ts         # your orm configuration
├─  package.json
└─  tsconfig.json
```

  </CodeGroupItem>
  <CodeGroupItem title="JS">

```:no-line-numbers
├─ src
│  ├─ models         # model files
│  │  ├─ shop.js
│  │  └─ product.js
│  ├─ index.js       # your program
│  └─ orm.js         # your orm configuration
└─ package.json
```
  </CodeGroupItem>
</CodeGroup>


- Step 1: Create and change into a new directory

```bash
mdir my-project
cd my-project
```

- Step 2: Initialize your project
```
npm init
```

- Step 3: Install TaiChi ORM and its dependencies
```bash
npm install --save taichi-orm knex
```

- Step 4: Install the SQL client (mysql, postgresql or sqlite)
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

- Step 5: Create `models` folder for your Model files.

```bash
mkdir src
cd src
mkdir models
```

- Step 6: Create Model files inside `models` folders


<CodeGroup>
  <CodeGroupItem title="TS" active>

@[code ts](../../examples/getting-started-typescript/src/models/shop.ts)

  </CodeGroupItem>
  <CodeGroupItem title="JS">


@[code ts](../../examples/getting-started-javascript/src/models/shop.js)

  </CodeGroupItem>
</CodeGroup>



<CodeGroup>
  <CodeGroupItem title="TS" active>

@[code ts](../../examples/getting-started-typescript/src/models/product.ts)

  </CodeGroupItem>
  <CodeGroupItem title="JS">


@[code ts](../../examples/getting-started-javascript/src/models/product.js)

  </CodeGroupItem>
</CodeGroup>



- Step 7: Create a file named 'orm.ts'('orm.js'). It contains settings of your ORM. Here we use 'sqlite3' as example.


```bash
cd ..
```

<CodeGroup>
  <CodeGroupItem title="TS" active>

@[code ts](../../examples/getting-started-typescript/src/orm.ts)

  </CodeGroupItem>
  <CodeGroupItem title="JS">


@[code ts](../../examples/getting-started-javascript/src/orm.js)

  </CodeGroupItem>
</CodeGroup>


::: tip
You can also register your Models with directory paths. Please see [Register Model](./concepts/orm.md#register-models)
:::


- Step 8: Create a file named 'index.js'.


<CodeGroup>
  <CodeGroupItem title="TS" active>

@[code ts](../../examples/getting-started-typescript/src/index.ts)

  </CodeGroupItem>
  <CodeGroupItem title="JS">


@[code ts](../../examples/getting-started-javascript/src/index.js)

  </CodeGroupItem>
</CodeGroup>


- Step 9: Run your program

```bash
node index.js
```

Output:
```
Found [ { products: [ [Object] ], id: 2 } ]
```

::: tip

You can find the [full examples here](https://github.com/thfai2000/taichi-orm/tree/main/examples/). 

:::