// import { Builder } from './Builder'
import knex from 'knex'
import { Entity } from './entity'
import * as fs from 'fs';

// let knexObj: Knex<any, unknown[]> | null = null
// const getGlobalKnex = () => {
//     if(!knexObj){
//         knexObj = knex({
//         client: 'mysql2',
//             // connection: {
//             //     host : '127.0.0.1',
//             //     user : 'example',
//             //     password : 'example',
//             //     database : 'example'
//             // }
//         });
//     }
//     return knexObj
// }

type Config = {
    modelsPath: string,
    entityNameToTableName?: (params:string) => string | undefined,
    tableNameToEntityName?: (params:string) => string| undefined,
    propNameTofieldName?: (params:string) => string| undefined,
    fieldNameToPropName?: (params:string) => string| undefined
}

let config: Config = {
    modelsPath: 'models/'
}

export const configure = async function(newConfig: Config){
    config = newConfig

    let files = fs.readdirSync(config.modelsPath)
    
    await Promise.all(files.map( async(file) => {

        if(file.endsWith('.js')){
            let path = config.modelsPath + '/' + file
            path = path.replace(/\.js$/,'')
            console.log('load model file:', path)
            let entityClass = require(path)
            entityClass.default.register()
        }
    }))
}

export const Types = {
    AutoIncrement: ['bigint','AutoIncrement'],
    String: (length: number, nullable: boolean) => [`varchar(${length})`, nullable?'null':'not null'],
    StringNull: ['varchar(255)', 'null'],
    StringNotNull: ['varchar(255)', 'not null'],
    Number: [],
    Date: [],
    arrayOf: function(entity: { new(): Entity }){
        //TODO
    }
}

export const Select = function(...args: any[]){

    let alias: string[] = args.map(s => /\[\[(.*)\]\]/g.exec(s)?.[1] || '' ).filter(s => s.length > 0)
    
    let info = alias.map(a => {
        let parts = a.split('|')
        return {
            fullName: `[[${a}]]`,
            tableName: parts[0],
            aliasName: parts[1],
            fieldName: parts[2]
        }
    })

    let distinctNames: string[] = [...new Set(info.map(i => `${i.tableName} as ${i.aliasName}`))]
    // let [firstName, ...otherNames] = distinctNames

    let stmt = knex({client: 'mysql2'}).select(...args)
    if(distinctNames.length === 1){
        stmt = stmt.from(distinctNames[0])
    }

    // stmt = distinctNames.reduce((acc, name) => acc.from(name, {only:false}), stmt)
    console.log(stmt.toSQL())
    return stmt
}

Select('[[SKU|t1|name]].name', '[[SKU|t1|abc]].abc')