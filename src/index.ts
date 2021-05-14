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
const config: Config = {
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
    namedProperties: NamedProperty[]
    primaryKey: NamedProperty

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = new NamedProperty(
            'id',
            [Types.AutoIncrement],
            null
        )
        this.namedProperties = [this.primaryKey]
    }

    createTableStmt(){
        return `CREATE TABLE \`${this.tableName}\` (\n${this.namedProperties.filter(f => !f.computedFunc).map(f => `\`${f.name}\` ${f.definition.flat().join(' ')}`).join(',\n')}\n)`;
    }


    prop(name:string, definition: any, options?: any){
        this.namedProperties.push(new NamedProperty(
            name,
            definition,
            null,
            options
        ))
    }

    computedProp(name:string, definition: any, computedFunc: ComputedFunctionDefinition, options?: any){
        this.namedProperties.push(new NamedProperty(
            name,
            definition,
            computedFunc,
            options
        ))
    }
}


function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
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

export type ComputedFunctionDefinition = (selector: Selector, queryFunction: QueryFunction, ...args: any[]) => Knex.QueryBuilder


export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: any,
        public computedFunc: ComputedFunctionDefinition | null,
        public options?: any){}

    get fieldName(){
        return config.propNameTofieldName ? config.propNameTofieldName(this.name) : this.name
    }
}

export const configure = async function(newConfig: Config){
    Object.assign(config, newConfig)

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

export const raw = function(first: string, ...args: any[]) : any{
    return getKnexInstance().raw(first, ...args)
}

export type ComputedSelector = {
    [key: string] : compiledComputedFunction
}

export type FieldSelector = {
    [key: string] : string
}

export type Selector = {
    schema: Schema,
    '_': FieldSelector,
    '$': ComputedSelector,       
    'table': string,            // "table"
    'tableAlias': string,       // "abc"
    'source': string,           // "table AS abc"
    'all': string,              // "abc.*"
    'id': string,                // "abc.id"
    // (SQL template) create a basic belongsTo prepared statement 
    'hasMany': (entityClass: typeof Entity, propName: string, injectFunc: QueryFunction) => Knex.QueryBuilder,
    // (SQL template) create a basic belongsTo prepared statement 
    'belongsTo': (entityClass: typeof Entity, propName: string, injectFunc: QueryFunction) => Knex.QueryBuilder
}

export type compiledComputedFunction = (queryFunction?: QueryFunction, ...args: any[]) => SQLString

export type QueryFunction = (stmt: Knex.QueryBuilder, selector: Selector) => Knex.QueryBuilder

export class Entity {
    constructor(){
    }

    static get schema(): Schema{
        return schemas[this.name]
    }

    static get tableName() {
        return this.schema.tableName
    }

    /**
     * Can be overridden by inheritance Class
     * @param schema
     */
    static register(schema: Schema) : void{
    }

    /**
     * alias of produceSelector
     * @returns Selector
     */
    static selector(): Selector {
        return this.produceSelector()
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    static produceSelector(): Selector {
        let randomTblName = this.schema.entityName + '_' + makeid(5)
        let selector: Selector = {
            schema: this.schema,
            table: `${this.schema.tableName}`,
            tableAlias: `${randomTblName}`,
            source: `${this.schema.tableName} AS ${randomTblName}`,   // used as table name
            all: `*`,                          
            id : `${randomTblName}.${this.schema.primaryKey.fieldName}`,
            _: {},
            $: {},
            hasMany(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): Knex.QueryBuilder{
                let selector = entityClass.produceSelector()
                let stmt = getKnexInstance().from(selector.source).where(getKnexInstance().raw("?? = ??", [this.id, selector._[propName]]))
                return applyFilter(stmt, selector)
            },
            belongsTo(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): Knex.QueryBuilder{
                let selector = entityClass.produceSelector()
                let stmt = getKnexInstance().from(selector.source).where(getKnexInstance().raw("?? = ??", [selector.id, this._[propName]]))
                return applyFilter(stmt, selector)
            }
        }
        this.schema.namedProperties.forEach( (prop) => {
            let compiled = compileNameProperty(selector, prop)
            if(prop.computedFunc){
                selector.$[prop.name] = compiled as compiledComputedFunction
            } else {
                selector._[prop.name] = compiled as string
            }
        })

        return selector
    }

    /**
     * find array of records
     * @param queryFunction 
     * @returns 
     */
    static async find(queryFunction?: QueryFunction ): Promise<any>{
        let selector = this.produceSelector()
        let stmt: Knex.QueryBuilder = getKnexInstance().from(selector.source)
        if(queryFunction){
        stmt = queryFunction(stmt, selector)
        }
        console.log("========== FIND ================")
        console.log(stmt.toString())
        console.log("================================")
        return [] //await getKnexInstance().raw(r.toString())
    }

    // it is a parser
    static Array(){

    }
}

/**
 *  NamedProperty can be compiled into CompiledNamedProperty for actual SQL query
 *  The compilation is:
 *  - embedding a runtime entity's selector into the 'computed function'
 *  - or translate the field into something like 'tableAlias.fieldName'
 */
type CompiledNamedProperty = string | compiledComputedFunction
const compileNameProperty = (rootSelector: Selector, prop: NamedProperty): CompiledNamedProperty => {
    //convert the props name into actual field Name
    let actualFieldName = prop.fieldName
    if(prop.computedFunc){
        let computedFunc = prop.computedFunc
        return (queryFunction?: QueryFunction, ...args: any[]) => {

            const applyFilterFunc: QueryFunction = (stmt, selector) => {
                const x = (queryFunction && queryFunction(stmt, selector) ) || stmt
                return x
            }
            let subquery = computedFunc(rootSelector, applyFilterFunc, ...args)

            let subqueryString = subquery.toString()

            // determine the column list
            let ast = sqlParser.parse(subqueryString)

            //TODO: there will be bug if the alias contain . inside
            let columns: string[] = ast.value.selectItems.value.map( (v:any) => (v.alias? v.alias: v.value) ).map( (v:string) => {
                let p = v.split('.')
                let name = p[p.length - 1]
                return name
            })
            
            // FIX: more than one table has *
            // console.log('xxxxxx before', columns)
            if(columns.includes('*')){
                //replace star into all column names
                let all = rootSelector.schema.namedProperties.filter(p => !p.computedFunc).map(p => p.name)
                let fullSet = new Set(columns.filter(n => n !== '*').concat(all))
                columns = [...fullSet]
            }
            // console.log('xxxxxx after', columns)

            let jsonify =  `SELECT JSON_ARRAYAGG(JSON_OBJECT(${
                columns.map(c => `'${c.replace(/[`']/g,'')}', ${c}`).join(',')
            })) FROM (${subquery}) AS \`${makeid(5)}\``

            return getKnexInstance().raw('(' + jsonify + `) AS ${actualFieldName}`)
        }
    } else {
        return `${rootSelector.tableAlias}.${actualFieldName}`
    }
}



/**
 * 
 * 
 *  Below is for experiment code... exploring tricks for cache
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