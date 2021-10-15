import knex, { Knex } from 'knex'
import * as fs from 'fs'
export { PropertyTypeDefinition as PropertyDefinition, FieldPropertyTypeDefinition as FieldPropertyDefinition }
import { ArrayType, ComputePropertyTypeDefinition, FieldPropertyTypeDefinition, ObjectType, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringNotNullType } from './PropertyType'
import {Dataset, Datasource, TableDatasource, Scalarable, Scalar, Column, TableOptions, Expression, AddPrefix, ExpressionFunc, MutationEntityPropertyKeyValues} from './Builder'

import { Expand, expandRecursively, ExpandRecursively, ExtractComputeProps, ExtractFieldProps, ExtractProps, isFunction, makeid, notEmpty, quote, ScalarMapToKeyValueMap, SimpleObject, SQLString, thenResult, UnionToIntersection } from './util'
import { ModelRepository } from './Model'


// type ComputeFunction_PropertyTypeDefinition<C extends ComputeFunction<any, any, any>> = (C extends ComputeFunction<infer ARG, infer P> ? P: any) & (new (...args: any[]) => any) & typeof PropertyTypeDefinition
// type FindSchema<F extends SingleSourceArg<any>> = F extends SingleSourceArg<infer S>?S:never


// type VirtualSchemaWithComputed<F extends SingleSourceArg<any>> = EntityFieldPropertyKeyValues< FindSchema<F> > 
//     & { 
//         [k in keyof F["select"]]: 
//             (
//                 (FindSchema<F>[k] extends ComputeProperty<infer P, any, any, any>? 
//                 P:
//                 FindSchema<F>[k] extends FieldProperty<infer P>?
//                 P:never) extends PropertyTypeDefinition<infer T> ? ExpectedInstance<>
//             ) 

// }


export type QueryOrderBy = ( (string| Column<any, any> ) | {column: (string|Column<any, any>), order: 'asc' | 'desc'} )[]

export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any>
} | SelectableProps<E>[]


export type ComputePropertyArgsMap<E> = {
    [key in keyof ExtractComputeProps<E> & string ]:
            E[key] extends undefined?
            never:
            (
                E[key] extends ComputeProperty<ComputeFunction<infer Arg, any>>?
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

// export type SingleSourceArgFunction<S extends TableSchema> = (root: SelectorMap< S>) => SingleSourceArg<S>


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
            
        ExtractProps<E>[key] extends ComputeProperty<ComputeFunction<infer Arg, infer P>>? 
            CompiledComputeFunction<key, Arg, P>              
        : 
            ExtractProps<E>[key] extends FieldProperty<infer D>? 
            Column<key, D>:
            ExtractProps<E>[key] extends ScalarProperty<infer D>?
            Column<key, D>:
            never    
}

export type ComputeFunction<ARG, 
    P extends PropertyTypeDefinition<any>
> = (source: Datasource<any, any>, arg?: ARG) => Scalarable<P> | Promise<Scalarable<P>>

export type CompiledComputeFunction<Name extends string, ARG, R extends PropertyTypeDefinition<any> > = (args?: ARG) => Column<Name, R>

export type PartialMutationEntityPropertyKeyValues<S> = Partial<MutationEntityPropertyKeyValues<ExtractFieldProps<S>>>

export type EntityFieldPropertyKeyValues<E> = {
    [key in keyof ExtractFieldProps<E>]:
        ExtractFieldProps<E>[key] extends FieldProperty<FieldPropertyTypeDefinition<infer Primitive>>? Primitive : never
}

export type EntityPropertyKeyValues<E> = {
    [key in keyof E]:
        E[key] extends FieldProperty<FieldPropertyTypeDefinition<infer Primitive>>? Primitive:
                (
                    E[key] extends ComputeProperty<ComputeFunction<any, PropertyTypeDefinition<infer X>>>? X: 
                                (
                            E[key] extends ScalarProperty<PropertyTypeDefinition<infer Primitive>>? Primitive:
                            E[key]
                        )
                )                  
}

type SelectiveArg = {select?:{}}
type SelectiveArgFunction = ((root: SelectorMap<any>) => SelectiveArg )

type ExtractSchemaFromSelectiveComputeProperty<T> = T extends ComputeProperty<ComputeFunction<((root: SelectorMap<infer S>) => { select?: {}}), any>>? S: never
type ExtractValueTypeFromComputeProperty<T> = T extends ComputeProperty<ComputeFunction<any, PropertyTypeDefinition<infer D>>>? D : never
    
type EntityPropertyKeyValues_ExtractFieldProps<S> = EntityPropertyKeyValues< ExtractFieldProps<S>> 

type CheckA<SSA, S> = SSA extends SelectiveArgFunction? 
                EntityWithOptionalProperty< ExtractSchemaFromSelectiveComputeProperty<S>, ReturnType<SSA>>
                :  (
                    SSA extends SelectiveArg?
                    EntityWithOptionalProperty< ExtractSchemaFromSelectiveComputeProperty<S>, SSA>
                    : 
                    ExtractValueTypeFromComputeProperty< S>
                )

export type EntityWithOptionalProperty<S, SSA extends { select?: {}} > = ( 
    EntityPropertyKeyValues_ExtractFieldProps<S>
    & {
        [k in keyof SSA["select"]]: CheckA<SSA["select"][k], S[k]>
    })
    
export type ORMConfig<ModelMap extends {[key:string]: typeof TableSchema}> = {
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
    enableUuid: boolean
    uuidPropName: string
}

export abstract class Property {
    #name?: string
    // #definitionConstructor: D | (new () => D ) | (() => D)
    // #definition: D | null = null

    constructor(
        // definition: D | (new () => D ) | (() => D)
    ){
        // this.#definitionConstructor = definition
    }

    register(
        name: string){
            if( /[\.`' ]/.test(name) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "'" or startsWith/endsWith '_'.`)
            }
            this.#name = name
            
        }

    // get definition(): D{

    //     if(!this.#definition){
    //         let definition: D | null = null
    //         if(this.#definitionConstructor instanceof PropertyTypeDefinition){
    //             definition = this.#definitionConstructor
    //         } else if( isFunction(this.#definitionConstructor) ){
    //             definition = (this.#definitionConstructor as () => D)()
    //         } else if(this.#definitionConstructor instanceof Function){
    //             const c = (this.#definitionConstructor as (new () => D ))
    //             definition = new c()
    //         }
    
    //         if(definition instanceof PropertyTypeDefinition){
    //             this.#definition = definition
    //         }
    //         else throw new Error('Invalid parameters')
    //     }

    //     return this.#definition
    // }

    get name(){
        if(!this.#name){
            throw new Error('Property not yet registered')
        }
        return this.#name
    }

}

export class StrictTypeProperty<D extends PropertyTypeDefinition<any>> extends Property {
    #definitionConstructor: D | (new () => D ) | (() => D)
    #definition: D | null = null

     constructor(
        definition: D | (new () => D ) | (() => D)){
            super()
            this.#definitionConstructor = definition
        }

    get definition(): D{

        if(!this.#definition){
            let definition: D | null = null
            if(this.#definitionConstructor instanceof PropertyTypeDefinition){
                definition = this.#definitionConstructor
            } else if( isFunction(this.#definitionConstructor) ){
                definition = (this.#definitionConstructor as () => D)()
            } else if(this.#definitionConstructor instanceof Function){
                const c = (this.#definitionConstructor as (new () => D ))
                definition = new c()
            }
    
            if(definition instanceof PropertyTypeDefinition){
                this.#definition = definition
            }
            else throw new Error('Invalid parameters')
        }

        return this.#definition
    }
}

export class ComputeProperty<F extends ComputeFunction<any, any> > extends Property {

    // type: 'ComputeProperty' = 'ComputeProperty'
    compute: F

    constructor(
        // definition: (F extends ComputeFunction<any, infer P>?P:never) |
        // (new () => (F extends ComputeFunction<any, infer P>?P:never)) |
        // ( () => (F extends ComputeFunction<any, infer P>?P:never))
        // ,
        compute:  F){
            super()
            this.compute = compute
        }
}

export class FieldProperty<D extends FieldPropertyTypeDefinition<any>> extends StrictTypeProperty<D> {

    // type: 'FieldProperty' = 'FieldProperty'
    private _fieldName?: string


    constructor(
        definition: D | (new () => D ) | (() => D)){
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

export class ScalarProperty<D extends PropertyTypeDefinition<any>> extends Property {
    readonly scalar: Scalar<D>

    constructor(
        scalar: Scalar<D>){
            super()
            this.scalar = scalar
        }
}

export class Schema implements ParsableTrait<any>{

    // properties: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)[] = []
    // propertiesMap: {[key:string]: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)} = {}

    // properties: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> )[] = []
    // propertiesMap: {[key:string]: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> )} = {}
    
    properties: (Property)[] = []
    propertiesMap: {[key:string]: Property} = {}

    constructor(){
    }

    register(){
        for (let field in this) {
            // console.log('register field', field)
            this.addField(field)
        }
        let z = Object.getOwnPropertyDescriptors(this.constructor.prototype)
        for (let field in z) {
            // console.log('register field', field)
            this.addField(field)
        }
    }

    // initPostAction() {
    //     //@ts-ignore
    //     let z = Object.getOwnPropertyDescriptors(this.constructor.prototype)
    //     // for(let x in z){console.log('=>', x)}
    //     for (let field in z) {
    //         this.addField(field)
    //     }
    // }

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

    parseRaw(rawValue: any, context: DatabaseContext<any, any>, prop?: string): any {
        return this.parseDataBySchema(rawValue, context)
    }
    parseProperty(propertyvalue: any, context: DatabaseContext<any, any>, prop?: string) {
        return propertyvalue
    }

    parseDataBySchema(row: any, context: DatabaseContext<any,any>) {
        const schema = this
        let output = {}
        for (const propName in row) {
            const p = schema.propertiesMap[propName]
            if(p){
                if( p instanceof ScalarProperty){

                    const propType = p.scalar.definitionForParsing()
                    /**
                     * it can be boolean, string, number, Object, Array of Object (class)
                     * Depends on the props..
                     */
                    // let start = null
                    // if(metaInfo.propName === 'products'){
                    //     start = new Date()
                    // }
                    let propValue = propType.parseRaw(row[propName], context, propName) ?? row[propName]
                    
                    // if(metaInfo.propName === 'products'){
                    //     //@ts-ignore
                    //     console.log('parseDataBySchema',  new Date() - start )
                    // }
        
                    Object.defineProperty(output, propName, {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: propValue
                    })
                }
            }
        }

        // entityInstance = Object.keys(row).reduce((entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
        // }, entityInstance)
        
        return output
    }

}

// export class ParsableSchema<SelectedScalars extends {[key:string]: Scalar<any>}> extends Schema implements ParsableTrait< ScalarMapToKeyValueMap<SelectedScalars> >{

//     override register(){
//         super.register()
//         if(!this.properties.every(p => p instanceof ScalarProperty )){
//             throw new Error('ParsableSchema only accept all FieldProperty')
//         }
//     }

// }

export abstract class TableSchema extends Schema {

    #entityName: string
    #repository: ModelRepository<any>
    abstract id: FieldProperty<PrimaryKeyType>
    uuid?: FieldProperty<StringNotNullType> = undefined
    hooks: Hook[] = []
    // entityClass?: E
    overridedTableName?: string

    constructor(repository: ModelRepository<any>, entityName: string){
        super()
        this.#repository = repository
        this.#entityName = entityName
    }

    get modelName(){
        return this.#entityName
    }

    tableName(options?: TableOptions){
        if(this.overridedTableName){
            return this.overridedTableName
        } else {
            let name = this.#entityName
            
            if( this.#repository.orm.ormConfig.entityNameToTableName) {
                name = this.#repository.orm.ormConfig.entityNameToTableName(name)
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

    createTableStmt(context: DatabaseContext<any, any>, options?: TableOptions){
  
        const client = context.client()
        const tableName = this.tableName(options)

        let props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty<FieldPropertyTypeDefinition<any>>[]
        
        return `CREATE TABLE IF NOT EXISTS ${quote(client, tableName)} (\n${
            props.map( prop => {
                let f = prop.definition
                if(f instanceof FieldPropertyTypeDefinition){
                    return `${f.create(prop.name, prop.fieldName(this.#repository.orm), context)}`  
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

    compute<F extends ComputeFunction<any, any>>(
        // definition: 
        //     (new () => (F extends ComputeFunction<any, infer P>?P:never) ) |
        //     (() => (F extends ComputeFunction<any, infer P>?P:never) ) |
        //      (F extends ComputeFunction<any, infer P>?P:never)
        //      , 
             compute: F) : ComputeProperty<F> {


        return new ComputeProperty(compute)

        // if( definition instanceof PropertyTypeDefinition ){
        //     const d = definition as (F extends ComputeFunction<any, infer P>?P:unknown)
        //     return new ComputeProperty(d, compute)
        // } else{
        //     const d = definition as (new (...args: any[]) => (F extends ComputeFunction<any, infer P>?P:unknown) )
        //     return new ComputeProperty(new d(), compute)
        // }
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

    // parseRaw<T extends TableSchema>(rawValue: any, context: DatabaseContext<any, any>, prop?: string): any {
    //     return super.parseRaw(rawValue, context) // this.parseDataBySchema(instance, repository, rawValue)
    // }
    
    // parseProperty<T extends TableSchema>(propertyvalue: any & EntityPropertyKeyValues<T>, context: DatabaseContext<any, any>, prop?: string) {
    //     return super.parseProperty(propertyvalue, context, prop)
    // }

    hasMany<ParentSchema extends TableSchema, RootSchema extends TableSchema>(
        this: ParentSchema,
        relatedSchemaClass: (new (...args: any[]) => RootSchema), 
        relatedBy: ((schema: RootSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>), 
        parentKey?: ((schema: ParentSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>)
        ) {

        let computeFn = <SSA extends SingleSourceArg<RootSchema>>(parent: Datasource<ParentSchema, any>, 
            args?: SSA | ((root: SelectorMap<RootSchema>) => SSA)
            ): Scalarable< ArrayType< EntityWithOptionalProperty<RootSchema, SSA>[] > > => {

            let dataset = new Dataset()

             let relatedSchemaFunc = () => this.#repository.context.findRegisteredSchema(relatedSchemaClass)
            let relatedSchema = relatedSchemaFunc()
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

            let r = newDataset.toScalar()
            return r as unknown as Scalarable< ArrayType< EntityWithOptionalProperty<RootSchema, SSA>[] > >
        }

        //() => new ArrayType(relatedSchemaFunc())
        return this.compute( computeFn )
    }

    belongsTo<ParentSchema extends TableSchema, RootSchema extends TableSchema>(
        this: ParentSchema,
        relatedSchemaClass: (new (...args: any[]) => RootSchema),
        parentKey: ((schema: ParentSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>),
        relatedBy?: ((schema: RootSchema) => FieldProperty<FieldPropertyTypeDefinition<any>>) 
        ) {

        let computeFn = <SSA extends SingleSourceArg<RootSchema>>(parent: Datasource<ParentSchema, any>, 
            args?: SSA | ((root: SelectorMap<RootSchema>) => SSA)
            ): Scalarable< ObjectType<
                EntityWithOptionalProperty<RootSchema, SSA>
            >> => {
            
            let dataset = new Dataset()
            let relatedSchemaFunc = () => this.#repository.context.findRegisteredSchema(relatedSchemaClass)
            let relatedSchema = relatedSchemaFunc()
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

            let r = newDataset.castToScalar(new ObjectType(newDataset.schema() ))
            return r as Scalarable< ObjectType<
                EntityWithOptionalProperty<RootSchema, SSA>
            >>
        }

        return this.compute( computeFn )
    }

}

export class ORM<ModelMap extends {[key:string]: typeof TableSchema}, ModelRepositoryMap extends {[key in keyof ModelMap]: ModelRepository< ModelMap[key] >}>{

    #globalKnexInstance: Knex | null = null
    #contextMap = new Map<string, DatabaseContext<ModelMap, ModelRepositoryMap>>()

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

    #ormConfig: ORMConfig<ModelMap>
    // @ts-ignore
    #registeredModels: ModelMap = {}

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

    private register(){
        //register models 
        if(this.#ormConfig.models){
            let models = this.#ormConfig.models
            Object.keys(models).forEach(key => {
                // @ts-ignore
                this.#registeredModels[key] = models[key]
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
                    this.#registeredModels[entityName] = entityClass.default
                }
            })
        }

        // Object.keys(this.#registeredModels).forEach(k => {
        //     this.#registeredModels[k].registerPostAction()
        // })
    }

    getContext(config?: Partial<DatabaseContextConfig>): DatabaseContext<ModelMap, ModelRepositoryMap> {
        //!!!important: lazy load, don't always return new object
        const key = JSON.stringify(config)
        let repo = this.#contextMap.get(key)
        if(!repo){
            repo = new DatabaseContext(this, this.#registeredModels, config)
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
    //     return this.getRepository().executeStatement(stmt, executionOptions)
    // }

    // async execute<S>(dataset: Dataset<S, any, any>, executionOptions: ExecutionOptions) {
    //     return this.getRepository().execute(dataset, executionOptions)
    // }
}

export type DatabaseContextConfig = {
} & TableOptions

//(ModelMap[key] extends Model<infer E>?E:never) 
export class DatabaseContext<ModelMap extends {[key:string]: typeof TableSchema}, ModelRepositoryMap extends {[key in keyof ModelMap]: ModelRepository<  ModelMap[key]>}> {
    #config: Partial<DatabaseContextConfig> | null = null
    readonly orm
    // private registeredEntities: EntityMap
    public models: ModelRepositoryMap
    #modelClassMap: ModelMap
    
    constructor(orm: ORM<ModelMap, ModelRepositoryMap>, modelClassMap: ModelMap, config?: Partial<DatabaseContextConfig> ){
        this.orm = orm
        this.#config = config ?? {}
        this.#modelClassMap = modelClassMap

        this.models = Object.keys(modelClassMap).reduce( (acc, key) => {
            let modelClass = modelClassMap[key]
            acc[key] = new ModelRepository(orm,this, modelClass, key)
            return acc
        }, {} as {[key:string]: ModelRepository<any>}) as ModelRepositoryMap
    }

    get config(){
        return this.#config
    }

    get tablePrefix(){
        return this.#config?.tablePrefix ?? ''
    }

    findRegisteredSchema = <T extends typeof TableSchema>(modelClass: T): InstanceType<T> => {
        let foundKey = Object.keys(this.#modelClassMap).find(key => this.#modelClassMap[key] === modelClass)
        if(!foundKey){
            throw new Error('Cannot find model')
        }
        return this.models[foundKey].modelClass as unknown as InstanceType<T>
    }

    schemaSqls = () => {
        let m = this.models
        let sqls = Object.keys(m).map(k => m[k].modelClass).map(s => s.createTableStmt(this, { tablePrefix: this.tablePrefix})).filter(t => t)
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

    execute = async <S extends {[key:string]: Scalar<any>}>(dataset: Dataset<S, any, any>, executionOptions?: ExecutionOptions): Promise< 
        ExpandRecursively< Array<ScalarMapToKeyValueMap<S>>>
    > =>
     {
        // console.time('construct-sql')
        const nativeSql = await dataset.toNativeBuilder(this)
        // console.timeEnd('construct-sql')
        // console.log('nativeSql', nativeSql.toString())
        let data = await this.executeStatement(nativeSql, executionOptions)
        console.log('data', data)
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
        } else if(Array.isArray(rows)){
    
            // console.time('parsing')
            const context = this
            const len = rows.length
            let parsedRows = new Array(len) as ScalarMapToKeyValueMap<S>[]
            const schema = dataset.schema()
            // console.log(schema)
            for(let i=0; i <len;i++){
                parsedRows[i] = schema.parseRaw(rows[i], context)
            }
        
            // console.timeEnd('parsing')
            // console.log('parsed', parsedRows)
            return expandRecursively(parsedRows)
        }
        return rows
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

export class DatabaseActionRunnerBase<I, S extends TableSchema> implements PromiseLike<ExpandRecursively<I> >{
    protected execOptions: ExecutionOptions
    protected action: DatabaseAction<I, S>
    protected options: Partial<DatabaseActionOptions<S> > = {}
    // private trx?: Knex.Transaction | null
    protected sqlRunCallback?: ((sql: string) => void) | null

    constructor(action: DatabaseAction<I, S>, ){
        // this.beforeAction = beforeAction
        this.execOptions = {}
        this.action = action
    }

    protected async execAction(){
        return await this.action(this.execOptions, this.options)
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

export type HookAction = <T>(context: DatabaseContext<any, any>, rootValue: T, info: HookInfo, executionOptions: ExecutionOptions) => T | Promise<T>



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
