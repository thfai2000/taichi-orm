import {configure, raw} from '../../../dist/'
import {snakeCase} from 'lodash'
import Shop from './models/Shop'
import Product from './models/Product'

let run = async() =>{

    // configure the orm
    await configure({
        modelsPath: process.cwd() + '/dist/models/',
        outputSchemaPath: process.cwd() + '/dist/db-schema.sql',
        entityNameToTableName: (className: string) => snakeCase(className),
        // tableNameToEntityName: (tableName: string) => camelCase(tableName),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        // fieldNameToPropName: (attributeName: string) => camelCase(attributeName),
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
    
    await basic()

    // await insert()

    // await advanced()
    
}

async function basic(){
    /**
     * Basic
     */
    let records0 = await Shop.find()
    console.log('queried0:', records0)

    /**
     * find records in coding style 1
     */
    let records1 = await Shop.find( (stmt, root) => {
        return stmt.where(root.id, '>', 2).limit(3)
    })
    console.log('queried1:', records1)

    /**
     *  find records in coding style 2
     */
    // let s = Shop.selector()
    // //FIXME: remove the toString() later
    // let records2 = await select(s.all).from(s.source).where(s.id, '>', 3)
    // console.log('queried2:', records2)

    /**
     * find records with relations (computed field)
     * !important: computed field is a function call
     */
    let records3 = await Shop.find( (stmt, root) => {
        return stmt.select(root.all, root.$.products())
    })
    console.log('queried3:', records3)

    
    /**
     * find records with multiple level of relations
     */
    let records4 = await Shop.find( (stmt, shop) => {
        return stmt.select(shop.all, shop.$.productCount(), shop.$.products( (stmt2, prd) => {
            return stmt2.select(prd.all, prd.$.colors()).limit(4)
        }))
    })
    console.log('queried4:', records4)

    let records5 = await Product.find( (stmt, prd) => {
        return stmt.select(prd.all, prd.$.shop())
    })
    console.log('queried5:', records5)


    let records6 = await Shop.find( (stmt, {all, $, $$}) => {
        return stmt.select(all, $.products()).where( raw('?? > ?', [$$.productCount(), 2]))
    })
    console.log('query6', records6)
}

async function advanced(){

    let records0 = await Shop.find( async (stmt) => {
        return await new Promise( (resolve, reject) =>{
            stmt.where({id: 1})
        })
    })
    console.log('queried0:', records0)

}

async function insert(){
     /**
     * insert records
     */  
    let record_inserted = await Shop.createOne({
        location: 'Malaysia'
    })
    console.log('inserted', record_inserted)


    let record_inserted1 = await Product.createOne({
        name: 'hello',
        shopId: record_inserted.id
    })
    console.log('inserted', record_inserted1)

}


run()
