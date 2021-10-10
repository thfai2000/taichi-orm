import knex, { Knex } from 'knex'
import * as fs from 'fs'
export { PropertyTypeDefinition as PropertyDefinition, FieldPropertyTypeDefinition as FieldPropertyDefinition }
import { ArrayType, ComputePropertyTypeDefinition, FieldPropertyTypeDefinition, ObjectType, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringNotNullType } from './PropertyType'
import {Dataset, Datasource, TableDatasource, Scalarable, Scalar, Column, TableOptions, resolveEntityProps, Expression, AddPrefix, ExpressionFunc, MutationEntityPropertyKeyValues} from './Builder'

import { ExtractComputeProps, ExtractFieldProps, ExtractProps, makeid, notEmpty, quote, SimpleObject, SQLString, thenResult, UnionToIntersection } from './util'
import { Model } from './Model'

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
    select?: Partial<ComputePropertyArgsMap<S>>,
    where?: Expression< 
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



export type SelectorMap<E> = {
    [key in keyof ExtractProps<E> & string ]:
            E[key] extends undefined?
            never:
            (
                E[key] extends ComputeProperty<infer D, infer Root, infer rootName, infer Arg>? 
                (
                        CompiledComputeFunction<key, Arg, D>                    
                ): 
                    E[key] extends Property<infer D>? 
                    Column<key, D>:
                    never
            )
}

export type ComputeFunction<
    Root extends Schema, Name extends string, ARG extends any, 
    R extends PropertyTypeDefinition<any>
> = (source: Datasource<Root, Name>, arg?: ARG) => Scalarable<R> | Promise<Scalarable<R>>

export type CompiledComputeFunction<Name extends string, ARG extends any, R extends PropertyTypeDefinition<any> > = (args?: ARG) => Column<Name, R>

export type PartialMutationEntityPropertyKeyValues<S> = Partial<MutationEntityPropertyKeyValues<ExtractFieldProps<S>>>


export type ORMConfig<EntityMap extends {[key:string]: Entity}> = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    // types: { [key: string]: typeof PropertyDefinition },
    models: EntityMap
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
    enableUuid: boolean
    uuidPropName: string
}

export class Property<D extends PropertyTypeDefinition<any> > {
    // private repository?: EntityRepository<any>
    private _name?: string
    readonly definition: D
    // private schema?: Schema

    constructor(definition: D){
        this.definition = definition
    }
    register(
        name: string){
            if( /[\.`' ]/.test(name) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "'" or startsWith/endsWith '_'.`)
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

export class ComputeProperty<D extends PropertyTypeDefinition<any>, Root extends Schema, Name extends string, Arg extends any | undefined> extends Property<D> {

    // type: 'ComputeProperty' = 'ComputeProperty'
    compute: ComputeFunction<Root, Name, Arg, D>

    constructor(
        definition: D,
        compute:  ComputeFunction<Root, Name, Arg, D>){
            super(definition)
            this.compute = compute
        }
}
export class FieldProperty<D extends FieldPropertyTypeDefinition<any>> extends Property<D> {

    // type: 'FieldProperty' = 'FieldProperty'
    private _fieldName?: string

    constructor(
        definition: D){
            super(definition)
        }

    convertFieldName(propName: string, orm: ORM<any, any>){
        const c = orm.ormConfig.propNameTofieldName
        return c? c(propName) : propName
    }

    fieldName(orm: ORM<any, any>){
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

export class Schema implements ParsableTrait<any>{

    properties: (ComputeProperty<PropertyTypeDefinition<any>, Schema, string, any> 
        | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)[] = []
    propertiesMap: {[key:string]: (ComputeProperty<PropertyTypeDefinition<any>, Schema, string, any> 
        | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)} = {}
    
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
        if (actual instanceof Property) {
            actual.register(field)
            this.propertiesMap[field] = actual
            this.properties.push(actual)
        }
    }


    parseDataBySchema<T>(entityInstance: T, repository: DatabaseRepository<any,any>, row: PartialMutationEntityPropertyKeyValues<any>): T {
        const schema = this
        for (const propName in row) {
            const propType = schema.propertiesMap[propName].definition
            
            /**
             * it can be boolean, string, number, Object, Array of Object (class)
             * Depends on the props..
             */
            // let start = null
            // if(metaInfo.propName === 'products'){
            //     start = new Date()
            // }
            let propValue = propType.parseRaw(row[propName], repository, propName) ?? row[propName]
            
            // if(metaInfo.propName === 'products'){
            //     //@ts-ignore
            //     console.log('parseDataBySchema',  new Date() - start )
            // }

            Object.defineProperty(entityInstance, propName, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: propValue
            })
        }

        // entityInstance = Object.keys(row).reduce((entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
        // }, entityInstance)
        
        return entityInstance
    }

    parseRaw(rawValue: any, repository: DatabaseRepository<any, any>, prop?: string): any {
        return this.parseDataBySchema({}, repository, rawValue)
    }
    parseProperty(propertyvalue: any, repository: DatabaseRepository<any, any>, prop?: string) {
        return propertyvalue
    }
}

export class Entity {

    // static repository: EntityRepository<any> | null = null;
    static orm?: ORM<any, any>
    static entityName?: string

    [key: string]: any
    // static registeredSchema: TableSchema
    static schema: TableSchema

    constructor(){
    }

    static register(orm: ORM<any, any>, entityName: string) {
        this.orm = orm
        this.entityName = entityName
        if(!this.schema){
            throw new Error(`There is no schema for Entity ${entityName}`)
        }
        let s = this.schema
        s.initAndRegister(this)
        this.schema = s 
    }

    static registerPostAction() {
        this.schema.registerPostAction()
    }

}

export abstract class TableSchema<E extends typeof Entity = typeof Entity> extends Schema implements ParsableTrait<InstanceType<E>>{

    abstract id: FieldProperty<PrimaryKeyType>
    uuid?: FieldProperty<StringNotNullType> = undefined
    hooks: Hook[] = []
    entityClass?: E
    overridedTableName?: string

    constructor(){
        super()
    }

    initAndRegister(entityClass: E){
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

    createTableStmt(repository: DatabaseRepository<any, any>, options?: TableOptions){
        // console.log('xxxx', this.entityClass)
        if(!this.entityClass || !this.entityClass.orm){
            throw new Error('Not register yet')
        }
        const orm = this.entityClass.orm
        const client = repository.client()
        const tableName = this.tableName(options)
        if(!tableName){
            throw new Error('Not yet registered')
        }
        let props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty<FieldPropertyTypeDefinition<any>>[]
        
        return `CREATE TABLE IF NOT EXISTS ${quote(client, tableName)} (\n${
            props.map( prop => {
                let f = prop.definition
                if(f instanceof FieldPropertyTypeDefinition){
                    return `${f.create(prop.name, prop.fieldName(orm), repository)}`  
                }
                return ``
            }).flat().join(',\n')}\n)`;
    }

    field<D extends FieldPropertyTypeDefinition<any> >(definition: (new (...args: any[]) => D) | D  ) {

        if(definition instanceof FieldPropertyTypeDefinition){
            return new FieldProperty<D>(definition)
        }
        return new FieldProperty<D>( new definition() )
    }

    compute<D extends PropertyTypeDefinition<any>, Root extends TableSchema, Arg extends any, R>(
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

    override parseRaw(rawValue: any, repository: DatabaseRepository<any, any>, prop?: string): InstanceType<E> {
        const schema = this
        const entityClass = this.entityClass
        if(!entityClass){
            throw new Error('Unexpected. Schema not registered.')
        }
        const instance = new entityClass() as InstanceType<E>
        return this.parseDataBySchema( instance, repository, rawValue)
    }
    
    override parseProperty(propertyvalue: InstanceType<E>, repository: DatabaseRepository<any, any>, prop?: string) {
        return propertyvalue
    }

    hasMany<ParentSchema extends TableSchema, RootSchema extends TableSchema>(
        this: ParentSchema,
        relatedSchema: RootSchema, 
        relatedBy: ((schema: RootSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>), 
        parentKey?: ((schema: ParentSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>)
        ) {
        
        let computeFn = (parent: Datasource<ParentSchema, any>, 
            args?: SingleSourceArg<RootSchema> | 
                SingleSourceArgFunction<RootSchema>
            ): Scalarable<any> => {

            let dataset = new Dataset()

            let relatedSource = relatedSchema.datasource('root')

            let parentColumn = (parentKey? parent.getFieldProperty( parentKey(parent.schema).name  ): undefined ) ?? parent.getFieldProperty("id")
            let relatedByColumn = relatedSource.getFieldProperty( relatedBy(relatedSource.schema).name  )
        
            let newDataset = dataset.from(relatedSource)

            let props = relatedSource.getAllFieldProperty().map(col => col.value() ).reduce( (acc,v) => Object.assign(acc, v), {})

            let resolvedArgs: SingleSourceArg<RootSchema> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }


            if(resolvedArgs?.select){
                let computed = resolvedArgs.select
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return relatedSource.getComputeProperty(key)(arg).value()
                }).reduce( (acc,v) => Object.assign(acc, v), {})

                dataset.select(Object.assign(props, computedValues))
            }else {
                dataset.select(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.where){
               filters.push( resolvedArgs.where as any )
            }
            newDataset.where( ({And}) => And(...filters) )

            return newDataset
        }

        return this.compute( new ArrayType(relatedSchema), computeFn )
    }

    belongsTo<ParentSchema extends TableSchema, RootSchema extends TableSchema>(
        this: ParentSchema,
        relatedSchema: RootSchema, 
        parentKey: ((schema: ParentSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>),
        relatedBy?: ((schema: RootSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>) 
        ) {
        
        let computeFn = (parent: Datasource<ParentSchema, any>, 
            args?: SingleSourceArg<RootSchema> | 
                SingleSourceArgFunction<RootSchema>
            ): Scalarable<any> => {
            
            let dataset = new Dataset()

            let relatedSource = relatedSchema.datasource('root')

            let relatedByColumn = (relatedBy? relatedSource.getFieldProperty( relatedBy(relatedSource.schema).name  ): undefined ) ?? relatedSource.getFieldProperty("id")
            let parentColumn = parent.getFieldProperty( parentKey(parent.schema).name  )
        
            let newDataset = dataset.from(relatedSource)

            let resolvedArgs: SingleSourceArg<RootSchema> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }

            let props = relatedSource.getAllFieldProperty().map(col => col.value() ).reduce( (acc,v) => Object.assign(acc, v), {})
            if(resolvedArgs?.select){
                let computed = resolvedArgs.select
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return relatedSource.getComputeProperty(key)(arg).value()
                }).reduce( (acc,v) => Object.assign(acc, v), {})

                dataset.select(Object.assign(props, computedValues))
            }else {
                dataset.select(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.where){
               filters.push( resolvedArgs.where as any )
            }
            newDataset.where( ({And}) => And(...filters) )

            return newDataset
        }

        return this.compute( new ObjectType(relatedSchema), computeFn )
    }

}

export class ORM<EntityMap extends {[key:string]: typeof Entity}, ModelMap extends {[key in keyof EntityMap]: Model<EntityMap[key]>}>{

    #globalKnexInstance: Knex | null = null
    #repositoryMap = new Map<string, DatabaseRepository<EntityMap, ModelMap>>()

    defaultORMConfig: ORMConfig<any> = {
        // primaryKeyName: 'id',
        enableUuid: false,
        // useSoftDeleteAsDefault: true,
        uuidPropName: 'uuid',
        // createModels: false,
        // types: {},
        models: {},
        knexConfig: {
            client: 'mysql' //default mysql
        }
    }

    #ormConfig: ORMConfig<EntityMap>
    // @ts-ignore
    #registeredModels: EntityMap = {}

    constructor(newConfig: Partial<ORMConfig<EntityMap>>){
        let newOrmConfig: ORMConfig<EntityMap> = Object.assign({}, this.defaultORMConfig, newConfig)
        // newOrmConfig.ormContext = Object.assign({}, defaultORMConfig.ormContext, newConfig.ormContext)
        this.#ormConfig = newOrmConfig
        this.register()
    }


    get ormConfig(){
        //TODO: deep copy
        return Object.assign({}, this.#ormConfig)
    }

    register(){
        const registerEntity = (entityName: string, entityClass: typeof Entity) => {
            entityClass.register(this, entityName)
            // @ts-ignore
            this.#registeredModels[entityName] = entityClass
        }
        
        //register models 
        if(this.#ormConfig.models){
            let models = this.#ormConfig.models
            Object.keys(models).forEach(key => {
                registerEntity(key, models[key]);
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
                    registerEntity(entityName, entityClass.default);
                }
            })
        }

        Object.keys(this.#registeredModels).forEach(k => {
            this.#registeredModels[k].registerPostAction()
        })
    }

    getRepository(config?: Partial<DatabaseRepositoryConfig>): DatabaseRepository<EntityMap, ModelMap> {
        //!!!important: lazy load, don't always return new object
        const key = JSON.stringify(config)
        let repo = this.#repositoryMap.get(key)
        if(!repo){
            repo = new DatabaseRepository(this, this.#registeredModels, config)
            this.#repositoryMap.set(key, repo)
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
    //     return this.getRepository().executeStatement(stmt, executionOptions)
    // }

    // async execute<S>(dataset: Dataset<S, any, any>, executionOptions: ExecutionOptions) {
    //     return this.getRepository().execute(dataset, executionOptions)
    // }
}

export type DatabaseRepositoryConfig = {
} & TableOptions

//(ModelMap[key] extends Model<infer E>?E:never) 
export class DatabaseRepository<EntityMap extends {[key:string]: typeof Entity}, ModelMap extends {[key in keyof EntityMap]: Model<EntityMap[key]>}> {
    private config: Partial<DatabaseRepositoryConfig> | null = null
    readonly orm
    private registeredEntities: EntityMap
    public models: ModelMap

    constructor(orm: ORM<EntityMap, ModelMap>, registeredEntities: EntityMap, config?: Partial<DatabaseRepositoryConfig> ){
        // this.name = name
        this.orm = orm
        this.config = config ?? {}
        this.registeredEntities = registeredEntities

        this.models = Object.keys(registeredEntities).reduce( (acc, key) => {
            acc[key] = new Model(registeredEntities[key], this)
            return acc
        }, {} as {[key:string]: Model<any>}) as ModelMap
    }

    get tablePrefix(){
        return this.config?.tablePrefix ?? ''
    }

    schemaSqls = () => {
        let m = this.models
        let sqls = Object.keys(m).map(k => m[k].entityClass().schema).map(s => s.createTableStmt(this, { tablePrefix: this.tablePrefix})).filter(t => t)
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

    executeStatement = async (stmt: SQLString, executionOptions?: ExecutionOptions): Promise<any> => {

        const sql = stmt.toString()
        if(executionOptions?.onSqlRun) {
            executionOptions.onSqlRun(sql)
        }
        // console.log('sql', sql)
        let KnexStmt = this.orm.getKnexInstance().raw(sql)
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

    dataset = <S extends Schema, SName extends string>() : Dataset<{},{},{},any> => 
        {
            return new Dataset(this)
        }

    execute = async <S, R extends {
        [key in keyof ExtractProps<S>]: 
        S[key] extends Property<PropertyTypeDefinition<infer D1>>? D1 : never
            // S[key] extends FieldProperty<FieldPropertyTypeDefinition<infer D1>>? D1 :
                // (S[key] extends ComputeProperty<FieldPropertyTypeDefinition<infer D2>, any, any, any>? D2: never)
    }>(dataset: Dataset<S, any, any>, executionOptions?: ExecutionOptions): Promise<R[]> =>
     {
        // console.time('construct-sql')
        const nativeSql = await dataset.toNativeBuilder(this)
        // console.timeEnd('construct-sql')
        // console.log('nativeSql', nativeSql.toString())
        let data = await this.executeStatement(nativeSql, executionOptions)
        // console.log('data', data)
        let rows: any
        if(this.client().startsWith('mysql')){
            rows = data[0][0]
        } else if(this.client().startsWith('sqlite')){
            rows = data
        } else if(this.client().startsWith('pg')){
            rows = data.rows[0]
        } else {
            throw new Error('Unsupport client.')
        }
        if(!dataset.hasSelectedItems()){
            return []
        } else {
            if(Array.isArray(rows)){
    
                // console.time('parsing')
                const repository = this
                const len = rows.length
                let parsedRows = new Array(len) as R[]
                const schema = dataset.schema()
                
                for(let i=0; i <len;i++){
                    parsedRows[i] = schema.parseRaw(rows[i], repository)
                }
            
                // console.timeEnd('parsing')
                // console.log('parsed', parsedRows)
                return parsedRows 
            }
            return rows
        }
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

export type DatabaseActionResult<T> = T

export type DatabaseActionOptions<T extends TableSchema> = {
    failIfNone: boolean
}
export type DatabaseAction<I, S extends TableSchema> = (executionOptions: ExecutionOptions, options: Partial<DatabaseActionOptions<S> >) => Promise<DatabaseActionResult<I>>

export class DatabaseActionRunnerBase<I, S extends TableSchema> implements PromiseLike<I>{
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
    propertyDefinition: PropertyTypeDefinition<any> | null,
    propertyValue: any | null,
    rootClassName: string
}

export type HookAction = <T>(repository: DatabaseRepository<any, any>, rootValue: T, info: HookInfo, executionOptions: ExecutionOptions) => T | Promise<T>



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
