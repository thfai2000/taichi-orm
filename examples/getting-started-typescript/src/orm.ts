//@filename: src/orm.ts
import { ORM } from 'taichi-orm'
import Shop from './models/shop'
import Product from "./models/product"

// configure your orm
export default new ORM({
    // register the models here
    models: {
        Shop, Product
    },
    // knex config with client sqlite3 / mysql / postgresql
    knexConfig: {
        client: 'sqlite3',
        connection: {
            filename: ':memory:'
        }
    }
})