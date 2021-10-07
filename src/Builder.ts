import { Knex}  from "knex"
import { ComputePropertyArgsMap, TableSchema, SelectorMap, CompiledComputeFunction, FieldProperty, Schema, ComputeProperty, ExecutionOptions, EntityRepository, ORM, Entity, Property } from "."
import { AndOperator, ConditionOperator, ContainOperator, EqualOperator, IsNullOperator, NotOperator, OrOperator, AssertionOperator, ExistsOperator } from "./Operator"
import { BooleanType, BooleanTypeNotNull, ComputePropertyTypeDefinition, DateTimeType, FieldPropertyTypeDefinition, NumberType, ObjectType, ParsableTrait, PropertyTypeDefinition, StringType, StringTypeNotNull, UnknownPropertyTypeDefinition } from "./PropertyType"
import { ExtractFieldProps, ExtractProps, makeid, notEmpty, quote, SimpleObject, SimpleObjectClass, SQLString, thenResult, thenResultArray, UnionToIntersection } from "./util"

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

export type FieldPropertyValueMap<E> = {
    [key in keyof E]:
        E[key] extends Prefixed<any, any, infer C>? (
                C extends FieldProperty<infer D>? (D extends FieldPropertyTypeDefinition<infer Primitive>? (Primitive | Scalar<D> ): never): never
             ): E[key] extends FieldProperty<infer D>? (D extends FieldPropertyTypeDefinition<infer Primitive>? (Primitive | Scalar<D> ): never): never
             
}

// type A<E> = Pick<E, ({
//     [key in keyof E]:
//         E[key] extends Prefixed<any, any, infer C>? (
//                 C extends FieldProperty<any>? key: never
//              ): E[key] extends FieldProperty<any>? key: never            
// })[keyof E]>

// export type FieldPropertyValueMap<E> = {
//     [key in keyof A<E>]: key extends FieldProperty<infer D>? (D extends PropertyTypeDefinition<infer Primitive>? Primitive: never): never
// }

export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => AndOperator<Props, PropMap>,
    Or: (...condition: Array<Expression<Props, PropMap> > ) => OrOperator<Props, PropMap>,
    Not: (condition: Expression<Props, PropMap>) => NotOperator<Props, PropMap>,
    Exists: (dataset: Dataset<any, any, any>) => ExistsOperator<Props, PropMap>
}

export type HelperFunctions = {
    $raw: () => Knex.Raw
}

export type ExpressionFunc<O, M> = (map: UnionToIntersection< M | SQLKeywords<O, M> | HelperFunctions > ) => Expression<O, M>

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

export interface Scalarable<T extends PropertyTypeDefinition<any> > {
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
        this.sourceAliasAndSalt = makeid(5)// this.sourceAlias + '___' + 
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

    readonly dataset: Dataset<any, any, any, any>
    constructor(dataset: Dataset<any, any, any, any>, sourceAlias: Name){
        super(dataset.schema(), sourceAlias)
        this.dataset = dataset
    }

    async realSource(repository: EntityRepository<any>){
        return `(${(await this.dataset.toNativeBuilder(repository))})`
    }
}

export class Dataset<SelectProps ={}, SourceProps ={}, SourcePropMap ={}, FromSource extends Datasource<any, any> = Datasource<any, any>> implements Scalarable<any> {
    // parsableType: ParsableTrait<any> | null = null
    // __type: 'Dataset' = 'Dataset'
    #whereRawItem: null |  Expression<any, any> = null
    #selectItems: { [key: string]: Scalar<any> } | null = null
    #updateItems: { [key: string]: Scalar<any> } | null = null
    #fromItem: null | Datasource<Schema, string> = null
    #joinItems:  Array<{type: 'inner' | 'left' | 'right', source: Datasource<Schema, string>, expression: Expression<any, any> | ExpressionFunc<any, any>  }> = []
    
    #limit: null | number = null
    #offset: null | number = null
    #repository: EntityRepository<any> | null = null

    nativeBuilderCallbacks: ((nativeBuilder: Knex.QueryBuilder) => Promise<void> | void)[] = []

    constructor(repository?: EntityRepository<any>){
        // this.#fromItem = fromSource
        this.#repository = repository ?? null
    }

    toDataset(): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource> {
        return this
    }
    
    getSelectorMap(): SourcePropMap {
        let sources = this.#joinItems.map(item => item.source)
        if(this.#fromItem){
            sources.push(this.#fromItem)
        }

        const sourcePropMap = sources.reduce( (acc, source) => {
            const t = source.sourceAlias
            acc[t] = source.selectorMap()
            return acc
        }, {} as {[key:string]: SelectorMap<any> } )

        return sourcePropMap as unknown as SourcePropMap
    }

    selectItemsAlias(): string[]{
        if(!this.#selectItems){
            return []
        }
        const selectItems = this.#selectItems
        return Object.keys(selectItems).map(key => this.selectItemAlias(key, selectItems[key]) )
    }

    async toNativeBuilder(repo?: EntityRepository<any>): Promise<Knex.QueryBuilder> {

        const repository = repo ?? this.#repository

        if(!repository){
            throw new Error('There is no repository provided.')
        }

        let nativeQB = repository.orm.getKnexInstance().clearSelect()
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

        if(this.#updateItems && this.#selectItems){
            throw new Error('Cannot be both select or update statements')
        }

        if(this.#fromItem){
            const from = await this.#fromItem.toRaw(repository)
            nativeQB.from(from)
        }

        let selectorMap = this.getSelectorMap()

        let resolver = makeExpressionResolver(this.#fromItem, this.#joinItems.map(item => item.source), selectorMap)
        
        Object.assign(selectorMap, this.sqlKeywords(resolver) )
        
        await this.#joinItems.reduce( async(acc, item) => {
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
        
        if(this.#whereRawItem){
            const where: Knex.Raw = await resolver(this.#whereRawItem).toRaw(repository)
            nativeQB.where( where )
        }

        if(this.#offset) {
            if(this.#updateItems){
                throw new Error('Cannot use limit on update')
            }
            nativeQB.offset(this.#offset)
        }

        if(this.#limit) {
            if(this.#updateItems){
                throw new Error('Cannot use limit on update')
            }
            nativeQB.limit(this.#limit)
        }

        if(this.#selectItems){
            const selectItems = await this.resolveSelectItems(this.#selectItems, repository)
            if(selectItems.length === 0 && !this.#fromItem){
                throw new Error('No SELECT and FROM are provided for Dataset')
            }
            nativeQB.select( selectItems )
        }

        if(this.#updateItems){
            const updateItems = await this.resolveUpdateItems(this.#updateItems, repository)
            if(Object.keys(updateItems).length === 0 && !this.#fromItem){
                throw new Error('No UPDATE and FROM are provided for Dataset')
            }
            nativeQB.update( updateItems )
        }

        await Promise.all(this.nativeBuilderCallbacks.map( async(callback) => {    
            await callback(nativeQB)
        }))
        
        return nativeQB
    }

    native(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource>{
        this.nativeBuilderCallbacks = []
        this.addNative(nativeBuilderCallback)
        return this
    }
    
    addNative(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource>{
        this.nativeBuilderCallbacks.push(nativeBuilderCallback)
        return this
    }

    toScalar<T extends PropertyTypeDefinition<any> >(t: T): Scalar<T>{
        return new Scalar(t, this)
    }
    
    selectProps<P extends keyof SourceProps>(...properties: P[]): 
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
        SourceProps, SourcePropMap, FromSource>{
       
        let map = this.getSelectorMap() as unknown as {[key1: string]: { [key2: string]: Column<string, any>}}
        let fields = properties as string[]
        let nameMap: { [key: string]: Scalar<any> } = fields.reduce( (acc, f:string) => {
            let [source, field] = f.split('.') 
            let col = map[source][field]
            acc = Object.assign({}, acc, col.value() )
            return acc
        }, {})

        this.#selectItems = nameMap
        return this as any
    }

    // type<I>(parsableType: ParsableTrait<I>){
    //     this.parsableType = parsableType
    // }

    // getType(): ParsableTrait<any> {

    // }
        
    select<S extends { [key: string]: Scalar<any> }, Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractProps<SourceProps>, SourcePropMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            UnionToIntersection<
            SelectProps
            | 
            {
            [key in keyof S] :
                S[key] extends Scalar<infer D> ?
                    D extends PropertyTypeDefinition<any>?
                    Property<D>
                    : never
                : never 
            }
            >
        , 
        SourceProps, SourcePropMap, FromSource> {

        let nameMap: { [key: string]: Scalar<any> }
        let selectorMap = this.getSelectorMap()
        let resolver = makeExpressionResolver(this.#fromItem, this.#joinItems.map(item => item.source), selectorMap)
        
        if(named instanceof Function){
            Object.assign(selectorMap, this.sqlKeywords(resolver) )
            const map = Object.assign({}, this.getSelectorMap(), this.sqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        } else {
            nameMap = named
        }

        this.#selectItems = Object.keys(nameMap).reduce( (acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any> } )
        return this as any
    }

    update<S extends Partial<FieldPropertyValueMap<ExtractFieldProps< (FromSource extends Datasource<infer DS, any>?DS:any)>>> , Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractProps<SourceProps>, SourcePropMap> >>
    (keyValues: S | ((map: Y ) => S )): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource>{
        
        let nameMap: { [key: string]: any | Scalar<any> }
        let selectorMap = this.getSelectorMap()
        let resolver = makeExpressionResolver(this.#fromItem, this.#joinItems.map(item => item.source), selectorMap)
        
        if(keyValues instanceof Function){    
            Object.assign(selectorMap, this.sqlKeywords(resolver) )
            const map = Object.assign({}, this.getSelectorMap(), this.sqlKeywords<any, any>(resolver)) as Y
            nameMap = keyValues(map)
        } else {
            nameMap = keyValues
        }

        this.#updateItems = Object.keys(nameMap).reduce( (acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any> } )
        return this as any
    }
    private selectItemAlias(name: string, scalar: Scalar<any>){
        return name
    }

    private async resolveSelectItems(nameMap: { [key: string]: Scalar<any> }, repository: EntityRepository<any>): Promise<Knex.Raw<any>[]> {
        const client = repository.orm.client()
        return await Promise.all(Object.keys(nameMap).map(async (k) => {

            // let acc = await accP
            let scalar = nameMap[k]
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await scalar.toRaw(repository)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = makeRaw(repository, `${text} AS ${quote(client, this.selectItemAlias(k, scalar))}`)

            return newRaw
        }))
    }

    private async resolveUpdateItems(nameMap: { [key: string]: Scalar<any> }, repository: EntityRepository<any>) {
        const client = repository.orm.client()
        return await Object.keys(nameMap).reduce( async (accP, k) => {

            const acc = await accP
            // let acc = await accP
            let scalar = nameMap[k]
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await scalar.toRaw(repository)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            acc[k] = makeRaw(repository, text)
            return acc
        }, Promise.resolve({} as {[key:string]: Knex.Raw<any>}) )
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

    clone(): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource> {
        const newDataset = new Dataset<SelectProps, SourceProps, SourcePropMap, FromSource>()
        newDataset.#fromItem = this.#fromItem
        newDataset.#joinItems = this.#joinItems.map(i => i)
        newDataset.#selectItems = this.#selectItems
        newDataset.#whereRawItem = this.#whereRawItem
        newDataset.nativeBuilderCallbacks = this.nativeBuilderCallbacks.map(i => i)
        return newDataset
    }

    where<X extends ExtractProps<SourceProps>, Y extends SourcePropMap & SQLKeywords< X, SourcePropMap >  >(expression: Expression< X, Y> | ExpressionFunc<X, Y> ): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource>{
        //@ts-ignore
        this.#whereRawItem = expression
        return this
    }

    limit(limit: number | null): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource> {
        this.#limit = limit
        return this
    }

    offset(offset: number | null): Dataset<SelectProps, SourceProps, SourcePropMap, FromSource> {
        this.#offset = offset
        return this
    }

    from<S extends Schema, SName extends string>(source: Datasource<S, SName>):
        Dataset<{}, 
            UnionToIntersection< AddPrefix< ExtractProps< S>, '', ''> | AddPrefix< ExtractProps< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> }>, Datasource<S, SName>
        > {
            this.#fromItem = source
            return this as any
        }

    innerJoin<S extends Schema, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractProps< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y >): Dataset<SelectProps,X,Y, FromSource>{
        this.#joinItems.push( {
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
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<SelectProps,X,Y, FromSource>{
        this.#joinItems.push( {
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
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<SelectProps,X,Y, FromSource>{
        this.#joinItems.push( {
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
        if(!this.#selectItems){
            throw new Error('No selectItems for a schema')
        }
        const selectItems = this.#selectItems
        const propertyMap =  Object.keys(selectItems).reduce((acc, key) => {

            const d = selectItems[key].definition
            let referName = this.selectItemAlias(key, selectItems[key])

            acc[key] = new Property(d)
            acc[key].register(referName)
            
            return acc
        }, {} as {[key:string]: Property<any>}) 

        //@ts-ignore
        let schema =  Object.assign(new Schema(), propertyMap as SelectProps)
        schema.init()
        return schema
    }

    hasSelectedItems(){
        return Object.keys(this.#selectItems ?? {}).length > 0
    }

    async execute<R extends {
        [key in keyof ExtractProps<SelectProps>]: 
        SelectProps[key] extends Property<PropertyTypeDefinition<infer D1>>? D1 : never
            // S[key] extends FieldProperty<FieldPropertyTypeDefinition<infer D1>>? D1 :
                // (S[key] extends ComputeProperty<FieldPropertyTypeDefinition<infer D2>, any, any, any>? D2: never)
    }>(executionOptions?: ExecutionOptions, repo?: EntityRepository<any>): Promise<R[]>{
        const repository = repo ?? this.#repository

        if(!repository){
            throw new Error('There is no repository provided.')
        }

        return repository.execute(this, executionOptions)
    }
}

type RawUnit = Knex.Raw | Promise<Knex.Raw> | Knex.QueryBuilder | Promise<Knex.QueryBuilder> | Promise<Scalar<any>> | Scalar<any> | Dataset<any, any, any, any> | Promise<Dataset<any, any, any, any>>
type RawExpression = ( (repository: EntityRepository<any>) => RawUnit) | RawUnit

export class Scalar<T extends PropertyTypeDefinition<any> >  {
    // __type: 'Scalar'
    // __definition: PropertyTypeDefinition | null

    readonly definition: PropertyTypeDefinition<any>
    protected expressionOrDataset: RawExpression
    // protected dataset:  | null = null

    constructor(definition: PropertyTypeDefinition<any> , expressionOrDataset: RawExpression ){
        this.definition = definition
        this.expressionOrDataset = expressionOrDataset
    }

    equals(rightOperand: any): Scalar<BooleanTypeNotNull> {
        return new EqualOperator(this, rightOperand).toScalar()
    }

    toRealRaw() {
        return this.expressionOrDataset
    }


    toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw> {
        const client = repository.orm.client()
        const expressionOrDataset = this.expressionOrDataset

        const resolveIntoRawOrDataset = (ex: RawExpression ):
            ( Knex.Raw<any> | Knex.QueryBuilder | Dataset<any, any, any>) => {

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
                // console.log('here 3')
                return ex
            })
        }

        return thenResult( resolveIntoRawOrDataset(expressionOrDataset), rawOrDataset => {
            if(!(rawOrDataset instanceof Dataset)){
                const next = makeRaw(repository, rawOrDataset.toString())
                return this.definition.transformQuery(next, repository)
            } else {
                return this.definition.transformQuery(rawOrDataset, repository)
            }

            // if('transformQuery' in this.definition){
            //     const transformQuery = this.definition.transformQuery
            //     const definition = this.definition
            //     if(rawOrDataset instanceof Dataset){
            //         const dataset = rawOrDataset
                    
            //         return thenResult(dataset.toNativeBuilder(repository), oldSql => {
            //             const sql = transformQuery(oldSql, dataset.selectItemsAlias(), 'column1', client)
            //             const newRaw = makeRaw(repository, sql)
            //             return newRaw
            //         })

            //     } else {
    
            //         const sql = transformQuery(rawOrDataset, ['column1'], 'column1', client)
            //         const newRaw = makeRaw(repository, sql)
            //         return newRaw
            //     }
            // } else {
            //     if(rawOrDataset instanceof Dataset){
            //         const dataset = rawOrDataset
                        
            //         return thenResult(dataset.toNativeBuilder(repository), sql => {
            //             return makeRaw(repository, sql.toString())
            //         })
                
            //     } else {
            //         return makeRaw(repository, rawOrDataset.toString())
            //     }
            // }

        })

    }

    asColumn<Name extends string>(propName: Name): Column<Name, T> {
        return new Column(propName, this.definition, this.expressionOrDataset)
    }
}

export class Column<Name extends string, T extends PropertyTypeDefinition<any>> extends Scalar<T>{
    alias: Name
    // scalarable: Scalarable<T> | Promise<Scalarable<T>>

    constructor(alias: Name, definition: PropertyTypeDefinition<any>, expressionOrDataset: RawExpression| Dataset<any, any, any>){
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

export type ExpressionResolver<Props, M> = (expression: Expression<Props, M> | ExpressionFunc<Props, M>) => Scalar<any>

export const makeExpressionResolver = function<Props, M>(fromSource: Datasource<any, any> | null, sources: Datasource<any, any>[], dictionary: UnionToIntersection< M | SQLKeywords<Props, M> >) {

    const resolver: ExpressionResolver<Props, M> = (expression: Expression<Props, M> | ExpressionFunc<Props, M>): Scalar<any> => {
        let value
        if( expression instanceof Function) {
            value = expression(dictionary)
        } else {
            value = expression
        }
        if( value === null){
            return new Scalar(new UnknownPropertyTypeDefinition(), repository => makeRaw(repository, '?', [null]) )
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
            return value.toScalar( new ObjectType(new Schema()) )
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

