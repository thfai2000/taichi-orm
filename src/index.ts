import knex, { Knex } from 'knex'
import * as fs from 'fs'
import Types, { PropertyDefinition } from './PropertyType'
export { PropertyDefinition as PropertyType, Types }
import {makeBuilder as builder, isRow, isRaw, isColumn, makeRaw as raw, makeColumn as column, makeNamedColumn, Source, makeSource, NamedColumn, makeColumn, Column} from './Builder'
export {builder, raw, column}
import { ComputeFn } from './Common'
export const Builtin = { ComputeFn }
import { v4 as uuidv4 } from 'uuid'
import {And, Or, AndOperator, OrOperator, Equal, ValueOperator, Contain, Expression, ExpressionResolver, IsNull, NotOperator, ConditionOperator, SelectorFunction} from './Operator'
// import { AST, Column, Parser } from 'node-sql-parser'

const SimpleObjectClass = ({} as {[key:string]: any}).constructor
function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

// function then<T>(value: T | Promise<T>, fn: (value: T) => void):  (T | Promise<T>) {
//     if(value instanceof Promise){
//         return value.then(fn).then( () =>  )
//     }
//     return value
// }
export function thenResultArray<T, R>(value: Array<T | Promise<T>>, fn: (value: Array<T>) => (R | Promise<R>) ):  (R | Promise<R>) {
    if(value.some(v => v instanceof Promise)){
        return Promise.all(value).then(fn)
    }
    return fn(value as Array<T>)
}

export function thenResult<T, R>(value: T | Promise<T>, fn: (value: T) => (R | Promise<R>), errorFn?: (error: any) => (R | Promise<R>) ):  (R | Promise<R>) {
    if(value instanceof Promise){
        return value.then(fn, errorFn)
    }
    return fn(value)
}

export function addBlanketIfNeeds(text: string) {
    text = text.trim()
    let need = true
    if(/^[a-zA-Z0-9\_\$\.`'"]+$/.test(text)){
        need = false
    }
    if (need) {
        text = `(${text})`
    }
    return text
}

export type ORMConfig = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    models: {[key:string]: typeof Entity}
    createModels?: boolean,
    modelsPath?: string,
    outputSchemaPath?: string,
    // waitUtilDatabaseReady?: boolean,
    entityNameToTableName?: (params:string) => string,
    // tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    // fieldNameToPropName?: (params:string) => string,
    suppressErrorOnPropertyNotFound?: string,
    useNullAsDefault?: boolean
    // useSoftDeleteAsDefault: boolean
    primaryKeyName: string
    enableUuid: boolean
    uuidColumnName: string,
    globalContext: Partial<ExecutionContextConfig>
}

const ormConfig: ORMConfig = {
    primaryKeyName: 'id',
    enableUuid: false,
    // useSoftDeleteAsDefault: true,
    uuidColumnName: 'uuid',
    createModels: false,
    models: {},
    knexConfig: {
        client: 'mysql' //default mysql
    },
    globalContext: {
        tablePrefix: ''
    }
}

// the new orm config
export {ormConfig as config}

const META_FIELD_DELIMITER = '___'

export const client = (): string => ormConfig.knexConfig.client.toString()

export const quote = (name: string) => {
    let c = client()
    if(c.startsWith('sqlite') || c.startsWith('mysql') ){
        return `\`${name.replace(/\`/g, '``')}\``
    } else if (c.startsWith('pg')){
        return `"${name.replace(/\"/g, '""')}"`
    }
    throw new Error('Unsupport client')
}

let _globalKnexInstance: Knex | null = null

// a global knex instance
export const getKnexInstance = (): Knex => {
    if(_globalKnexInstance){
        return _globalKnexInstance
    }

    let newKnexConfig = Object.assign({
        useNullAsDefault: true
    }, ormConfig.knexConfig)

    if(typeof newKnexConfig.connection !== 'object'){
        throw new Error('Configuration connection only accept object.')
    }

    if(typeof newKnexConfig.client !== 'string'){
        throw new Error('Configuration client only accept string')
    }

    // multipleStatements must be true
    newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, {multipleStatements: true})
    
    
    // console.log('newKnexConfig', newKnexConfig)
    _globalKnexInstance = knex(newKnexConfig)
    return _globalKnexInstance
}

export const startTransaction = async<T>(func: (trx: Knex.Transaction) => Promise<T> | T, existingTrx?: Knex.Transaction | null): Promise<T> => {
    let knex = getKnexInstance()
    const useTrx = (trx: Knex.Transaction, isExistingTrx: boolean) => {
        return thenResult( func(trx), async(result) => {
            if(!isExistingTrx){
                await trx.commit()
            }
            return result
        }, async (error) => {
            if(!isExistingTrx){
                await trx.rollback()
            }
            throw error
        })
    }
        
    if(existingTrx){
        // use existing
        return useTrx(existingTrx, true)
    } else {
        // use new
        // let result: T | Promise<T>, error
        
        try{
            //{isolationLevel: 'read committed'}
            const trx = await knex.transaction()
            return await useTrx(trx, false)
        }catch(e){
            // console.log('herere error', e)
            // error = e
            throw e
        }
    }
    
}

let schemas: {
    [key: string]: Schema
} = {}


let registeredModels: {
    [key: string]: typeof Entity
} = {}

export class Schema {

    tableName: string
    entityName: string
    namedProperties: NamedProperty[]
    primaryKey: NamedProperty
    uuid: NamedProperty | null

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = ormConfig.entityNameToTableName?ormConfig.entityNameToTableName(entityName):entityName
        this.primaryKey = new NamedProperty(
            ormConfig.primaryKeyName,
            new Types.PrimaryKey()
        )
        if(ormConfig.enableUuid){
            this.uuid = new NamedProperty(
                ormConfig.uuidColumnName,
                new Types.String({nullable: false, length: 255})
            )
            this.namedProperties = [this.primaryKey, this.uuid]
        } else {
            this.uuid = null
            this.namedProperties = [this.primaryKey]
        }
        
    }

    createTableStmt(tablePrefix?: string){
        if(this.tableName.length > 0){
            return `CREATE TABLE IF NOT EXISTS ${quote( (tablePrefix??'') + this.tableName)} (\n${
                this.namedProperties.filter(f => !f.definition.computeFunc).map(f => {
                    return `${f.definition.create(f)}`  
                }).flat().join(',\n')}\n)`;
        }
        return ''
    }

    prop(name:string, definition: any, options?: NamedPropertyOptions){
        this.namedProperties.push(new NamedProperty(
            name,
            definition,
            options
        ))
        this.checkProps()
    }

    private checkProps(){
        this.namedProperties.reduce( (acc, p) => {
            acc[p.name] = (acc[p.name] || 0) + 1
            if(acc[p.name] > 1){
                throw new Error(`Duplicated Property Name in schema ${this.entityName}`)
            }
            return acc
        }, {} as SimpleObject)
    }
}

export function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
   }
   return result.join('');
}

export interface SQLString{
    toString(): string
}

export type NamedPropertyOptions = {
    skipFieldNameConvertion?: boolean
}

export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: PropertyDefinition,
        public options?: NamedPropertyOptions){
            this.name = name
            this.definition = definition
            this.options = options

            if( /[\.`' ]/.test(name) || name.includes(META_FIELD_DELIMITER) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "${META_FIELD_DELIMITER}", "'" or startsWith/endsWith '_'.`)
            }
        }

    static convertFieldName(propName: string){
        return ormConfig.propNameTofieldName ? ormConfig.propNameTofieldName(propName) : propName
    }

    get fieldName(){
        if(this.options?.skipFieldNameConvertion){
            return this.name
        } else {
            return NamedProperty.convertFieldName(this.name)
        }
    }

}


const simpleQuery = (stmt: Knex.QueryBuilder<any, any>, selector: Selector, queryOptions: QueryObject) => {

    // let select: any[] = []
    let isOnlyWhere = true

    if(queryOptions.limit){
        stmt = stmt.limit(queryOptions.limit)
        isOnlyWhere = false
    }
    if(queryOptions.offset){
        stmt = stmt.offset(queryOptions.offset)
        isOnlyWhere = false
    }
    if(queryOptions.orderBy){
        stmt = stmt.orderBy(queryOptions.orderBy)
        isOnlyWhere = false
    }
    if(queryOptions.select){
        isOnlyWhere = false
    }
    if(queryOptions.args){
        isOnlyWhere = false
    }
    if(queryOptions.fn){
        isOnlyWhere = false
    }

    let stmtOrPromise: Knex.QueryBuilder | Promise<Knex.QueryBuilder>

    let select: {[key:string]: boolean | QueryOptions | PropertyDefinition}
    if(queryOptions.select instanceof Array){
        select = queryOptions.select.reduce( (acc, key)=> {
            acc[key] = true
            return acc
        },{} as {[key:string]: boolean | QueryOptions | PropertyDefinition} )
    }else {
        select = queryOptions.select ?? {}
    }

    if (select && Object.keys(select).length > 0) {

        let removeNormalPropNames = Object.keys(select).map( (key: string) => {
            const item = select[key]
            if (item === false) {
                let prop = selector.schema.namedProperties.find(p => p.name === key)
                if(!prop){
                    throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
                } else {
                    if(!prop.definition.computeFunc){
                        return prop.name
                    }
                }
            }
            return null
        }).filter(notEmpty)

        if(removeNormalPropNames.length > 0){
            const shouldIncludes = selector.schema.namedProperties.filter(p => !removeNormalPropNames.includes( p.name) )
            stmt = stmt.clearSelect().select(...shouldIncludes)
        }

        //(the lifecycle) must separate into 2 steps ... register all computeProp first, then compile all
        let executedProps = Object.keys(select).map( (key: string) => {
            const item = select[key]
            if (item === true){
                let prop = selector.schema.namedProperties.find(p => p.name === key)
                if(!prop){
                    throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
                }
                if(prop.definition.computeFunc){
                    return selector.$$[prop.name]()
                }
            } else if (item instanceof SimpleObjectClass) {
                let options = item as QueryOptions

                let prop = selector.schema.namedProperties.find(p => p.name === key && p.definition.computeFunc)

                if(!prop){
                    if( options instanceof PropertyDefinition){
                        selector.registerProp( new NamedProperty(key, options) )
                        return selector.$$[key]()
                    } else {
                        throw new Error('Temp Property must be propertyDefinition')
                    }
                } else {
                    if(!prop.definition.computeFunc){
                        throw new Error('Only COmputeProperty allows QueryOptions')
                    }
                    return selector.$$[key](options)
                }
            }
            return null
        }).filter(notEmpty) 
        
        stmtOrPromise = stmt
        // let props = selector.getProperties().map(p => p.computedFunc)
        stmtOrPromise = executedProps.reduce((stmt, executed) => {
            let result = executed
            if(result instanceof Promise || stmt instanceof Promise){
                return new Promise( async (resolve, reject) => {
                    try{
                        let c = (await result) as NamedColumn
                        let builder = await stmt
                        builder.select(c)
                        resolve(builder)
                    }catch(error){
                        reject(error)
                    }
                })
            } else {
                return stmt.select(result)
            }
        }, stmtOrPromise)
    } else {
        stmtOrPromise = stmt
    }

    if(queryOptions.where){
        const where = queryOptions.where
        stmtOrPromise = thenResult(stmtOrPromise, stmt => stmt.where(selector(where)) )
        isOnlyWhere = false
    }
    if(isOnlyWhere){
        stmtOrPromise = thenResult(stmtOrPromise, stmt => stmt.where(selector(queryOptions as QueryWhere)) )
    }
    return stmtOrPromise
}

export const configure = async function(newConfig: Partial<ORMConfig>){
    Object.assign(ormConfig, newConfig)
    Object.assign(ormConfig.globalContext, newConfig.globalContext)
    // let arrayOfSchemas: Schema[] = []

    const registerEntity = (entityName: string, entityClass: any) => {
        let s = new Schema(entityName);
        if(entityClass.register){
            entityClass.register(s)
            schemas[entityName] = s
            // arrayOfSchemas.push(s)
        }
        registeredModels[entityName] = entityClass
    }
    
    //register special Entity Dual
    registerEntity(Dual.name, Dual)

    //register models 
    if(ormConfig.models){
        let models = ormConfig.models
        Object.keys(models).forEach(key => {
            registerEntity(key, models[key]);
        })
    }
    //register models by path
    if(ormConfig.modelsPath){
        let files = fs.readdirSync(ormConfig.modelsPath)
        await Promise.all(files.map( async(file) => {
            if(file.endsWith('.js')){
                let path = ormConfig.modelsPath + '/' + file
                path = path.replace(/\.js$/,'')
                // console.debug('load model file:', path)
                let p = path.split('/')
                let entityName = p[p.length - 1]
                let entityClass = require(path)
                registerEntity(entityName, entityClass.default);
            }
        }))
    }
    
    if(ormConfig.outputSchemaPath){
        globalContext.outputSchema(ormConfig.outputSchemaPath)
    }

    if(ormConfig.createModels){
       await globalContext.createModels()
    }
}

export type SimpleObject = { [key:string]: any}

const map1 = new Map<NamedProperty, string>()
const map2 = new Map<string, NamedProperty>()
const registerGlobalNamedProperty = function(d: NamedProperty): string{
    let r = map1.get(d)
    if(!r){
        let key = makeid(5)
        map1.set(d, key)
        map2.set(key, d)
        r = key
    }
    return r
}

const findGlobalNamedProperty = function(propAlias: string): NamedProperty{
    let r = map2.get(propAlias)
    if(!r){
        throw new Error(`Cannot find the Property by '${propAlias}'. Make sure it is registered before.`)
    }
    return r
}

const metaTableAlias = function(schema: Schema): string{
    return schema.entityName + META_FIELD_DELIMITER + makeid(5)
}

const breakdownMetaTableAlias = function(metaAlias: string) {
    metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
    
    if(metaAlias.includes(META_FIELD_DELIMITER)){
        let [entityName, randomNumber] = metaAlias.split(META_FIELD_DELIMITER)
        let found = schemas[entityName]
        return found
    } else {
        return null
    }
}

export const metaFieldAlias = function(p: NamedProperty): string{
    let propAlias = registerGlobalNamedProperty(p)
    return `${p.name}${META_FIELD_DELIMITER}${propAlias}`
}

export const breakdownMetaFieldAlias = function(metaAlias: string){
    metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
    if(metaAlias.includes(META_FIELD_DELIMITER)){
        let [propName, propAlias] = metaAlias.split(META_FIELD_DELIMITER)
        let namedProperty = findGlobalNamedProperty(propAlias)
        return {propName, namedProperty}
    } else {
        return null
    }
}

export interface Selector extends ExpressionResolver {
    (value: QueryWhere): Promise<Column> | Column
    impl: SelectorImpl
    readonly entityClass: typeof Entity
    readonly executionContext: ExecutionContext
    readonly schema: Schema
    readonly derivedProps: Array<NamedProperty>
    readonly _: {[key: string] : NamedColumn}
    readonly $: {[key: string] : CompiledComputeFunction}
    readonly $$: {[key: string] : CompiledComputeFunctionPromise}
    
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    readonly all: NamedColumn[]
    // star: NamedColumn
    readonly source: Source
    // sourceRaw: string
    readonly pk: NamedColumn
    readonly uuid: NamedColumn | null
    // [key: string]: any
    readonly tableAlias: string
    readonly tableName: string
    registerProp(namedProperty: NamedProperty): CompiledComputeFunction
    getProperties(): NamedProperty[]
}


export class SelectorImpl{
    interface: Selector | null | undefined
    readonly entityClass: typeof Entity
    readonly executionContext: ExecutionContext
    readonly schema: Schema
    readonly derivedProps: Array<NamedProperty> = []
    readonly _: {[key: string] : NamedColumn}
    readonly $: {[key: string] : CompiledComputeFunction}
    readonly $$: {[key: string] : CompiledComputeFunctionPromise}
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    readonly [key: string]: any
    readonly tableAlias: string
    readonly tableName: string

    // stored any compiled property
    // compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor(entityClass: typeof Entity, schema: Schema, executionContext: ExecutionContext){
        let selector = this
        this.schema = schema
        this.tableAlias = metaTableAlias(schema)
        this.tableName = executionContext.tablePrefix + schema.tableName
        this.entityClass = entityClass
        this.executionContext = executionContext
        
        this._ = new Proxy( {} ,{
            get: (oTarget, sKey: string) => {
                return selector.getNormalCompiled(sKey)
            }
        }) as {[key: string] : NamedColumn}

        this.$ = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledComputeFunction => {
                return selector.getComputedCompiled(sKey)
            }
        })

        this.$$ = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledComputeFunctionPromise => {
                return selector.getComputedCompiledPromise(sKey)
            }
        })
    }

    getComputedCompiledPromise(sKey: string) {
        let selector = this
        if(!selector){
            throw new Error('Unexpected')
        }
        let prop = selector.getProperties().find((prop) => prop.name === sKey)
        selector.checkDollar(prop, sKey)
        return this.compileAs$$(prop!)
    }

    getComputedCompiled(sKey: string) {
        let selector = this
        if(!selector){
            throw new Error('Unexpected')
        }
        // let withTransform = true
        // if (sKey.startsWith('_')) {
        //     withTransform = false
        //     sKey = sKey.slice(1)
        // }
        let prop = selector.getProperties().find((prop) => prop.name === sKey)
        selector.checkDollar(prop, sKey)
        return this.compileAs$(prop!)
    }

    getNormalCompiled(sKey: string) {
        let selector = this
        if(!selector){
            throw new Error('Unexpected')
        }
        // let withEscape = false
        // if (sKey.startsWith('_')) {
        //     withEscape = true
        //     sKey = sKey.slice(1)
        // }
        let prop = this.getProperties().find((prop) => prop.name === sKey)
        this.checkDash(prop, sKey)
        return this.compileAs_(prop!)
    }

    private checkDollar(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}' in Entity '${this.schema.entityName}'`)
        } else if (!prop.definition.computeFunc) {
            throw new Error(`Property '${sKey}' is NormalProperty. Accessing through $ is not allowed.`)
        }
    }

    private checkDash(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}' in Entity '${this.schema.entityName}'`)
        } else if (prop.definition.computeFunc) {
            throw new Error(`Property '${sKey}' is ComputedProperty. Accessing through _ is not allowed.`)
        }
    }

    // "table AS abc"
    get source(): Source{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
        }
        return makeSource(null, this.interface!)
    }

    get all(): NamedColumn[] {
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this.getProperties().filter(p => !p.definition.computeFunc).map(p => this.getNormalCompiled(p.name))
    }

    get pk(): NamedColumn{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.primaryKey.name]
    }

    get uuid(): NamedColumn | null {
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.uuid?.name ?? '']
    }

    getProperties(): NamedProperty[]{
        // derived Props has higher priority. I can override the schema property
        return [...this.derivedProps, ...this.schema.namedProperties]
    }

    registerProp(namedProperty: NamedProperty): CompiledComputeFunctionPromise{
        this.derivedProps.push(namedProperty)
        if(!namedProperty.definition.computeFunc){
            throw new Error('Only the Computed Property can be registered after the schema is created.')
        } else {
            return this.getComputedCompiledPromise(namedProperty.name)
        }
    }


    compileAs_(prop: NamedProperty) {
        const rootSelector: SelectorImpl = this
        if(prop.definition.computeFunc){
            throw new Error('Computed Property cannot be compiled as normal field.')
        } 
        let tableAlias = quote(rootSelector.tableAlias)
        let fieldName: string = quote(prop.fieldName)
        let alias = metaFieldAlias(prop)
        let rawTxt = `${tableAlias}.${fieldName}`

        return makeNamedColumn(alias, makeColumn(raw(rawTxt), prop.definition) )
    }

    compileAs$(prop: NamedProperty): CompiledComputeFunction {
        const rootSelector: SelectorImpl = this
        return (queryOptions?: QueryOptions) => {
            let subquery: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = this.executeComputeFunc(queryOptions, prop)

            let process = (subquery: Knex.QueryBuilder): NamedColumn => {
                let alias = metaFieldAlias(prop)
                return makeNamedColumn(alias, makeColumn(subquery, prop.definition) )
            }
            if(subquery instanceof Promise){
                throw new Error(`Computed Function of Property '${prop.name}' which used Async function/Promise has to use Selector.$$ to access`)
            } else {
                return process(subquery)
            }
        }
    }

    compileAs$$(prop: NamedProperty): CompiledComputeFunctionPromise {
        const rootSelector: SelectorImpl = this
        return (queryOptions?: QueryOptions) => {
            let subquery: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = this.executeComputeFunc(queryOptions, prop)

            let process = (subquery: Knex.QueryBuilder): NamedColumn => {
                let alias = metaFieldAlias(prop)
                return makeNamedColumn(alias, makeColumn(subquery, prop.definition) )
            }

            return thenResult(subquery, query => process(query))
        }
    }

    executeComputeFunc(queryOptions: QueryOptions | undefined, prop: NamedProperty) {
        const rootSelector: SelectorImpl = this
        if(!prop.definition.computeFunc){
            throw new Error('Normal Property cannot be compiled as computed field.')
        }
        let args: QueryArguments = {}
        if(queryOptions instanceof SimpleObjectClass){
            let casted: QueryObject = queryOptions
            args = casted.args ?? args
        }
        const computeFunc = prop.definition.computeFunc
        const applyFilterFunc: ApplyNextQueryFunction = (stmt, firstSelector: Selector, ...restSelectors: Selector[]) => {
            let process = (stmt: Knex.QueryBuilder) => {

                // If the function object placed into the Knex.QueryBuilder, 
                // Knex.QueryBuilder will call it and pass itself as the parameter
                // That's why we can say likely our compiled function didn't be called.
                if (queryOptions && !(queryOptions instanceof Function) && !(queryOptions instanceof SimpleObjectClass)) {
                    console.log('\x1b[33m%s\x1b[0m', 'Likely that your ComputedProperty are not called before placing into Knex.QueryBuilder.')
                    throw new Error('The QueryFunction is not instanceof Function.')
                }

                // !! VERY IMPORTANT: must clone a new one for next filtering
                stmt = stmt.clone()
                
                if(!queryOptions){
                    return stmt
                } else {
                    if(!isRow(stmt)){
                        throw new Error('Only Computed Property in Object/Array can apply QueryOption.')
                    }
                    if(queryOptions instanceof Function){
                        let queryFunction = queryOptions as QueryFunction
                        return queryFunction(stmt, firstSelector, ...restSelectors)
                    } else if(queryOptions instanceof SimpleObjectClass){
                        // Mix usage of Object and function
                        // combine the sql statement
                        let queryObject = queryOptions as QueryObject
                        let result = simpleQuery(stmt, firstSelector, queryObject)
                        if(queryObject.fn){
                            let queryFunction = queryObject.fn
                            // if(result instanceof Promise){
                            //     return result.then(value => queryFunction(value, firstSelector, ...restSelectors) )
                            // } else {
                            //     return queryFunction(result, firstSelector, ...restSelectors)
                            // }
                            return thenResult(result, value => queryFunction(value, firstSelector, ...restSelectors) )
                        }
                        return result
                    }
                }
                throw new Error('It is not support. Only Function and Object can be passed as filters.')
            }

            return thenResult(stmt, stmt => process(stmt))
        }

        let checkValid = (subquery: Knex.QueryBuilder | Column) => {
            if(!isRow(subquery) && !isColumn(subquery)){
                throw new Error(`The property '${prop.name}' 's computed function is invalid. The return value (Knex.QueryBuilder or Knex.Raw) must be created by TaiChi builder() or column().`)
            }
            if(prop.definition.transformFromMultipleRows && !isRow(subquery)){
                console.log(`The property '${prop.name}' 's computed function has to be match the requirement of the PropertyDefinition '${prop.definition.constructor.name}'.`)
                throw new Error(`The property '${prop.name}' 's computed function has to be match the requirement of the PropertyDefinition '${prop.definition.constructor.name}' .`)
            }
            if(!prop.definition.transformFromMultipleRows && !isColumn(subquery)){
                console.log(`The property '${prop.name}' 's computed function has to be match the requirement of the PropertyDefinition '${prop.definition.constructor.name}'.`)
                throw new Error(`The property '${prop.name}' 's computed function has to be match the requirement of the PropertyDefinition '${prop.definition.constructor.name}' .`)
            }
        }

        let subquery = computeFunc.call(prop.definition, rootSelector.interface!, args, this.executionContext, applyFilterFunc)

        return thenResult(subquery, subquery => {
            checkValid(subquery)
            return subquery
        })
    }
}

export type EntityPropertyKeyValues = {
    [key: string]: boolean | number | string | any | Array<any>
}

export type QuerySelect = {[key:string]: boolean | QueryOptions | PropertyDefinition} | string[]

export type QueryWhere = Expression

export type QueryOrderBy = (string | {column: string, order: 'asc' | 'desc'} )[]

export type QueryArguments = {[key:string]: any | FutureArgument}

export type ComputeArguments = {[key:string]: any}

export class FutureArgument<Input = any, Output = any>{
    constructor(private fnc: (futureValue: Input) => Output ){}
}

export type QueryObject = {
    select?: QuerySelect,
    where?: QueryWhere,
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
    args?: QueryArguments
    fn?: QueryFunction
}

export type MutateFunction = (this: PropertyDefinition, actionName: string, data: any, rootValue: Entity, context: ExecutionContext) => any | Promise<any>

export type ComputeFunction = (this: PropertyDefinition, selector: Selector, args: ComputeArguments, context: ExecutionContext, applyNextQueryFunction: ApplyNextQueryFunction) => Knex.QueryBuilder | Promise<Knex.QueryBuilder> | Column | Promise<Column>

export type CompiledComputeFunction = (queryObject?: QueryOptions) => NamedColumn

export type CompiledComputeFunctionPromise = (queryObject?: QueryOptions) => Promise<NamedColumn> | NamedColumn

export type QueryFunction = (stmt: Knex.QueryBuilder, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export type QueryOptions = QueryFunction | QueryObject | Exclude<QueryWhere, Function> | null

export type ApplyNextQueryFunction = (stmt: Knex.QueryBuilder | Promise<Knex.QueryBuilder>, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

type DBRunnerActionResult<T> = {
    resultData: T
}

type DBRunnerAction<I> =  (context: ExecutionContext) => Promise<DBRunnerActionResult<I>>


export type ExecutionContextConfig = {
    tablePrefix: string
    // isSoftDeleteMode: boolean
    sqlRunCallback: ((sql: string) => void) | null
    trx: Knex.Transaction<any, any[]> | null
}

export class ExecutionContext{

    private _config: Partial<ExecutionContextConfig> | null = null
    readonly name

    constructor(name: string, config?: Partial<ExecutionContextConfig>){
        this.name = name
        this._config = config ?? null
    }

    get config() {
        if(!this._config){  
            return ormConfig.globalContext
        }
        return this._config
    }

    get models(){
        const context = this
        const models = registeredModels
        let proxyEntities = new Map<string, typeof Entity>()

        let proxyRoot: {[key:string]: typeof Entity} = new Proxy(models, {
            get: (models, sKey: string): typeof Entity => {
                let e = proxyEntities.get(sKey)
                if(e){
                    return e
                }else {
                    const newE: typeof Entity = new Proxy(models[sKey], {
                        get: (entityClass: typeof Entity, sKey: string) => {
                            //@ts-ignore
                            const method = entityClass[sKey]
                            //@ts-ignore
                            const referMethod = Database[sKey]
                            if( (sKey in entityClass) && (sKey in Database) && method instanceof Function ){
                                return (...args: any[]) => referMethod(newE, context, ...args)
                            }
                            return method
                        }
                    })
                    proxyEntities.set(sKey, newE)
                    return newE
                }
            }
        })

        return proxyRoot
    }

    schemaSqls(){
        let m = this.models
        let sqls = Object.keys(m).map(k => m[k].schema).map(s => s.createTableStmt(this.config.tablePrefix)).filter(t => t)
        return sqls
    }

    //write schemas into sql file
    outputSchema(path: string){
        fs.writeFileSync(path, this.schemaSqls().join(";\n") + ';')
        // console.debug('schemas files:', Object.keys(schemas))
    }

    async createModels() {
        // create tables
        // important: sqllite3 doesn't accept multiple statements
        await Promise.all( this.schemaSqls().map( async(sql) => {
            await getKnexInstance().raw(sql)
        }) )
    }

    get sqlRunCallback(){
        return this.config.sqlRunCallback
    }

    get trx(){
        return this.config.trx
    }

    get tablePrefix(){
        return this.config.tablePrefix ?? ''
    }

    // get isSoftDeleteMode(){
    //     return this._isSoftDeleteMode
    // }

    async withTransaction<T>(func: (context: ExecutionContext) => (Promise<T> | T) ): Promise<T> {
        let result = await startTransaction<T>( async (trx) => {
            return await func(trx === this.trx? this: this.clone({trx}))
        }, this.trx)
        return result
    }

    async withNewTransaction<T>(func: (context: ExecutionContext) => (Promise<T> | T) ): Promise<T> {
        let result = await startTransaction<T>( async (trx) => {
            return await func(this.clone({trx}))
        })
        return result
    }

    clone(newConfig: Partial<ExecutionContextConfig>){
        let final = Object.assign({}, this.config, newConfig)
        return new ExecutionContext(this.name + '>' + makeid(5), final)
    }
}
export const globalContext = new ExecutionContext('global')
export const models = globalContext.models

export class DBRunner<I> implements PromiseLike<I>{
    private ctx: ExecutionContext
    private action: DBRunnerAction<I>
    // private trx?: Knex.Transaction | null
    private sqlRunCallback?: ((sql: string) => void) | null

    constructor(ctx: ExecutionContext, action: DBRunnerAction<I>){
        // this.beforeAction = beforeAction
        this.ctx = ctx
        this.action = action
    }

    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: I) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            let result = await this.action(this.ctx)
            if(onfulfilled){
                return onfulfilled(result.resultData)
            } else {
                return this.then(onfulfilled, onrejected)
            }
        }catch(error){
            if(onrejected){
                return onrejected(error)
            } else{
                throw error
            }
        }
        // return this.then(onfulfilled, onrejected)
    }

    usingConnection(trx: Knex.Transaction): DBRunner<I>{
        this.ctx = this.ctx.clone({trx})
        return this
    }

    // usingConnectionIfAvailable(trx: Knex.Transaction | null | undefined): DBRunner<I>{
    //     if(trx){
    //         this.trx = trx
    //     }
    //     return this
    // }

    onSqlRun(callback: ((sql: string) => void) | null ){
        this.ctx = this.ctx.clone({sqlRunCallback: callback})
        return this
    }

    usingContext(ctx: ExecutionContext) {
        this.ctx = ctx
        return this
    }

    // async toSQLString(): Promise<string[]> {
    //     return (await this.action(false, null)).sqlStacks.map( sqlString => sqlString.toString() )
    // }
}
export class Database{
    
    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    static selector<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null): Selector{
        let selectorImpl = new SelectorImpl(entityClass, schemas[entityClass.name], existingContext?? globalContext)
        // let entityClass = this

        let resolveExpression: ExpressionResolver = function(value: Expression): Promise<Column> | Column {
            if(value instanceof ConditionOperator){
                return value.toColumn(resolveExpression)
            } else if(Array.isArray(value)){
                return resolveExpression(Or(...value))
            } else if(value instanceof Function) {
                const casted = value as SelectorFunction
                return casted(selectorImpl.interface!)
            } else if(isColumn(value) || isRow(value)){
                return value as Knex.QueryBuilder
            } else if(value instanceof SimpleObjectClass){
                let dict = value as SimpleObject
                let sqls = Object.keys(dict).reduce( (accSqls, key) => {
                    let prop = selectorImpl.getProperties().find((prop) => prop.name === key)
                    if(!prop){
                        throw new Error(`cannot found property '${key}'`)
                    }

                    let operator: ValueOperator
                    if(dict[key] instanceof ValueOperator){
                        operator = dict[key]
                    }else if( Array.isArray(dict[key]) ){
                        operator = Contain(...dict[key])
                    } else if(dict[key] === null){
                        operator = IsNull()
                    } else {
                        operator = Equal(dict[key])
                    }

                    if(!prop.definition.computeFunc){
                        let converted = selectorImpl.getNormalCompiled(key)
                        accSqls.push( operator.toColumn(converted) )
                    } else {
                        let compiled = (selectorImpl.getComputedCompiledPromise(key))()
                        // if(compiled instanceof Promise){
                        //     accSqls.push( compiled.then(col => operator.toRaw(col) ) )
                        // } else {
                        //     accSqls.push( operator.toRaw(compiled) )
                        // }
                        accSqls.push( thenResult(compiled, col => operator.toColumn(col)) )
                    }

                    return accSqls

                }, [] as Array<Promise<Column> | Column> )
                return resolveExpression(And(...sqls))
            } else {
                throw new Error('Unsupport Where clause')
            }
        }
        
        let selector = resolveExpression as Selector

        // selector._ = selectorImpl._
        // selector.$ = selectorImpl.$
        // selector.schema = selectorImpl.schema
        // selector.entityClass = selectorImpl.entityClass
        // selector.tableAlias = selectorImpl.tableAlias
        // selector.getProperties = selectorImpl.getProperties
        
        selector = new Proxy(selector, {
            get: (oTarget, sKey): any => {
                if(typeof sKey === 'string'){
                    // if (sKey.length > 2) {
                    //     if( /^\$\$[^$_]/.test(sKey) ){
                    //         return oTarget.$$[sKey.slice(2)]
                    //     }    
                    // }
                    if (sKey.length > 1){
                        if( /^\_/.test(sKey) ){
                            return selectorImpl._[sKey.slice(1)]
                        } else if(/^\$\$/.test(sKey) && sKey.length > 2){
                            return selectorImpl.$$[sKey.slice(2)]
                        } else if(/^\$[^\$]/.test(sKey) ){
                            return selectorImpl.$[sKey.slice(1)]
                        }
                    }
                }
                if(sKey in selectorImpl){
                    return selectorImpl[sKey.toString()]
                }
                else throw new Error(`Cannot find property '${sKey.toString()}' of selector`)
            }
        })

        selectorImpl.interface = selector
        selector.impl = selectorImpl
        return selector
    }

    static createOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: EntityPropertyKeyValues): DBRunner< InstanceType<T> >{
        return new DBRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._create<T>(entityClass, existingContext, [data])
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return {
                    resultData: result[0]
                }
            }
        )
    }

    static createEach<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, arrayOfData: EntityPropertyKeyValues[]): DBRunner< InstanceType<T>[] >{
        return new DBRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._create<T>(entityClass, existingContext, arrayOfData)
                return {
                    resultData: result.map( data => {
                        if(data === null){
                            throw new Error('Unexpected Flow.')
                        }
                        return data
                    })
                }
            })
    }

    private static async _create<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, values: EntityPropertyKeyValues[]) {
        const schema = entityClass.schema
        
        let useUuid: boolean = !!ormConfig.enableUuid
        if (ormConfig.knexConfig.client.startsWith('sqlite')) {
            if (!ormConfig.enableUuid ){
                throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
            }
        }
        
        let inputs = values.map( data => {
            let newUuid = null
            let {fieldValues, mutations} = Database._prepareNewData(data, schema, 'create', existingContext)
    
            if(useUuid){
                newUuid = uuidv4()
                fieldValues[ormConfig.uuidColumnName] = newUuid
            }
            let stmt = getKnexInstance()(existingContext.tablePrefix + schema.tableName).insert(fieldValues)
    
            if (ormConfig.knexConfig.client.startsWith('pg')) {
               stmt = stmt.returning(entityClass.schema.primaryKey.fieldName)
            }
    
            return {
                sqlString: stmt,
                uuid: newUuid,
                mutations
            }
        })

        let fns = await existingContext.withTransaction(async (existingContext) => {
            let allResults = await Promise.all(inputs.map(async ( input) => {
                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (ormConfig.knexConfig.client.startsWith('mysql')) {
                    let insertedId: number
                    const insertStmt = input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id '
                    const r = await this.executeStatement(insertStmt, existingContext)
                    insertedId = r[0][0].insertId
                    let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.whereRaw('?? = ?', [t.pk, insertedId]))
                    
                    let b = await this.resolveMutations<T>(record, input.mutations, existingContext)
                    return b
                } else if (ormConfig.knexConfig.client.startsWith('sqlite')) {
                    const insertStmt = input.sqlString.toString()
                    const r = await this.executeStatement(insertStmt, existingContext)
                    
                    if(ormConfig.enableUuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.whereRaw('?? = ?', [t.uuid, uuid]))
                            return await this.resolveMutations<T>(record, input.mutations, existingContext)
                        }
                    } else {
                        return null
                    }

                } else if (ormConfig.knexConfig.client.startsWith('pg')) {
                    const insertStmt = input.sqlString.toString()
                    let insertedId: number
                    const r = await this.executeStatement(insertStmt, existingContext)
                    
                    insertedId = r.rows[0][ entityClass.schema.primaryKey.fieldName]
                    let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.whereRaw('?? = ?', [t.pk, insertedId]))
                    return await this.resolveMutations<T>(record, input.mutations, existingContext)

                } else {
                    throw new Error('Unsupport client')
                }
                
            }))
            return allResults

        })

        return fns
    }

    private static _prepareNewData(data: EntityPropertyKeyValues, schema: Schema, actionName: string, context: ExecutionContext) {
        return Object.keys(data).reduce(( {fieldValues, mutations}, propName) => {
            let prop = schema.namedProperties.find(p => {
                return p.name === propName
            })
            if (!prop) {
                throw new Error(`The Property [${propName}] doesn't exist`)
            }
            
            if(!prop.definition.computeFunc){
                fieldValues[prop.fieldName] = prop.definition.parseProperty(data[prop.name], prop, context)
            } else {
                const currentProp = prop
                let action: MutateFunctionProducer

                if(data[prop.name] instanceof Function){
                    action = data[currentProp.name]
                } else {
                    action = mutate(actionName, data[prop.name])
                }
                mutations[currentProp.fieldName] = (rootValue: Entity, existingContext: ExecutionContext) => {
                    let value = action(currentProp, rootValue, existingContext)
                    return currentProp.definition.parseProperty(value, currentProp, context)
                }
            }
            
            return {fieldValues, mutations}
        }, {fieldValues: {}, mutations: {}} as {
            fieldValues: EntityPropertyKeyValues,
            mutations: { [key:string]: (rootValue: Entity, existingContext: ExecutionContext) => any}
        })
    }

    private static async resolveMutations<T extends typeof Entity>(record: InstanceType<T>, 
        mutations: {[key: string]: (rootValue: Entity, existingContext: ExecutionContext) => any | Promise<any>}, 
        existingContext: ExecutionContext): Promise<InstanceType<T>> {
        let mutationValues = await Object.keys(mutations).reduce( async (accP, key) => {
            let acc = await accP
            const action = mutations[key]
            acc[key] = await action(record, existingContext)
            return acc
        }, {} as {[key:string]: any})

        record = Object.assign(record, mutationValues)
        return record
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
     static findOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, applyFilter?: QueryOptions): DBRunner<  InstanceType<T> >{
         return new DBRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let rows = await Database._find<T>(entityClass, existingContext, applyFilter?? null)
                return {
                    resultData: rows[0] ?? null
                }
        })
     }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, applyFilter?: QueryOptions): DBRunner<  Array<InstanceType<T>> >{
        return new DBRunner< Array<InstanceType<T>> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let rows = await Database._find<T>(entityClass, existingContext, applyFilter?? null)
                return {
                    resultData: rows
                }
        })
    }

    private static async _find<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, applyFilter: QueryOptions | null) {   
        let dualSelector = existingContext.models.Dual.selector()
        let prop = new NamedProperty(
            'data',
            new Types.ArrayOf(new Types.ObjectOf(
                entityClass.name, {
                    compute: (root, {}, context, applyFilter) => {
                        let currentEntitySelector = entityClass.selector()
                        let stmt: Knex.QueryBuilder = builder(currentEntitySelector)
                        return applyFilter(stmt, currentEntitySelector)
                    }
                }
            ))
            
        )
        dualSelector.registerProp(prop)
        let sqlString =  builder().select(await dualSelector.$$.data(applyFilter))
 

        // console.debug("========== FIND ================")
        // console.debug(stmt.toString())
        // console.debug("================================")
        let resultData: any = await Database.executeStatement(sqlString, existingContext)

        let rowData = null
        if(ormConfig.knexConfig.client.startsWith('mysql')){
            rowData = resultData[0][0]
        } else if(ormConfig.knexConfig.client.startsWith('sqlite')){
            rowData = resultData[0]
        } else if(ormConfig.knexConfig.client.startsWith('pg')){
            rowData = resultData.rows[0]
        } else {
            throw new Error('Unsupport client.')
        }
        let dualInstance = this.parseRaw(Dual, existingContext, rowData)
        let str = "data" as keyof Dual
        let rows = dualInstance[str] as Array<InstanceType<T>>
        return rows
    }

    static updateOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner< InstanceType<T> >{
        return new DBRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, true, false)
                return {
                    resultData: result[0] ?? null
                }
            }
        )
    }

    static update<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner< InstanceType<T>[] >{
        return new DBRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, false, false)
                return {
                    resultData: result
                }
            }
        )
    }

    private static async _update<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, data: EntityPropertyKeyValues,  
        applyFilter: QueryOptions | null, 
        isOneOnly: boolean,
        isDelete: boolean
       ) {
        
        const schema = entityClass.schema
        const s = entityClass.selector()
        let {fieldValues, mutations} = Database._prepareNewData(data, schema, isDelete?'delete':'update', existingContext)
        if(!applyFilter || !(applyFilter instanceof SimpleObjectClass) ){
            throw new Error('Invalid Query Options')
        }


        // let deleteMode: 'soft' | 'real' | null = null
        // if(isDelete){
        //     deleteMode = existingContext.isSoftDeleteMode ? 'soft': 'real'
        // }

        //TODO: allow using fnc to build update
        //TODO: allow using select to get back the data, 
        // check the applyFilter
        // if simpleObject...
        //      if limit, offset... throw error
        //      where + fnc => update stmt  + update(newData)
        //      select + where => sideSql
        //
        // if function...
        //      become the update stmt starting point  + update(newData)

        const input = {
            updateSqlString: !isDelete && Object.keys(fieldValues).length > 0? builder(s).where(applyFilter).update(fieldValues) : null,
            selectSqlString: builder(s).where(applyFilter),
            entityData: data,
            mutations
        }

        let fns = await existingContext.withTransaction(async (existingContext) => {
            if(!input.selectSqlString || !input.entityData){
                throw new Error('Unexpected Flow.')
            }
            let updateStmt = input.updateSqlString
            let selectStmt = input.selectSqlString.select(entityClass.schema.primaryKey.fieldName)
            
            let pks: number[] = []
            if (ormConfig.knexConfig.client.startsWith('pg')) {
                let targetResult
                if(updateStmt){
                    updateStmt = updateStmt.returning(entityClass.schema.primaryKey.fieldName)
                    targetResult = await this.executeStatement(updateStmt, existingContext)
                } else {
                    targetResult = await this.executeStatement(selectStmt, existingContext)
                }
                let outputs = await Promise.all((targetResult.rows as SimpleObject[] ).map( async (row) => {
                    let pkValue = row[entityClass.schema.primaryKey.fieldName]
                    let record = await this.findOne(entityClass, existingContext, {[entityClass.schema.primaryKey.name]: pkValue} )
                    let finalRecord = await this.resolveMutations<T>(record, input.mutations, existingContext)
                    if(isDelete){
                        await this.executeStatement( builder(s).where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
                    }
                    return finalRecord
                }))

                return outputs
            } else {

                if (ormConfig.knexConfig.client.startsWith('mysql')) {
                    let result = await this.executeStatement(selectStmt, existingContext)
                    pks = result[0].map( (r: SimpleObject) => r[entityClass.schema.primaryKey.fieldName])
                } else if (ormConfig.knexConfig.client.startsWith('sqlite')) {
                    let result = await this.executeStatement(selectStmt, existingContext)
                    pks = result.map( (r: SimpleObject) => r[entityClass.schema.primaryKey.fieldName])
                } else {
                    throw new Error('NYI.')
                }

                if(isOneOnly){
                    if(pks.length > 1){
                        throw new Error('More than one records were found.')
                    } else if(pks.length === 0){
                        return []
                    }
                }
    
                return await Promise.all(pks.flatMap( async (pkValue) => {
                    if (ormConfig.knexConfig.client.startsWith('mysql')) {
                        if(updateStmt){
                            let updateResult = await this.executeStatement(updateStmt.clone().andWhereRaw('?? = ?', [entityClass.schema.primaryKey.fieldName, pkValue]), existingContext)
                            let numUpdates: number
                            numUpdates = updateResult[0].affectedRows
                            if(numUpdates > 1){
                                throw new Error('Unexpected flow.')
                            } else if(numUpdates === 0){
                                return null
                            } 
                        }
                        let record = await this.findOne(entityClass, existingContext, {[entityClass.schema.primaryKey.name]: pkValue})
                        let finalRecord = await this.resolveMutations<T>(record, input.mutations, existingContext)
                        if(isDelete){
                            await this.executeStatement( builder(s).where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
                        }
                        return finalRecord
                        
                    } else if (ormConfig.knexConfig.client.startsWith('sqlite')) {
                        if(updateStmt){
                            let updateResult = await this.executeStatement(updateStmt.clone().andWhereRaw('?? = ?', [entityClass.schema.primaryKey.fieldName, pkValue]), existingContext)
                            let found = await this.findOne(entityClass, existingContext, {[entityClass.schema.primaryKey.name]: pkValue})
                            let data = input.entityData!
                            let unmatchedKey = Object.keys(data).filter( k => data[k] !== found[k])
                            if( unmatchedKey.length > 0 ){
                                console.log('Unmatched prop values', unmatchedKey.map(k => `${k}: ${data[k]} != ${found[k]}` ))
                                throw new Error(`The record cannot be updated. `)
                            }
                        }
                        let record = await this.findOne(entityClass, existingContext, {[entityClass.schema.primaryKey.name]: pkValue})
                        let finalRecord = await this.resolveMutations<T>(record, input.mutations, existingContext)
                        if(isDelete){
                            await this.executeStatement( builder(s).where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
                        }
                        return finalRecord
                    } else {
                        throw new Error('NYI.')
                    }
                }))
            }


        })

        return fns.filter(notEmpty)
    }

    static deleteOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner< InstanceType<T> >{
        return new DBRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, true, true)
                return {
                    resultData: result[0] ?? null
                }
            }
        )
    }

    static delete<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner< InstanceType<T>[] >{
        return new DBRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, false, true)
                return {
                    resultData: result
                }
            }
        )
    }

    static async executeStatement(stmt: SQLString, context: ExecutionContext): Promise<any> {

        const sql = stmt.toString()
        if(context.sqlRunCallback) context.sqlRunCallback(sql)

        let KnexStmt = getKnexInstance().raw(sql)
        if (context.trx) {
            KnexStmt.transacting(context.trx)
        }
        let result = null
        try{
            result = await KnexStmt
        }catch(error){
            throw error
        }
        return result
    }

    static parseRaw<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, row: EntityPropertyKeyValues): InstanceType<T>{
        // let entityClass = (entityConstructor as unknown as typeof Entity)
        // let entityClass = this
        const context = existingContext ?? globalContext

        let entityInstance = Object.keys(row).reduce( (entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
            let metaInfo = breakdownMetaFieldAlias(fieldName)
            // let propName = null
            let namedProperty = null
            if(metaInfo){
                // propName = metaInfo.propName
                namedProperty = metaInfo.namedProperty
            } else{
                
                let prop = entityClass.schema.namedProperties.find(p => {
                    return p.fieldName === fieldName
                })

                if(!prop){
                    if(!ormConfig.suppressErrorOnPropertyNotFound){
                        throw new Error(`Result contain property/column [${fieldName}] which is not found in schema.`)
                    }
                }else{
                    namedProperty = prop
                    // propName = prop.name
                    // definition = prop.definition
                }
            }
            /**
             * it can be boolean, string, number, Object, Array of Object (class)
             * Depends on the props..
             */
            let propValue = namedProperty?.definition!.parseRaw(row[fieldName], namedProperty, context)
            
            Object.defineProperty(entityInstance, namedProperty?.name!, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: propValue
            })
            return entityInstance
        }, new entityClass(context) as InstanceType<T>)
        return entityInstance
    }
}

export class Entity {
    [key: string]: any
    readonly ctx: ExecutionContext
    
    constructor(ctx: ExecutionContext){
        this.ctx = ctx
    }

    get entityClass() {
        return this.ctx.models[this.constructor.name]
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

    static selector<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ){
        return Database.selector(this, null)
    }

    static parseRaw<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), row: EntityPropertyKeyValues): I{
        let r = Database.parseRaw(this, null, row)
        return r as I
    }

    static createEach<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), arrayOfData: EntityPropertyKeyValues[]): DBRunner<I[]>{
        return Database.createEach(this, null, arrayOfData)
    }

    static createOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: EntityPropertyKeyValues): DBRunner<I>{
        return Database.createOne(this, null, data)
    }

    static updateOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner<I>{
        return Database.updateOne(this, null, data, applyFilter)
    }

    static update<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner<I[]>{
        return Database.update(this, null, data, applyFilter)
    }

    static deleteOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner<I>{
        return Database.deleteOne(this, null, data, applyFilter)
    }

    static delete<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: EntityPropertyKeyValues, applyFilter?: QueryOptions): DBRunner<I[]>{
        return Database.delete(this, null, data, applyFilter)
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryOptions): DBRunner<I>{
        return Database.findOne(this, null, applyFilter)
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryOptions): DBRunner<Array<I>>{
        return Database.find(this, null, applyFilter)
    }


}


// it is a special Entity or table. Just like the Dual in SQL Server
export class Dual extends Entity {

    static register(schema: Schema) : void{
        //override the tableName into empty
        schema.tableName = ''
    }
}



export type MutateFunctionProducer = (prop: NamedProperty, rootValue: Entity, existingContext: ExecutionContext) => any

export const mutate = (actionName: string, value: any): MutateFunctionProducer => {
    return (prop: NamedProperty, rootValue: Entity, existingContext: ExecutionContext) => {
        if(!prop.definition.mutationFunc){
            throw new Error('There is no mutation function defined.')
        }
        return prop.definition.mutationFunc.call(prop.definition, actionName, value, rootValue, existingContext)
    }
}