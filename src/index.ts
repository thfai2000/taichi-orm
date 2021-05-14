// import { Builder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs';
const sqlParser = require('js-sql-parser');

export type Config = {
    modelsPath: string,
    dbSchemaPath: string,
    entityNameToTableName?: (params:string) => string,
    tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    fieldNameToPropName?: (params:string) => string,
    knexConfig: object
}

// the new orm config
let config: Config = {
    modelsPath: 'models/',
    dbSchemaPath: 'db-schema.sql',
    knexConfig: {client: 'mysql2'}
}

// a global knex instance
const getKnexInstance = () => knex(config.knexConfig)


const types = {
    AutoIncrement: ['bigint', 'NOT NULL', 'AUTO_INCREMENT', 'PRIMARY KEY'],
    String: (length: number, nullable: boolean) => [`varchar(${length})`],
    Number: ['integer'],
    Date: ['datetime'],
    arrayOf: function(entity: { new(): Entity }){
        //TODO
    }
}

export const Types = types

export const More = {
    Null: 'NULL',
    NotNull: "NOT NULL"
}

let schemas: any = {}
export class Schema {

    tableName: string
    entityName: string
    properties: ModelProperty[]
    primaryKey: ModelProperty

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = {
            name: 'id',
            definition: [Types.AutoIncrement],
            computedFunc: null
        }
        this.properties = [this.primaryKey]
    }

    createTableStmt(){
        return `CREATE TABLE \`${this.tableName}\` (\n${this.properties.filter(f => !f.computedFunc).map(f => `\`${f.name}\` ${f.definition.flat().join(' ')}`).join(',\n')}\n)`;
    }


    prop(name:string, definition: any, options?: any){
        this.properties.push({
            name,
            definition,
            ...options,
            computedFunc: null
        })
    }

    computedProp(name:string, definition: any, computedFunc: ComputedFunctionDefinition){
        this.properties.push({
            name,
            definition,
            computedFunc
        })
    }

}


function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * 
 charactersLength)));
   }
   return result.join('');
}

export interface SQLString{
    toString(): string
}

export type ComputedFunctionDefinition = (map: NameMap, ...args: any[]) => SQLString


export type ModelProperty = {
    name: string,
    definition: any,
    options?: any,
    computedFunc: ComputedFunctionDefinition | null
}

export const configure = async function(newConfig: Config){
    config = newConfig

    let files = fs.readdirSync(config.modelsPath)
    let tables: Schema[] = []
    
    await Promise.all(files.map( async(file) => {
        if(file.endsWith('.js')){
            let path = config.modelsPath + '/' + file
            path = path.replace(/\.js$/,'')
            console.log('load model file:', path)
            let p = path.split('/')
            let entityName = p[p.length - 1]
            let entityClass = require(path)
            if(entityClass.default.register){
                let s = new Schema(entityName)
                tables.push(s)
                entityClass.default.register(s)
                schemas[entityName] = s
            }
        }
    }))
    // let schemaFilename = new Date().getTime() + '.sql'
    let path = config.dbSchemaPath //+ '/' + schemaFilename
    fs.writeFileSync(path, tables.map(t => t.createTableStmt()).join(";\n") + ';' )
    console.log('schemas:', Object.keys(schemas))
}

export const select = function(...args: any[]) : Knex.QueryBuilder {
    return getKnexInstance().select(args)
}

export type NameMap = {
    [key: string]: string | NameMapCall | any
}

export type NameMapCall = (queryFunction: QueryFunction) => SQLString

export type QueryFunction = (stmt: Knex.QueryBuilder, map: object) => Knex.QueryBuilder

export class Entity {
    constructor(){
    }

    static get schema(): Schema{
        return schemas[this.name]
    }

    static get tableName() {
        return this.schema.tableName
    }

    // create a basic belongsTo prepared statement (SQL template)
    static belongsTo(entityClass: typeof Entity, propName: string){
        let map = this.produceNameMap()
        return getKnexInstance().from(map.$).where(getKnexInstance().raw("?? = ??", [propName, map.$id]))
    }

    // create a basic belongsTo prepared statement (SQL template)
    static hasMany(entityClass: typeof Entity, propName: string){
        let map = entityClass.produceNameMap()
        return getKnexInstance().from(map.$).where(getKnexInstance().raw("?? = ??", [propName, map.$id]))
    }

    /**
     * alias 
     * @returns NameMap
     */
    static nameMap(): NameMap {
        return this.produceNameMap()
    }

    /**
     * NameMap is very important. used for building sql part with actual field name
     * field pointers
     * @returns 
     */
    static produceNameMap(): NameMap {
        let randomTblName = makeid(5)
        let propNameTofieldName = config.propNameTofieldName ?? ((name) => name)
        let map: NameMap = {
            $: `${this.schema.tableName} AS ${randomTblName}`,   // used as table name
            $all: `${randomTblName}.*`,                          
            $id : `${randomTblName}.${propNameTofieldName(this.schema.primaryKey.name)}`
        }
        this.schema.properties.forEach( (prop) => {
            //convert the props name into actual field Name
            let actualFieldName = propNameTofieldName(prop.name)
            if(prop.computedFunc){
                let func = prop.computedFunc
                map[prop.name] = (...args: any[]) => {
                    let subquery = func(map, ...args).toString()

                    // determine the column list
                    let ast = sqlParser.parse(subquery)
                    //TODO: there will be bug if the alias contain . inside
                    let columns: string[] = ast.value.selectItems.value.map( (v:any) => (v.alias? v.alias: v.value) ).map( (v:string) => {
                        let p = v.split('.')
                        let name = p[p.length - 1]
                        return name
                    })
                    
                    // FIX: more than one table has *
                    if(columns.includes('*')){
                        //replace star into all column names
                        //TODO:
                    }

                    let jsonify =  `SELECT JSON_ARRAYAGG(JSON_OBJECT(${
                        columns.map(c => `'${c.replace(/[`']/g,'')}', ${c}`).join(',')
                    })) FROM (${subquery}) AS ${makeid(5)}`

                    return getKnexInstance().raw('(' + jsonify + `) AS ${actualFieldName}`)
                }
            } else {
                map[prop.name] = `${randomTblName}.${actualFieldName}`
            }
        })

        return map
    }

    static async find(func: QueryFunction ){
        let map: any = this.produceNameMap()
        let stmt: Knex.QueryBuilder = getKnexInstance().from(map.$)
        stmt = func(stmt, map)
        console.log("========== FIND ================")
        console.log(stmt.toString())
        console.log("================================")
        return await stmt
    }

    // it is a parser
    static Array(){

    }
}



/**
 * 
 * 
 *  Below is for experiment usage
 * 
 * 
 */

// export const select = function(...args: any[]){

//     let alias: string[] = args.map(s => /\[\[(.*)\]\]/g.exec(s)?.[1] || '' ).filter(s => s.length > 0)
    
//     let info = alias.map(a => {
//         let parts = a.split('|')
//         return {
//             fullName: `[[${a}]]`,
//             tableName: parts[0],
//             aliasName: parts[1],
//             fieldName: parts[2]
//         }
//     })

//     let distinctNames: string[] = [...new Set(info.map(i => `${i.tableName} as ${i.aliasName}`))]
//     // let [firstName, ...otherNames] = distinctNames

//     let stmt = getKnexInstance().select(...args)
//     if(distinctNames.length === 1){
//         stmt = stmt.from(distinctNames[0])
//     }

//     // stmt = distinctNames.reduce((acc, name) => acc.from(name, {only:false}), stmt)
//     console.log(stmt.toSQL())
//     return stmt
// }

// select('[[SKU|t1|name]].name', '[[SKU|t1|abc]].abc')