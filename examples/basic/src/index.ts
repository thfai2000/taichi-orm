import {configure, select} from '../../../dist/'
import {camelCase, snakeCase} from 'lodash'
import Shop from './models/Shop'
const util = require('util')

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

    
    /**
     * insert records
     */  
    // let record_inserted = await Shop.create({
    // })
    // console.log('inserted', record)

//     insert into shop (id) values (null), (null), (null);
//   insert into product (name, shopId) values 
//   ('a', 1), ('b', 1), ('c',1),
//   ('d', 2), ('e', 2), ('f',2);

    /**
     * Basic
     */
    let records0 = await Shop.find()
    console.log('queried0:', records0)

    /**
     * find records in coding style 1
     */
    let records1 = await Shop.find( (stmt, root) => {
        return stmt.where(root.id, '>', 1).limit(5)
    })
    console.log('queried1:', records1)

    /**
     *  find records in coding style 2
     */
    let s = Shop.selector()
    //FIXME: remove the toString() later
    let records2 = await select(s.all).where(s.id, '>', 1).toString()
    console.log('queried2:', records2)


    /**
     * find records with relations (computed field)
     * !important: computed field is a function call
     */
    let records3 = await Shop.find( (stmt, root) => {
        return stmt.select(root.all, root.$.products()).where(root.id, '=', 1)
    })
    console.log('queried3:', records3)

    
    /**
     * find records with multiple level of relations
     */
    let records4 = await Shop.find( (stmt, shop) => {
        return stmt.select(shop.all, shop.$.products( (stmt2, prd) => {
            return stmt2.select(prd.all, prd.$.colors()).limit(4)
        }))
    })
    console.log('queried4:', records4)
}

run()


