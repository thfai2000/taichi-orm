import { Knex}  from "knex"
import { ComputePropertyArgsMap, TableSchema, SelectorMap, CompiledComputeFunction, FieldProperty, Schema, ComputeProperty, ExecutionOptions, EntityRepository, ORM, Entity, Property } from "."
import { AndOperator, ConditionOperator, ContainOperator, EqualOperator, IsNullOperator, NotOperator, OrOperator, AssertionOperator, ExistsOperator } from "./Operator"
import { BooleanType, BooleanTypeNotNull, ComputePropertyTypeDefinition, DateTimeType, FieldPropertyTypeDefinition, NumberType, ParsableFieldPropertyTypeDefinition, ParsableTrait, PropertyTypeDefinition, StringType, StringTypeNotNull } from "./PropertyType"
import { addBlanketIfNeeds, ExtractFieldProps, ExtractProps, makeid, metaFieldAlias, notEmpty, quote, SimpleObject, SimpleObjectClass, SQLString, thenResult, thenResultArray, UnionToIntersection } from "./util"

// type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn;

// type Dataset<TRecord = any, TResult = any> = {
//     [Property in keyof Knex.QueryBuilder<TRecord, TResult>]: 
//         Knex.QueryBuilder<TRecord, TResult>[Property] extends (...a: any) => Knex.QueryBuilder<TRecord, TResult> ? 
//             ReplaceReturnType< Knex.QueryBuilder<TRecord, TResult>[Property], Dataset> : ( Knex.QueryBuilder<TRecord, TResult>[Property] extends Knex.QueryBuilder<TRecord, TResult> ?  Dataset : Knex.QueryBuilder<TRecord, TResult>[Property]  )
// }

// declare module "knex" {
//     export namespace Knex {
//         interface QueryBuilder{
//             toRow(): Dataset<any, any, any>
//             // toRaw(): Knex.Raw
//             toQueryBuilder(): Knex.QueryBuilder
//         }

//         interface Raw {
//             clone: Function
//             __type: 'Raw' | 'Scalar' | 'FromClause' | 'Dataset'
//         }
//     }
// }

export type FieldPropertyValueMap<E> =  Partial<{
    [key in keyof E]:
        E[key] extends Prefixed<any, any, infer C>? (
                C extends FieldProperty<infer D>? (D extends PropertyTypeDefinition<infer Primitive>? Primitive: never): never
             ): E[key] extends FieldProperty<infer D>? (D extends PropertyTypeDefinition<infer Primitive>? Primitive: never): never
             
}>

export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => AndOperator<Props, PropMap>,
    Or: (...condition: Array<Expression<Props, PropMap> > ) => OrOperator<Props, PropMap>,
    Not: (condition: Expression<Props, PropMap>) => NotOperator<Props, PropMap>,
    Exists: (dataset: Dataset<any, any, any>) => ExistsOperator<Props, PropMap>
}

export type ExpressionFunc<O, M> = (map: UnionToIntersection< M | SQLKeywords<O, M> > ) => Expression<O, M>

export type Expression<O, M> = Partial<FieldPropertyValueMap<O>>  
    | AndOperator<O, M> 
    | OrOperator<O, M> 
    | NotOperator<O, M>
    | ExistsOperator<O, M>
    | Scalar<any> | Array<Expression<O, M> > | boolean | string | Date | number

export type Prefixed<Prefix extends string, MainName extends String, Content> = {
    type: 'Prefixed',
    prefix: Prefix,
    mainName: MainName,
    content: Content
}

export type AddPrefix<E, k extends string, delimitor extends string = '.'> = {
    [key in keyof E & string as `${k}${delimitor}${key}`]: Prefixed<k, key, E[key]>
}

type SelectItem = {
    value: any,
    actualAlias: string
}

export interface Scalarable<T extends PropertyTypeDefinition> {
    toScalar(type?: T): Scalar<T>
    // toRaw(repository: EntityRepository<any>): Promise<Knex.Raw> | Knex.Raw
}

export interface Datasource<E extends Schema, alias extends string> {
    sourceAlias: alias
    schema: E
    selectorMap(): SelectorMap<E>

    toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw>
    realSource(repository: EntityRepository<any>): SQLString | Promise<SQLString>
    
    // getProperty: <Name extends string, T extends PropertyTypeDefinition<any> >(name: Name) => Column<Name, T>
    getAllFieldProperty: <T extends PropertyTypeDefinition<any>>()  => Column<string, T>[]
    getFieldProperty: <Name extends string, T extends PropertyTypeDefinition<any> >(name: Name) => Column<Name, T>    
    getComputeProperty: <Name extends string, ARG extends any, R extends PropertyTypeDefinition<any>>(name: Name) => CompiledComputeFunction<Name, ARG, R>
    // getAysncComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunctionPromise<Name, ARG, R>
    // tableAlias: {
    //     [key in keyof [alias] as alias]: string 
    // }
}

export type TableOptions = {
    tablePrefix?: string
}

abstract class DatasourceBase<E extends Schema, Name extends string> implements Datasource<E, Name> {

    readonly schema: E
    readonly sourceAlias: Name
    readonly sourceAliasAndSalt: string

    constructor(schema: E, sourceAlias: Name){
        if( !Number.isInteger(sourceAlias.charAt(0)) && sourceAlias.charAt(0).toUpperCase() === sourceAlias.charAt(0) ){
            throw new Error('alias cannot start with Uppercase letter')
        }

        this.schema = schema
        this.sourceAlias = sourceAlias
        this.sourceAliasAndSalt = this.sourceAlias + '___' + makeid(5)
    }
    abstract realSource(repository: EntityRepository<any>): SQLString | Promise<SQLString>

    selectorMap(): SelectorMap<E>{
        const datasource = this
        //@ts-ignore
        const map = new Proxy( datasource, {
            get: (oTarget: typeof datasource, sKey: string) => {
                if(typeof sKey === 'string'){
                    let prop = oTarget.schema.propertiesMap[sKey]
                    if(prop instanceof FieldProperty){
                        return datasource.getFieldProperty(sKey)
                    }
                    if(prop instanceof ComputeProperty){
                        return datasource.getComputeProperty(sKey)
                    }
                    // if(prop instanceof Property){
                    //     return datasource.getProperty(sKey)
                    // }
                }

            }
        }) as SelectorMap<E>
        return map
    }

    // getProperty<Name extends string, T extends PropertyTypeDefinition<any>>(name: Name) : Column<Name, T> {
    //     let prop = this.schema.propertiesMap[name]
    //     if( !(prop instanceof Property)){
    //         throw new Error('it is not property')
    //     } else {
    //         const derivedProp = prop
    //         return new Column(name, derivedProp.definition, (entityRepository) => {
    //             const orm = entityRepository.orm
    //             const client = orm.client()
    //             let rawTxt = `${quote(client, this.sourceAlias)}.${quote(client, derivedProp.name)}`
    //             return makeRaw(entityRepository, rawTxt)
    //         })
    //     }
    // }

    getAllFieldProperty<T extends PropertyTypeDefinition<any>>(): Column<string, T>[] {
        return Object.keys(this.schema.propertiesMap)
        .map(key => (this.schema.propertiesMap[key] instanceof FieldProperty)? this.getFieldProperty(key) :null )
        .filter(notEmpty)
    }

    getFieldProperty<Name extends string, T extends PropertyTypeDefinition<any>>(name: Name): Column<Name, T> {
        let prop = this.schema.propertiesMap[name]
        if( !(prop instanceof FieldProperty)){
            throw new Error(`it is not field property ${name}`)
        } else {
            const fieldProp = prop
            return new Column(name, fieldProp.definition, (entityRepository) => {
                const orm = entityRepository.orm
                const client = orm.client()
                let rawTxt = `${quote(client, this.sourceAliasAndSalt)}.${quote(client, fieldProp.fieldName(orm))}`
                return makeRaw(entityRepository, rawTxt)
            })
        }
    }


    getComputeProperty<Name extends string, ARG extends any, R extends PropertyTypeDefinition<any>>(name: Name): CompiledComputeFunction<Name, ARG, R>{
        let prop = this.schema.propertiesMap[name]
        if( !(prop instanceof ComputeProperty)){
            throw new Error(`Not field property ${name}`)
        }else{
            const cProp = prop
            return (args?: ARG) => {
                return new Column(name, cProp.definition, (entityRepository) => {
                    const subquery: Scalarable<any> | Promise<Scalarable<any> > = cProp.compute.call(cProp, this, args)
                    return thenResult( subquery, scalarable => scalarable.toScalar(cProp.definition) )
                })
            }
        }
    }
    
    async toRaw(repository: EntityRepository<any>){
        const client = repository.orm.client()
        const sql = await this.realSource(repository)
        return makeRaw(repository, `${sql} AS ${quote(client, this.sourceAliasAndSalt)}`)
    }

}

export class TableDatasource<E extends TableSchema, Name extends string> extends DatasourceBase<E, Name> {

    readonly options?: TableOptions

    constructor(schema: E, sourceAlias: Name, options?: TableOptions){
        super(schema, sourceAlias)
        this.options = options
    }

    realSource(repository: EntityRepository<any>){
        const finalOptions = Object.assign({}, {tablePrefix: repository.tablePrefix}, this.options ?? {})

        let tableName = this.schema.tableName(finalOptions)
        if(!tableName){
            throw new Error('Not yet registered')
        }
        return quote(repository.orm.client(), tableName)
    }
}

export class DerivedDatasource<E extends Schema, Name extends string> extends DatasourceBase<E, Name> {

    readonly dataset: Dataset<any, any, any>
    constructor(dataset: Dataset<any, any, any>, sourceAlias: Name){
        super(dataset.schema(), sourceAlias)
        this.dataset = dataset
    }

    async realSource(repository: EntityRepository<any>){
        return `(${(await this.dataset.toNativeBuilder(repository))})`
    }
}

export class Dataset<SelectProps ={}, SourceProps ={}, SourcePropMap ={}> implements Scalarable<any> {
    // parsableType: ParsableTrait<any> | null = null
    __type: 'Dataset' = 'Dataset'
    __whereRawItem: null |  Expression<any, any> = null
    __selectItems: { [key: string]: Scalar<any> } = {}
    __fromItem: null | Datasource<Schema, string> = null
    __joinItems:  Array<{type: 'inner' | 'left' | 'right', source: Datasource<Schema, string>, expression: Expression<any, any> }> = []
    
    nativeBuilderCallbacks: ((nativeBuilder: Knex.QueryBuilder) => Promise<void> | void)[] = []

    constructor(fromSource: Datasource<Schema, string> | null = null){
        this.__fromItem = fromSource
    }

    toDataset(): Dataset<SelectProps, SourceProps, SourcePropMap> {
        return this
    }
    
    getSelectorMap(): SourcePropMap {
        let sources = this.__joinItems.map(item => item.source)
        if(this.__fromItem){
            sources.push(this.__fromItem)
        }

        const sourcePropMap = sources.reduce( (acc, source) => {
            const t = source.sourceAlias
            acc[t] = source.selectorMap()
            return acc
        }, {} as {[key:string]: SelectorMap<any> } )

        return sourcePropMap as unknown as SourcePropMap
    }

    selectItemsAlias(): string[]{
        return Object.keys(this.__selectItems).map(key => this.selectItemAlias(key, this.__selectItems[key]) )
    }

    async toNativeBuilder(repository: EntityRepository<any>): Promise<Knex.QueryBuilder> {
        let nativeQB = repository.orm.getKnexInstance().clearSelect()
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

        if(this.__fromItem){
            const from = await this.__fromItem.toRaw(repository)
            nativeQB.from(from)
        }


        let selectorMap = this.getSelectorMap()

        let resolver = makeExpressionResolver(this.__fromItem, this.__joinItems.map(item => item.source), selectorMap)
        
        Object.assign(selectorMap, this.sqlKeywords(resolver) )
        
        await this.__joinItems.reduce( async(acc, item) => {
            await acc
            let finalExpr = await resolver(item.expression).toRaw(repository)

            if(item.type === 'inner'){
                nativeQB.innerJoin( await item.source.toRaw(repository), finalExpr)
            } else if(item.type === 'left'){
                nativeQB.leftJoin( await item.source.toRaw(repository), finalExpr)
            } else if(item.type === 'right'){
                nativeQB.rightJoin( await item.source.toRaw(repository), finalExpr)
            }
            return true
        }, Promise.resolve(true))
        
        if(this.__whereRawItem){
            nativeQB.where( await resolver(this.__whereRawItem).toRaw(repository) )
        }
        if(this.__selectItems){
            const selectItems = await this.resolveSelectItems(this.__selectItems, repository)
            // console.log('aaaaaa', selectItems)
            nativeQB.select( selectItems )
        }
        await Promise.all(this.nativeBuilderCallbacks.map( async(callback) => {    
            await callback(nativeQB)
        }))
        
        return nativeQB
    }

    native(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<SelectProps, SourceProps, SourcePropMap>{
        this.nativeBuilderCallbacks = []
        this.addNative(nativeBuilderCallback)
        return this
    }
    
    addNative(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<SelectProps, SourceProps, SourcePropMap>{
        this.nativeBuilderCallbacks.push(nativeBuilderCallback)
        return this
    }

    toScalar<T extends PropertyTypeDefinition>(t: PropertyTypeDefinition): Scalar<T>{
        return new Scalar(t, this)
    }
    
    fields<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            UnionToIntersection<
            SelectProps |
            {
                [key in keyof SourceProps
                    as 
                    (
                        key extends P? (
                            SourceProps[key] extends Prefixed<infer prefix, infer N, infer C>?
                            N & string
                            : 
                            never
                        ): never
                        
                    )
                ]: 
                    key extends P? (
                            SourceProps[key] extends Prefixed<infer prefix, infer N, infer C>?
                            C
                            : 
                            never
                        ): never
            }
            >
        , 
        SourceProps, SourcePropMap>{
       
        let map = this.getSelectorMap() as unknown as {[key1: string]: { [key2: string]: Column<string, any>}}
        let fields = properties as string[]
        let nameMap: { [key: string]: Scalar<any> } = fields.reduce( (acc, f:string) => {
            let [source, field] = f.split('.') 
            let col = map[source][field]
            acc = Object.assign({}, acc, col.value() )
            return acc
        }, {})

        this.__selectItems = nameMap
        return this as any
    }

    // type<I>(parsableType: ParsableTrait<I>){
    //     this.parsableType = parsableType
    // }

    // getType(): ParsableTrait<any> {

    // }
        
    props<S extends { [key: string]: Scalar<any> }, Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractFieldProps<SourceProps>, SourcePropMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            UnionToIntersection<
            SelectProps
            | 
            {
            [key in keyof S] :
                S[key] extends Scalar<infer D> ?
                    D extends PropertyTypeDefinition?
                    FieldProperty<D>
                    : never
                : never 
            }
            >
        , 
        SourceProps, SourcePropMap> {

        let nameMap: { [key: string]: Scalar<any> }
        if(named instanceof Function){

            let selectorMap = this.getSelectorMap()

            let resolver = makeExpressionResolver(this.__fromItem, this.__joinItems.map(item => item.source), selectorMap)
            
            Object.assign(selectorMap, this.sqlKeywords(resolver) )
            
            const map = Object.assign({}, this.getSelectorMap(), this.sqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        }else {
            nameMap = named
        }

        this.__selectItems = nameMap
        return this as any
    }

    private selectItemAlias(name: string, scalar: Scalar<any>){

        return metaFieldAlias(name, scalar.definition)

    }


    private async resolveSelectItems(nameMap: { [key: string]: Scalar<any> }, repository: EntityRepository<any>) {
        // const client = repository.orm.client()
        
        return await Promise.all(Object.keys(nameMap).map(async (k) => {

            // let acc = await accP
            let scalar = nameMap[k]
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            console.log('431 try to resolve', k, scalar.definition)
            const raw: Knex.Raw = await scalar.toRaw(repository)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = makeRaw(repository, `${text} AS ${this.selectItemAlias(k, scalar)}`)

            return newRaw

        }))
    }

    sqlKeywords<X, Y>(resolver: ExpressionResolver<X, Y>){
        let sqlkeywords: SQLKeywords<X, Y> = {
            And: (...conditions: Expression<X, Y>[]) => new AndOperator(resolver, ...conditions),
            Or: (...conditions: Expression<X, Y>[]) => new OrOperator(resolver, ...conditions),
            Not: (condition: Expression<X, Y>) => new NotOperator(resolver, condition),
            Exists: (dataset: Dataset<any, any, any>) => new ExistsOperator(resolver, dataset)
        }
        return sqlkeywords
    }

    clone(): Dataset<SelectProps, SourceProps, SourcePropMap> {
        const newDataset = new Dataset<SelectProps, SourceProps, SourcePropMap>()
        newDataset.__fromItem = this.__fromItem
        newDataset.__joinItems = this.__joinItems.map(i => i)
        newDataset.__selectItems = this.__selectItems
        newDataset.__whereRawItem = this.__whereRawItem
        newDataset.nativeBuilderCallbacks = this.nativeBuilderCallbacks.map(i => i)
        return newDataset
    }

    filter<X extends ExtractFieldProps<SourceProps>, Y extends SourcePropMap & SQLKeywords< X, SourcePropMap >  >(expression: Expression< X, Y> | ExpressionFunc<X, Y> ): Dataset<SelectProps, SourceProps, SourcePropMap>{
        //@ts-ignore
        this.__whereRawItem = expression
        return this
    }

    from<S extends Schema, SName extends string>(source: Datasource<S, SName>):
        Dataset<{}, 
            UnionToIntersection< AddPrefix< ExtractProps< S>, '', ''> | AddPrefix< ExtractProps< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> } >
        > {
            this.__fromItem = source
            return this as any
        }

    innerJoin<S extends Schema, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractProps< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y >): Dataset<SelectProps,X,Y>{
        this.__joinItems.push( {
            type: "inner",
            source,
            expression
        })
        return this as any
    }
     
    leftJoin<S extends Schema, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractProps< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<SelectProps,X,Y>{
        this.__joinItems.push( {
            type: "left",
            source,
            expression
        })
        return this as any
    }

    rightJoin<S extends Schema, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractProps< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<SelectProps,X,Y>{
        this.__joinItems.push( {
            type: "right",
            source,
            expression
        })
        return this as any
    }

    datasource<Name extends string>(name: Name): Datasource<SelectProps & Schema, Name> {
        return new DerivedDatasource(this, name)
    }

    schema(): SelectProps & Schema{
        const propertyMap =  Object.keys(this.__selectItems).reduce((acc, key) => {

            const d = this.__selectItems[key].definition
            let referName = this.selectItemAlias(key, this.__selectItems[key])

            if(d instanceof FieldPropertyTypeDefinition){
                //@ts-ignore
                acc[key] = new FieldProperty(d).setFieldName(referName)
            } else {
                //@ts-ignore
                acc[key] = new FieldProperty( new FieldPropertyTypeDefinition() ).setFieldName(referName)
            }

            return acc
        }, {} as SelectProps & {[key:string]: FieldPropertyTypeDefinition<any>}) 

        let schema =  Object.assign(new Schema(), propertyMap)
        schema.init()
        return schema
    }
}


type RawExpression = (repository: EntityRepository<any>) => Knex.Raw | Promise<Knex.Raw> | Knex.QueryBuilder | Promise<Knex.QueryBuilder> | Promise<Scalar<any>> | Scalar<any>

export class Scalar<T extends PropertyTypeDefinition<any> >  {
    // __type: 'Scalar'
    // __definition: PropertyTypeDefinition | null

    readonly definition: PropertyTypeDefinition
    protected expressionOrDataset: RawExpression | Dataset<any, any, any>
    // protected dataset:  | null = null

    constructor(definition: PropertyTypeDefinition , expressionOrDataset: RawExpression | Dataset<any, any, any>){
        this.definition = definition
        this.expressionOrDataset = expressionOrDataset
    }

    // get createdFromDataset(){
    //     if(this.expressionOrDataset instanceof Dataset){
    //         return this.expressionOrDataset
    //     }
    //     return null
    // }

    // get expression(){
    //     if(this.expressionOrDataset instanceof Dataset){
    //         const dataset = this.expressionOrDataset
    //         return (repository: EntityRepository<any>) => {
    //             return dataset.toNativeBuilder(repository)
    //         }
    //     }else {
    //         return this.expressionOrDataset
    //     }
    // }

    // producePropertyTypeDe(value: any): FieldPropertyTypeDefinition<any> {
    //     if(typeof value === 'string'){
    //         const s = value
    //         return new StringTypeNotNull()
    //     }
    //     throw new Error('Cannot resolve value')
    // }


    equals(rightOperand: any): Scalar<BooleanTypeNotNull> {
        return new EqualOperator(this, rightOperand).toScalar()
    }

    toRealRaw() {
        return this.expressionOrDataset
    }


    toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw> {
        const client = repository.orm.client()
        const expressionOrDataset = this.expressionOrDataset

        const resolveIntoRawOrDataset = (ex: Knex.Raw<any> | Knex.QueryBuilder | Scalar<any> | RawExpression | Dataset<any, any, any> |
            Promise<Knex.Raw<any> | Knex.QueryBuilder | Scalar<any> | RawExpression | Dataset<any, any, any>> ):
            (Knex.Raw<any> | Knex.QueryBuilder | Dataset<any, any, any> |
                Promise<Knex.Raw<any> | Knex.QueryBuilder | Dataset<any, any, any>>
            ) => {

            return thenResult(ex, ex => {

                if(ex instanceof Dataset){
                    // console.log('here 1')
                    return ex
                } else if(ex instanceof Scalar) {
                    // console.log('here 2')
                    return resolveIntoRawOrDataset( ex.toRealRaw())
                    
                } else if( ex instanceof Function){
                    // console.log('resolve', ex.toString())
                    return resolveIntoRawOrDataset(ex(repository))
                }
                console.log('here 3')
                return ex
            })
        }

        return thenResult( resolveIntoRawOrDataset(expressionOrDataset), rawOrDataset => {

            if(this.definition instanceof ComputePropertyTypeDefinition && this.definition.queryTransform){
                const definition = this.definition
                if(rawOrDataset instanceof Dataset){
                    const dataset = rawOrDataset
                    
                    return thenResult(dataset.toNativeBuilder(repository), oldSql => {
                        const sql = definition.queryTransform(oldSql, dataset.selectItemsAlias(), 'column1', client)
                        const newRaw = makeRaw(repository, sql)
                        return newRaw
                    })

                } else {
    
                    const sql = definition.queryTransform(rawOrDataset, ['column1'], 'column1', client)
                    const newRaw = makeRaw(repository, sql)
                    return newRaw
                }
            } else {
                if(rawOrDataset instanceof Dataset){
                    const dataset = rawOrDataset
                        
                    return thenResult(dataset.toNativeBuilder(repository), sql => {
                        return makeRaw(repository, sql.toString())
                    })
                
                } else {
                    return makeRaw(repository, rawOrDataset.toString())
                }
            }

        })

    }

    asColumn<Name extends string>(propName: Name): Column<Name, T> {
        return new Column(propName, this.definition, this.expressionOrDataset)
    }
}

export class Column<Name extends string, T extends PropertyTypeDefinition<any>> extends Scalar<T>{
    alias: Name
    // scalarable: Scalarable<T> | Promise<Scalarable<T>>

    constructor(alias: Name, definition: PropertyTypeDefinition, expressionOrDataset: RawExpression| Dataset<any, any, any>){
        super(definition, expressionOrDataset)
        this.alias = alias
        // this.scalarable = scalarable
    }

    value(): { [key in Name]: Scalar<T> } {
        const key = this.alias
        //@ts-ignore
        return { [key]: new Scalar(this.definition, this.expressionOrDataset) }
    }

    clone(): Column<Name, T> {
        return new Column(this.alias, this.definition, this.expressionOrDataset)
    }
}

// export interface FromClause<Props, PropMap> extends Knex.Raw {
//     __type: 'FromClause'
//     // __raw: string
//     __parentSource: FromClause<any, any> | null
//     __realClone: Function
// }

// const castAsRow = (builder: any) : Row => {
//     //@ts-ignore
//     if(builder.__type === 'Dataset' ){
//         return builder as Row
//     }
//     throw new Error('Cannot cast into QueryBuilder. Please use the modified version of QueryBuilder.')
// }

export const isRaw = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Raw' ){
        return true
    }
    return false
}

export const isDataset = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Dataset' ){
        return true
    }
    return false
}

export const isColumn = (builder: any) : boolean => {
    //@ts-ignore
    if( isScalar(builder) && builder.__actualAlias){
        return true
    }
    return false
}

export const isScalar = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Scalar' ){
        return true
    }
    return false
}


export const makeRaw = (repository: EntityRepository<any>, first: any, ...args: any[]) => {
    let r = repository.orm.getKnexInstance().raw(first, ...args)
    // @ts-ignore
    r.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    // r.clone = () => {
    //     return makeRaw(repository, r.toString())
    // }
    // r.__type = 'Raw'
    return r
}

// export const makeScalar = <T extends PropertyTypeDefinition>(repository: EntityRepository<any>, expression: Knex.Raw | Knex.QueryBuilder, definition: T | null = null): Scalar<T> => {

//     let text = expression.toString().trim()

//     text = addBlanketIfNeeds(text)
//     let scalar: Scalar<any> = makeRaw(repository, text) as Scalar<any>
//     scalar.__type = 'Scalar'
//     scalar.__expression = expression.clone()
//     scalar.__definition = definition

//     scalar.equals = (value: any): Scalar<BooleanType> => {

//         return makeScalar<BooleanType>(repository, new EqualOperator(value).toRaw(repository, scalar), new BooleanType())
//     }

//     scalar.is = (operator: string, value: any): Scalar<BooleanType> => {
//         if(!expression){
//             throw new Error('Only Dataset can apply count')
//         }

//         return makeScalar<BooleanType>(repository, makeRaw(repository, `(${expression.toString()}) ${operator} ?`, [value]), new BooleanType())
//     }

//     scalar.clone = () =>{
//         return makeScalar<T>(repository, expression, definition)
//     }

//     scalar.toRaw = () => {
//         return scalar
//     }
    
//     return scalar
// }



// export const extractColumns = (builder: Knex.QueryBuilder): string[] => {
    
//     // let ourBuilder = castAsRow(builderOrRaw)
//     return builder.__selectItems.map(item => {
//         return item.actualAlias
//     })
// }

export type ExpressionResolver<Props, M> = (expression: Expression<Props, M> | ExpressionFunc<Props, M>) => Scalar<any>

export const makeExpressionResolver = function<Props, M>(fromSource: Datasource<any, any> | null, sources: Datasource<any, any>[], dictionary: UnionToIntersection< M | SQLKeywords<Props, M> >) {

    const resolver: ExpressionResolver<Props, M> = (expression: Expression<Props, M> | ExpressionFunc<Props, M>) => {
        let value
        if( expression instanceof Function) {
            value = expression(dictionary)
        } else {
            value = expression
        }
        if( value === null){
            return new Scalar(new PropertyTypeDefinition(), repository => makeRaw(repository, '?', [null]) )
        } else if (typeof value === 'boolean') {
            const boolValue = value
            return new Scalar(new BooleanType(), repository => makeRaw(repository, '?', [boolValue]) )
        } else if (typeof value === 'string'){
            const stringValue = value
            return new Scalar(new StringType(), repository => makeRaw(repository, '?', [stringValue]) )
        } else if (typeof value === 'number'){
            const numberValue = value
            //TODO
            return new Scalar(new NumberType(), repository => makeRaw(repository, '?', [numberValue]) )
        } else if (value instanceof Date){
            const dateValue = value
            //TODO
            return new Scalar(new DateTimeType(), repository => makeRaw(repository, '?', [dateValue]) )
        } else if(value instanceof ConditionOperator){
            return value.toScalar()
        } else if(Array.isArray(value)){
            const expr = new OrOperator<Props, M>(resolver, ...value)
            return resolver( expr )
        } else if(value instanceof Scalar){
            return value
        } else if (value instanceof Dataset) {
            return value.toScalar(new PropertyTypeDefinition() )
        } else if(value instanceof SimpleObjectClass){
            let dict = value as SimpleObject
            let scalars = Object.keys(dict).reduce( (scalars, key) => {
                
                let source: Datasource<any, any> | null | undefined = null
                let [sourceName, propName] = key.split('.')
                if(!propName){
                    if(!fromSource){
                        throw new Error(`There must be a FROM before using in 'filter'.`)
                    }

                    propName = sourceName
                    source = fromSource
                } else{
                    source = [fromSource, ...sources].find(s => s && s.sourceAlias === sourceName)
                }
                if(!source){
                    console.log('sources', sources, sourceName)
                    throw new Error(`cannot found source (${sourceName})`)
                }

                let prop = source.schema.propertiesMap[propName]
                if(!prop){
                    throw new Error(`cannot found prop (${propName})`)
                }
                
                const makeOperator = (leftOperatorEx: any, rightOperatorEx: any) => {
                    const leftOperator = resolver(leftOperatorEx)

                    let operator: AssertionOperator
                    if(rightOperatorEx instanceof AssertionOperator){
                        operator = rightOperatorEx
                    }else if( Array.isArray(rightOperatorEx) ){
                        operator = new ContainOperator(leftOperator, ...rightOperatorEx.map(r => resolver(r) ))
                    } else if(rightOperatorEx === null){
                        operator = new IsNullOperator(leftOperator)
                    } else {
                        operator = new EqualOperator(leftOperator, resolver(rightOperatorEx))
                    }
                    return operator
                }
                
                if(prop instanceof FieldProperty){
                    let converted = source.getFieldProperty(propName)
                    scalars.push( makeOperator(converted, dict[key]).toScalar() )
                } else {
                    let compiled = (source.getComputeProperty(propName))()
                    if(compiled instanceof Promise){
                        throw new Error('Unsupported Async Computed Property in Expression Resolver')
                    }
                    scalars.push( makeOperator(compiled, dict[key]).toScalar() )
                }
    
                return scalars
    
            }, [] as Scalar<BooleanTypeNotNull>[] )

            let arr = new AndOperator<Props, M>(resolver, ...scalars)
            return resolver(arr)
        } else {
            throw new Error('Unsupport Where clause')
        }
    }

    return resolver
}


export async function resolveEntityProps<T extends typeof Entity, D extends T["schema"]>(source: Datasource<D, "root">, 
    props: Partial<ComputePropertyArgsMap<D>> | undefined): Promise<{ [key: string]: Scalar<any> }> {
    
    let computedCols: { [key: string]: Scalar<any> }[] = []
    if(props){
        computedCols = Object.keys(props).map( (propName) => {
            //@ts-ignore
            const args = props[propName]
            let call = source.getComputeProperty(propName)
            
            let col = call(args) as Column<any, any>
            let colDict = col.value()

            return colDict

        })
    }
    let fieldCols = source.schema.properties.filter(prop => !(prop instanceof ComputeProperty) )
        .map(prop => source.getFieldProperty<string, any>(prop.name).value() )
    let r = Object.assign({}, ...fieldCols, ...computedCols)
    return r as { [key: string]: Scalar<any> }
}

