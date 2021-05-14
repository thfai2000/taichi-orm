import {configure, select} from '../../../dist/'
import {camelCase, snakeCase} from 'lodash'
import Shop from './models/Shop'
import { rawListeners } from 'process'

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
            // connection: {
            //     host : '127.0.0.1',
            //     user : 'example',
            //     password : 'example',
            //     database : 'example',
            //     port: 3306
            // }
        }
    })

    
    /**
     * insert records
     */  
    // let record_inserted = await Shop.create({
    // })
    // console.log('inserted', record)

    /**
     * find records  in style 1
     */
    // let records1 = await Shop.find( (stmt, root) => {
    //     return stmt.select(root.all, root.$.products()).where(root.id, '=', 1)
    // })
    // console.log('queried1:', records1)

    /**
     *  find records  in style 2
     */
    // let s = Shop.selector()
    // let records2 = await select(s.all).where(s.id, '=', 1).toString()
    // console.log('queried2:', records2)

    /**
     * find records with multiple level of relations in style 1
     */
    let records3 = await Shop.find( (stmt, root) => {
        return stmt.select(root.all, root.$.products( (stmt2, root2) => {
            console.log('mmmmmmmmmmmmmm', root2.all)
            return stmt2.select(root2.all, root2.$.colors())
        })).where(root.id, '=', 1)
    })
    console.log('queried3:', records3)
}

run()


