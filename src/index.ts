import knex, { Knex } from 'knex'
import * as fs from 'fs'
import { FieldPropertyType, NumberNotNullType, PrimaryKeyType, PropertyType } from './types'
import {Dataset, Scalar, Expression, AddPrefix, ExpressionFunc, UpdateStatement, InsertStatement, RawUnit, DeleteStatement, ExpressionResolver, RawExpression, DScalar, DScalarRawExpression} from './builder'

import { expandRecursively, ExpandRecursively, ExtractFieldPropDictFromDict, ExtractFieldPropDictFromSchema, ExtractPropDictFromSchema, ExtractSchemaFromModelType, ExtractGetValueTypeDictFromSchema_FieldsOnly, isFunction, makeid, notEmpty, quote, ScalarDictToValueTypeDict, SimpleObject, thenResult, UnionToIntersection, ExtractGetValueTypeDictFromSchema, ExtractSchemaFieldOnlyFromSchema, AnyDataset, ExtractGetValueTypeDictFromDataset, ExtractComputePropWithArgDictFromSchema, camelize, ExtractSchemaFromDatasource, ExtractSetValueTypeDictFromSchema_FieldsOnly } from './util'
import { Model, ModelRepository } from './model'
import { ComputeProperty, Datasource, FieldProperty, Property, ScalarProperty, Schema, TableOptions, TableSchema } from './schema'

import {ExtractComputePropDictFromSchema} from './util'
import { constructSqlKeywords, SQLKeywords } from './sqlkeywords'


export * from './model'
export * from './builder'
export * from './sqlkeywords'
export * from './schema'
export * from './types'
export * from './util'

export type ScalarWithPropertyType<D> = Scalar<PropertyType<D>, any>

export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any, any>
} | SelectableProps<E>[]


export type ConstructComputeValueGetterArgsDictFromSchema<E extends Schema<any>> = {
    [key in keyof ExtractComputePropWithArgDictFromSchema<E>]:
        ExtractComputePropWithArgDictFromSchema<E>[key] extends ComputeProperty<ComputeValueGetterDefinitionDynamicReturn<any, infer ArgR >, any>? 
        Parameters<ArgR>[0]:
        ExtractComputePropWithArgDictFromSchema<E>[key] extends ComputeProperty<ComputeValueGetterDefinition<any, infer Arg, any>, any>?
        Arg: 
        never
}

export type QueryOrderBy<S extends Schema<any>> = ( ((keyof ExtractPropDictFromSchema<S>) | Scalar<any, any> ) | {value: ((keyof ExtractPropDictFromSchema<S>)|Scalar<any, any>), order: 'asc' | 'desc'} )[]

export type SingleSourceArg<S extends Schema<any> > = {
    select?: SingleSourceSelect<S>,
    selectProps?: SingleSourceSelectProps<S>,
    where?: SingleSourceWhere<S>
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy<S> | ((map: {'root': PropertyValueGetters<S>} & SQLKeywords< 
        UnionToIntersection< 
            AddPrefix< ExtractPropDictFromSchema<S> , ''> | AddPrefix< ExtractPropDictFromSchema<S> , 'root'>
        >,
        {'root': PropertyValueGetters<S>}
    > ) => QueryOrderBy<S> )
}

export type SingleSourceWhere<S extends Schema<any> > = Expression< 
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': PropertyValueGetters< S> }  >        
                > | ExpressionFunc<
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': PropertyValueGetters< S> }  >
        >

export type SingleSourceSelect<S extends Schema<any> > = Partial<ConstructComputeValueGetterArgsDictFromSchema<S>>

export type SingleSourceSelectProps<S extends Schema<any>> = (keyof ExtractComputePropDictFromSchema<S>)[]

export type TwoSourceArg<S extends Schema<any>, S2 extends Schema<any> > = {
    select?: SingleSourceSelect<S>,
    selectProps?: SingleSourceSelectProps<S>,
    where?: TwoSourceWhere<S, S2>
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy<S> | ((map: {'root': PropertyValueGetters<S>, 'through': PropertyValueGetters<S2>} & SQLKeywords< 
            UnionToIntersection< 
                AddPrefix< ExtractPropDictFromSchema<S> , ''> | AddPrefix< ExtractPropDictFromSchema<S> , 'root'> | AddPrefix< ExtractPropDictFromSchema<S2> , 'through'>
            >, 
            {'root': PropertyValueGetters<S>, 'through': PropertyValueGetters<S2>}
        > ) => QueryOrderBy<S> )
}

export type TwoSourceWhere<S extends Schema<any>, S2 extends Schema<any> > = Expression< 
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': PropertyValueGetters< S>, 'through': PropertyValueGetters<S2> }  >        
                > | ExpressionFunc<
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': PropertyValueGetters< S>, 'through': PropertyValueGetters<S2> }  >         
        >

export type PropertyValueGetters<E extends Schema<any>> = {
    [key in keyof ExtractPropDictFromSchema<E> & string ]:
        ExtractPropDictFromSchema<E>[key] extends ComputeProperty<ComputeValueGetterDefinitionDynamicReturn<any, infer ArgR >, any>? 
        ArgR:
        ExtractPropDictFromSchema<E>[key] extends ComputeProperty<ComputeValueGetterDefinition<any, infer Arg, infer S>, any>?
        ComputeValueGetter<Arg, S>: 
        ExtractPropDictFromSchema<E>[key] extends FieldProperty<infer D>? 
        Scalar<D, any>:
        ExtractPropDictFromSchema<E>[key] extends ScalarProperty<infer S>?
        S:
        never
} & {
    $allFields: {
        [key in keyof ExtractFieldPropDictFromSchema<E> & string ]:
            
        ExtractFieldPropDictFromSchema<E>[key] extends FieldProperty<infer D>? 
            Scalar<D, any>:
            never
    }
}

export type FieldValuesToBeSet<S extends Schema<any>> = Partial<ExtractSetValueTypeDictFromSchema_FieldsOnly<S>>


export type SetValuesCallback<S extends Schema<any>> = (valuesToBeSet: FieldValuesToBeSet<S>, trx: Knex.Transaction, mutationName: 'create'|'update'|'delete') => Promise<FieldValuesToBeSet<S>> | FieldValuesToBeSet<S>

export type AfterMutationCallback<S extends Schema<any>> = (affectedRecord: any, trx: Knex.Transaction, mutationName: 'create'|'update'|'delete') => Promise<void> | void

export type MutationHookDictionary<S extends Schema<any>> = {
    beforeCreate: (setValuesCallback: SetValuesCallback<S>) => void,
    beforeUpdate: (setValuesCallback: SetValuesCallback<S>) => void,
    beforeMutation: (setValuesCallback: SetValuesCallback<S>) => void,
    beforeDelete: (callback: ((trx: Knex.Transaction) => Promise<void> | void )) => void
    afterCreate: (callback: AfterMutationCallback<S>) => void,
    afterUpdate:(callback: AfterMutationCallback<S>) => void,
    afterMutation: (callback: AfterMutationCallback<S>) => void,
    afterDelete: (callback: AfterMutationCallback<S>) => void,
}

export type ComputeValueGetterDynamicReturn = ((arg?: any) => Scalar<PropertyType<any>, any> )

export class ComputeValueGetterDefinition<DS extends Datasource<any, any>, ARG, 
    S extends Scalar<PropertyType<any>, any>
>{
    fn: (source: DS, arg: ARG, context: DatabaseContext<any>) => S
    constructor(fn: (source: DS, arg: ARG, context: DatabaseContext<any>) => S ){
        this.fn = fn
    }
}

export class ComputeValueSetterDefinition<DS extends Datasource<any, any>, NewValue>{
    fn: (source: DS, arg: NewValue, context: DatabaseContext<any>, hooks: MutationHookDictionary< ExtractSchemaFromDatasource<DS> >) => void

    constructor(fn: (source: DS, arg: NewValue, context: DatabaseContext<any>, hooks: MutationHookDictionary< ExtractSchemaFromDatasource<DS> >) => void ){
        this.fn = fn
    }
}

export class ComputeValueGetterDefinitionDynamicReturn<DS extends Datasource<any, any>,
    CCF extends ComputeValueGetterDynamicReturn
> extends ComputeValueGetterDefinition<DS,
            Parameters<CCF>[0],
            ReturnType<CCF>
            >{

    mode: 'dynamic' = 'dynamic'
    // fn: (context: DatabaseContext<any>, source: DS, arg?: Parameters<CCF>[0]) => Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never > | Promise<Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never >>
    constructor(fn: (source: DS, arg: Parameters<CCF>[0], context: DatabaseContext<any>) => 
        ReturnType<CCF>
    ){
        super(fn)
    }
}

export type ComputeValueGetter<Arg, S extends Scalar<any,any>> = (args?: Arg) => S

// export type PartialMutationEntityPropertyKeyValues<S extends Schema<any>> = Partial<ExtractEntityKeyValuesFromPropDict<ExtractFieldPropDictFromSchema<S>>>

export type ExtractValueTypeDictFromFieldProperties<E> = {
    [key in keyof ExtractFieldPropDictFromDict<E>]:
        ExtractFieldPropDictFromDict<E>[key] extends FieldProperty<FieldPropertyType<infer Primitive>>? Primitive : never
}
export type ExtractValueTypeFromComputeProperty<T extends Property> = 
    T extends ComputeProperty<ComputeValueGetterDefinition<any, any, Scalar<PropertyType<infer V>, any> >, any>? V : never


// type ActualSelectiveArg = { select: {[key:string]: any}} | {selectProps: string[] }
// type SelectiveArg = { select?: any, selectProps?: any }
// type SelectiveArgFunction = ((root: SelectorMap<any>) => SingleSourceArg<any> )


// type ExtractSchemaFromSelectiveComputeProperty<T extends Property> = T extends ComputeProperty<ComputeFunction<any, ((root: SelectorMap<infer S>) => SingleSourceArg<any>), any>>? S: never

type ConstructValueTypeDictBySelectiveArgAttribute<SSA, P extends Property> = 
        P extends FieldProperty<any>? never:
        P extends ComputeProperty<ComputeValueGetterDefinition<any, undefined, any>, any>? ExtractValueTypeFromComputeProperty<P>:
        P extends ComputeProperty<ComputeValueGetterDefinition<any, ((map: {root: PropertyValueGetters<infer S>, through: PropertyValueGetters<any>}) => TwoSourceArg<any, any>), any>, any>? ConstructValueTypeDictBySelectiveArg<S, 
                (SSA extends ((...args: any[]) => any)? ReturnType<SSA>: SSA)
            >:
        P extends ComputeProperty<ComputeValueGetterDefinition<any, ((map: {root: PropertyValueGetters<infer S>}) => SingleSourceArg<any>), any>, any>? ConstructValueTypeDictBySelectiveArg<S, 
                (SSA extends ((...args: any[]) => any)? ReturnType<SSA>: SSA)
            >:
        ExtractValueTypeFromComputeProperty< P>


type ExtractSpecificPropertyFromSchema<S extends Schema<any>, name extends string> = S extends Schema<infer PropertyDict>? (
        PropertyDict[name]
    ): never
                

export type ConstructValueTypeDictBySelectiveArg<S extends Schema<any>, SSA> = 
    ExtractGetValueTypeDictFromSchema_FieldsOnly<S>
    & (
        SSA extends {select: {[key:string]: any}} ?
        {
        [k in keyof SSA["select"] & string]: ConstructValueTypeDictBySelectiveArgAttribute<SSA["select"][k], ExtractSpecificPropertyFromSchema<S, k> >
        } : {}
    )
    & (
        SSA extends {selectProps: string[]} ?
        {
            [k in SSA["selectProps"][number] & string]: ConstructValueTypeDictBySelectiveArgAttribute<{ select: {} }, ExtractSpecificPropertyFromSchema<S, k>>
        } : {}
    )
    

export type ConstructScalarPropDictBySelectiveArg<S extends Schema<any>, SSA > = 
    ExtractFieldPropDictFromSchema<S>
    & (
        SSA extends {select: {[key:string]: any}} ?
        {
        [k in keyof SSA["select"] & string]: ScalarProperty<Scalar<PropertyType< 
            ConstructValueTypeDictBySelectiveArgAttribute<SSA["select"][k], ExtractSpecificPropertyFromSchema<S, k> >
        >, any>>
        }: {}
    )
    & (
        SSA extends {selectProps: string[]} ?
        {
            [k in SSA["selectProps"][number] & string]: ScalarProperty<Scalar<PropertyType< 
                ConstructValueTypeDictBySelectiveArgAttribute<{ select: {} }, ExtractSpecificPropertyFromSchema<S, k> >
            >, any>>
        } : {}
    )


export type ORMConfig<ModelMap extends {[key:string]: typeof Model}> = {
    // sql client connection
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // object of Models
    models: ModelMap
    // the directory of the Model files
    modelsPath?: string,
    // output a SQL file of all schema
    outputSchemaPath?: string,
    // function to convert model name to table name
    entityNameToTableName?: (name:string) => string,
    // function of convert property Name to field name
    propNameTofieldName?: (name:string) => string

    useNullAsDefault?: boolean
}
export class ORM<ModelMap extends Record<string, typeof Model>>{

    #globalKnexInstance: Knex | null = null
    #contextMap = new Map<string, DatabaseContext<ModelMap>>()

    defaultORMConfig: ORMConfig<any> = {
        // primaryKeyName: 'id',
        // enableUuid: false,
        // useSoftDeleteAsDefault: true,
        // uuidPropName: 'uuid',
        // createModels: false,
        // types: {},
        models: {},
        knexConfig: {
            client: 'mysql' //default mysql
        }
    }

    #ormConfig: ORMConfig<ModelMap>
    #modelMap: ModelMap = {} as ModelMap

    constructor(newConfig: Partial<ORMConfig<ModelMap>>){
        const newOrmConfig: ORMConfig<ModelMap> = Object.assign({}, this.defaultORMConfig, newConfig)
        // newOrmConfig.ormContext = Object.assign({}, defaultORMConfig.ormContext, newConfig.ormContext)
        this.#ormConfig = newOrmConfig
        this.register()
    }


    get ormConfig(){
        //TODO: deep copy
        return Object.assign({}, this.#ormConfig)
    }

    get modelMap(){
        return this.#modelMap
    }

    private register(){
        //register models 
        if(this.#ormConfig.models){
            const models = this.#ormConfig.models
            Object.keys(models).forEach(key => {
                //@ts-ignore
                this.#modelMap[key] = models[key]
            })
        }

        //register models by path
        if(this.#ormConfig.modelsPath){
            const files = fs.readdirSync(this.#ormConfig.modelsPath)
            files.forEach( (file) => {
                if(file.endsWith('.js')){
                    let path = this.#ormConfig.modelsPath + '/' + file
                    path = path.replace(/\.js$/,'')
                    // console.debug('load model file:', path)
                    const p = path.split('/')
                    const entityName = p[p.length - 1]
                    const entityClass = require(path)
                    // registerEntity(entityName, entityClass.default);

                    const camelCase = camelize(entityName)
                    const finalName = camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    this.#modelMap[finalName] = entityClass.default
                }
            })
        }
    }

    getContext(config?: Partial<DatabaseContextConfig>): DatabaseContext<ModelMap> {
        //!!!important: lazy load, don't always return new object
        const key = JSON.stringify(config)
        let repo = this.#contextMap.get(key)
        if(!repo){
            repo = new DatabaseContext<ModelMap>(this, config)
            this.#contextMap.set(key, repo)
        }
        return repo
    }

    // a global knex instance
    getKnexInstance(): Knex {
        if(this.#globalKnexInstance){
            return this.#globalKnexInstance
        }

        const newKnexConfig = Object.assign({
            useNullAsDefault: true
        }, this.#ormConfig.knexConfig)

        if(newKnexConfig.connection !== undefined && typeof newKnexConfig.connection !== 'object'){
            throw new Error('Configuration connection only accept object.')
        }

        if(typeof newKnexConfig.client !== 'string'){
            throw new Error('Configuration client only accept string')
        }

        // multipleStatements must be true
        newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, {multipleStatements: true})
        
        
        // console.log('newKnexConfig', newKnexConfig)
        this.#globalKnexInstance = knex(newKnexConfig)
        return this.#globalKnexInstance
    }

    async shutdown(): Promise<void> {
        return this.getKnexInstance().destroy()
    }

    // async executeStatement(stmt: SQLString, executionOptions: ExecutionOptions): Promise<any> {
    //     return this.getRepository().executeStatement(stmt, {}, executionOptions)
    // }

    // async execute<S>(dataset: Dataset<S, any, any>, executionOptions: ExecutionOptions) {
    //     return this.getRepository().execute(dataset, executionOptions)
    // }
}

export type DatabaseContextConfig = TableOptions

//(ModelMap[key] extends Model<infer E>?E:never) 
export class DatabaseContext<ModelMap extends {[key:string]: typeof Model}> {
    #config: Partial<DatabaseContextConfig> | null = null
    readonly orm
    // private registeredEntities: EntityMap
    public repos: {[key in keyof ModelMap]: ModelRepository<  ModelMap[key]>}
    // #modelClassMap: ModelMap
    
    constructor(orm: ORM<ModelMap>, config?: Partial<DatabaseContextConfig> ){
        this.orm = orm
        this.#config = config ?? {}
        // this.#modelClassMap = modelClassMap

        this.repos = Object.keys(orm.modelMap).reduce( (acc, key) => {
            const modelClass = orm.modelMap[key]
            //@ts-ignore
            acc[key] = new ModelRepository< ModelMap[typeof key] >(this, modelClass, key)
            return acc
        }, {} as {[key in keyof ModelMap]: ModelRepository< ModelMap[key]>})
    }

    get config(){
        return this.#config
    }

    get tablePrefix(){
        return this.#config?.tablePrefix ?? ''
    }

    getRepository<T extends typeof Model>(modelName: string): ModelRepository<T>;

    getRepository<T extends typeof Model>(modelClass: T): ModelRepository<T>;
    
    getRepository<T extends typeof Model>(nameOrClass: T | string): ModelRepository<T> {

        if(typeof nameOrClass === 'string'){
            return this.repos[nameOrClass] as unknown as ModelRepository<T>
        } else {
            //@ts-ignore
            const foundKey = Object.keys(this.repos).find(key => this.repos[key].modelClass === nameOrClass)
            if(!foundKey){
                console.log('cannot find model', nameOrClass)
                throw new Error('Cannot find model')
            }
            return this.repos[foundKey] as unknown as ModelRepository<T>
        }
    }

    schemaSqls = () => {
        const m = this.repos
        const sqls: string[] = Object.keys(m)
            .map(k => m[k].model)
            .map(s => s.schema().createTableStmt(this, { tablePrefix: this.tablePrefix}))
            .filter(notEmpty)
        return sqls
    }

    //write schemas into sql file
    outputSchema = (path: string) => {
        fs.writeFileSync(path, this.schemaSqls().join(";\n") + ';')
        // console.debug('schemas files:', Object.keys(schemas))
    }

    createModels = async() => {
        // create tables
        // important: sqllite3 doesn't accept multiple statements
        await Promise.all( this.schemaSqls().map( async(sql) => {
            await this.orm.getKnexInstance().raw(sql)
        }))
    }

    executeStatement(sql: string, variables: {[key:string]: any} | any[], executionOptions: ExecutionOptions): Promise<any>;

    executeStatement(stmt: Knex.QueryBuilder | Knex.Raw, executionOptions: ExecutionOptions): Promise<any>;
    
    async executeStatement(...args: any[]){

        if(typeof args[0] ==='string'){

            const variables = args[1] as {[key:string]: any}
            const executionOptions = args[2] as ExecutionOptions

            if(executionOptions?.onSqlRun) {
                executionOptions.onSqlRun(args[0])
            }
            // console.log('sql', sql)
            const KnexStmt = this.orm.getKnexInstance().raw(args[0], variables)
            if (executionOptions?.trx) {
                KnexStmt.transacting(executionOptions.trx)
            }
            let result = null
            result = await KnexStmt
     
            return result

        } else {
            const stmt: Knex.QueryBuilder | Knex.Raw = args[0]
            const executionOptions = args[1] as ExecutionOptions

            if(executionOptions?.onSqlRun) {
                executionOptions.onSqlRun(stmt.toString())
            }
            
            // const KnexStmt = this.orm.getKnexInstance().raw('?', [stmt])
            const KnexStmt = stmt
            if (executionOptions?.trx) {
                KnexStmt.transacting(executionOptions.trx)
            }
            const result = await new Promise((resolve, reject) => {
                //@ts-ignore
                KnexStmt.originalThen(resolve, reject)
            })
     
            return result
        }
    }

    dataset = (): Dataset<any> => {
        return new Dataset(this)
    }

    scalar<D extends PropertyType<any>>(sql: string, args?: any[], definition?: D | (new (...args: any[]) => D) ): Scalar<D, any>;

    scalar<D extends PropertyType<any>>(value: RawExpression<D>, definition?: D | (new (...args: any[]) => D)): Scalar<D, any>;
    
    scalar(...args:  any[]): Scalar<any, any>{
        
        if(typeof args[0] ==='string' && Array.isArray(args[1]) ){
            return new Scalar(this, {sql: args[0], args: args[1]}, args[2])
        }
        return new Scalar(this, args[0], args[1])
    }

    scalarNumber(sql: string, args?: any[]): Scalar<NumberNotNullType, any>;
    
    scalarNumber(value: RawExpression<NumberNotNullType>): Scalar<NumberNotNullType, any>;

    scalarNumber(...args: any[]): Scalar<NumberNotNullType, any>{
        if(typeof args[0] ==='string' && Array.isArray(args[1])){
            return new Scalar(this, {sql: args[0], args: args[1]}, NumberNotNullType)
        }
        return new Scalar(this, args[0], NumberNotNullType)
    }

    dScalar<D extends PropertyType<any>, DS extends Dataset<any, any, any, any> >
        (value: DScalarRawExpression<DS>,  definition?: D | (new (...args: any[]) => D)): DScalar<D, DS> {
        return new DScalar(this, value, definition)
    }

    raw = (sql: string, args?: any[]) => {

        const r = this.orm.getKnexInstance().raw(sql, args ?? [])        
        
        //@ts-ignore
        r.originalThen = r.then

        //@ts-ignore
        r.then = 'It is overridden. \'Then\' function is removed to prevent execution when it is passing across any async function(s).'

        return r
    }

    get $(): SQLKeywords< any, any> {
        const o = {}
        const f = new ExpressionResolver< AddPrefix< {}, string>, any>(this, o)
        return Object.assign(o, constructSqlKeywords(this, f))
    }
    
    update = () => {
        return new UpdateStatement(this)
    }
   
    del = () => {
        return new DeleteStatement(this)
    }

    insert = <T extends TableSchema< { id: FieldProperty<PrimaryKeyType>; } >>(into: T): InsertStatement<T> => {
        return new InsertStatement(this, into)
    }

    client = (): string => this.orm.ormConfig.knexConfig.client.toString()

    async startTransaction<T>(func: (trx: Knex.Transaction) => Promise<T> | T, existingTrx?: Knex.Transaction | null): Promise<T> {
        const knex = this.orm.getKnexInstance()
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
            
            //{isolationLevel: 'read committed'}
            const trx = await knex.transaction()
            return await useTrx(trx, false)
            
        }
    }
}

export type ExecutionOptions = {
    // isSoftDeleteMode: boolean
    onSqlRun?: ((sql: string) => void) | null
    trx?: Knex.Transaction<any, any[]> | null
}

export type MutationExecutionOptions<S extends Schema<any> > = ExecutionOptions & {
    // returnIds?: boolean
}

export type DBActionResult<T> = T

export type DBActionOptions = {
    // failIfNone: boolean
    // failIfNotOne: boolean
    // failIfMoreThanOne: boolean
}
export type DBAction<I> = (context: DatabaseContext<any>, executionOptions: ExecutionOptions, options: Partial<DBActionOptions>) => Promise<DBActionResult<I>>

export type DBMutationAction<I, S extends Schema<any>> = (context: DatabaseContext<any>, executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>) => Promise<DBActionResult<I>>


export class DBActionRunnerBase<I> implements PromiseLike<ExpandRecursively<I> >{
    protected context: DatabaseContext<any>
    protected execOptions: ExecutionOptions
    protected action: DBAction<I>
    protected options: Partial<DBActionOptions> = {}
    // private trx?: Knex.Transaction | null
    protected sqlRunCallback?: ((sql: string) => void) | null

    constructor(context: DatabaseContext<any>, action: DBAction<I>){
        // this.beforeAction = beforeAction
        this.context = context
        this.execOptions = {}
        this.action = action
    }

    protected async execAction(execOptions?: ExecutionOptions){
        return await this.action.call(this, this.context, execOptions ?? this.execOptions, this.options)
    }

    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: ExpandRecursively<I>) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            const result = await this.execAction() 
            if(onfulfilled){
                return onfulfilled( expandRecursively(result))
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

    protected async exec(){
        const result = await this.execAction()
        return result
    }

    usingConnection(trx: Knex.Transaction): this{
        if(!trx){
            throw new Error('No transaction given.')
        }
        this.execOptions.trx = trx
        return this
    }

    usingConnectionIfAny(trx?: Knex.Transaction | null): this{
        if(trx){
            this.execOptions.trx = trx
        }
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

    getOptions() : ExecutionOptions{
        return this.execOptions
    }
} 

export class DBQueryRunner<Source extends Dataset<any, any, any, any> | Scalar<any, any>, I> extends DBActionRunnerBase<I> {

    protected parent: DBQueryRunner<any, any> | null = null
    // protected isFullCount = false
    // protected fullCountResult: number | null = null
    protected source: Source

    constructor(source: Source, context: DatabaseContext<any>, action: DBAction<I>, 
        args?: {
            parent?: DBQueryRunner<any, any>
            // isFullCount?: boolean
        }
        ){
        super(context, action)
        this.parent = args?.parent ?? null
        this.source = source
        // this.isFullCount = args?.isFullCount ?? false
    }

    get ancestor(): DBQueryRunner<any, any>{
        
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let parent: DBQueryRunner<any, any> = this
        while(parent && parent.parent){
            parent = parent.parent
        }
        if(!parent){
            return this
        }
        return parent
    }

    getOne(){
        type NewI = I extends Array<infer T>? T: never
        
        const m = new DBQueryRunner<Source, NewI>(
            this.source,
            this.context,
            async function(this: DBQueryRunner<Source, NewI>, context: DatabaseContext<any>, executionOptions: ExecutionOptions, options: Partial<DBActionOptions>){
                
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    const result = await this.ancestor.action.call(this, context, executionOptions, options)
                    if(Array.isArray(result)){
                        if(result.length !== 1){
                            throw new Error('getFirstOne finds Zero or Many Rows')
                        }
                        return result[0] as NewI
                    }
                    throw new Error('Only array is allowed to use getFirstRow')
                }, executionOptions.trx)
            }, {
                parent: this
            })
        return m
    }

    getOneOrNull(){
        type NewI = I extends Array<infer T>? T | null: never
        
        const m = new DBQueryRunner<Source, NewI>(
            this.source,
            this.context,
            async function(this: DBQueryRunner<Source, NewI>, context: DatabaseContext<any>, executionOptions: ExecutionOptions, options: Partial<DBActionOptions>){
                
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    const result = await this.ancestor.action.call(this, context, executionOptions, options)
                    if(Array.isArray(result)){
                        if(result.length > 1){
                            throw new Error('getFirstOne finds Many Rows')
                        }
                        return result[0] ?? null as NewI
                    }
                    throw new Error('Only array is allowed to use getFirstRow')
                }, executionOptions.trx)
            }, {
                parent: this
            })
        return m
    }

    getBuilder(){
        return this.source
    }

    // withFullCount(){
    //     type NewI = {
    //         result: I,
    //         fullCount: isFullCount extends true? number: never,
    //     }
    //     const m = new DBQueryRunner<NewI, isFullCount>(
    //         this.dataset,
    //         this.context,
    //         async function(this: DBQueryRunner<NewI, isFullCount>,
    //             executionOptions: ExecutionOptions, options: Partial<DBActionOptions>) {
    //             const result = await this.ancestor.action.call(this, executionOptions, options)
    //             return {
    //                 result,
    //                 fullCount: this.fullCountResult
    //             } as NewI
    //         }, {
    //             parent: this,
    //             isFullCount: true
    //         })

    //     return m
    // }
}

// type AffectedOne<X> = X extends Array<infer T>? (T|null): never

export class DBMutationRunner<I, S extends TableSchema<any>, PreflightRecordType, AffectedRecordType, isPreflight, isAffected> extends DBActionRunnerBase<I>{

    // protected execOptions: MutationExecutionOptions<S>

    // protected preflightFunction: <D extends Dataset<Schema<any>>>(
    //     this: DBMutationRunner<any, S, PreflightRecordType, AffectedRecordType, isPreflight, isAffected>, dataset: D) => Promise<ExtractValueTypeDictFromDataset<D>>
    // protected queryAffectedFunction: <D extends Dataset<Schema<any>>>(
    //     this: DBMutationRunner<any, S, PreflightRecordType, AffectedRecordType, isPreflight, isAffected>, dataset: D) => Promise<ExtractValueTypeDictFromDataset<D>>
        
    protected preflightFunctionArg: null | ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>) = null

    protected queryAffectedFunctionArg: null | ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>) = null


    protected preflightResult: PreflightRecordType | null = null
    protected affectedResult: AffectedRecordType | null = null
    protected parent: DBMutationRunner<any, any, any, any, any, any> | null = null

    constructor(
        context: DatabaseContext<any>,
        action: DBMutationAction<I, S>, 
        args?: {
            parent?: DBMutationRunner<any, any, any, any, any, any>,
            preflightFunctionArg?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>),
            queryAffectedFunctionArg?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>)
        }
        ){
        super(context, action)
        this.parent = args?.parent ?? null
        this.preflightFunctionArg = args?.preflightFunctionArg ?? null
        this.queryAffectedFunctionArg = args?.queryAffectedFunctionArg ?? null
    }

    get ancestor(): DBMutationRunner<any, any, any, any, any, any>{
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let parent: DBMutationRunner<any, any, any, any, any, any> = this
        while(parent && parent.parent){
            parent = parent.parent
        }
        if(!parent){
            return this
        }
        return parent
    }

    get latestPreflightFunctionArg(): null | ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>){
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let target: DBMutationRunner<any, any, any, any, any, any> | null = this
        while( target && !target.preflightFunctionArg) {
            target = target.parent
        }

        return target?.preflightFunctionArg ?? null
    }

    get latestQueryAffectedFunctionArg(): null | ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>){
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let target: DBMutationRunner<any, any, any, any, any, any> | null = this
        while( target && !target.queryAffectedFunctionArg) {
            target = target.parent
        }

        return target?.queryAffectedFunctionArg ?? null
    }

    protected async execAction(execOptions?: MutationExecutionOptions<S> ){
        return await super.execAction(execOptions)
    }

    override withOptions(execOptions: MutationExecutionOptions<S> ){
        super.withOptions(execOptions)
        return this
    }

    override getOptions() : MutationExecutionOptions<S> {
        return this.execOptions
    }
    getAffected()
    : DBMutationRunner< 
        ExtractGetValueTypeDictFromDataset<
            Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
        >[], S, PreflightRecordType, 
            ExtractGetValueTypeDictFromDataset<
                Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
            >[], isPreflight, true>;

    getAffected<D extends Dataset<Schema<any>>>(onQuery: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D )
    : DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>;


    getAffected(...args: any[]){
        type D = Dataset<any>
        const onQuery: (() => D) = args[0] ?? ((dataset: D) => dataset)

        return new DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>, 
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                await this.ancestor.action.call(this, context, executionOptions, options)
                return this.affectedResult as ExtractGetValueTypeDictFromDataset<D>[]
            }, {
                parent: this,
                queryAffectedFunctionArg: onQuery
            })
    }

    getAffectedOne()
    : DBMutationRunner< 
        ExtractGetValueTypeDictFromDataset<
            Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
        >, S, PreflightRecordType, 
            ExtractGetValueTypeDictFromDataset<
                Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
            >[], isPreflight, true>;

    getAffectedOne<D extends Dataset<Schema<any>>>(onQuery: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D )
    : DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>;

    getAffectedOne(...args: any[]){

        type D = Dataset<any>
        const onQuery: (() => D) = args[0] ?? ((dataset: D) => dataset)

        return new DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>, 
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                    
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    await this.ancestor.action.call(this, context, executionOptions, options)
                    if(Array.isArray(this.affectedResult)){
                        if(this.affectedResult.length !== 1){
                            throw new Error('getAffectedOne finds Zero or Many Rows')
                        }
                        return this.affectedResult[0]
                    }
                    throw new Error('Only array is allowed to use getAffectedOne')
                }, executionOptions.trx )
                
            }, {
                parent: this,
                queryAffectedFunctionArg: onQuery 
            })
    }

    withAffected()
    : DBMutationRunner<{
            result: I,
            preflight: isPreflight extends true? PreflightRecordType: never,
            affected: ExtractGetValueTypeDictFromDataset<
                Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
            >[] 
        }, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<
                Dataset<ExtractSchemaFieldOnlyFromSchema<S>>
            >[], isPreflight, true>;

    withAffected<D extends Dataset<Schema<any>>>(onQuery?: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D )
    : DBMutationRunner<{
            result: I,
            preflight: isPreflight extends true? PreflightRecordType: never,
            affected: ExtractGetValueTypeDictFromDataset<
                D
            >[] 
        }, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>;

    withAffected(...args: any[]){
        
        type D = Dataset<any>
        const onQuery: (() => D) = args[0] ?? ((dataset: D) => dataset)
        type NewI = {
            result: I,
            preflight: isPreflight extends true? PreflightRecordType: never,
            affected: ExtractGetValueTypeDictFromDataset<D>[] 
        }
        const m = new DBMutationRunner<NewI, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner<NewI, S, PreflightRecordType, ExtractGetValueTypeDictFromDataset<D>[], isPreflight, true>,
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>) {
                const result = await this.ancestor.action.call(this, context, executionOptions, options)
                return {
                    result,
                    preflight: this.preflightResult,
                    affected: this.affectedResult
                } as NewI
            }, {
                parent: this,
                queryAffectedFunctionArg: onQuery
            })

        return m
    }

    getPreflight<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(
        onQuery?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ))
    : DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>[], S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected> {
        
        return new DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>[], S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>[], S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>, 
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                await this.ancestor.action.call(this, context, executionOptions, options)
                return this.preflightResult as ExtractGetValueTypeDictFromDataset<D>[]
            }, {
                parent: this,
                preflightFunctionArg : onQuery ?? ((dataset: any) => dataset)
            })
    }

    getPreflightOne<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(
        onQuery?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ))
    : DBMutationRunner< ExtractGetValueTypeDictFromDataset<D>, S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected> {
        
        return new DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>, S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<ExtractGetValueTypeDictFromDataset<D>, S, ExtractGetValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>, 
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){

                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    await this.ancestor.action.call(this, context, executionOptions, options)
                    if(Array.isArray(this.preflightResult)){
                        if(this.preflightResult.length !== 1){
                            throw new Error('getPreflightOne finds Zero or Many Rows')
                        }
                        return this.preflightResult[0]
                    }
                    throw new Error('Only array is allowed to use getPreflightOne')
                }, executionOptions.trx)
            }, {
                parent: this,
                preflightFunctionArg : onQuery ?? ((dataset: any) => dataset)
            })
    }

    withPreflight<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>>>(onQuery?: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ){

        type NewI = {
            result: I,
            preflight: ExtractGetValueTypeDictFromDataset<D>,
            affected: isAffected extends true? AffectedRecordType: never,
        }
        const m = new DBMutationRunner<NewI, S, ExtractGetValueTypeDictFromDataset<D>, AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<NewI, S, ExtractGetValueTypeDictFromDataset<D>, AffectedRecordType, true, isAffected>, 
                context: DatabaseContext<any>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                const result = await this.ancestor.action.call(this, context, executionOptions, options)
                return {
                    result,
                    preflight: this.preflightResult,
                    affected: this.affectedResult
                } as NewI
            }, {
                parent: this,
                preflightFunctionArg: onQuery ?? ((dataset: any) => dataset)
            })
        return m
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
    propertyDefinition: PropertyType<any> | null,
    propertyValue: any | null,
    rootClassName: string
}

export type HookAction = <T>(context: DatabaseContext<any>, rootValue: T, info: HookInfo, executionOptions: ExecutionOptions) => T | Promise<T>


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