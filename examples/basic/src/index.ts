import {configure, select} from '../../llorm/dist'
import {camelCase, snakeCase} from 'lodash'
import Shop from './models/Shop'

let run = async() =>{

    // configure the orm
    await configure({
        modelsPath: process.cwd() + '/dist/models/',
        dbSchemaPath: process.cwd() + '/src/db-schema.sql',
        entityNameToTableName: (className: string) => snakeCase(className),
        tableNameToEntityName: (tableName: string) => camelCase(tableName),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        fieldNameToPropName: (attributeName: string) => camelCase(attributeName),
        knexConfig: {
            client: 'mysql2',
            // connection: {
            //     host : '127.0.0.1',
            //     user : 'example',
            //     password : 'example',
            //     database : 'example'
            // }
        }
    })
    
    // get records
    let records = await Shop.get( (stmt, f) => stmt.select(f.products).where(f.id, '=', 1) )
    
    console.log(records)
}

run()


