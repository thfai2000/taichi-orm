import knex, { Knex } from 'knex'
import * as fs from 'fs'
import Types, { PropertyType } from './PropertyType'
export { PropertyType, Types }
import {makeBuilder as builder, makeRaw as raw, makeColumn, Source, makeSource, Column} from './Builder'
export {builder, raw}
import { Relations } from './Relations'
export { Relations }
import { v4 as uuidv4 } from 'uuid'
// import { AST, Column, Parser } from 'node-sql-parser'

export type Config = {
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
    primaryKeyName: string
    enableUuid: boolean
    uuidColumnName: string
}

// the new orm config
export const config: Config = {
    primaryKeyName: 'id',
    enableUuid: false,
    uuidColumnName: 'uuid',
    createModels: false,
    models: {},
    knexConfig: {
        client: 'mysql' //default mysql
    }
}

const META_FIELD_DELIMITER = '___'

export const client = (): string => config.knexConfig.client.toString()

export const quote = (name: string) => {
    let c = client()
    if(c.startsWith('sqlite') || c.startsWith('mysql') ){
        //TODO: escape `
        return `\`${name}\``
    } else if (c.startsWith('pg')){
        //TODO: escape "
        return `"${name}"`
    }
    throw new Error('Unsupport client')
}

let _globalKnexInstance: Knex | null = null

// let _sqlParser: Parser | null = null

// const getSqlParser = (): Parser => {
//     if(_sqlParser){
//         return _sqlParser
//     }
//     let pkg = 'node-sql-parser'
//     if(client().startsWith('pg')){
//         pkg = 'node-sql-parser/build/postgresql'
//     } else if(client().startsWith('mysql')){
//         pkg = 'node-sql-parser/build/mysql'
//     }

//     const {Parser} = require(pkg)
//     _sqlParser = new Parser()
//     return _sqlParser!
// }

// a global knex instance
export const getKnexInstance = (): Knex => {
    if(_globalKnexInstance){
        return _globalKnexInstance
    }

    let newKnexConfig = Object.assign({
        useNullAsDefault: true
    }, config.knexConfig)

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


export const startTransaction = async<T>(func: (trx: Knex.Transaction) => Promise<T> | T, existingTrx?: Knex.Transaction ): Promise<T> => {
    let knex = getKnexInstance()
    return await new Promise((resolve, reject)=> {
        const useTrx = (trx: Knex.Transaction, isExistingTrx: boolean) => {
            try{
                const AsyncFunction = (async () => {}).constructor;
                if(func instanceof AsyncFunction){
                    let called = func(trx) as Promise<T>
                    called.then(
                        (result: T) => {
                            if(!isExistingTrx){
                                trx.commit().then( 
                                    () => resolve(result),
                                    (error) => reject(error)
                                )
                            } else {
                                resolve(result)
                            }
                        },
                        (error: any) => {
                            if(!isExistingTrx){
                                trx.rollback().then(
                                    () => reject(error),
                                    () => reject(error)
                                )
                            } else {
                                reject(error)
                            }
                        }
                    )
                }else{
                    let result = func(trx)
                    if(!isExistingTrx){
                        trx.commit().then( 
                            () => resolve(result),
                            (error) => reject(error)
                        )
                    } else {
                        resolve(result)
                    }
                }
            }catch(error){
                if(!isExistingTrx){
                    trx.rollback().then(
                        () => reject(error),
                        () => reject(error)
                    )
                } else {
                    reject(error)
                }
            }
        }

        if(existingTrx){
            // use existing
            useTrx(existingTrx, true)
        } else {
            // use new 
            knex.transaction( (trx) => {
                useTrx(trx, false)
            })
        }
    })
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
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = new NamedProperty(
            config.primaryKeyName,
            new Types.PrimaryKey(),
            null
        )
        if(config.enableUuid){
            this.uuid = new NamedProperty(
                config.uuidColumnName,
                new Types.String(false, 255, {unique: true}),
                null
            )
            this.namedProperties = [this.primaryKey, this.uuid]
        } else {
            this.uuid = null
            this.namedProperties = [this.primaryKey]
        }
        
    }

    createTableStmt(){
        if(this.tableName.length > 0){
            return `CREATE TABLE IF NOT EXISTS ${quote(this.tableName)} (\n${
                this.namedProperties.filter(f => !f.computedFunc).map(f => {
                    return `${f.definition.create(f)}`  
                }).flat().join(',\n')}\n)`;
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

    computedProp(name:string, definition: any, computedFunc: ComputedFunction, options?: any){
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

export type ComputedFunction = (selector: Selector, queryFunction: ApplyNextQueryFunction, ...args: any[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export type NamedPropertyOptions = {
    skipFieldNameConvertion?: boolean
}

export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: PropertyType,
        public computedFunc?: ComputedFunction | null,
        public options?: NamedPropertyOptions){
            this.name = name
            this.definition = definition
            this.computedFunc = computedFunc
            this.options = options

            if( /[\.`' ]/.test(name) || name.includes(META_FIELD_DELIMITER) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "${META_FIELD_DELIMITER}", "'" or startsWith/endsWith '_'.`)
            }
        }

    static convertFieldName(propName: string){
        return config.propNameTofieldName ? config.propNameTofieldName(propName) : propName
    }

    get fieldName(){
        if(this.options?.skipFieldNameConvertion){
            return this.name
        } else {
            return NamedProperty.convertFieldName(this.name)
        }
    }

    compileAs_(rootSelector: SelectorImpl){
        if(this.computedFunc){
            throw new Error('Computed Property cannot be compiled as normal field.')
        } 
        return makeColumn(rootSelector.interface!, this, null)
    }

    compileAs$(rootSelector: SelectorImpl): CompiledFunction{
        if(!this.computedFunc){
            throw new Error('Normal Property cannot be compiled as computed field.')
        }
        let computedFunc = this.computedFunc
        let namedProperty = this
        // let fieldAlias = metaFieldAlias(namedProperty)

        return (queryFunction?: QueryFunction, ...args: any[]) => {
            let subquery: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = this.executeComputeFunc(queryFunction, computedFunc, rootSelector, args)

            let process = (subquery: Knex.QueryBuilder): Column => {
                return makeColumn(null, namedProperty, subquery)
            }

            if(subquery instanceof Promise){
                throw new Error(`Computed Function of Property '${namedProperty.name}' which used Async function/Promise has to use Selector.$p to access`)
            } else {
                return process(subquery)
            }
        }
    }

    compileAs$p(rootSelector: SelectorImpl): CompiledFunctionPromise {
        if(!this.computedFunc){
            throw new Error('Normal Property cannot be compiled as computed field.')
        }
        let computedFunc = this.computedFunc
        let namedProperty = this
        // let fieldAlias = metaFieldAlias(namedProperty)

        return (queryFunction?: QueryFunction, ...args: any[]) => {
            let subquery: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = this.executeComputeFunc(queryFunction, computedFunc, rootSelector, args)

            let process = (subquery: Knex.QueryBuilder): Column => {
                return makeColumn(null, namedProperty, subquery)
            }

            if(subquery instanceof Promise){
                return new Promise<Column>( (resolve, reject)=> {
                    if(subquery instanceof Promise){
                        subquery.then((query: Knex.QueryBuilder)=>{
                            resolve(process(query))
                        },reject)
                    } else {
                        throw new Error('Unexpected flow. Subquery is updated.')
                    }
                })
            } else {
                throw new Error(`Computed Function of Property '${namedProperty.name}' has to use Selector.$ to access`)
            }
        }


    }

    

    private executeComputeFunc(queryFunction: QueryFunction | undefined, computedFunc: ComputedFunction, rootSelector: SelectorImpl, args: any[]) {
        const applyFilterFunc: ApplyNextQueryFunction = (stmt, selector) => {
            let process = (stmt: Knex.QueryBuilder) => {
                // console.log('stmt', stmt.toString())
                // If the function object placed into the Knex.QueryBuilder, 
                // Knex.QueryBuilder will call it and pass itself as the parameter
                // That's why we can say likely our compiled function didn't be called.
                if (queryFunction && !(queryFunction instanceof Function)) {
                    console.log('\x1b[33m%s\x1b[0m', 'Likely that your ComputedProperty are not called before placing into Knex.QueryBuilder.')
                    throw new Error('The QueryFunction is not instanceof Function.')
                }
                const x = (queryFunction && queryFunction(stmt, selector)) || stmt
                return x
            }

            if (stmt instanceof Promise) {
                return new Promise<Knex.QueryBuilder>((resolve, reject) => {
                    if (stmt instanceof Promise) {
                        stmt.then((query: Knex.QueryBuilder) => {
                            resolve(process(query))
                        }, reject)
                    } else {
                        throw new Error('Unexpected flow. Subquery is updated.')
                    }
                })
            } else {
                return process(stmt)
            }
        }
        let subquery: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = computedFunc(rootSelector.interface!, applyFilterFunc, ...args)
        return subquery
    }
}

export const configure = async function(newConfig: Partial<Config>){
    Object.assign(config, newConfig)


    // if(config.waitUtilDatabaseReady){
        
    //     while(){
    //         try{
    //             await getKnexInstance().raw('SELECT 1')
    //         }catch(error){
    
    //         }
    //     }

    // }

    let tables: Schema[] = []

    const registerEntity = (entityName: string, entityClass: any) => {
        let s = new Schema(entityName);
        if(entityClass.register){
            entityClass.register(s)
            schemas[entityName] = s
            tables.push(s)
        }
        registeredModels[entityName] = entityClass
    }
    
    //register special Entity Dual
    registerEntity(Dual.name, Dual)

    //register models 
    if(config.models){
        let models = config.models
        Object.keys(models).forEach(key => {
            registerEntity(key, models[key]);
        })
    }
    //register models by path
    if(config.modelsPath){
        let files = fs.readdirSync(config.modelsPath)
        await Promise.all(files.map( async(file) => {
            if(file.endsWith('.js')){
                let path = config.modelsPath + '/' + file
                path = path.replace(/\.js$/,'')
                // console.debug('load model file:', path)
                let p = path.split('/')
                let entityName = p[p.length - 1]
                let entityClass = require(path)
                registerEntity(entityName, entityClass.default);
            }
        }))
    }


    let sqlStmts: string[] = tables.map(t => t.createTableStmt()).filter(t => t)

    //write schemas into sql file
    if(config.outputSchemaPath){
        let path = config.outputSchemaPath
        fs.writeFileSync(path, sqlStmts.join(";\n") + ';')
        // console.debug('schemas files:', Object.keys(schemas))
    }

    //create tables
    // important: sqllite3 doesn't accept multiple statements
    if(config.createModels){
        await Promise.all( sqlStmts.map( async(sql) => {
            await getKnexInstance().raw(sql)
        }) )
    }

    return sqlStmts
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

export interface Selector {
    (value: any): any
    impl: SelectorImpl
    entityClass: typeof Entity
    schema: Schema
    derivedProps: Array<NamedProperty>
    _: {[key: string] : Column}
    $: {[key: string] : CompiledFunction}
    
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    all: Column[]
    star: Column
    source: Source
    // sourceRaw: string
    pk: Column
    uuid: Column | null
    // [key: string]: any
    tableAlias: string
    registerProp(namedProperty: NamedProperty): CompiledFunction
    getProperties(): NamedProperty[]
}


export class SelectorImpl{
    interface: Selector | null | undefined
    entityClass: typeof Entity
    schema: Schema
    derivedProps: Array<NamedProperty> = []
    _: {[key: string] : Column}
    $: {[key: string] : CompiledFunction}
    $p: {[key: string] : CompiledFunctionPromise}
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    [key: string]: any
    tableAlias: string

    // stored any compiled property
    // compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor(entityClass: typeof Entity, schema: Schema){
        let selector = this
        this.schema = schema
        this.tableAlias = metaTableAlias(schema)
        this.entityClass = entityClass
        
        this._ = new Proxy( {} ,{
            get: (oTarget, sKey: string) => {
                return selector.getNormalCompiled(sKey)
            }
        }) as {[key: string] : Column}

        this.$ = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledFunction => {
                return selector.getComputedCompiled(sKey)
            }
        })

        this.$p = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledFunctionPromise => {
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
        return prop!.compileAs$p(selector)
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
        return prop!.compileAs$(selector)
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
        return prop!.compileAs_(selector)
    }

    private checkDollar(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}'`)
        } else if (!prop.computedFunc) {
            throw new Error(`Property '${sKey}' is NormalProperty. Accessing through $ is not allowed.`)
        }
    }

    private checkDash(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}'`)
        } else if (prop.computedFunc) {
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

    // get sourceRaw(): string{
    //     if(this.schema.tableName.length === 0){
    //         throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
    //     }
    //     return `${quote(this.schema.tableName)} AS ${quote(this.tableAlias)}`
    // }

    // "abc.*"
    get star(): Column{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [star] for selection.`)
        }
        // return `${this.tableAlias}.$star`
        return makeColumn(this.interface!, '*', null)
    }

    get all(): Column[] {
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this.getProperties().filter(p => !p.computedFunc).map(p => this.getNormalCompiled(p.name))
    }

    get pk(): Column{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.primaryKey.name]
    }

    get uuid(): Column | null {
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.uuid?.name ?? '']
    }

    getProperties(): NamedProperty[]{
        // derived Props has higher priority. I can override the schema property
        return [...this.derivedProps, ...this.schema.namedProperties]
    }

    registerProp(namedProperty: NamedProperty): CompiledFunction{
        this.derivedProps.push(namedProperty)
        if(!namedProperty.computedFunc){
            throw new Error('Only the Computed Property can be registered after the schema is created.')
        } else {
            return this.getComputedCompiled(namedProperty.fieldName)
        }
    }
}

export type CompiledFunction = (queryFunction?: QueryFunction, ...args: any[]) => Column

export type CompiledFunctionPromise = (queryFunction?: QueryFunction, ...args: any[]) => Promise<Column>

export type QueryFunction = (stmt: Knex.QueryBuilder, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export type ApplyNextQueryFunction = (stmt: Knex.QueryBuilder | Promise<Knex.QueryBuilder>, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

type ExecutionContextAction<I> =  (beforeExecutionOutput: BeforeExecutionOutput, trx?: Knex.Transaction) => Promise<I>
type BeforeExecutionAction = () => Promise<BeforeExecutionOutput>
type BeforeExecutionOutput = Array<{
    sqlString: SQLString,
    uuid: string | null
}>

export class ExecutionContext<I> implements PromiseLike<I>{
    private beforeAction: BeforeExecutionAction
    private trx?: Knex.Transaction
    private action: ExecutionContextAction<I>
    private withLogFlag: boolean

    constructor(beforeAction: BeforeExecutionAction, action: ExecutionContextAction<I>){
        this.beforeAction = beforeAction
        this.action = action
        this.withLogFlag = false
    }

    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: I) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            let beforeExecutionOutput = await this.beforeAction()
            if(this.withLogFlag){
                beforeExecutionOutput.forEach( ({sqlString}) => console.log('\x1b[33m%s\x1b[0m', sqlString.toString()) )
            }
            let result = await this.action(beforeExecutionOutput, this.trx)
            if(onfulfilled){
                return onfulfilled(result)
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

    usingConnection(trx: Knex.Transaction): ExecutionContext<I>{
        this.trx = trx
        return this
    }

    usingConnectionIfAvailable(trx: Knex.Transaction | null | undefined): ExecutionContext<I>{
        if(trx){
            this.trx = trx
        }
        return this
    }

    withLog(){
        this.withLogFlag = true
        return this
    }

    async toSQLString(): Promise<string[]> {
        return (await this.beforeAction()).map( ({sqlString}) => sqlString.toString() )
    }
}
export class Database{

    static run(...args: Array<typeof Entity | ((...args: Array<Selector>) => Knex.QueryBuilder )> ) : ExecutionContext<Dual[]> {
        return new ExecutionContext<Dual[]>(
            async() => {
                if(args.length < 1){
                    throw new Error('At least one selector callback should be given.')
                }
            
                let callback = args[args.length -1] as (...args: Array<Selector>) => Knex.QueryBuilder
                let entities = args.slice(0, args.length -1) as Array<typeof Dual>
                let selectors = entities.map(entity => entity.selector())
                let stmt = callback(...selectors)

                let dualSelector = Dual.newSelector()
                let prop = new NamedProperty(
                    'data',
                    new Types.ArrayOf(Dual),
                    (dualSelector): Knex.QueryBuilder => {
                        return stmt
                    }
                )
                dualSelector.registerProp(prop)

                return [{
                    sqlString: builder().select(await dualSelector.$.data()),
                    uuid: null
                }]
            },
            async(input: BeforeExecutionOutput, trx?: Knex.Transaction) => {
                // console.debug("======== run ========")
                // console.debug(stmt.toString())
                // console.debug("=====================")
                if(input.length > 1){
                    throw new Error('Unexpected Flow.')
                }

                let rows = await Database._find(Dual, input[0].sqlString, trx)
                return rows
            })
    }

    static createOne<T extends typeof Entity>(entityClass: T, data: SimpleObject ): ExecutionContext< InstanceType<T> >{
        return new ExecutionContext< InstanceType<T> >(
            async() => {
                let addUuid: boolean = !!config.enableUuid
                if (config.knexConfig.client.startsWith('sqlite')) {
                    if (!config.enableUuid ){
                        throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
                    }
                }
                let prepared = Database._prepareCreate<T>(entityClass, data, addUuid)
                return [prepared]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction) => {
                let result = await Database._create<T>(input, entityClass, existingTrx)
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return result[0]
            }
        )
    }

    static create<T extends typeof Entity>(entityClass: T, arrayOfData: SimpleObject[] ): ExecutionContext< InstanceType<T>[] >{
        return new ExecutionContext< InstanceType<T>[] >(
            async() => {
                let addUUID: boolean = !!config.enableUuid
                if (config.knexConfig.client.startsWith('sqlite')) {
                    if (!config.enableUuid ){
                        throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
                    }
                }
                return arrayOfData.map( (data) => {
                    return Database._prepareCreate<T>(entityClass, data, addUUID)
                })
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction) => {
                let result = await Database._create<T>(input, entityClass, existingTrx)
                return result.map( data => {
                    if(data === null){
                        throw new Error('Unexpected Flow.')
                    }
                    return data
                })
            })
    }

    private static async _create<T extends typeof Entity>(inputs: BeforeExecutionOutput, entityClass: T, existingTrx: Knex.Transaction<any, any[]> | undefined) {
        let fns = await startTransaction(async (trx) => {
            let allResults = await Promise.all(inputs.map(async ( input) => {
                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (config.knexConfig.client.startsWith('mysql')) {
                    let insertedId: number
                    const r = await this.executeStatement(input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id ', trx)
                    insertedId = r[0][0].insertId
                    let records = () => this.find(entityClass, (stmt, t) => stmt.whereRaw('?? = ?', [t.pk, insertedId]))
                    return records
                } else if (config.knexConfig.client.startsWith('sqlite')) {
                    const r = await this.executeStatement(input.sqlString.toString(), trx)
                    
                    if(config.enableUuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let records = () => this.find(entityClass, (stmt, t) => stmt.whereRaw('?? = ?', [t.uuid, uuid]))
                            // return records[0] ?? null
                            return records
                        }
                    } else {
                        return null
                    }

                } else if (config.knexConfig.client.startsWith('pg')) {
                    let insertedId: number
                    const r = await this.executeStatement(input.sqlString.toString(), trx)
                    
                    insertedId = r.rows[0][ NamedProperty.convertFieldName(config.primaryKeyName)]
                    let records = () => this.find(entityClass, (stmt, t) => stmt.whereRaw('?? = ?', [t.pk, insertedId]))
                    return records

                } else {
                    throw new Error('NYI')
                }
                
            }))
            return allResults

        }, existingTrx)

        return await Promise.all(fns.map(async (exec) => {
            if(exec === null){
                return null
            }
            const context = exec().usingConnectionIfAvailable(existingTrx)
            return (await context)[0] ?? null
        }))
    }

    private static _prepareCreate<T extends typeof Entity>(entityClass: T, data: SimpleObject, useUuid: boolean) {
        const schema = entityClass.schema
        let newUuid = uuidv4()
        let newData = Object.keys(data).reduce((acc, propName) => {
            let prop = schema.namedProperties.find(p => {
                return p.name === propName
            })
            if (!prop) {
                throw new Error(`The Property [${propName}] doesn't exist`)
            }
            acc[prop.fieldName] = prop.definition.parseProperty(data[prop.name], prop)
            return acc
        }, {} as SimpleObject)

        if(useUuid){
            newData[config.uuidColumnName] = newUuid
        }
        let stmt = getKnexInstance()(schema.tableName).insert(newData)

        if (config.knexConfig.client.startsWith('pg')) {
           stmt = stmt.returning(NamedProperty.convertFieldName(config.primaryKeyName))
        }

        return {
            sqlString: stmt,
            uuid: newUuid
        }
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
     static findOne<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): ExecutionContext<  InstanceType<T> >{
         return new ExecutionContext< InstanceType<T> >(
            async() => {
                return [{
                    sqlString: await Database._prepareFind(entityClass, applyFilter),
                    uuid: null
                }]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction
            ) => {
                if(input.length > 1){
                    throw new Error('Unexpected Flow.')
                }
                let rows = await Database._find<T>(entityClass, input[0].sqlString, existingTrx)
            return rows[0] ?? null
        })
     }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): ExecutionContext<  Array<InstanceType<T>> >{
        return new ExecutionContext< Array<InstanceType<T>> >(
            async() => {
                return [{
                    sqlString: await Database._prepareFind(entityClass, applyFilter),
                    uuid: null
                }]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction
            ) => {
                let rows = await Database._find<T>(entityClass, input[0].sqlString, existingTrx)
            return rows
        })
    }

    private static async _prepareFind<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): Promise<SQLString>{
        let dualSelector = Dual.newSelector()
        let prop = new NamedProperty(
            'data',
            new Types.ArrayOf(entityClass),
            () => {
                let currentEntitySelector = entityClass.selector()
                let stmt: Knex.QueryBuilder = builder(currentEntitySelector)
                let result = stmt
                if (applyFilter) {
                    return applyFilter(stmt, currentEntitySelector)
                } else{
                    return result
                }
            }
        )
        dualSelector.registerProp(prop)
        return builder().select(await dualSelector.$.data())
    }

    private static async _find<T extends typeof Entity>(entityClass: T, stmt: SQLString, existingTrx?: Knex.Transaction<any, any[]>) {
       
        // console.debug("========== FIND ================")
        // console.debug(stmt.toString())
        // console.debug("================================")
        let resultData: any = await Database.executeStatement(stmt, existingTrx)

        let rowData = null
        if(config.knexConfig.client.startsWith('mysql')){
            rowData = resultData[0][0]
        } else if(config.knexConfig.client.startsWith('sqlite')){
            rowData = resultData[0]
        } else if(config.knexConfig.client.startsWith('pg')){
            rowData = resultData.rows[0]
        } else {
            throw new Error('NYI')
        }
        let dualInstance = this.parseRaw(Dual, rowData)
        let str = "data" as keyof Dual
        let rows = dualInstance[str] as Array<InstanceType<T>>
        return rows
    }

    static async executeStatement(stmt: SQLString, existingTrx?: Knex.Transaction): Promise<any> {

        let KnexStmt = getKnexInstance().raw(stmt.toString())
        if (existingTrx) {
            KnexStmt.transacting(existingTrx)
        }
        let result = null
        try{
            result = await KnexStmt
        }catch(error){
            throw error
        }
        return result
    }

    static parseRaw<T extends typeof Entity>(entityClass: T, row: SimpleObject): InstanceType<T>{
        // let entityClass = (entityConstructor as unknown as typeof Entity)
        // let entityClass = this
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
                    if(!config.suppressErrorOnPropertyNotFound){
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
            let propValue = namedProperty?.definition!.parseRaw(row[fieldName], namedProperty)
            
            Object.defineProperty(entityInstance, namedProperty?.name!, {
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

export class Entity {
    [key: string]: any

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
        return this.newSelector()
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    static newSelector<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Selector{
        let selectorImpl = new SelectorImpl(this, schemas[this.name])
        // let entityClass = this

        let selector = function(value: any){
            if(typeof value === 'string'){
                return selectorImpl.getNormalCompiled(value)
            } else if(value.constructor === Object){

                let sqlArgs: string[] = []
                let accSqls: string[] = []
            
                Object.keys(value).forEach( (key) => {
                    let prop = selectorImpl.getProperties().find((prop) => prop.name === key)
                    if(prop && !prop.computedFunc){
                        let converted = selectorImpl.getNormalCompiled(key).toString()
                        accSqls.push(`${converted} = ?`)
                        sqlArgs.push(value[key])
                    }
                })
                return raw( accSqls.join(' AND '), sqlArgs)
            } else if(Array.isArray(value)){
                return value.map( v => selectorImpl.getNormalCompiled(v) )
            } else return value
        } as Selector

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
                        } else if( /^\$/.test(sKey) ){
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

    static create<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), arrayOfData: SimpleObject[]): ExecutionContext<I[]>{
        return Database.create(this, arrayOfData)
    }

    static createOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: SimpleObject): ExecutionContext<I>{
        return Database.createOne(this, data)
    }

    // static createOneOnly<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: SimpleObject): ExecutionContext<void>{
    //     return Database.createOneOnly(this, data)
    // }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<I>{
        return Database.findOne(this, applyFilter)
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<Array<I>>{
        return Database.find(this, applyFilter)
    }

    static parseRaw<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), row: SimpleObject): I{
        let r = Database.parseRaw(this, row)
        return r as I
    }
}


// it is a special Entity or table. Just like the Dual in SQL Server
export class Dual extends Entity {

    static register(schema: Schema) : void{
        //override the tableName into empty
        schema.tableName = ''
    }
}


export const run = Database.run
export const models = registeredModels

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



// type d<Type> = {
//     [key in keyof Type as `$${string}`] : boolean
// }
