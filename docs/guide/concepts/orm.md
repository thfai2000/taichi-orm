# ORM

Before getting started, you must create a ORM instance.
The ORM instance is the root of your data logics.
It provides `DatabaseContext` which are used to access the `ModelRepository`.

```js
const { ORM } = require('taichi-orm')

const orm = new ORM(ormConfig)
```


## Usage

### SQL client

You must specify the `KnexConfig` in the ORMConfig

```js{6-11}
const orm = new ORM({
    models: {
        //....
    }
    // knex config with client sqlite3 / mysql / postgresql
    knexConfig: {
        client: 'sqlite3',
        connection: {
            filename: ':memory:'
        }
    }
})
```

### Register Models

You must specify your `Models` in the ORMConfig

```js{3-6}
const orm = new ORM({
    // register the models here
    models: { 
        Model1RepoName: Model1, 
        Model2RepoName: Model2
    },
    knexConfig: {
        //...
    }
})

// get ModelRepository
let { Model1RepoName, Model2RepoName } = orm.getContext().models

// make query
let modelRecords = await Model1RepoName.find({ where: {id: 1} })

```
The `models` are object with keys of `ModelRepository` names.

::: tip
For convenience, we usually name the `ModelRepository` with the same names as corresponding  `Models`.
:::

If you put all your Model files in a directory, you can also register your models by given the directory path. The names of the `ModelRepository` will be the camel cases of their filenames with first letter captialized.

```js{3}
const orm = new ORM({
    // Relative Path to the directory you run your nodejs runtime
    modelsPath: './models',
    knexConfig: {
        //...
    }
})
```

::: tip
If you use `modelsPath`, you will use lose typescript hints provided by `Model API`. 

If your app is using javascript, it is suggested to use `models` options to specify your `Models`.

If your app is using typescript, you can provide type hints manually. Please see [Typescript Support](../typescript-support#model-repository)
:::


## Table Name

## More options

Here are all the options of ORM

```ts
export type ORMConfig<ModelMap extends {[key:string]: typeof Model}> = {
    // sql client connection
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // object of Models
    models: ModelMap
    // the directory of the Model files
    modelsPath?: string,
    // output a SQL file of all schema
    outputSchemaPath?: string,
    // function to convert model name to table name
    entityNameToTableName?: (name:string) => string,
    // function of convert property Name to field name
    propNameTofieldName?: (name:string) => string
}
```

