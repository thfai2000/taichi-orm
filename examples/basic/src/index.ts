import {configure, select} from '../../../dist/'
import {camelCase, snakeCase} from 'lodash'
import Shop from './models/Shop'

let run = async() =>{

    // configure the orm
    await configure({
        modelsPath: process.cwd() + '/dist/models/',
        dbSchemaPath: process.cwd() + '/dist/db-schema.sql',
        entityNameToTableName: (className: string) => snakeCase(className),
        tableNameToEntityName: (tableName: string) => camelCase(tableName),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        fieldNameToPropName: (attributeName: string) => camelCase(attributeName),
        knexConfig: {
            client: 'mysql2',
            connection: {
                host : '127.0.0.1',
                user : 'example',
                password : 'example',
                database : 'example',
                port: 3306
            }
        }
    })
    
    // let record = await Shop.create({

    // })
    // console.log('inserted', record)

    // find records
    let records = await Shop.find( (stmt, root) => {
        console.log('log nameMap', root)
        return stmt.select(root.$all, root.products()).where(root.id, '=', 1)
    })
    console.log('queried:', records)

    
    let s = Shop.nameMap()
    await select(s.$all).where(s.$id, '=', 1)

    console.log('queried:', records)
}

run()


