// import { Builder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs';
import { PropertyType, Types } from './PropertyType'
import { values } from 'lodash';
export { PropertyType, Types }
const sqlParser = require('js-sql-parser');

export type Config = {
    modelsPath: string,
    dbSchemaPath: string,
    entityNameToTableName?: (params:string) => string,
    tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    fieldNameToPropName?: (params:string) => string,
    suppressErrorOnPropertyNotFound?: string,
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

let schemas: {
    [key: string]: Schema
} = {}

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
        if(this.tableName.length > 0){
            return `CREATE TABLE \`${this.tableName}\` (\n${this.namedProperties.filter(f => !f.computedFunc).map(f => `\`${f.fieldName}\` ${f.definition.create().join(' ')}`).join(',\n')}\n)`;
        }
        return ''
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

export function makeid(length: number) {
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
        public options?: any){
            this.name = name
            this.definition = definition
            this.computedFunc = computedFunc
            this.options = options

            if( /[\.`' ]/.test(name) || name.includes('___')){
                throw new Error('The name of the NamedProperty is invalid')
            }
        }

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
    fs.writeFileSync(path, tables.map(t => t.createTableStmt()).filter(t => t).join(";\n") + ';' )
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
    // runtimeId: string,
    compiled: SQLString | compiledComputedFunction
}

export type SimpleObject = { [key:string]: any}


// export type SelectorBasic<T extends typeof Entity> = {
//     entityClass: T,
//     schema: Schema,
//     '_': FieldSelector,
//     '$': ComputedSelector,       
//     'table': string,            // "table"
//     'tableAlias': string,       // "abc"
//     'source': string,           // "table AS abc"
//     'all': string,              // "abc.*"
//     'id': string                // "abc.id"
// }

const map1 = new Map<PropertyType, string>()
const map2 = new Map<string, PropertyType>()
const registerPropertyType = function(d: PropertyType): string{
    let r = map1.get(d)
    if(!r){
        let key = makeid(5)
        map1.set(d, key)
        map2.set(key, d)
        r = key
    }
    return r
}

const findPropertyType = function(typeAlias: string): PropertyType{
    let r = map2.get(typeAlias)
    if(!r){
        throw new Error('Cannot find the PropertyType. Make sure it is registered before.')
    }
    return r
}

const metaAlias = function(p: NamedProperty): string{
    let typeAlias = registerPropertyType(p.definition)
    return `${p.name}___${typeAlias}`
}

const breakdownMetaAlias = function(metaAlias: string){
    if(metaAlias.includes('___')){
        let [propName, typeAlias] = metaAlias.split('___')
        let definition = findPropertyType(typeAlias)
        return {propName, definition}
    } else {
        return null
    }
}

type ASTObject = {
    type: string,
    value: any
}

export class Selector<T extends typeof Entity> {
    
    entityClass: T
    schema: Schema
    _: FieldSelector = {}
    $: ComputedSelector = {}  
    // table: string            // "table"
    private tableAlias: string       // "abc"

    // stored any compiled property
    // compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor(entityClass: T, schema: Schema){
        this.schema = schema
        this.tableAlias = schema.entityName + '_' + makeid(5)
        this.entityClass = entityClass
    }

    // "table AS abc"
    get source(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
        }
        return `${this.schema.tableName} AS ${this.tableAlias}`
    }

    // "abc.*"
    get all(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return `*`
    }

    // "abc.id"  primary key
    get id(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [id] for selection.`)
        }
        return `${this.tableAlias}.${this.schema.primaryKey.fieldName}`
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

    /**
     * Create and compile a new ComputedProperty
     * It is similar to compileNamedProperty but it return the selector of this new property
     * @param namedProperty A `NamedProperty` instance
     * @returns the selector of this new property
     */
    derivedProp(namedProperty: NamedProperty){
        if(!namedProperty.computedFunc){
            throw new Error('derivedProp only allows ComputedProperty.')
        }
        return this.compileNamedProperty(namedProperty).compiled as compiledComputedFunction
    }

    /**
     * Create and compile a new NamedProperty
     * NamedProperty can be compiled into CompiledNamedProperty for actual SQL query
     * The compilation is:
     *  - embedding a runtime entity's selector into the 'computed function'
     *  - or translate the field into something like 'tableAlias.fieldName'
     * @param namedProperty A `NamedProperty` instance
     * @returns CompiledNamedProperty 
     */
    compileNamedProperty(prop: NamedProperty): CompiledNamedProperty{
        let rootSelector = this
        // must be unique, use to reference the compiledNamedProperty latter
        // let runtimeId = makeid(5)
        let compiledNamedProperty: CompiledNamedProperty
        //convert the props name into actual field Name
        // let actualFieldName = prop.fieldName
        // let actualFieldNameAlias = this.constructRawFieldName(prop.fieldName, runtimeId)
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
                console.log('SubQuery', subqueryString)

                // determine the column list
                let ast = sqlParser.parse(subqueryString)

                const santilize = (item: any): string => {
                    let v = item.alias ?? item.value
                    v = v.replace(/[`']/g, '')
                    let p = v.split('.')
                    let name = p[p.length - 1]
                    return name
                }

                let columns: string[] = ast.value.selectItems.value.map( (v:any) => santilize(v) )
                
                // HERE: columns can contains metaAlias (computedProps only) and normal fieldName

                // Important: more than one table has *
                if(columns.includes('*')){

                    if(ast.value.from.type !== 'TableReferences'){
                        throw new Error('Unexpected flow is reached.')
                    }
                    let info: Array<any> = ast.value.from.value.map( (obj: ASTObject ) => {
                        if(obj.type === 'TableReference'){
                            if(obj.value.type === 'TableFactor'){
                                // determine the from table
                                if( obj.value.value.type === 'Identifier'){
                                    return {type: 'table', value: santilize(obj.value.value) }
                                }
                            } else if( obj.value.value.type === 'SubQuery'){
                                let selectItems = obj.value.value.value.selectItems
                                if(selectItems.type === 'SelectExpr'){
                                    // determine any fields from derived table
                                    return selectItems.value.map( (item: any) => {
                                        if( item.type === 'Identifier'){
                                            return {type: 'field', value: santilize(item) }
                                        }
                                    })
                                } else throw new Error('Unexpected flow is reached.')
                            } else throw new Error('Unexpected flow is reached.')
                        } else throw new Error('Unexpected flow is reached.')
                    })
                    
                    
                    let tables: Array<string> = info.filter( (i: any) => i.type === 'table').map(i => i.value)
                    if(tables.length > 0){
                        let schemaArr = Object.keys(schemas).map(k => schemas[k])
                        let selectedSchemas = tables.map(t => {
                            let s = schemaArr.find(s => s.tableName === t) 
                                if(!s)
                                throw new Error(`Table [${t}] is not found.`)
                            return s
                        })
                        let all = selectedSchemas.map(schema => schema.namedProperties.filter(p => !p.computedFunc).map(p => p.fieldName) ).flat()
                        columns = columns.concat(all)
                    }
                    
                    columns.concat( info.filter( (i:any) => i.type === 'field').map(i => i.value) )
                    
                    //determine the distinct set of columns
                    columns = columns.filter(n => n !== '*')
                    let fullSet = new Set(columns)
                    columns = [...fullSet]
                
                    
                    // going to replace star into all column names
                    if( ast.value.selectItems.type !== 'SelectExpr'){
                        throw new Error('Unexpected flow is reached.')
                    } else {
                        //remove * element
                        let retain = ast.value.selectItems.value.filter( (v:any) => v.value !== '*' )
                        
                        let newlyAdd = columns.filter( c => !retain.find( (v:any) => santilize(v) === c ) )

                        //add columns element
                        ast.value.selectItems.value = [...retain, ...newlyAdd.map(name => {
                            return {
                                type: "Identifier",
                                value: name,
                                alias: null,
                                hasAs: null
                            }
                        })]
                    }

                    subqueryString = sqlParser.stringify(ast)
                }

                if(!prop.definition.readTransform){
                    if(columns.length > 1){
                        throw new Error('PropertyType doesn\'t allow multiple column values.')
                    }
                    return getKnexInstance().raw(`(${subqueryString}) AS ${metaAlias(prop)}`)
                } else {
                    let transformed = prop.definition.readTransform(subqueryString, columns)
                    return getKnexInstance().raw(`(${transformed.toString()}) AS ${metaAlias(prop)}`)
                }
            }
            compiledNamedProperty = {
                namedProperty: prop,
                // runtimeId,
                compiled: compiledFunc
            }
        } else {
            compiledNamedProperty = {
                namedProperty: prop,
                // runtimeId,
                compiled: `${rootSelector.tableAlias}.${prop.fieldName}`
            }
        }

        if(prop.computedFunc){
            this.$[prop.name] = compiledNamedProperty.compiled as compiledComputedFunction
        } else {
            this._[prop.name] = compiledNamedProperty.compiled as string
        }
        //register the runtimeId for later data parsing
        // this.compiledNamedPropertyMap.set(actualFieldNameAlias, compiledNamedProperty)
        //register the fieldName, because it is fallback solution if user add the field using * or by hardcode sql
        // this.compiledNamedPropertyMap.set(actualFieldName, compiledNamedProperty)

        return compiledNamedProperty
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
        let entityClass = this as T
        let selector = new Selector<T>(entityClass, this.schema)
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
        let func = dualSelector.derivedProp(new NamedProperty(
            'data',
            Types.Array(this),
            (dualSelector): SQLString => {
                let currentEntitySelector = this.selector()
                let stmt: Knex.QueryBuilder = getKnexInstance().from(currentEntitySelector.source)
                let result: SQLString = stmt
                if(applyFilter){
                    result = applyFilter(stmt, currentEntitySelector)
                }
                return result
            }
        ))
        let stmt = getKnexInstance().select(func())
        console.log("========== FIND ================")
        console.log(stmt.toString())
        console.log("================================")
        let resultData: any = await stmt
        let dualInstance = Dual.parseRaw(resultData[0] as SimpleObject)
        let str = "data" as keyof Dual;
        return dualInstance[str]
    }

    static parseRaw<T extends typeof Entity>(row: SimpleObject): InstanceType<T>{
        let entityClass = this
        let entityInstance = Object.keys(row).reduce( (entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)

            let metaInfo = breakdownMetaAlias(fieldName)
            let propName = null
            let definition = null
            if(metaInfo){
                propName = metaInfo.propName
                definition = metaInfo.definition
            } else{
                let prop = entityClass.schema.namedProperties.find(p => {
                    return p.fieldName === fieldName
                })

                if(!prop){
                    if(!config.suppressErrorOnPropertyNotFound){
                        throw new Error(`Result contain property/column [${fieldName}] which is not found in schema.`)
                    }
                }else{
                    propName = prop.name
                    definition = prop.definition
                }
            }
            /**
             * it can be boolean, string, number, Object, Array of Object (class)
             * Depends on the props..
             */
            let propValue = definition!.parseRaw(row[fieldName])
            
            Object.defineProperty(entityInstance, propName!, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: propValue
            })
            return entityInstance
        }, new entityClass() as InstanceType<T>)
        return entityInstance
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