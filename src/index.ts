import knex, { Knex } from 'knex'
import * as fs from 'fs'
export { PropertyDefinition, FieldPropertyDefinition, ComputePropertyDefinition }
import types, { FieldPropertyDefinition, PropertyDefinition, ComputePropertyDefinition } from './PropertyType'
export { PropertyDefinition as PropertyType, types }
import {makeBuilder as builder, isDataset, isRaw, isScalar, makeRaw as raw, makeColumn, makeFromClause, Column, makeScalar, Scalar, Dataset, makeRaw, isColumn, FromClause, Datasource, TableDatasource, Scalarable} from './Builder'
export const Builtin = { ComputeFn }
import { v4 as uuidv4 } from 'uuid'
import {And, Or, Equal, Contain,  IsNull, ValueOperator, ConditionOperator} from './Operator'
import { breakdownMetaFieldAlias, makeid, metaFieldAlias, metaTableAlias, notEmpty, Property, quote, thenResult } from './util'
// import { AST, Column, Parser } from 'node-sql-parser'


export type SelectorMap<E extends Schema> = {
    [key in keyof Omit<E, keyof Schema> & string]: 
        E[key] extends FieldPropertyDefinition? Column<E[key]>:
            E[key] extends ComputePropertyDefinition<infer D, infer Root, infer Arg, infer R>? 
                (
                    R extends Scalarable? 
                        CompiledComputeFunction< Arg >:
                        (R extends Promise<Scalarable>?
                            CompiledComputeFunctionPromise< Arg >: 
                            unknown) 
                        
                ):
                never;
}
// ComputeFunction<E, infer ARG>
function compute<D extends PropertyDefinition, Root extends Schema, Arg, R>(definition: D, c: ComputeFunction<Root, Arg, R>){
    return new ComputePropertyDefinition<D, Root, Arg, R>(definition, c)
}

export type QueryFilterResolver = (value: QueryFilter) => Promise<Scalar> | Scalar
// export type ExpressionSelectorFunction = (...selectors: Selector[]) => Scalar
export type QueryEntityPropertyValue = null|number|string|boolean|Date|ValueOperator
export type QueryEntityPropertyKeyValues = {[key:string]: QueryEntityPropertyValue | QueryEntityPropertyValue[]}
export type Expression = ConditionOperator | Scalar | Promise<Scalar> | QueryEntityPropertyKeyValues | Array<Expression> | boolean


export type MutationEntityPropertyKeyValues = {
    [key: string]: boolean | number | string | any | Array<any>
}

export type QuerySelect = { [key: string]: boolean | QueryOptions | Scalar } | Array<string | Column> 

export type QueryFilter = Expression

export type QueryOrderBy = ( (string|Column) | {column: (string|Column), order: 'asc' | 'desc'} )[]

export type QueryArguments = {[key:string]: any}

// export type ComputeArguments = {[key:string]: any}

// export class FutureArgument<Input = any, Output = any>{
//     constructor(private fnc: (futureValue: Input) => Output ){}
// }

export type QueryObject = {
    select?: QuerySelect,
    filter?: QueryFilter,
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
    args?: QueryArguments
    // fn?: QueryFunction
}

// type A<T> = T extends undefined? () => void: (a: T) => void

// let d: A<undefined>
// let e = d!()
// let c: A<number>
// let v = c!(5)


// export type ScalarOrDataset = Scalar | Dataset

export type ComputeFunction<Root extends Schema, ARG, R = Scalarable | Promise<Scalarable>> = (this: ComputeProperty, context: ExecutionContext, selector: Datasource<Root>, args: ARG) => R

export type CompiledComputeFunction<ARG> = (queryObject: ARG) => Column

export type CompiledComputeFunctionPromise<ARG> = (queryObject: ARG) => Promise<Column> | Column

// export type QueryFunction = (stmt: Dataset, ...selectors: Selector[]) => Dataset | Promise<Dataset>

// export type QueryOptions = QueryFunction | QueryObject | Exclude<QueryFilter, Function> | null

// export type ApplyNextQueryFunction = (stmt: Dataset, ...selectors: Selector[]) => Dataset | Promise<Dataset>

type DatabaseActionResult<T> = T
type DatabaseActionOptions = {
    failIfNone: boolean
    querySelect: QuerySelect
}
type DatabaseAction<I> = (context: ExecutionContext, options: Partial<DatabaseActionOptions>) => Promise<DatabaseActionResult<I>>


export type ORMConfig = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // types: { [key: string]: typeof PropertyDefinition },
    models: {[key:string]: typeof Entity}
    createModels: boolean,
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
    uuidPropName: string,
    globalContext: Partial<ExecutionContextConfig>
}

const ormConfig: ORMConfig = {
    primaryKeyName: 'id',
    enableUuid: false,
    // useSoftDeleteAsDefault: true,
    uuidPropName: 'uuid',
    createModels: false,
    // types: {},
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

export const client = (): string => ormConfig.knexConfig.client.toString()

export class ComputeProperty extends Property {

    readonly definition: ComputePropertyDefinition<any, any, any, any>

    constructor(name: string,
        definition: ComputePropertyDefinition<any, any, any, any>){
            super(name)
            this.definition = definition
        }
}
export class FieldProperty extends Property {

    readonly definition: FieldPropertyDefinition

    constructor(name: string,
        definition: FieldPropertyDefinition){
            super(name)
            this.definition = definition
        }

    static convertFieldName(propName: string){
        return ormConfig.propNameTofieldName ? ormConfig.propNameTofieldName(propName) : propName
    }

    get fieldName(){
        return FieldProperty.convertFieldName(this.name)
    }
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

let registeredModels: {
    [key: string]: typeof Entity
} = {}

export class Schema {

    tableName?: string
    entityName?: string
    properties: Property[] = []
    propertiesMap: {[key:string]: Property} = {}
    hooks: Hook[] = []
    primaryKey: PropertyDefinition
    uuid: PropertyDefinition | null

    constructor(entityName?: string){
        this.entityName = entityName
        this.primaryKey = types.PrimaryKey()
        if(ormConfig.enableUuid){
            this.uuid = types.StringNotNull({length: 255})
        } else {
            this.uuid = null
        }
    }

    register(entityName: string){
        this.entityName = this.entityName ?? entityName
        this.tableName = ormConfig.entityNameToTableName?ormConfig.entityNameToTableName(entityName):entityName
 
        let fields : Property[] = []
        for(let field in this){
            const actual = this[field]
            if(actual instanceof FieldPropertyDefinition) {
                const f  = new FieldProperty(field, actual)
                this.propertiesMap[field] = f
                fields.push( f )
            } else if(actual instanceof ComputePropertyDefinition ){
                //@ts-ignore
                const f = new ComputeProperty(field, actual as ComputePropertyDefinition)
                this.propertiesMap[field] = f
                fields.push( f )
            }
        }
        this.properties = fields
    }


    createTableStmt(tablePrefix?: string){
        if(!this.tableName){
            throw new Error('Not register yet')
        }
        if(this.tableName.length > 0){
            let props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty[]

            return `CREATE TABLE IF NOT EXISTS ${quote( (tablePrefix??'') + this.tableName)} (\n${
                props.map( prop => {
                    let f = prop.definition
                    return `${f.create(prop.name, prop.fieldName )}`  
                }).flat().join(',\n')}\n)`;
        }
        return ''
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    datasource<T extends Schema>(this: T, existingContext: ExecutionContext | null): TableDatasource<T>{
        let selectorImpl = makeTableDatasource<T>(this, existingContext?? globalContext)
        return selectorImpl
    }

    hook(newHook: Hook){
        this.hooks.push(newHook)
    }
}


export type MutationName = 'create'|'update'|'delete'
export type HookName = 'beforeMutation' | 'afterMutation'

export class Hook {
    propName?: string | null
    constructor(readonly name: HookName, readonly action: HookAction) {}

    onPropertyChange(propName: string){
        this.propName = propName
        return this
    }
}

export type HookInfo = {
    hookName: string,
    mutationName: MutationName,
    propertyName: string | null,
    propertyDefinition: PropertyDefinition | null,
    propertyValue: any | null,
    rootClassName: string
}

export type HookAction = <T>(context: ExecutionContext, rootValue: T, info: HookInfo) => T | Promise<T>


export const configure = async function(newConfig: Partial<ORMConfig>){
    Object.assign(ormConfig, newConfig)
    Object.assign(ormConfig.globalContext, newConfig.globalContext)

    const registerEntity = (entityName: string, entityClass: typeof Entity) => {
        registeredModels[entityName] = entityClass
        entityClass.schema.register(entityName)
    }
    
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

    return await globalContext
}


const simpleQuery = <T extends Schema>(row: Dataset, selector: Datasource<T>, queryOptions: QueryObject) => {
    let stmt = row.toQueryBuilder()

    let isWholeFilter = true

    if(queryOptions.limit){
        stmt = stmt.limit(queryOptions.limit)
        isWholeFilter = false
    }
    if(queryOptions.offset){
        stmt = stmt.offset(queryOptions.offset)
        isWholeFilter = false
    }
    if(queryOptions.orderBy){
        stmt = stmt.orderBy(queryOptions.orderBy)
        isWholeFilter = false
    }
    if(queryOptions.select){
        isWholeFilter = false
    }
    if(queryOptions.args){
        isWholeFilter = false
    }
    // if(queryOptions.fn){
    //     isWholeFilter = false
    // }

    let stmtOrPromise: Dataset | Promise<Dataset> = stmt
    if (queryOptions.select){
        stmtOrPromise = makeQuerySelectResolver(() => [selector])(queryOptions.select, row)
    }
    let filterOption: QueryFilter | null = null
    if(queryOptions.filter){
        filterOption = queryOptions.filter
        isWholeFilter = false
    }
    if(isWholeFilter){
        filterOption = queryOptions as QueryFilter
    }
    if(filterOption){
        const resolved = makeQueryFilterResolver(() => [selector])(filterOption)
        stmtOrPromise = thenResult(stmtOrPromise, stmt => thenResult(resolved, (r) => {
            stmt.toQueryBuilder().where(r).toRow()
            return stmt
        }))
    }

    if(!isWholeFilter){
        const expectedKeys = ['limit', 'offset', 'orderBy', 'select', 'filter']
        if(! Object.keys(queryOptions).every(key => expectedKeys.includes(key)) ) {
            throw new Error(`The query option must be with keys of [${expectedKeys.join(',')}]`)
        }
    }

    return stmtOrPromise
}


// const breakdownMetaTableAlias = function(metaAlias: string) {
//     metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
    
//     if(metaAlias.includes(META_FIELD_DELIMITER)){
//         let [entityName, randomNumber] = metaAlias.split(META_FIELD_DELIMITER)
//         let found = schemas[entityName]
//         return found
//     } else {
//         return null
//     }
// }





// class ProductSchema extends Schema {
//     name = types.String({})
//     shopId = types.Number()
//     // shop = belongsTo<typeof Product, typeof Shop>('Shop', 'shopId')
//     myABC = compute(types.String(), (context: ExecutionContext, root: any, args: number): Scalarable => {
//         throw new Error()
//     })
// }



// let a: SelectorMap<ProductSchema>




function makeTableDatasource<E extends Schema>(schema: E, executionContext: ExecutionContext){

    let tableAlias = metaTableAlias(schema)
    let tableName = executionContext.tablePrefix + schema.tableName
    
    const selector = makeRaw(`${quote(tableName)} AS ${quote(tableAlias)}`) as unknown as TableDatasource<E>
    let newSelector = makeFromClause(null, null, selector, null) as unknown as TableDatasource<E>
    
    newSelector.schema = schema
    newSelector.executionContext = executionContext
    newSelector.tableName = tableName
    newSelector.tableAlias = tableAlias

    //@ts-ignore
    newSelector.$ = new Proxy( this.schema ,{
        get: (oTarget: Schema, sKey: string) => {

            if(typeof sKey === 'string'){
                let prop = oTarget.propertiesMap[sKey]
                if(prop instanceof FieldProperty){
                    let tableAlias = quote(selector.tableAlias)
                    let fieldName: string = quote(prop.fieldName)
                    let alias = metaFieldAlias(prop)
                    let rawTxt = `${tableAlias}.${fieldName}`
                    return makeColumn(alias, makeScalar(raw(rawTxt), prop.definition ) )
                }
                if(prop instanceof ComputeProperty){
                    const cProp = prop
                    return (queryOptions?: any) => {
                        const subquery = cProp.definition.compute.call(cProp, executionContext, newSelector, queryOptions)
                        let alias = metaFieldAlias(cProp)
                        return makeColumn(alias, subquery)
                    }
                }
            }

        }
    }) as SelectorMap<E>

    return newSelector
}


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


class DatabaseActionRunnerBase<I> implements PromiseLike<I>{
    protected ctx: ExecutionContext
    protected action: DatabaseAction<I>
    protected options: Partial<DatabaseActionOptions> = {}
    // private trx?: Knex.Transaction | null
    protected sqlRunCallback?: ((sql: string) => void) | null

    constructor(ctx: ExecutionContext, action: DatabaseAction<I>){
        // this.beforeAction = beforeAction
        this.ctx = ctx
        this.action = action
    }

    protected async execAction(){
        return await this.action(this.ctx, this.options)
    }

    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: I) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            let result = await this.execAction()
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
    }

    async exec(){
        let result = await this.execAction()
        return result
    }

    usingConnection(trx: Knex.Transaction): this{
        this.ctx = this.ctx.clone({trx})
        return this
    }

    onSqlRun(callback: ((sql: string) => void) | null ) : this{
        this.ctx = this.ctx.clone({sqlRunCallback: callback})
        return this
    }

    usingContext(ctx: ExecutionContext) : this{
        this.ctx = ctx
        return this
    }
} 

export class DatabaseQueryRunner<I> extends DatabaseActionRunnerBase<I> {

    async failIfNone<T>(){
        this.options = {
            ...this.options,
            failIfNone: true
        }
        return this
    }
}

export class DatabaseMutationRunner<I> extends DatabaseQueryRunner<I>{

    constructor(ctx: ExecutionContext, action: DatabaseAction<I>){
        super(ctx, action)
    }

    async fetch<T>(querySelect: QuerySelect){
        this.options = {
            ...this.options,
            querySelect: querySelect
        }
        return this
    }
}

export function makeQuerySelectResolver(getSelectorFunc: () => Datasource[]) {

    return function querySelectResolver(querySelect: QuerySelect, row: Dataset) {
        let selector = getSelectorFunc()[0]
        let stmtOrPromise: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = row.toQueryBuilder()
        let allColumns: Array<Column | Promise<Column>> = []
        if(querySelect && !Array.isArray(querySelect)){
            let select = querySelect
            if (select && Object.keys(select).length > 0) {

                let removeNormalPropNames = Object.keys(select).map((key: string) => {
                    const item = select[key]
                    if (item === false) {
                        let prop = selector.schema.fieldProperties.find(p => p.name === key)
                        if (!prop) {
                            throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
                        } else {
                            if (!prop.definition.computeFunc) {
                                return prop.name
                            }
                        }
                    }
                    return null
                }).filter(notEmpty)

                if (removeNormalPropNames.length > 0) {
                    const shouldIncludes = selector.schema.fieldProperties.filter(p => !removeNormalPropNames.includes(p.name))
                    stmtOrPromise = thenResult(stmtOrPromise, s => s.clearSelect().select(...shouldIncludes))
                }

                //(the lifecycle) must separate into 2 steps ... register all computeProp first, then compile all
                let executedProps = Object.keys(select).map((key: string) => {
                    const item = select[key]
                    if (item === true) {
                        let prop = selector.schema.fieldProperties.find(p => p.name === key)
                        if (!prop) {
                            throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
                        }
                        if (prop.definition.computeFunc) {
                            return selector.$$[prop.name]()
                        }
                    } else if (item instanceof SimpleObjectClass) {
                        let options = item as QueryOptions

                        let prop = selector.schema.fieldProperties.find(p => p.name === key && p.definition.computeFunc)

                        if (!prop) {
                            // if (options instanceof PropertyDefinition) {
                            //     selector.registerProp(new NamedProperty(key, options))
                            //     return selector.$$[key]()
                            // } else {
                            //     throw new Error('Temp Property must be propertyDefinition')
                            // }
                            throw new Error(`Cannot find Property ${key}`)
                        } else {
                            if (!prop.definition.computeFunc) {
                                throw new Error('Only COmputeProperty allows QueryOptions')
                            }
                            return selector.$$[key](options)
                        }
                    } else if (isScalar(item)){
                        let scalar = item as Scalar
                        return scalar.asColumn(key)
                    }
                    return null
                }).filter(notEmpty)
                allColumns.push(...executedProps)
            }
        } else if (querySelect && querySelect instanceof Array) {
            let select = querySelect

            let props = select.map(s => {
                if( isColumn(s)) {
                    return s  as Column
                } else if( typeof s === 'string'){
                    let prop = selector.schema.fieldProperties.find(p => p.name === s)
                    if (!prop) {
                        throw new Error(`The property ${s} cannot be found in schema '${selector.entityClass.name}'`)
                    }
                    if (prop.definition.computeFunc) {
                        return selector.$$[prop.name]()
                    } else {
                        return selector._[prop.name]
                    }
                }
                throw new Error('Unexpected type')
            })

            allColumns.push(...props)
        }

        // !important: must use a constant to reference the object before it is re-assigned
        const prevStmt = stmtOrPromise
        let stmtOrPromiseNext = thenResultArray(allColumns, columns => {
            return columns.reduce((stmt, column) => {
                return thenResult(stmt, stmt => stmt.select(column))
            }, prevStmt)
        })

        return thenResult(stmtOrPromiseNext, stmt => stmt.toRow())
    }
}


export function makeQueryFilterResolver( getSelectorFunc: () => Datasource[] ){

    // console.log('aaaaaa', getSelectorFunc())
    
    const resolveExpression: QueryFilterResolver = function(value: Expression) {
        if (value === true || value === false) {
            return makeScalar(makeRaw('?', [value]), Types.Boolean())
        } else if(value instanceof ConditionOperator){
            return value.toScalar(resolveExpression)
        } else if(Array.isArray(value)){
            return resolveExpression(Or(...value))
        // } else if(value instanceof Function) {
        //     const casted = value as ExpressionSelectorFunction
        //     return casted(...(getSelectorFunc() ).map(s => s.interface!))
        } else if(isScalar(value)){
            return value as Scalar
        } else if (isDataset(value)) {
            throw new Error('Unsupport')
        } else if(value instanceof SimpleObjectClass){
            const firstSelector = getSelectorFunc()[0]
            let dict = value as SimpleObject
            let sqls = Object.keys(dict).reduce( (accSqls, key) => {
                let prop = firstSelector.getProperties().find((prop) => prop.name === key)
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
                    let converted = firstSelector.getNormalCompiled(key)
                    accSqls.push( operator.toScalar(converted) )
                } else {
                    let compiled = (firstSelector.getComputedCompiledPromise(key))()
                    // if(compiled instanceof Promise){
                    //     accSqls.push( compiled.then(col => operator.toRaw(col) ) )
                    // } else {
                    //     accSqls.push( operator.toRaw(compiled) )
                    // }
                    accSqls.push( thenResult(compiled, col => operator.toScalar(col)) )
                }

                return accSqls

            }, [] as Array<Promise<Scalar> | Scalar> )
            return resolveExpression(And(...sqls))
        } else {
            throw new Error('Unsupport Where clause')
        }
    }
    return resolveExpression
}

export class Database{
    

    static createOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: MutationEntityPropertyKeyValues): DatabaseMutationRunner< InstanceType<T> >{
        return new DatabaseMutationRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._create<T>(entityClass, existingContext, [data])
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return result[0]
            }
        )
    }

    static createEach<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, arrayOfData: MutationEntityPropertyKeyValues[]): DatabaseMutationRunner< InstanceType<T>[] >{
        return new DatabaseMutationRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let result = await Database._create<T>(entityClass, existingContext, arrayOfData)
                return result.map( data => {
                        if(data === null){
                            throw new Error('Unexpected Flow.')
                        }
                        return data
                    })
            })
    }

    private static async _create<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, values: MutationEntityPropertyKeyValues[]) {
        const schema = entityClass.schema
        const actionName = 'create'
        
        let useUuid: boolean = !!ormConfig.enableUuid
        if (ormConfig.knexConfig.client.startsWith('sqlite')) {
            if (!ormConfig.enableUuid ){
                throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
            }
        }
        
        let fns = await existingContext.withTransaction(async (existingContext) => {
            let allResults = await Promise.all(values.map(async (value) => {

                let propValues = await Database._prepareNewData(value, schema, actionName, existingContext)
                
                let newUuid = null
                if(useUuid){
                    newUuid = uuidv4()
                    propValues[ormConfig.uuidPropName] = newUuid
                }
                let stmt = getKnexInstance()(existingContext.tablePrefix + schema.tableName).insert( this.extractRealField(schema, propValues) )
        
                if (ormConfig.knexConfig.client.startsWith('pg')) {
                stmt = stmt.returning(entityClass.schema.primaryKey.fieldName)
                }
        
                let input = {
                    sqlString: stmt,
                    uuid: newUuid
                }

                // let afterMutationHooks = schema.hooks.filter()

                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (ormConfig.knexConfig.client.startsWith('mysql')) {
                    let insertedId: number
                    const insertStmt = input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id '
                    const r = await this.executeStatement(insertStmt, existingContext)
                    insertedId = r[0][0].insertId
                    let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId]))
                    
                    let b = await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)
                    return b
                } else if (ormConfig.knexConfig.client.startsWith('sqlite')) {
                    const insertStmt = input.sqlString.toString()
                    const r = await this.executeStatement(insertStmt, existingContext)
                    
                    if(ormConfig.enableUuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.uuid, uuid]))
                            return await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)
                        }
                    } else {
                        return null
                    }

                } else if (ormConfig.knexConfig.client.startsWith('pg')) {
                    const insertStmt = input.sqlString.toString()
                    let insertedId: number
                    const r = await this.executeStatement(insertStmt, existingContext)
                    
                    insertedId = r.rows[0][ entityClass.schema.primaryKey.fieldName]
                    let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId]))
                    return await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)

                } else {
                    throw new Error('Unsupport client')
                }
                
            }))
            return allResults

        })

        return fns
    }

    private static async _prepareNewData(data: MutationEntityPropertyKeyValues, schema: Schema, actionName: MutationName, context: ExecutionContext) {
        
        let propValues = Object.keys(data).reduce(( propValues, propName) => {
            let foundProp = schema.properties.find(p => {
                return p.name === propName
            })
            if (!foundProp) {
                throw new Error(`The Property [${propName}] doesn't exist in ${schema.entityName}`)
            }
            const prop = foundProp
            const propertyValue = prop.definition.parseProperty(data[prop.name], prop, context)
            propValues[prop.name] = propertyValue
            return propValues
        }, {} as MutationEntityPropertyKeyValues)

        let hooks1 = schema.hooks.filter(h => h.name === 'beforeMutation' && h.propName && Object.keys(propValues).includes(h.propName) )
        let hooks2 = schema.hooks.filter(h => h.name === 'beforeMutation' && !h.propName )

        propValues = await hooks1.reduce( async (recordP, h) => {
            let record = await recordP
            let foundProp = schema.properties.find(p => {
                return p.name === h.propName
            })
            if(!foundProp){
                throw new Error('Unexpected.')
            }
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundProp.name,
                propertyDefinition: foundProp.definition,
                propertyValue: record[foundProp.name],
                rootClassName: schema.entityName
            })
            return record
        }, Promise.resolve(propValues) )

        propValues = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: schema.entityName
            })
            return record
        }, Promise.resolve(propValues))
        
        return propValues
    }

    private static async afterMutation<T extends typeof Entity>(
        record: InstanceType<T>, 
        schema: Schema,
        actionName: MutationName,
        inputProps: MutationEntityPropertyKeyValues, 
        context: ExecutionContext): Promise<InstanceType<T>> {

        Object.keys(inputProps).forEach( key => {
            if( !(key in record) ){
                record = Object.assign(record, { [key]: inputProps[key]})
            }
        })

        const hooks1 = schema.hooks.filter(h => h.name === 'afterMutation' && h.propName && Object.keys(inputProps).includes(h.propName) )
        const hooks2 = schema.hooks.filter(h => h.name === 'afterMutation' && !h.propName )

        record = await hooks1.reduce( async (recordP, h) => {
            let record = await recordP
            let foundProp = schema.properties.find(p => {
                return p.name === h.propName
            })
            if(!foundProp){
                throw new Error('Unexpected.')
            }
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundProp.name,
                propertyDefinition: foundProp.definition,
                propertyValue: record[foundProp.name] ?? inputProps[foundProp.name],
                rootClassName: schema.entityName
            })
            return record
        }, Promise.resolve(record) )

        record = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: schema.entityName
            })
            return record
        }, Promise.resolve(record))

        return record
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, applyFilter?: QueryOptions): DatabaseQueryRunner<  InstanceType<T> >{
        return new DatabaseQueryRunner< InstanceType<T> >(
        existingContext?? globalContext,
        async (existingContext: ExecutionContext) => {
            let rows = await Database._find<T>(entityClass, existingContext, applyFilter?? null)
            return rows[0] ?? null
        })
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, applyFilter?: QueryOptions): DatabaseQueryRunner<  Array<InstanceType<T>> >{
        return new DatabaseQueryRunner< Array<InstanceType<T>> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext) => {
                let rows = await Database._find<T>(entityClass, existingContext, applyFilter?? null)
                return rows
        })
    }

    private static async _find<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, applyFilter: QueryOptions | null) {   
        
        let dualSelector = entityClass.datasource(existingContext)
       
        let sqlString = builder().select(applyFilter.props).from(dualSelector).filter(applyFilter.filter)
        // console.debug("========== FIND ================")
        // console.debug(sqlString.toString())
        // console.debug("================================")
        let resultData = await Database.executeStatement(sqlString, existingContext)

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

    static updateOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner< InstanceType<T> >{
        return new DatabaseQueryRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext, actionOptions: Partial<DatabaseActionOptions> ) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, true, false,  actionOptions)
                return result[0] ?? null
            }
        )
    }

    static update<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner< InstanceType<T>[] >{
        return new DatabaseMutationRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext, actionOptions: Partial<DatabaseActionOptions> ) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, false, false, actionOptions)
                return result
            }
        )
    }

    private static async _update<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext, data: MutationEntityPropertyKeyValues,  
        applyFilter: QueryFilter | null, 
        isOneOnly: boolean,
        isDelete: boolean,
        actionOptions: Partial<DatabaseActionOptions> 
       ) {
        
        const schema = entityClass.schema
        const actionName = isDelete?'delete':'update'

        const s = entityClass.selector()
        let propValues = await Database._prepareNewData(data, schema, actionName, existingContext)

        // let deleteMode: 'soft' | 'real' | null = null
        // if(isDelete){
        //     deleteMode = existingContext.isSoftDeleteMode ? 'soft': 'real'
        // }

        const realFieldValues = this.extractRealField(schema, propValues)
        const input = {
            updateSqlString: !isDelete && Object.keys(realFieldValues).length > 0? (applyFilter? builder(s).toQueryBuilder().where(s(applyFilter)): builder(s) ).toQueryBuilder().update(realFieldValues) : null,
            selectSqlString: (applyFilter? builder(s).toQueryBuilder().where(s(applyFilter)): builder(s) ),
            entityData: data
        }

        let fns = await existingContext.withTransaction(async (existingContext) => {
            if(!input.selectSqlString || !input.entityData){
                throw new Error('Unexpected Flow.')
            }
            let updateStmt = input.updateSqlString
            let selectStmt = input.selectSqlString.toQueryBuilder().select(entityClass.schema.primaryKey.fieldName)
            
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
                    let record = await this.findOne(entityClass, existingContext, {[entityClass.schema.primaryKey.name]: pkValue})
                    let finalRecord = await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)
                    if(isDelete){
                        await this.executeStatement( builder(s).toQueryBuilder().where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
                    }

                    // {
                    //     ...(querySelectAfterMutation? {select: querySelectAfterMutation}: {}),
                    //     where: { [entityClass.schema.primaryKey.name]: pkValue} 
                    // })

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
                        let finalRecord = await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)
                        if(isDelete){
                            await this.executeStatement( builder(s).toQueryBuilder().where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
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
                        let finalRecord = await this.afterMutation<T>(record, schema, actionName, propValues, existingContext)
                        if(isDelete){
                            await this.executeStatement( builder(s).toQueryBuilder().where( {[entityClass.schema.primaryKey.fieldName]: pkValue} ).del(), existingContext)
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

    static deleteOne<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner< InstanceType<T> >{
        return new DatabaseQueryRunner< InstanceType<T> >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext, actionOptions: Partial<DatabaseActionOptions> ) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, true, true, actionOptions)
                return result[0] ?? null
            }
        )
    }

    static delete<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner< InstanceType<T>[] >{
        return new DatabaseQueryRunner< InstanceType<T>[] >(
            existingContext?? globalContext,
            async (existingContext: ExecutionContext, actionOptions: Partial<DatabaseActionOptions> ) => {
                let result = await Database._update<T>(entityClass, existingContext, data, applyFilter??null, false, true, actionOptions)
                return result
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

    static parseRaw<T extends typeof Entity>(entityClass: T, existingContext: ExecutionContext | null, row: MutationEntityPropertyKeyValues): InstanceType<T>{
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
                
                let prop = entityClass.schema.properties.find(p => {
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

    static extractRealField(schema: Schema, fieldValues: MutationEntityPropertyKeyValues): any {
        return Object.keys(fieldValues).reduce( (acc, key) => {
            let prop = schema.properties.find(p => p.name === key)
            if(!prop){
                throw new Error('Unexpected')
            }
            if(!prop.definition.computeFunc){
                acc[prop.fieldName] = fieldValues[key]
            }
            return acc
        }, {} as MutationEntityPropertyKeyValues)        
    }
}

export class Entity {
    [key: string]: any
    static schema: Schema
    readonly _ctx: ExecutionContext
    
    constructor(ctx: ExecutionContext){
        this._ctx = ctx
    }

    get entityClass() {
        return this._ctx.models[this.constructor.name]
    }

    // static get schema(): Schema{
    //     return schemas[this.name]
    // }

    static get tableName() {
        return this.schema.tableName
    }

    static datasource<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), ctx: ExecutionContext ): Datasource<I["schema"]> {
        return this.schema.datasource(ctx)
    }

    // /**
    //  * Can be overridden by inheritance Class
    //  * @param schema
    //  */
    // static register(schema: Schema) : void{
    // }

    // static selector<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ){
    //     return Database.selector(this, null)
    // }

    static parseRaw<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), row: MutationEntityPropertyKeyValues): I{
        let r = Database.parseRaw(this, null, row)
        return r as I
    }

    static createEach<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), arrayOfData: MutationEntityPropertyKeyValues[]): DatabaseQueryRunner<I[]>{
        return Database.createEach(this, null, arrayOfData)
    }

    static createOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: MutationEntityPropertyKeyValues): DatabaseQueryRunner<I>{
        return Database.createOne(this, null, data)
    }

    static updateOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner<I>{
        return Database.updateOne(this, null, data, applyFilter)
    }

    static update<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner<I[]>{
        return Database.update(this, null, data, applyFilter)
    }

    static deleteOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner<I>{
        return Database.deleteOne(this, null, data, applyFilter)
    }

    static delete<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: MutationEntityPropertyKeyValues, applyFilter?: QueryFilter): DatabaseQueryRunner<I[]>{
        return Database.delete(this, null, data, applyFilter)
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryOptions): DatabaseQueryRunner<I>{
        return Database.findOne(this, null, applyFilter)
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryOptions): DatabaseQueryRunner<Array<I>>{
        return Database.find(this, null, applyFilter)
    }

    static find<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), 
        options: QueryX< I["schema"] > ): 
        ObjectValue< I > { 
        throw new Error()
    }

}


function find<T extends {
        [key: string]: Scalar<any>
    }>(options: {
    props: T
    source?: Datasource<any>
    filter?: any
}): {
    [key in keyof T]: T[key] extends Scalar<infer D>? (D extends PropertyDefinition ? ReturnType< D["parseRaw"]>: never):
            never;
}{
    throw new Error()
}


// it is a special Entity or table. Just like the Dual in SQL Server
// export class Dual extends Entity {

//     static register(schema: Schema) : void{
//         //override the tableName into empty
//         schema.tableName = ''
//     }
// }