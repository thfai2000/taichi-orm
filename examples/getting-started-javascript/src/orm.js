const { ORM } = require('taichi-orm')

// configure your orm
module.exports = new ORM({
    // register the models here
    models: {
        Shop: require('./models/shop'),
        Product: require('./models/product')
    },
    // knex config with client sqlite3 / mysql / postgresql
    knexConfig: {
        client: 'sqlite3',
        connection: {
            filename: ':memory:'
        }
    }
})