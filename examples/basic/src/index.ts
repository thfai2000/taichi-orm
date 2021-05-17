import {configure, select} from '../../../dist/'
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
    let s = Shop.selector()
    //FIXME: remove the toString() later
    let records2 = await select(s.all).from(s.source).where(s.id, '>', 3)
    console.log('queried2:', records2)

    /**
     * find records with relations (computed field)
     * !important: computed field is a function call
     */
    let records3 = await Shop.find( (stmt, root) => {
        return stmt.select(root.all, root.$.products()).where(root.id, '=', 'aaaa')
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

    let records5 = await Product.find( (stmt, prd) => {
        return stmt.select(prd.all, prd.$.shop())
    })
    console.log('queried5:', records5)

        
    /**
     * insert records
     */  
    let record_inserted = await Shop.createOne({
        location: 'Malaysia'
    })
    console.log('inserted', record_inserted)


    // let shops = [
    //     {
    //         products: [
    //             {colors: []},
    //             {colors: []},
    //         ]
    //     },
    //     {
    //         products: [
    //             {colors: []},
    //             {colors: []},
    //             {colors: []}
    //         ]
    //     }
    // ]

    // shops.forEach(s => {

    //     await Shop.create(s, (stmt, selector) => {
    //         stmt.where(selector.id, '=', )
    //     })

    //     await Shop.update(s, (stmt, selector) => {
    //         return stmt.where(selector.id, '=', )
    //     }, ({products}) => {
    //         products(5).colors(10)
    //     })
    // })

    // Shop.mutate(data, (stmt, $) => {
    //     stmt.update($.all, $.products( data.products, (stmt, $) => {
    //         stmt.update($.all, $.colors() )
    //     })).where( )
    // })

    // shop.save()       // create or update

}

run()
