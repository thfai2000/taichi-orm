// import { Builder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs';
import { PropertyType, Types } from './PropertyType'
export { PropertyType, Types }
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
            Types.PrimaryKey(),
            null
        )
        this.namedProperties = [this.primaryKey]
    }

    createTableStmt(){
        return `CREATE TABLE \`${this.tableName}\` (\n${this.namedProperties.filter(f => !f.computedFunc).map(f => `\`${f.fieldName}\` ${f.definition.create.join(' ')}`).join(',\n')}\n)`;
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

export type ComputedFunctionDefinition = (selector: Selector<any>, queryFunction: QueryFunction, ...args: any[]) => SQLString


export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: PropertyType,
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

    const register = (entityName: string, entityClass: any) => {
        let s = new Schema(entityName);
        if(entityClass.register){
            tables.push(s)
            entityClass.register(s)
            schemas[entityName] = s
        }
        if(entityClass.postRegister){
            entityClass.postRegister(s)
        }
    }

    //register special Entity Dual
    register(Dual.name, Dual)

    await Promise.all(files.map( async(file) => {
        if(file.endsWith('.js')){
            let path = config.modelsPath + '/' + file
            path = path.replace(/\.js$/,'')
            console.log('load model file:', path)
            let p = path.split('/')
            let entityName = p[p.length - 1]
            let entityClass = require(path)
            register(entityName, entityClass.default);
            
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


type CompiledNamedProperty = {
    namedProperty: NamedProperty,
    runtimeId: string,
    compiled: SQLString | compiledComputedFunction
}

export type SimpleObject = { [key:string]: any}


export type SelectorBasic<T extends typeof Entity> = {
    entityClass: T,
    schema: Schema,
    '_': FieldSelector,
    '$': ComputedSelector,       
    'table': string,            // "table"
    'tableAlias': string,       // "abc"
    'source': string,           // "table AS abc"
    'all': string,              // "abc.*"
    'id': string                // "abc.id"
}

export class Selector<T extends typeof Entity> {
    
    entityClass: T
    schema: Schema
    _: FieldSelector
    $: ComputedSelector    
    table: string            // "table"
    tableAlias: string       // "abc"
    source: string           // "table AS abc"
    all: string              // "abc.*"
    id: string                // "abc.id"  primary key

    // stored any compiled property
    compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor({
        entityClass,
        schema,
        _,
        $,
        table,
        tableAlias,
        source,
        all,
        id 
    }: SelectorBasic<T>){
        this.entityClass = entityClass
        this.schema = schema
        this._ = _
        this.$ = $
        this.table = table
        this.tableAlias = tableAlias
        this.source = source
        this.all = all
        this.id = id
    }

    init(){
        // the lifecycle should be 
        this.schema.namedProperties.forEach( (prop) => {
            this.compileNamedProperty(prop)
        })
    }

     // (SQL template) create a basic belongsTo prepared statement 
    hasMany(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): SQLString{
        let selector = entityClass.newSelector()
        let stmt = getKnexInstance().from(selector.source).where(getKnexInstance().raw("?? = ??", [this.id, selector._[propName]]))
        return applyFilter(stmt, selector)
    }

    // (SQL template) create a basic belongsTo prepared statement 
    belongsTo(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): SQLString{
        let selector = entityClass.newSelector()
        let stmt = getKnexInstance().from(selector.source).where(getKnexInstance().raw("?? = ??", [selector.id, this._[propName]]))
        return applyFilter(stmt, selector)
    }

    constructRawFieldName(fieldName: string, runtimeId: string): string{
        return `${fieldName}|${runtimeId}`
    }

    destructFieldName(rawFieldName: string){
        let [fieldName, runtimeId] = rawFieldName.split('|')
        return {fieldName, runtimeId}
    }

    /**
     * Create Derived Field for Temporary use
     * @param namedProperty
     * @returns 
     */
    derivedProp(namedProperty: NamedProperty){
        return this.compileNamedProperty(namedProperty)
    }

    /**
     *  NamedProperty can be compiled into CompiledNamedProperty for actual SQL query
     *  The compilation is:
     *  - embedding a runtime entity's selector into the 'computed function'
     *  - or translate the field into something like 'tableAlias.fieldName'
     */
    compileNamedProperty(prop: NamedProperty): CompiledNamedProperty{
        let rootSelector = this
        // must be unique, use to reference the compiledNamedProperty latter
        let runtimeId = makeid(5)
        let compiledNamedProperty: CompiledNamedProperty
        //convert the props name into actual field Name
        let actualFieldName = this.constructRawFieldName(prop.fieldName, runtimeId)
        if(prop.computedFunc){
            let computedFunc = prop.computedFunc
            let compiledFunc = (queryFunction?: QueryFunction, ...args: any[]) => {
                
                const applyFilterFunc: QueryFunction = (stmt, selector) => {
                    if(queryFunction && !(queryFunction instanceof Function)){
                        console.log(queryFunction)
                        throw new Error('Likely that your ComputedProperty are not called in the select query.')
                    }
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
                    let all = rootSelector.schema.namedProperties.filter(p => !p.computedFunc).map(p => p.fieldName)
                    let fullSet = new Set(columns.filter(n => n !== '*').concat(all))
                    columns = [...fullSet]
                }
                // console.log('xxxxxx after', columns)

                if(prop.definition.isPrimitive){
                    if(columns.length > 1){
                        throw new Error('Non-object PropertyType doesn\'t allow multiple column values.')
                    }
                    return getKnexInstance().raw(`(${columns[0]}) AS \`${actualFieldName}\``)
                    
                } else {
                    let jsonify =  `SELECT JSON_ARRAYAGG(JSON_OBJECT(${
                        columns.map(c => `'${c.replace(/[`']/g,'')}', ${c}`).join(',')
                    })) FROM (${subquery}) AS \`${makeid(5)}\``
                    return getKnexInstance().raw(`(${jsonify}) AS \`${actualFieldName}\``)
                }
            }
            compiledNamedProperty = {
                namedProperty: prop,
                runtimeId,
                compiled: compiledFunc
            }
        } else {
            compiledNamedProperty = {
                namedProperty: prop,
                runtimeId,
                compiled: `\`${rootSelector.tableAlias}\`.\`${actualFieldName}\``
            }
        }

        if(prop.computedFunc){
            this.$[prop.name] = compiledNamedProperty.compiled as compiledComputedFunction
        } else {
            this._[prop.name] = compiledNamedProperty.compiled as string
        }
        //register the runtimeId for later data parsing
        this.compiledNamedPropertyMap.set(actualFieldName, compiledNamedProperty)
        //register the fieldName, because it is fallback solution if user add the field using * or by hardcode sql
        this.compiledNamedPropertyMap.set(prop.fieldName, compiledNamedProperty)

        return compiledNamedProperty
    }

    parseResult(row: SimpleObject): InstanceType<T>{
        return this.parseRaw(this.entityClass, row)
    }

    parseRaw(entityClass: T, row: SimpleObject): InstanceType<T>{
        let entityInstance = Object.keys(row).reduce( (entityInstance, fieldName) => {
            let prop = this.compiledNamedPropertyMap.get(fieldName)
            if(prop){
                /**
                 * it can be boolean, string, number, Object, Array of Object (class)
                 * Depends on the props..
                 */
                let propName = prop.namedProperty.name
                let propValue = prop.namedProperty.definition.parseRaw(this, row[fieldName])
                
                Object.defineProperty(entityInstance, propName, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: propValue
                })
            }
            return entityInstance
        }, new entityClass() as InstanceType<T>)
        return entityInstance
    }
}

export type compiledComputedFunction = (queryFunction?: QueryFunction, ...args: any[]) => SQLString

export type QueryFunction = (stmt: Knex.QueryBuilder, selector: Selector<any>) => SQLString

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
    static selector<T extends typeof Entity>(): Selector<T> {
        return this.newSelector()
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    static newSelector<T extends typeof Entity>(): Selector<T> {
        let randomTblName = this.schema.entityName + '_' + makeid(5)
        let selectorData: SelectorBasic<T> = {
            entityClass: this as T,
            schema: this.schema,
            table: `${this.schema.tableName}`,
            tableAlias: `${randomTblName}`,
            source: `${this.schema.tableName} AS ${randomTblName}`,   // used as table name
            all: `*`,                          
            id : `${randomTblName}.${this.schema.primaryKey.fieldName}`,
            _: {},
            $: {}
        }
        let selector = new Selector(selectorData)
        selector.init()
        return selector
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns 
     */
    static async find<T extends typeof Entity>(applyFilter?: QueryFunction): Promise<Array<InstanceType<T>>>{
        let dualSelector = Dual.newSelector()
        dualSelector.derivedProp(new NamedProperty(
            'data',
            Types.Array(this),
            (dualSelector, applyFilter): SQLString => {
                let currentEntitySelector = this.selector()
                let stmt: Knex.QueryBuilder = getKnexInstance().from(currentEntitySelector.table)
                return applyFilter(stmt, currentEntitySelector)
            }
        ))
        let stmt = getKnexInstance().select(dualSelector.$.data())
        console.log("========== FIND ================")
        console.log(stmt.toString())
        console.log("================================")
        let resultData: any = await stmt
        let dualInstance = dualSelector.parseResult(resultData[0] as SimpleObject )
        let str = "data" as keyof Dual;
        return dualInstance[str]
    }
}


// it is a special Entity or table. Just like the Dual in SQL Server
export class Dual extends Entity {

    static postRegister(schema: Schema) : void{
        //override the tableName into empty
        schema.tableName = ''
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