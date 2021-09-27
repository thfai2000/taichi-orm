import knex, { Knex } from 'knex'
import * as fs from 'fs'
export { PropertyTypeDefinition as PropertyDefinition, FieldPropertyTypeDefinition as FieldPropertyDefinition }
import { ArrayOfType, FieldPropertyTypeDefinition, ObjectOfType, PropertyTypeDefinition } from './PropertyType'
// export { PropertyDefinition as PropertyType, types }
import {Dataset, Datasource, TableDatasource, Scalarable, Scalar, Column, TableOptions, resolveEntityProps, Expression, AddPrefix, ExpressionFunc} from './Builder'
// export const Builtin = { ComputeFn }
import { v4 as uuidv4 } from 'uuid'
// import {And, Or, Equal, Contain,  IsNull, ValueOperator, ConditionOperator} from './Operator'
import { breakdownMetaFieldAlias, ExtractComputeProps, ExtractProps, makeid, META_FIELD_DELIMITER, notEmpty, quote, SimpleObject, SQLString, thenResult, UnionToIntersection } from './util'

// import { SingleSourceArg, SingleSourceFilter } from './Relation'
// import { SingleSourceFilter, SingleSourceQueryOptions, SingleSourceQueryFunction } from './Relation'
// import { AST, Column, Parser } from 'node-sql-parser'

export type QueryOrderBy = ( (string| Column<any, any> ) | {column: (string|Column<any, any>), order: 'asc' | 'desc'} )[]

export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any>
} | SelectableProps<E>[]


export type ComputePropertyArgsMap<E> = {
    [key in keyof ExtractComputeProps<E> & string ]:
            E[key] extends undefined?
            never:
            (
                E[key] extends ComputeProperty<infer D, infer Root, infer rootName, infer Arg>? 
                Arg: never
            )
}


export type SingleSourceArg<S extends TableSchema> = {
    props?: Partial<ComputePropertyArgsMap<S>>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractProps<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >        
                > | ExpressionFunc<
        UnionToIntersection< AddPrefix< ExtractProps<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >         
        >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type SingleSourceFilter<S extends TableSchema> = Expression<
        UnionToIntersection< AddPrefix< ExtractProps<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >        
    >

export type SingleSourceArgFunction<S extends TableSchema> = (root: SelectorMap< S>) => SingleSourceArg<S>


// export type SingleSourceQueryFunction<S extends TableSchema, SName extends string> = (ctx: ExecutionContext, root: Datasource<S, SName>) => {
//     props?: ComputePropertyArgsMap<S>,
//     filter?: Expression<never>,
//     limit?: number,
//     offset?: number,
//     orderBy?: QueryOrderBy
// }

export type TwoSourcesArg<Root extends TableSchema, RootName extends string, Related extends TableSchema, RelatedName extends string> = {

    props?: Partial<ComputePropertyArgsMap<Related>>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractProps< Root>, '', ''> | AddPrefix< ExtractProps< Root>, RootName> | AddPrefix< ExtractProps< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                > | 
                ExpressionFunc< 
        UnionToIntersection< AddPrefix< ExtractProps< Root>, '', ''> | AddPrefix< ExtractProps< Root>, RootName> | AddPrefix< ExtractProps< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}


export type TwoSourcesArgFunction<Root extends TableSchema, RootName extends string, Related extends TableSchema, RelatedName extends string> =
    (root: Datasource<Root, RootName>, related: Datasource<Related, RelatedName>) => TwoSourcesArg<Root, RootName, Related, RelatedName>


// type Col<D> = { key: Scalar<D> }

// let xxxx: Col<boolean>
// xxxx!.

// type Col<N extends string, T> =  { [key in keyof key as `${N}`]: Scalar<T> }

// let aaa: Col<'sss', BooleanType>

export type SelectorMap<E> = {
    [key in keyof ExtractProps<E> & string ]:
            E[key] extends undefined?
            never:
            (
                E[key] extends ComputeProperty<infer D, infer Root, infer rootName, infer Arg>? 
                (
                        CompiledComputeFunction<key, Arg, D>                    
                ): 
                    E[key] extends FieldProperty<infer D>? 
                    Column<key, D>:
                    never
            )
}

export type ComputeFunction<
    Root extends Schema, Name extends string, ARG extends any, 
    R extends PropertyTypeDefinition<any>
> = (source: Datasource<Root, Name>, arg?: ARG) => Scalarable<R> | Promise<Scalarable<R>>

export type CompiledComputeFunction<Name extends string, ARG extends any, R extends PropertyTypeDefinition<any> > = (args?: ARG) => Column<Name, R>

// export type CompiledComputeFunctionPromise<Name extends string, ARG extends any[], R> = (...args: ARG) => Promise<Column<Name, R> > | Column<Name, R>

export type MutationEntityPropertyKeyValues = {
    [key: string]: boolean | number | string | any | Array<any>
}


// export type EntityQueryOptions<S extends TableSchema> = SingleSourceQueryOptions<S>


export type ORMConfig<EntityClassMap extends {[key:string]: typeof Entity}> = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // types: { [key: string]: typeof PropertyDefinition },
    models: EntityClassMap
    createModels: boolean,
    modelsPath?: string,
    outputSchemaPath?: string,
    // waitUtilDatabaseReady?: boolean,
    entityNameToTableName?: (params:string) => string,
    // tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    // fieldNameToPropName?: (params:string) => string,
    // suppressErrorOnPropertyNotFound?: string,
    useNullAsDefault?: boolean
    // useSoftDeleteAsDefault: boolean
    // primaryKeyName: string
    enableUuid: boolean
    uuidPropName: string
}


// the new orm config
// export {defaultORMConfig as ormConfig}

export class Property<D extends PropertyTypeDefinition> {
    // private repository?: EntityRepository<any>
    private _name?: string
    readonly definition: D
    // private schema?: Schema

    constructor(definition: D){
        this.definition = definition
    }
    register(
        name: string){
            if( /[\.`' ]/.test(name) || name.includes(META_FIELD_DELIMITER) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "${META_FIELD_DELIMITER}", "'" or startsWith/endsWith '_'.`)
            }
            // this.schema = schema
            // this.repository = repository
            this._name = name
            
        }
    get name(){
        if(!this._name){
            throw new Error('Property not yet registered')
        }
        return this._name
    }

}

export class ComputeProperty<D extends PropertyTypeDefinition, Root extends Schema, Name extends string, Arg extends any | undefined> extends Property<D> {

    // type: 'ComputeProperty' = 'ComputeProperty'
    compute: ComputeFunction<Root, Name, Arg, D>

    constructor(
        definition: D,
        compute:  ComputeFunction<Root, Name, Arg, D>){
            super(definition)
            this.compute = compute
        }
}
export class FieldProperty<D extends PropertyTypeDefinition> extends Property<D> {

    // type: 'FieldProperty' = 'FieldProperty'
    private _fieldName?: string

    constructor(
        definition: D){
            super(definition)
        }

    convertFieldName(propName: string, orm: ORM<any>){
        const c = orm.ormConfig.propNameTofieldName
        return c? c(propName) : propName
    }

    fieldName(orm: ORM<any>){
        // if(!this._fieldName){
        //     throw new Error('Property not yet registered')
        // }
        if(this._fieldName){
            return this._fieldName
        }
        return this.convertFieldName(this.name, orm)
    }

    setFieldName(value: string){
        this._fieldName = value
        return this
    }
}

export class Schema {

    properties: (ComputeProperty<PropertyTypeDefinition, Schema, string, any> 
        | FieldProperty<PropertyTypeDefinition> | Property<PropertyTypeDefinition>)[] = []
    propertiesMap: {[key:string]: (ComputeProperty<PropertyTypeDefinition, Schema, string, any> 
        | FieldProperty<PropertyTypeDefinition> | Property<PropertyTypeDefinition>)} = {}
    
    // id: PropertyDefinition
    // uuid: PropertyDefinition | null

    constructor(){
    }

    init() {
        // let fields: (ComputeProperty<PropertyTypeDefinition, Schema, string, any[]> |
        //     FieldProperty<PropertyTypeDefinition>)[] = []
        for (let field in this) {
            this.addField(field)
        }
    }

    initPostAction() {
        //@ts-ignore
        let z = Object.getOwnPropertyDescriptors(this.constructor.prototype)
        // for(let x in z){console.log('=>', x)}
        for (let field in z) {
            this.addField(field)
        }
    }

    addField(field: string){
        // if (typeof field === 'string') {
        //@ts-ignore
        const actual = this[field]
        if (actual instanceof FieldProperty || actual instanceof ComputeProperty) {
            actual.register(field)
            this.propertiesMap[field] = actual
            this.properties.push(actual)
        }
    }
}

export abstract class TableSchema extends Schema {

    abstract id: FieldProperty<PropertyTypeDefinition>
    uuid?: FieldProperty<PropertyTypeDefinition> = undefined
    hooks: Hook[] = []
    entityClass?: typeof Entity
    overridedTableName?: string

    constructor(){
        super()
    }

    initAndRegister(entityClass: typeof Entity){
        // console.log('register TableSchema', entityClass)
        this.entityClass = entityClass
        super.init()
        // if(!entityClass.entityName || !this.entityClass?.orm){
        //     throw new Error('Not yet registered.')
        // }
        // const orm = this.entityClass.orm
    }

    registerPostAction() {
        super.initPostAction()
    }

    tableName(options?: TableOptions){
        if(this.overridedTableName){
            return this.overridedTableName
        } else {
            let name = this.entityClass?.entityName
            const orm = this.entityClass?.orm
            if(!name || !orm){
                throw new Error('Not yet registered.')
            }
            
            if( orm.ormConfig.entityNameToTableName) {
                name = orm.ormConfig.entityNameToTableName(name)
            }
            if(options?.tablePrefix){
                name = options.tablePrefix + name
            }
            return name
        }
    }

    setTableName(name: string) {
        this.overridedTableName = name
        return this
    }

    createTableStmt(options?: TableOptions){
        // console.log('xxxx', this.entityClass)
        if(!this.entityClass || !this.entityClass.orm){
            throw new Error('Not register yet')
        }
        const orm = this.entityClass.orm
        const client = orm.client()
        const tableName = this.tableName(options)
        if(tableName.length > 0){
            let props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty<PropertyTypeDefinition>[]
            
            return `CREATE TABLE IF NOT EXISTS ${quote(client, this.tableName(options))} (\n${
                props.map( prop => {
                    let f = prop.definition
                    if(f instanceof FieldPropertyTypeDefinition){
                        return `${f.create(prop.name, prop.fieldName(orm), client)}`  
                    }
                    return ``
                }).flat().join(',\n')}\n)`;
        }
        return ''
    }


    field<D extends FieldPropertyTypeDefinition<any> >(definition: (new (...args: any[]) => D) | D  ) {

        if(definition instanceof FieldPropertyTypeDefinition){
            return new FieldProperty<D>(definition)
        }
        return new FieldProperty<D>( new definition() )
    }

    compute<D extends PropertyTypeDefinition, Root extends TableSchema, Arg extends any, R>(
        this: Root,
        definition: (new (...args: any[]) => D)  | D, compute: ComputeFunction<Root, 'root', Arg, D>) : ComputeProperty<D, Root, 'root', Arg> {

        if(definition instanceof PropertyTypeDefinition){
            return new ComputeProperty<D, Root, 'root', Arg>(definition, compute)
        }
        return new ComputeProperty<D, Root, 'root', Arg>(new definition(), compute)
    }

    hook(newHook: Hook){
        this.hooks.push(newHook)
    }
    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    datasource<T extends TableSchema, Name extends string>(this: T, name: Name, options?: TableOptions) : Datasource<T, Name>{
        const source = new TableDatasource(this, name, options)
        return source
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
    propertyDefinition: PropertyTypeDefinition | null,
    propertyValue: any | null,
    rootClassName: string
}

export type HookAction = <T>(repository: EntityRepository<any>, rootValue: T, info: HookInfo, executionOptions: ExecutionOptions) => T | Promise<T>

export class ORM<EntityClassMap extends {[key:string]: typeof Entity}>{

    defaultORMConfig: ORMConfig<any> = {
        // primaryKeyName: 'id',
        enableUuid: false,
        // useSoftDeleteAsDefault: true,
        uuidPropName: 'uuid',
        createModels: false,
        // types: {},
        models: {},
        knexConfig: {
            client: 'mysql' //default mysql
        }
    }

    ormConfig: ORMConfig<EntityClassMap>
    // @ts-ignore
    private registeredModels: EntityClassMap = {}

    constructor(newConfig: Partial<ORMConfig<EntityClassMap>>){
        let newOrmConfig: ORMConfig<EntityClassMap> = Object.assign({}, this.defaultORMConfig, newConfig)
        // newOrmConfig.ormContext = Object.assign({}, defaultORMConfig.ormContext, newConfig.ormContext)
        this.ormConfig = newOrmConfig
        this.register()
    }

    register(){
        const registerEntity = (entityName: string, entityClass: typeof Entity) => {
            entityClass.register(this, entityName)
            // @ts-ignore
            this.registeredModels[entityName] = entityClass
        }
        
        //register models 
        if(this.ormConfig.models){
            let models = this.ormConfig.models
            Object.keys(models).forEach(key => {
                registerEntity(key, models[key]);
            })
        }

        //register models by path
        if(this.ormConfig.modelsPath){
            let files = fs.readdirSync(this.ormConfig.modelsPath)
            files.forEach( (file) => {
                if(file.endsWith('.js')){
                    let path = this.ormConfig.modelsPath + '/' + file
                    path = path.replace(/\.js$/,'')
                    // console.debug('load model file:', path)
                    let p = path.split('/')
                    let entityName = p[p.length - 1]
                    let entityClass = require(path)
                    registerEntity(entityName, entityClass.default);
                }
            })
        }

        Object.keys(this.registeredModels).forEach(k => {
            this.registeredModels[k].registerPostAction()
        })
    }

    getRepository(config?: Partial<EntityRepositoryConfig>): EntityRepository<EntityClassMap> {
        return new EntityRepository(this, this.registeredModels, config)
    }

    _globalKnexInstance: Knex | null = null

    // a global knex instance
    getKnexInstance(): Knex {
        if(this._globalKnexInstance){
            return this._globalKnexInstance
        }

        let newKnexConfig = Object.assign({
            useNullAsDefault: true
        }, this.ormConfig.knexConfig)

        if(typeof newKnexConfig.connection !== 'object'){
            throw new Error('Configuration connection only accept object.')
        }

        if(typeof newKnexConfig.client !== 'string'){
            throw new Error('Configuration client only accept string')
        }

        // multipleStatements must be true
        newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, {multipleStatements: true})
        
        
        // console.log('newKnexConfig', newKnexConfig)
        this._globalKnexInstance = knex(newKnexConfig)
        return this._globalKnexInstance
    }

    client = (): string => this.ormConfig.knexConfig.client.toString()

    async startTransaction<T>(func: (trx: Knex.Transaction) => Promise<T> | T, existingTrx?: Knex.Transaction | null): Promise<T> {
        let knex = this.getKnexInstance()
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

    async executeStatement(stmt: SQLString, executionOptions: ExecutionOptions): Promise<any> {
        return this.getRepository().executeStatement(stmt, executionOptions)
    }

    async execute<S>(dataset: Dataset<S, any, any>, executionOptions: ExecutionOptions) {
        return this.getRepository().query(dataset, executionOptions)
    }
}

export type EntityRepositoryConfig = {
} & TableOptions

export class EntityRepository<EntityClassMap extends {[key:string]: typeof Entity}> {
    private config: Partial<EntityRepositoryConfig> | null = null
    readonly orm
    private registeredModels: EntityClassMap

    constructor(orm: ORM<EntityClassMap>, registeredModels: EntityClassMap, config?: Partial<EntityRepositoryConfig> ){
        // this.name = name
        this.orm = orm
        this.config = config ?? {}
        this.registeredModels = registeredModels
    }

    get tablePrefix(){
        return this.config?.tablePrefix ?? ''
    }

    get models(){
        const repository = this
        const models: EntityClassMap = this.registeredModels
        let proxyEntities = new Map<string, typeof Entity>()

        let proxyRoot: EntityClassMap = new Proxy(models, {
            get: (models, sKey: string): typeof Entity => {
                let e = proxyEntities.get(sKey)
                if(e){
                    return e
                }else {
                    const newE: typeof Entity = new Proxy(models[sKey], {
                        get: (entityClass: typeof Entity, sKey: string) => {

                            // @ts-ignore
                            const method = entityClass[sKey]

                            // @ts-ignore
                            const referMethod = Database[sKey]
                            if( (sKey in entityClass) && (sKey in Database) && method instanceof Function ){
                                return (...args: any[]) => referMethod(newE, repository, ...args)
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
        let sqls = Object.keys(m).map(k => m[k].schema).map(s => s.createTableStmt({ tablePrefix: this.tablePrefix})).filter(t => t)
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
            await this.orm.getKnexInstance().raw(sql)
        }) )
    }

    async executeStatement(stmt: SQLString, executionOptions?: ExecutionOptions): Promise<any> {

        const sql = stmt.toString()
        if(executionOptions?.onSqlRun) {
            executionOptions.onSqlRun(sql)
        }
        console.log('sql', sql)
        let KnexStmt = this.orm.getKnexInstance().raw(sql)
        if (executionOptions?.trx) {
            KnexStmt.transacting(executionOptions.trx)
        }
        let result = null
        try{
            result = await KnexStmt
        }catch(error){
            throw error
        }
        return result
    }

    async query<S, R extends {
        [key in keyof ExtractProps<S>]: 
            S[key] extends FieldProperty<FieldPropertyTypeDefinition<infer D1>>? D1 :
                (S[key] extends ComputeProperty<FieldPropertyTypeDefinition<infer D2>, any, any, any>? D2: never)
    }>(dataset: Dataset<S, any, any>, executionOptions?: ExecutionOptions): Promise<R[]>
     {
        let data = await this.executeStatement(await dataset.toNativeBuilder(this), executionOptions)
        if(Array.isArray(data)){
            
            let result = data.map(one => parseDataBySchema({}, one, dataset.schema(), this.orm.client() ) )
            return result as R[]
        }
        return data
    }
}


export type ExecutionOptions = {
    // isSoftDeleteMode: boolean
    onSqlRun?: ((sql: string) => void) | null
    trx?: Knex.Transaction<any, any[]> | null
}

// export type ExecutionContextConfig = {
//     // isSoftDeleteMode: boolean
//     sqlRunCallback: ((sql: string) => void) | null
//     trx: Knex.Transaction<any, any[]> | null
// }

// export class ExecutionContext{

//     private _config: Partial<ExecutionContextConfig>

//     constructor(config: Partial<ExecutionContextConfig> ){
//         this._config = config
//     }

//     get trx(){
//         return this._config.trx
//     }

//     // get isSoftDeleteMode(){
//     //     return this._isSoftDeleteMode
//     // }

//     static async withTransaction<T>(func: (context: ExecutionContext) => (Promise<T> | T) ): Promise<T> {
//         let result = await startTransaction<T>( async (trx) => {
//             return await func(trx === this.trx? this: this.clone({trx}))
//         }, this.trx)
//         return result
//     }

//     static async withNewTransaction<T>(func: (context: ExecutionContext) => (Promise<T> | T) ): Promise<T> {
//         let result = await startTransaction<T>( async (trx) => {
//             return await func(this.clone({trx}))
//         })
//         return result
//     }

//     clone(newConfig: Partial<ExecutionContextConfig>){
//         let final = Object.assign({}, this.config, newConfig)
//         return new ExecutionContext(this.name + '>' + makeid(5), final)
//     }
//     get sqlRunCallback(){
//         return this.config.sqlRunCallback
//     }
// }


type DatabaseActionResult<T> = T
type DatabaseActionOptions<T extends TableSchema> = {
    failIfNone: boolean
    //TODO: NYI
    // queryProps: SelectableProps<T>
}
type DatabaseAction<I, S extends TableSchema> = (executionOptions: ExecutionOptions, options: Partial<DatabaseActionOptions<S> >) => Promise<DatabaseActionResult<I>>

class DatabaseActionRunnerBase<I, S extends TableSchema> implements PromiseLike<I>{
    protected execOptions: ExecutionOptions
    protected action: DatabaseAction<I, S>
    protected options: Partial<DatabaseActionOptions<S> > = {}
    // private trx?: Knex.Transaction | null
    protected sqlRunCallback?: ((sql: string) => void) | null

    constructor(action: DatabaseAction<I, S>){
        // this.beforeAction = beforeAction
        this.execOptions = {}
        this.action = action
    }

    protected async execAction(){
        return await this.action(this.execOptions, this.options)
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
        this.execOptions.trx = trx
        return this
    }

    onSqlRun(callback: ((sql: string) => void) | null ) : this{
        this.execOptions.onSqlRun = callback
        return this
    }

    withOptions(execOptions: ExecutionOptions) : this{
        this.execOptions = execOptions
        return this
    }
} 

export class DatabaseQueryRunner<I, S extends TableSchema> extends DatabaseActionRunnerBase<I, S> {

    async failIfNone<T>(){
        this.options = {
            ...this.options,
            failIfNone: true
        }
        return this
    }
}

export class DatabaseMutationRunner<I, S extends TableSchema> extends DatabaseQueryRunner<I, S>{

    constructor(action: DatabaseAction<I, S>){
        super(action)
    }

    //TODO: implement
    // async fetch<T>(queryProps: SelectableProps<S>){
    //     this.options = {
    //         ...this.options,
    //         queryProps: queryProps
    //     }
    //     return this
    // }
}

export class Database{
 
    static createOne<T extends typeof Entity, D extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, data: MutationEntityPropertyKeyValues): DatabaseMutationRunner< InstanceType<T>, D>{
        return new DatabaseMutationRunner< InstanceType<T>, D>(
            async (executionOptions: ExecutionOptions) => {
                let result = await Database._create<T>(entityClass, repository, executionOptions, [data])
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return result[0]
            }
        )
    }

    static createEach<T extends typeof Entity, D extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, arrayOfData: MutationEntityPropertyKeyValues[]): DatabaseMutationRunner< InstanceType<T>[], D>{
        return new DatabaseMutationRunner< InstanceType<T>[], D >(
            async (executionOptions: ExecutionOptions) => {
                let result = await Database._create<T>(entityClass, repository, executionOptions, arrayOfData)
                return result.map( data => {
                        if(data === null){
                            throw new Error('Unexpected Flow.')
                        }
                        return data
                    })
            })
    }

    private static async _create<T extends typeof Entity>(entityClass: T, repository: EntityRepository<any> | null, executionOptions: ExecutionOptions, values: MutationEntityPropertyKeyValues[]) {
        const schema = entityClass.schema
        const actionName = 'create'

        if(!repository){
            throw new Error('Entity is not accessed through Repository')
        }
        
        let useUuid: boolean = !!repository.orm.ormConfig.enableUuid
        if (repository.orm.client().startsWith('sqlite')) {
            if (!repository.orm.ormConfig.enableUuid ){
                throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
            }
        }
        
        const schemaPrimaryKeyFieldName = schema.id.fieldName(repository.orm)
        const schemaPrimaryKeyPropName = schema.id.name
        const schemaUUIDPropName = schema.uuid?.name
        
        let fns = await repository.orm.startTransaction(async (trx) => {

            //replace the trx
            executionOptions = {...executionOptions, trx: trx}

            let allResults = await Promise.all(values.map(async (value) => {

                let propValues = await Database._prepareNewData(repository, value, schema, actionName, {trx})
                let newUuid = null
                if(useUuid){
                    if(!schemaUUIDPropName){
                        throw new Error('Not UUID field is setup')
                    }
                    newUuid = uuidv4()
                    propValues[schemaUUIDPropName] = newUuid
                }
                let stmt = repository.orm.getKnexInstance()( schema.tableName({tablePrefix: repository.tablePrefix}) ).insert( this.extractRealField(repository, schema, propValues) )
        
                if ( repository.orm.client().startsWith('pg')) {
                    stmt = stmt.returning( schemaPrimaryKeyFieldName )
                }
                let input = {
                    sqlString: stmt,
                    uuid: newUuid
                }

                // let afterMutationHooks = schema.hooks.filter()

                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (repository.orm.client().startsWith('mysql')) {
                    let insertedId: number
                    const insertStmt = input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id '
                    const r = await repository.orm.executeStatement(insertStmt, executionOptions)
                    insertedId = r[0][0].insertId
                    // let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId])  )

                    let record = await this.findOne<T, typeof schema>(entityClass, repository, {
                        filter: {
                            id: insertedId
                        }
                    }).withOptions(executionOptions)

                    let b = await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)
                    return b
                } else if (repository.orm.client().startsWith('sqlite')) {
                    const insertStmt = input.sqlString.toString()
                    const r = await repository.orm.executeStatement(insertStmt, executionOptions)
                    if(repository.orm.ormConfig.enableUuid && schema.uuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let record = await this.findOne<T, typeof schema>(entityClass, repository, {
                                //@ts-ignore
                                filter: ({root}) => root.uuid.equals(uuid)
                            }).withOptions(executionOptions)

                            return await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)
                        }
                    } else {
                        return null
                    }

                } else if (repository.orm.client().startsWith('pg')) {
                    const insertStmt = input.sqlString.toString()
                    let insertedId: number
                    const r = await repository.orm.executeStatement(insertStmt, executionOptions)
                    
                    insertedId = r.rows[0][ schemaPrimaryKeyFieldName ]
                    let record = await this.findOne<T, TableSchema>(entityClass, repository, {
                        filter: {
                            id: insertedId
                        }
                    }).withOptions(executionOptions)

                    return await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)

                } else {
                    throw new Error('Unsupport client')
                }
                
            }))
            return allResults

        }, executionOptions.trx)

        return fns
    }

    private static async _prepareNewData(repository: EntityRepository<any>, data: MutationEntityPropertyKeyValues, schema: TableSchema, actionName: MutationName, executionOptions: ExecutionOptions) {

        if(!schema?.entityClass?.entityName){
            throw new Error('Not yet registered.')
        }
        const entityName = schema?.entityClass?.entityName

        let propValues = Object.keys(data).reduce(( propValues, propName) => {
            let foundProp = schema.properties.find(p => {
                return p.name === propName
            })
            if (!foundProp) {
                throw new Error(`The Property [${propName}] doesn't exist in ${schema.entityClass?.entityName}`)
            }
            const prop = foundProp
            const propertyValue =  prop.definition.parseProperty(data[prop.name], prop.name, repository.orm.client())
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
            record = await h.action(repository, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundProp.name,
                propertyDefinition: foundProp.definition,
                propertyValue: record[foundProp.name],
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(propValues) )

        propValues = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(repository, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(propValues))
        
        return propValues
    }

    private static async afterMutation<T extends typeof Entity>(
        repository: EntityRepository<any>,
        record: InstanceType<T>, 
        schema: TableSchema,
        actionName: MutationName,
        inputProps: MutationEntityPropertyKeyValues, 
        executionOptions: ExecutionOptions): Promise<InstanceType<T>> {

        if(!schema?.entityClass?.entityName){
            throw new Error('Not yet registered.')
        }
        const entityName = schema?.entityClass?.entityName

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
            record = await h.action(repository, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundProp.name,
                propertyDefinition: foundProp.definition,
                propertyValue: record[foundProp.name] ?? inputProps[foundProp.name],
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(record) )

        record = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(repository, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(record))

        return record
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<T extends typeof Entity, D extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, applyFilter?: SingleSourceArg<D>): DatabaseQueryRunner<  InstanceType<T>,  D >{
        return new DatabaseQueryRunner< InstanceType<T>, D>(
        async (executionOptions: ExecutionOptions) => {
            let rows = await Database._find(entityClass, repository, executionOptions, applyFilter?? null)
            return rows[0] ?? null
        })
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<T extends typeof Entity, D extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any>|null, applyFilter?: SingleSourceArg<D>): DatabaseQueryRunner<  InstanceType<T>[],  D >{
        return new DatabaseQueryRunner< Array<InstanceType<T>>, D >(
            async (executionOptions: ExecutionOptions) => {
                let rows = await Database._find(entityClass, repository, executionOptions, applyFilter?? null)
                return rows
        })
    }

    private static async _find<T extends typeof Entity, D extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, executionOptions: ExecutionOptions, applyOptions: SingleSourceArg<D> | null) {   
        
        if(!repository){
            throw new Error('Entity is not accessed through Repository')
        }

        let source = (entityClass.schema as D).datasource('root')

        // let options: SingleSourceQueryOptions<D> | null
        // if(applyFilter instanceof Function){
        //     const f = applyFilter
        //     options = applyFilter(existingContext, source)
        // }else {
        //     options = applyFilter
        // }
        let dataset = new Dataset()
            .props( await resolveEntityProps(source, applyOptions?.props ) )
            .from(source)

        dataset = applyOptions?.filter ? dataset.filter(applyOptions?.filter as Expression<any,any>) : dataset
        // console.debug("========== FIND ================")
        // console.debug(sqlString.toString())
        // console.debug("================================")
        let resultData = await repository.orm.executeStatement(await dataset.toNativeBuilder(repository), executionOptions)

        let rowData: any[]
        if(repository.orm.client().startsWith('mysql')){
            rowData = resultData[0][0]
        } else if(repository.orm.client().startsWith('sqlite')){
            rowData = resultData
        } else if(repository.orm.client().startsWith('pg')){
            rowData = resultData.rows[0]
        } else {
            throw new Error('Unsupport client.')
        }

        console.log('return from database', rowData)

        let dualInstance = rowData.map( row => this.parseRaw(entityClass, row, repository.orm.client()) )
        // let str = "data" as keyof Dual
        let rows = dualInstance as Array<InstanceType<T>>
        return rows
    }

    static updateOne<T extends typeof Entity, S extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<S>): DatabaseQueryRunner< InstanceType<T>, S>{
        return new DatabaseQueryRunner< InstanceType<T>, S >(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<S> > ) => {
                let result = await Database._update(entityClass, repository, executionOptions, data, applyFilter??null, true, false,  actionOptions)
                return result[0] ?? null
            }
        )
    }

    static update<T extends typeof Entity, S extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<S>): DatabaseQueryRunner< InstanceType<T>[], S >{
        return new DatabaseMutationRunner< InstanceType<T>[], S >(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<S> > ) => {
                let result = await Database._update(entityClass, repository, executionOptions, data, applyFilter??null, false, false, actionOptions)
                return result
            }
        )
    }

    private static async _update<T extends typeof Entity, S extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, executionOptions: ExecutionOptions, data: MutationEntityPropertyKeyValues,  
        applyFilter: SingleSourceFilter<S> | null, 
        isOneOnly: boolean,
        isDelete: boolean,
        actionOptions: Partial<DatabaseActionOptions<S> > 
       ) {

        if(!repository){
            throw new Error('Entity is not accessed through Repository')
        }

        const schema = entityClass.schema
        const actionName = isDelete?'delete':'update'

        const rootSource = entityClass.schema.datasource('root')
        let propValues = await Database._prepareNewData(repository, data, schema, actionName, executionOptions)

        // let deleteMode: 'soft' | 'real' | null = null
        // if(isDelete){
        //     deleteMode = existingContext.isSoftDeleteMode ? 'soft': 'real'
        // }

        const realFieldValues = this.extractRealField(repository, schema, propValues)
        const input = {
            updateSqlString: !isDelete && Object.keys(realFieldValues).length > 0? 
                            (applyFilter? new Dataset()
                                            .from( rootSource )
                                            .filter(applyFilter): 
                                            new Dataset().from(rootSource ).native( qb => qb.update(realFieldValues)) ): null,
            selectSqlString: (applyFilter? new Dataset()
                                            .from(rootSource)
                                            .filter(applyFilter):
                                        new Dataset().from(rootSource) ),
            entityData: data
        }

        const schemaPrimaryKeyFieldName = schema.id.fieldName(repository.orm)
        const schemaPrimaryKeyPropName = schema.id.name

        let fns = await repository.orm.startTransaction(async (trx) => {
            if(!input.selectSqlString || !input.entityData){
                throw new Error('Unexpected Flow.')
            }
            let updateStmt = input.updateSqlString
            let selectStmt = input.selectSqlString.addNative( qb => qb.select( schemaPrimaryKeyFieldName ) )
            
            let pks: number[] = []
            if (repository.orm.client().startsWith('pg')) {
                let targetResult
                if(updateStmt){
                    updateStmt = updateStmt.native( qb => qb.returning(schemaPrimaryKeyFieldName) )
                    targetResult = await repository.orm.executeStatement(updateStmt, executionOptions)
                } else {
                    targetResult = await repository.orm.executeStatement(selectStmt, executionOptions)
                }
                let outputs = await Promise.all((targetResult.rows as SimpleObject[] ).map( async (row) => {
                    let pkValue = row[ schemaPrimaryKeyFieldName ]
                    let record = await this.findOne(entityClass, repository, {[schemaPrimaryKeyPropName]: pkValue}).withOptions(executionOptions)
                    let finalRecord = await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)
                    if(isDelete){
                        await repository.orm.executeStatement( new Dataset().from(rootSource).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                    }
                    // {
                    //     ...(querySelectAfterMutation? {select: querySelectAfterMutation}: {}),
                    //     where: { [entityClass.schema.primaryKey.name]: pkValue} 
                    // })

                    return finalRecord
                }))

                return outputs
            } else {

                if (repository.orm.client().startsWith('mysql')) {
                    let result = await repository.orm.executeStatement(selectStmt, executionOptions)
                    pks = result[0].map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
                } else if (repository.orm.client().startsWith('sqlite')) {
                    let result = await repository.orm.executeStatement(selectStmt, executionOptions)
                    pks = result.map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
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
                    if (repository.orm.client().startsWith('mysql')) {
                        if(updateStmt){
                            let updateResult = await repository.orm.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), executionOptions)
                            let numUpdates: number
                            numUpdates = updateResult[0].affectedRows
                            if(numUpdates > 1){
                                throw new Error('Unexpected flow.')
                            } else if(numUpdates === 0){
                                return null
                            } 
                        }
                        let record = await this.findOne(entityClass, repository, {[schemaPrimaryKeyPropName]: pkValue}).withOptions(executionOptions)
                        let finalRecord = await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)
                        if(isDelete){
                            await repository.orm.executeStatement( new Dataset(schema.datasource('root')).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                        }
                        return finalRecord
                        
                    } else if (repository.orm.client().startsWith('sqlite')) {
                        if(updateStmt){
                            let updateResult = await repository.orm.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), executionOptions)
                            let found = await this.findOne(entityClass, repository, {[schemaPrimaryKeyPropName]: pkValue}).withOptions(executionOptions)
                            let data = input.entityData!
                            let unmatchedKey = Object.keys(data).filter( k => data[k] !== found[k])
                            if( unmatchedKey.length > 0 ){
                                console.log('Unmatched prop values', unmatchedKey.map(k => `${k}: ${data[k]} != ${found[k]}` ))
                                throw new Error(`The record cannot be updated. `)
                            }
                        }
                        let record = await this.findOne(entityClass, repository, {[schemaPrimaryKeyPropName]: pkValue}).withOptions(executionOptions)
                        let finalRecord = await this.afterMutation<T>(repository, record, schema, actionName, propValues, executionOptions)
                        if(isDelete){
                            await repository.orm.executeStatement( new Dataset(schema.datasource('root') ).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                        }
                        return finalRecord
                    } else {
                        throw new Error('NYI.')
                    }
                }))
            }


        }, executionOptions.trx)

        return fns.filter(notEmpty)
    }

    static deleteOne<T extends typeof Entity, S extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<S>): DatabaseQueryRunner< InstanceType<T>, S>{
        return new DatabaseQueryRunner< InstanceType<T>, S>(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< S > > ) => {
                let result = await Database._update(entityClass, repository, executionOptions, data, applyFilter??null, true, true, actionOptions)
                return result[0] ?? null
            }
        )
    }

    static delete<T extends typeof Entity, S extends T["initSchema"]>(entityClass: T, repository: EntityRepository<any> | null, data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<S>): DatabaseQueryRunner< InstanceType<T>[], S >{
        return new DatabaseQueryRunner< InstanceType<T>[], S>(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< S > > ) => {
                let result = await Database._update(entityClass, repository, executionOptions, data, applyFilter??null, false, true, actionOptions)
                return result
            }
        )
    }

    static parseEntity<T extends typeof Entity>(entityInstance: InstanceType<T>, client: string): any {
        return entityInstance
    }

    static parseRaw<T extends typeof Entity>(entityClass: T, row: MutationEntityPropertyKeyValues, client: string): InstanceType<T>{
        const schema = entityClass.schema
        const instance = new entityClass() as InstanceType<T>
        return parseDataBySchema( instance, row, schema, client)
    }

    static extractRealField(repository: EntityRepository<any>, schema: TableSchema, fieldValues: MutationEntityPropertyKeyValues): any {
        return Object.keys(fieldValues).reduce( (acc, key) => {
            let prop = schema.properties.find(p => p.name === key)
            if(!prop){
                throw new Error('Unexpected')
            }
            if(prop instanceof FieldProperty){
                acc[prop.fieldName(repository.orm)] = fieldValues[key]
            }
            return acc
        }, {} as MutationEntityPropertyKeyValues)        
    }
}

export class Entity{

    // static repository: EntityRepository<any> | null = null;
    static orm?: ORM<any>
    static entityName?: string

    [key: string]: any
    static schema: TableSchema
    static initSchema: TableSchema
    // static init: () => TableSchema
    // static get schema(): TableSchema {
    //     if( !this._schema){
    //         this._schema = this.init()
    //     }
    //     return this._schema
    // }

    constructor(){
    }

    static register(orm: ORM<any>, entityName: string) {
        this.orm = orm
        this.entityName = entityName
        if(!this.initSchema){
            throw new Error(`There is no schema for Entity ${entityName}`)
        }
        let s = this.initSchema
        s.initAndRegister(this)
        this.schema = s 
    }

    static registerPostAction() {
        this.schema.registerPostAction()
    }

    static datasource<I extends typeof Entity, Name extends string>(this: I & (new (...args: any[]) => InstanceType<I>), name: Name, options?: TableOptions): Datasource<I["initSchema"], Name> {
        return this.schema.datasource(name, options)
    }

    static parseRaw(row: MutationEntityPropertyKeyValues, client: string): Entity{
        return Database.parseRaw(this, row, client)
    }

    static parseEntity(entityInstance: Entity, client: string): any{
        let r = Database.parseEntity(entityInstance, client)
        return r
    }

    static createEach<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), arrayOfData: MutationEntityPropertyKeyValues[]): DatabaseQueryRunner< InstanceType<I>[], I["initSchema"]>{
        return Database.createEach(this, null, arrayOfData)
    }

    static createOne<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), data: MutationEntityPropertyKeyValues): DatabaseQueryRunner< InstanceType<I>, I["initSchema"] >{
        return Database.createOne(this, null, data)
    }

    static updateOne<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<I["initSchema"]>): DatabaseQueryRunner< InstanceType<I>, I["initSchema"] >{
        return Database.updateOne(this, null, data, applyFilter)
    }

    static update<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<I["initSchema"]>): DatabaseQueryRunner< InstanceType<I>[], I["initSchema"] >{
        return Database.update(this, null, data, applyFilter)
    }

    static deleteOne<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<I["initSchema"]>): DatabaseQueryRunner< InstanceType<I>, I["initSchema"] >{
        return Database.deleteOne(this, null, data, applyFilter)
    }

    static delete<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), data: MutationEntityPropertyKeyValues, applyFilter?: SingleSourceFilter<I["initSchema"]>): DatabaseQueryRunner< InstanceType<I>[], I["initSchema"] >{
        return Database.delete(this, null, data, applyFilter)
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), applyFilter?: SingleSourceArg<I["initSchema"]>): DatabaseQueryRunner<InstanceType<I>, I["initSchema"]>{
        return Database.findOne(this, null, applyFilter)
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), applyFilter?: SingleSourceArg<I["initSchema"]>): DatabaseQueryRunner<InstanceType<I>[], I["initSchema"]>{
        return Database.find(this, null, applyFilter)
    }

    static hasMany<ParentClass extends typeof Entity, TypeClass extends typeof Entity>(
        this: ParentClass & (new (...args: any[]) => InstanceType<ParentClass>),
        relatedEntity: TypeClass, 
        relatedBy: ((schema: TypeClass["initSchema"]) => FieldProperty<PropertyTypeDefinition>), 
        parentKey?: ((schema: ParentClass["initSchema"]) => FieldProperty<PropertyTypeDefinition>)
        ) {
        
        let computeFn = (parent: Datasource<ParentClass["initSchema"], any>, 
            args?: SingleSourceArg<TypeClass["initSchema"]> | 
                SingleSourceArgFunction<TypeClass["initSchema"]>
            ): Scalarable<any> => {

            let dataset = new Dataset()

            let relatedSource = relatedEntity.schema.datasource('root')

            let parentColumn = (parentKey? parent.getFieldProperty( parentKey(parent.schema).name  ): undefined ) ?? parent.getFieldProperty("id")
            let relatedByColumn = relatedSource.getFieldProperty( relatedBy(relatedSource.schema).name  )
        
            let newDataset = dataset.from(relatedSource)

            let props = relatedSource.getAllFieldProperty().map(col => col.value() ).reduce( (acc,v) => Object.assign(acc, v), {})

            let resolvedArgs: SingleSourceArg<TypeClass["initSchema"]> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }


            if(resolvedArgs?.props){
                let computed = resolvedArgs.props
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return relatedSource.getComputeProperty(key)(arg).value()
                }).reduce( (acc,v) => Object.assign(acc, v), {})

                dataset.props(Object.assign(props, computedValues))
            }else {
                dataset.props(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.filter){
               filters.push( resolvedArgs.filter as any )
            }
            newDataset.filter( ({And}) => And(...filters) )

            return newDataset
        }

        return this.schema.compute( new ArrayOfType( new ObjectOfType(relatedEntity) ), computeFn )
    }

    static belongsTo<ParentClass extends typeof Entity, TypeClass extends typeof Entity>(
        this: ParentClass & (new (...args: any[]) => InstanceType<ParentClass>),
        relatedEntity: TypeClass, 
        parentKey: ((schema: ParentClass["initSchema"]) => FieldProperty<PropertyTypeDefinition>),
        relatedBy?: ((schema: TypeClass["initSchema"]) => FieldProperty<PropertyTypeDefinition>) 
        ) {
        
        let computeFn = (parent: Datasource<TypeClass["initSchema"], 'root'>, 
            args?: SingleSourceArg<TypeClass["initSchema"]> | SingleSourceArgFunction<TypeClass["initSchema"]>
            ): Scalarable<any> => {
            
            let dataset = new Dataset()

            let relatedSource = relatedEntity.schema.datasource('root')

            let relatedByColumn = (relatedBy? relatedSource.getFieldProperty( relatedBy(relatedSource.schema).name  ): undefined ) ?? relatedSource.getFieldProperty("id")
            let parentColumn = parent.getFieldProperty( parentKey(parent.schema).name  )
        
            let newDataset = dataset.from(relatedSource)

            let resolvedArgs: SingleSourceArg<TypeClass["initSchema"]> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }

            let props = relatedSource.getAllFieldProperty().map(col => col.value() ).reduce( (acc,v) => Object.assign(acc, v), {})
            if(resolvedArgs?.props){
                let computed = resolvedArgs.props
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return relatedSource.getComputeProperty(key)(arg).value()
                }).reduce( (acc,v) => Object.assign(acc, v), {})

                dataset.props(Object.assign(props, computedValues))
            }else {
                dataset.props(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.filter){
               filters.push( resolvedArgs.filter as any )
            }
            newDataset.filter( ({And}) => And(...filters) )

            return newDataset
        }

        return this.schema.compute( new ObjectOfType(relatedEntity), computeFn )
    }

}


function parseDataBySchema<T>(entityInstance: T, row: MutationEntityPropertyKeyValues, schema: Schema, client: string): T {
    entityInstance = Object.keys(row).reduce((entityInstance, fieldName) => {
        // let prop = this.compiledNamedPropertyMap.get(fieldName)
        let metaInfo = breakdownMetaFieldAlias(fieldName)
        
        /**
         * it can be boolean, string, number, Object, Array of Object (class)
         * Depends on the props..
         */
        let propValue = metaInfo?.propType!.parseRaw(row[fieldName], metaInfo.propName, client)

        Object.defineProperty(entityInstance, metaInfo.propName, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: propValue
        })
        return entityInstance

    
    }, entityInstance)
    return entityInstance
}

// it is a special Entity or table. Just like the Dual in SQL Server
// export class Dual extends Entity {

//     static register(schema: Schema) : void{
//         //override the tableName into empty
//         schema.tableName = ''
//     }
// }

