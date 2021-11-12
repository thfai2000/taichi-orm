import knex, { Knex } from 'knex'
import * as fs from 'fs'
// import { v4 as uuidv4 } from 'uuid'
export { PropertyType as PropertyDefinition, FieldPropertyTypeDefinition as FieldPropertyDefinition }
import { ArrayType, FieldPropertyTypeDefinition, ObjectType, ParsableObjectTrait, ParsableTrait, PrimaryKeyType, PropertyType } from './types'
import {Dataset, Scalar, Expression, AddPrefix, ExpressionFunc, UpdateStatement, InsertStatement, RawExpression, RawUnit, DeleteStatement, makeExpressionResolver, SQLKeywords, ExpressionResolver} from './builder'

import { Expand, expandRecursively, ExpandRecursively, ExtractComputePropDictFromDict, ExtractFieldPropDictFromDict, ExtractFieldPropDictFromSchema, FilterPropDictFromDict, ExtractPropDictFromSchema, ExtractSchemaFromModelType, ExtractValueTypeDictFromSchema_FieldsOnly, isFunction, makeid, notEmpty, quote, ScalarDictToValueTypeDict, SimpleObject, SQLString, thenResult, UnionToIntersection, ExtractValueTypeDictFromSchema, ExtractSchemaFieldOnlyFromSchema, AnyDataset, ExtractValueTypeDictFromDataset } from './util'
import { Model, ModelRepository } from './model'
import { ComputeProperty, Datasource, FieldProperty, Property, ScalarProperty, Schema, TableOptions, TableSchema } from './schema'

import {ExtractComputePropDictFromSchema} from './util'
import { AndOperator, ExistsOperator, NotOperator, OrOperator } from './operators'

// type ComputeFunction_PropertyTypeDefinition<C extends ComputeFunction<any, any, any>> = (C extends ComputeFunction<infer ARG, infer P> ? P: any) & (new (...args: any[]) => any) & typeof PropertyType
// type FindSchema<F extends SingleSourceArg<any>> = F extends SingleSourceArg<infer S>?S:never

// type VirtualSchemaWithComputed<F extends SingleSourceArg<any>> = EntityFieldPropertyKeyValues< FindSchema<F> > 
//     & { 
//         [k in keyof F["select"]]: 
//             (
//                 (FindSchema<F>[k] extends ComputeProperty<infer P, any, any, any>? 
//                 P:
//                 FindSchema<F>[k] extends FieldProperty<infer P>?
//                 P:never) extends PropertyType<infer T> ? ExpectedInstance<>
//             ) 

// }

export type CFReturn<D> = Scalar<PropertyType<D>, any>

// export type CFReturnModelArray<Model> = Scalarable<PropertyType< ExtractVa >>

export type QueryOrderBy = ( (string| Scalar<any, any> ) | {column: (string|Scalar<any, any>), order: 'asc' | 'desc'} )[]

export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any, any>
} | SelectableProps<E>[]


export type ConstructComputePropertyArgsDictFromSchema<E extends Schema<any>> = {
    [key in keyof ExtractComputePropDictFromSchema<E>]:
        ExtractComputePropDictFromSchema<E>[key] extends ComputeProperty<ComputeFunction<any, infer Arg, any>>?
                Arg: never           
}


export type SingleSourceArg<S extends Schema<any> > = {
    select?: SingleSourceSelect<S>,
    where?: SingleSourceWhere<S>
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type SingleSourceWhere<S extends Schema<any> > = Expression< 
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >        
                > | ExpressionFunc<
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >         
        >

export type SingleSourceSelect<S extends Schema<any> > = Partial<ConstructComputePropertyArgsDictFromSchema<S>>

// export type SingleSourceArgFunction<S extends TableSchema> = (root: SelectorMap< S>) => SingleSourceArg<S>

export type TwoSourcesArg<Root extends Schema<any>, RootName extends string, Related extends Schema<any>, RelatedName extends string> = {

    props?: Partial<ConstructComputePropertyArgsDictFromSchema<Related>>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< Root>, '', ''> | AddPrefix< ExtractPropDictFromSchema< Root>, RootName> | AddPrefix< ExtractPropDictFromSchema< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                > | 
                ExpressionFunc< 
        UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< Root>, '', ''> | AddPrefix< ExtractPropDictFromSchema< Root>, RootName> | AddPrefix< ExtractPropDictFromSchema< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}


export type TwoSourcesArgFunction<Root extends Schema<any>, RootName extends string, Related extends Schema<any>, RelatedName extends string> =
    (root: Datasource<Root, RootName>, related: Datasource<Related, RelatedName>) => TwoSourcesArg<Root, RootName, Related, RelatedName>


export type SelectorMap<E extends Schema<any>> = {
    [key in keyof ExtractPropDictFromSchema<E> & string ]:
            
        ExtractPropDictFromSchema<E>[key] extends ComputeProperty<ComputeFunctionDynamicReturn<any, infer ArgR >>? 
        ArgR:
        ExtractPropDictFromSchema<E>[key] extends ComputeProperty<ComputeFunction<any, infer Arg, infer S>>?
        CompiledComputeFunction<Arg, S>: 
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

export interface Scalarable<T extends PropertyType<any>, Value extends Knex.Raw | Dataset<any, any, any, any> > {
    toScalar(): Scalar<T, Value>
    // castToScalar<D extends PropertyType<any>>(type?: D | (new (...args: any[]) => D) ): Scalar<D>
    // toRaw(repository: EntityRepository<any>): Promise<Knex.Raw> | Knex.Raw
}



// export type ComputeFunction<DS extends Datasource<any, any>, 
//     CompiledComputeFunction2<any, ARG, R>
// > = (context: DatabaseContext<any>, source: DS, arg?: ARG) => Scalarable<P> | Promise<Scalarable<P>>

// export type CompiledComputeFunction2<Name extends string, ARG, R extends PropertyType<any> > = (args?: ARG) => Column<Name, R>


// type AA<C> = (a: C) => number 

// type CC<T> = (a: T) => T extends boolean? string: boolean

// type B<A extends ((...args: any[]) => any) >= (f: Parameters<A>[0] ) => ReturnType<A>



// let b: B<AA<boolean>>

// let c: B<CC<boolean>>

// let x = b!(true)

// let y = c!(true)

// let p: (f: (...args: any[]) => any ) => void

// p!( c! )
export type CompiledComputeFunctionDynamicReturn = ((arg?: any) => Scalar<PropertyType<any>, any> )

// export type ComputeFunctionDynamicReturn<DS extends Datasource<any, any>,
//     CCF extends CompiledComputeFunctionDynamicReturn
// > = {
//     (context: DatabaseContext<any>, source: DS, arg?: Parameters<CCF>[0]): Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never > | Promise<Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never >>,
// }

export class ComputeFunction<DS extends Datasource<any, any>, ARG, 
    S extends Scalar<PropertyType<any>, any>
>{
    fn: (context: DatabaseContext<any>, source: DS, arg?: ARG) => S | Promise<S>
    constructor(fn: (context: DatabaseContext<any>, source: DS, arg?: ARG) => S | Promise<S>){
        this.fn = fn
    }
}

// export type CCFScalarable<CCF extends CompiledComputeFunctionDynamicReturn > = Scalarable<
//     ReturnType<CCF> extends Scalar<infer P, any>? P: never,
//     ReturnType<CCF> extends Scalar<any, infer Value>? Value: never
//     >

export class ComputeFunctionDynamicReturn<DS extends Datasource<any, any>,
    CCF extends CompiledComputeFunctionDynamicReturn
> extends ComputeFunction<DS,
            Parameters<CCF>[0],
            ReturnType<CCF>
            >{

    mode: 'dynamic' = 'dynamic'
    // fn: (context: DatabaseContext<any>, source: DS, arg?: Parameters<CCF>[0]) => Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never > | Promise<Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never >>
    constructor(fn: (context: DatabaseContext<any>, source: DS, arg?: Parameters<CCF>[0]) => 
        ReturnType<CCF> | Promise<ReturnType<CCF>>
    ){
        super(fn)
    }
}

export type CompiledComputeFunction<Arg extends any, S extends Scalar<any,any>> = (args?: Arg) => S

// export type PartialMutationEntityPropertyKeyValues<S extends Schema<any>> = Partial<ExtractEntityKeyValuesFromPropDict<ExtractFieldPropDictFromSchema<S>>>

export type ExtractValueTypeDictFromFieldProperties<E> = {
    [key in keyof ExtractFieldPropDictFromDict<E>]:
        ExtractFieldPropDictFromDict<E>[key] extends FieldProperty<FieldPropertyTypeDefinition<infer Primitive>>? Primitive : never
}
export type ExtractValueTypeFromComputeProperty<T extends Property> = T extends ComputeProperty<ComputeFunction<any, any, Scalar<PropertyType<infer V>, any> >>? V : never
   

type SelectiveArg = {select?:{}}
type SelectiveArgFunction = ((root: SelectorMap<Schema<any>>) => SelectiveArg )

type ExtractSchemaFromSelectiveComputeProperty<T extends Property> = T extends ComputeProperty<ComputeFunction<any, ((root: SelectorMap<infer S>) => { select?: {}}), any>>? S: never
 

type ConstructValueTypeDictBySelectiveArgAttribute<SSA, S extends Property> = SSA extends SelectiveArgFunction? 
                ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromSelectiveComputeProperty<S>, ReturnType<SSA>>
                :  (
                    SSA extends SelectiveArg?
                    ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromSelectiveComputeProperty<S>, SSA>
                    : 
                    ExtractValueTypeFromComputeProperty< S>
                )


type ExtractSpecificPropertyFromSchema<S extends Schema<any>, name extends string> = S extends Schema<infer PropertyDict>? (
        PropertyDict[name]
    ): never
                
export type ConstructValueTypeDictBySelectiveArg<S extends Schema<any>, SSA extends { select?: {}} > = ( 
    ExtractValueTypeDictFromSchema_FieldsOnly<S>
    & {
        [k in keyof SSA["select"] & string]: ConstructValueTypeDictBySelectiveArgAttribute<SSA["select"][k], ExtractSpecificPropertyFromSchema<S, k> >
    })



export type ConstructScalarPropDictBySelectiveArg<S extends Schema<any>, SSA extends { select?: {}} > = ( 
    ExtractFieldPropDictFromSchema<S>
    & {
        [k in keyof SSA["select"] & string]: ScalarProperty<Scalar<PropertyType< 
            ConstructValueTypeDictBySelectiveArgAttribute<SSA["select"][k], ExtractSpecificPropertyFromSchema<S, k> >
        >, any>>
    })

    
export type ORMConfig<ModelMap extends {[key:string]: typeof Model}> = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // types: { [key: string]: typeof PropertyDefinition },
    models: ModelMap
    // createModels: boolean,
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
    // enableUuid: boolean
    // uuidPropName: string
}


export class ORM<ModelMap extends {[key:string]: typeof Model}>{

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
    // @ts-ignore
    #modelMap: ModelMap = {}

    constructor(newConfig: Partial<ORMConfig<ModelMap>>){
        let newOrmConfig: ORMConfig<ModelMap> = Object.assign({}, this.defaultORMConfig, newConfig)
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
            let models = this.#ormConfig.models
            Object.keys(models).forEach(key => {
                // @ts-ignore
                this.#modelMap[key] = models[key]
            })
        }

        //register models by path
        if(this.#ormConfig.modelsPath){
            let files = fs.readdirSync(this.#ormConfig.modelsPath)
            files.forEach( (file) => {
                if(file.endsWith('.js')){
                    let path = this.#ormConfig.modelsPath + '/' + file
                    path = path.replace(/\.js$/,'')
                    // console.debug('load model file:', path)
                    let p = path.split('/')
                    let entityName = p[p.length - 1]
                    let entityClass = require(path)
                    // registerEntity(entityName, entityClass.default);

                    // @ts-ignore
                    this.#modelMap[entityName] = entityClass.default
                }
            })
        }

        // Object.keys(this.#registeredModels).forEach(k => {
        //     this.#registeredModels[k].registerPostAction()
        // })
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

        let newKnexConfig = Object.assign({
            useNullAsDefault: true
        }, this.#ormConfig.knexConfig)

        if(typeof newKnexConfig.connection !== 'object'){
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

    // async executeStatement(stmt: SQLString, executionOptions: ExecutionOptions): Promise<any> {
    //     return this.getRepository().executeStatement(stmt, {}, executionOptions)
    // }

    // async execute<S>(dataset: Dataset<S, any, any>, executionOptions: ExecutionOptions) {
    //     return this.getRepository().execute(dataset, executionOptions)
    // }
}

export type DatabaseContextConfig = {
} & TableOptions

//(ModelMap[key] extends Model<infer E>?E:never) 
export class DatabaseContext<ModelMap extends {[key:string]: typeof Model}> {
    #config: Partial<DatabaseContextConfig> | null = null
    readonly orm
    // private registeredEntities: EntityMap
    public models: {[key in keyof ModelMap]: ModelRepository<  ModelMap[key]>}
    // #modelClassMap: ModelMap
    
    constructor(orm: ORM<ModelMap>, config?: Partial<DatabaseContextConfig> ){
        this.orm = orm
        this.#config = config ?? {}
        // this.#modelClassMap = modelClassMap

        this.models = Object.keys(orm.modelMap).reduce( (acc, key) => {
            let modelClass = orm.modelMap[key]
            //@ts-ignore
            acc[key] = new ModelRepository<any>(this, modelClass, key)
            return acc
        }, {} as {[key in keyof ModelMap]: ModelRepository<  ModelMap[key]>})
    }

    get config(){
        return this.#config
    }

    get tablePrefix(){
        return this.#config?.tablePrefix ?? ''
    }

    // findModelInstance = <T extends typeof Model>(modelClass: T): InstanceType<T> => {
    //     let foundKey = Object.keys(this.#modelClassMap).find(key => this.#modelClassMap[key] === modelClass)
    //     if(!foundKey){
    //         throw new Error('Cannot find model')
    //     }
    //     return this.models[foundKey].modelClass as unknown as InstanceType<T>
    // }

    getRepository = <T extends typeof Model>(modelClass: T): ModelRepository<T> => {
        //@ts-ignore
        let foundKey = Object.keys(this.models).find(key => this.models[key].modelClass === modelClass)
        if(!foundKey){
            throw new Error('Cannot find model')
        }
        return this.models[foundKey] as unknown as ModelRepository<T>
    }

    schemaSqls = () => {
        let m = this.models
        let sqls: string[] = Object.keys(m)
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
        }) )
    }

    executeStatement = async (stmt: SQLString, variables: {[key:string]: any}, executionOptions: ExecutionOptions): Promise<any> => {

        const sql = stmt.toString()
        if(executionOptions?.onSqlRun) {
            executionOptions.onSqlRun(sql)
        }
        // console.log('sql', sql)
        let KnexStmt = this.orm.getKnexInstance().raw(sql, variables)
        if (executionOptions?.trx) {
            KnexStmt.transacting(executionOptions.trx)
        }
        let result = null
        try{
            // console.time('execute-stmt')
            result = await KnexStmt
            // console.timeEnd('execute-stmt')
        }catch(error){
            throw error
        }
        
        return result
    }

    dataset = (): Dataset<any> => {
        return new Dataset(this)
    }
    scalar<D extends PropertyType<any>>(sql: string, args?: any[], definition?: D | (new (...args: any[]) => D) ): Scalar<D, any>;
    //@ts-ignore
    scalar<D extends PropertyType<any>, Value extends RawUnit>(value: Value, definition?: D | (new (...args: any[]) => D)): Scalar<D, Value>;
    //@ts-ignore
    scalar = (...args: any[]): Scalar<any> => {
        
        if(typeof args[0] ==='string' && Array.isArray(args[1])){
            return new Scalar({sql: args[0], args: args[1]}, args[2], this)
        }
        return new Scalar(args[0], args[1], this)
    }

    raw = (sql: any, args?: any[]) => {
        let r = this.orm.getKnexInstance().raw(sql, args ?? [])
        // @ts-ignore
        r.then = 'It is overridden. \'Then\' function is removed to prevent execution when it is passing across any async function(s).'
        return r
    }

    get op(): SQLKeywords<{}, any> {
        let f = makeExpressionResolver<{}, any>(this.op)
        return constructSqlKeywords(f)
    }
    
    update = () => {
        return new UpdateStatement(this)
    }
   
    del = () => {
        return new DeleteStatement(this)
    }

    insert = <T extends TableSchema<any>>(into: T): InsertStatement<T> => {
        return new InsertStatement(into, this)
    }

    client = (): string => this.orm.ormConfig.knexConfig.client.toString()

    async startTransaction<T>(func: (trx: Knex.Transaction) => Promise<T> | T, existingTrx?: Knex.Transaction | null): Promise<T> {
        let knex = this.orm.getKnexInstance()
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
export type DBAction<I> = (executionOptions: ExecutionOptions, options: Partial<DBActionOptions>) => Promise<DBActionResult<I>>

export type DBMutationAction<I, S extends Schema<any>> = (executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>) => Promise<DBActionResult<I>>


export class DBActionRunnerBase<I> implements PromiseLike<ExpandRecursively<I> >{
    protected context: DatabaseContext<any>
    protected execOptions: ExecutionOptions
    protected action: DBAction<I>
    protected options: Partial<DBActionOptions> = {}
    // private trx?: Knex.Transaction | null
    protected sqlRunCallback?: ((sql: string) => void) | null

    constructor(context: DatabaseContext<any>, action: DBAction<I>, ){
        // this.beforeAction = beforeAction
        this.context = context
        this.execOptions = {}
        this.action = action
    }

    protected async execAction(execOptions?: ExecutionOptions){
        return await this.action.call(this, execOptions ?? this.execOptions, this.options)
    }

    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: ExpandRecursively<I>) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            let result = await this.execAction() 
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
        let result = await this.execAction()
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

export class DBQueryRunner<I, isFullCount> extends DBActionRunnerBase<I> {

    protected parent: DBQueryRunner<any, any> | null = null
    protected isFullCount: boolean = false
    protected fullCountResult: number | null = null

    constructor(context: DatabaseContext<any>, action: DBAction<I>, 
        args?: {
            parent?: DBQueryRunner<any, any>
            isFullCount?: boolean
        }
        ){
        super(context, action)
        this.parent = args?.parent ?? null
        this.isFullCount = this.isFullCount
    }

    get ancestor(): DBQueryRunner<any, any>{
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
        
        let m = new DBQueryRunner<NewI, isFullCount>(
            this.context,
            async function(this: DBQueryRunner<NewI, isFullCount>, executionOptions: ExecutionOptions, options: Partial<DBActionOptions>){
                
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    let result = await this.ancestor.action.call(this, executionOptions, options)
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
        
        let m = new DBQueryRunner<NewI, isFullCount>(
            this.context,
            async function(this: DBQueryRunner<NewI, isFullCount>, executionOptions: ExecutionOptions, options: Partial<DBActionOptions>){
                
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    let result = await this.ancestor.action.call(this, executionOptions, options)
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

    withFullCount(){
        type NewI = {
            result: I,
            fullCount: isFullCount extends true? number: never,
        }
        let m = new DBQueryRunner<NewI, isFullCount>(
            this.context,
            async function(this: DBQueryRunner<NewI, isFullCount>,
                executionOptions: ExecutionOptions, options: Partial<DBActionOptions>) {
                const result = await this.ancestor.action.call(this, executionOptions, options)
                return {
                    result,
                    fullCount: this.fullCountResult
                } as NewI
            }, {
                parent: this,
                isFullCount: true
            })

        return m
    }
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
        let target: DBMutationRunner<any, any, any, any, any, any> | null = this
        while( target && !target.preflightFunctionArg) {
            target = target.parent
        }

        return target?.preflightFunctionArg ?? null
    }

    get latestQueryAffectedFunctionArg(): null | ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<Dataset<any>> | Dataset<any>){
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


    getAffected<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(
        onQuery?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ))
    : DBMutationRunner< ExtractValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true> {
        
        return new DBMutationRunner<ExtractValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner<ExtractValueTypeDictFromDataset<D>[], S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>, 
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                await this.ancestor.action.call(this, executionOptions, options)
                return this.affectedResult as ExtractValueTypeDictFromDataset<D>[]
            }, {
                parent: this,
                queryAffectedFunctionArg: onQuery ?? ((dataset: any) => dataset)
            })
    }

    getAffectedOne<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(onQuery?: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D )
    : DBMutationRunner< ExtractValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true> {
        
        return new DBMutationRunner< ExtractValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner< ExtractValueTypeDictFromDataset<D>, S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>, 
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                    
                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    await this.ancestor.action.call(this, executionOptions, options)
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
                queryAffectedFunctionArg: onQuery ?? ((dataset: any) => dataset)
            })
    }

    withAffected<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(onQuery?: (dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ){
        type NewI = {
            result: I,
            preflight: isPreflight extends true? PreflightRecordType: never,
            affected: ExtractValueTypeDictFromDataset<D>[] 
        }
        let m = new DBMutationRunner<NewI, S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>(
            this.context,
            async function(this: DBMutationRunner<NewI, S, PreflightRecordType, ExtractValueTypeDictFromDataset<D>[], isPreflight, true>,
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>) {
                const result = await this.ancestor.action.call(this, executionOptions, options)
                return {
                    result,
                    preflight: this.preflightResult,
                    affected: this.affectedResult
                } as NewI
            }, {
                parent: this,
                queryAffectedFunctionArg: onQuery ?? ((dataset: any) => dataset)
            })

        return m
    }

    getPreflight<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(
        onQuery?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ))
    : DBMutationRunner< ExtractValueTypeDictFromDataset<D>[], S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected> {
        
        return new DBMutationRunner<ExtractValueTypeDictFromDataset<D>[], S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<ExtractValueTypeDictFromDataset<D>[], S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>, 
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                await this.ancestor.action.call(this, executionOptions, options)
                return this.preflightResult as ExtractValueTypeDictFromDataset<D>[]
            }, {
                parent: this,
                preflightFunctionArg : onQuery ?? ((dataset: any) => dataset)
            })
    }

    getPreflightOne<D extends Dataset<Schema<any>> = Dataset<ExtractSchemaFieldOnlyFromSchema<S>> >(
        onQuery?: ((dataset: Dataset<ExtractSchemaFieldOnlyFromSchema<S>>) => Promise<D> | D ))
    : DBMutationRunner< ExtractValueTypeDictFromDataset<D>, S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected> {
        
        return new DBMutationRunner<ExtractValueTypeDictFromDataset<D>, S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<ExtractValueTypeDictFromDataset<D>, S, ExtractValueTypeDictFromDataset<D>[], AffectedRecordType, true, isAffected>, 
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){

                return await this.context.startTransaction( async (trx)=> {
                    executionOptions = {...executionOptions, trx}
                    await this.ancestor.action.call(this, executionOptions, options)
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
            preflight: ExtractValueTypeDictFromDataset<D>,
            affected: isAffected extends true? AffectedRecordType: never,
        }
        let m = new DBMutationRunner<NewI, S, ExtractValueTypeDictFromDataset<D>, AffectedRecordType, true, isAffected>(
            this.context,
            async function(this: DBMutationRunner<NewI, S, ExtractValueTypeDictFromDataset<D>, AffectedRecordType, true, isAffected>, 
                executionOptions: MutationExecutionOptions<S>, options: Partial<DBActionOptions>){
                const result = await this.ancestor.action.call(this, executionOptions, options)
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

export function constructSqlKeywords<X, Y>(resolver: ExpressionResolver<X, Y>) {
    let sqlkeywords: SQLKeywords<X, Y> = {
        And: (...conditions: Expression<X, Y>[]) => new AndOperator(resolver, ...conditions).toScalar(),
        Or: (...conditions: Expression<X, Y>[]) => new OrOperator(resolver, ...conditions).toScalar(),
        Not: (condition: Expression<X, Y>) => new NotOperator(resolver, condition).toScalar(),
        Exists: (dataset: Dataset<any, any, any>) => new ExistsOperator(resolver, dataset).toScalar()
    }
    return sqlkeywords
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
