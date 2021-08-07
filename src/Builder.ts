import { Knex}  from "knex"
import { ComputePropertyArgsMap, TableSchema, SelectorMap, CompiledComputeFunction, FieldProperty, Schema, ComputeProperty, ExecutionOptions, EntityRepository, ORM, Entity } from "."
import { AndOperator, ConditionOperator, ContainOperator, EqualOperator, IsNullOperator, NotOperator, OrOperator, AssertionOperator } from "./Operator"
import { BooleanType, ComputePropertyTypeDefinition, DateTimeType, NumberType, PropertyTypeDefinition, StringType } from "./PropertyType"
import { addBlanketIfNeeds, ExtractFieldProps, ExtractProps, metaFieldAlias, notEmpty, quote, SimpleObject, SimpleObjectClass, SQLString, thenResult, thenResultArray, UnionToIntersection } from "./util"

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
                C extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>: never
             ): E[key] extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>: never
             
}>

export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => AndOperator<Props, PropMap>,
    Or: (...condition: Array<Expression<Props, PropMap> > ) => OrOperator<Props, PropMap>,
    Not: (condition: Expression<Props, PropMap>) => NotOperator<Props, PropMap>
}

export type ExpressionFunc<O, M> = (map: M) => Expression<O, M>

export type Expression<O, M> = Partial<FieldPropertyValueMap<O>>  
    | AndOperator<O, M> 
    | OrOperator<O, M> 
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

    toRaw(repository: EntityRepository<any>): Knex.Raw
    realSource(repository: EntityRepository<any>): SQLString
    
    getFieldProperty: <Name extends string, T extends PropertyTypeDefinition<any> >(name: Name) => Column<Name, T>    
    getComputeProperty: <Name extends string, ARG extends any[], R extends PropertyTypeDefinition<any>>(name: string) => CompiledComputeFunction<Name, ARG, R>
    // getAysncComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunctionPromise<Name, ARG, R>
    // tableAlias: {
    //     [key in keyof [alias] as alias]: string 
    // }
}

// export class DerivedDatasource<E extends Schema, Name extends string> implements Datasource<E, Name> {
//     sourceAlias: Name
//     schema: E
//     $: SelectorMap<E>
//     realSource(): SQLString {
//         throw new Error("Method not implemented.")
//     }
//     getFieldProperty: <Name extends string, T>(name: Name) => Column<Name, T>
//     getComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunction<Name, ARG, R>
//     getAysncComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunctionPromise<Name, ARG, R>
//     tableAlias: {}
// }

export type TableOptions = {
    tablePrefix?: string
}

export class TableDatasource<E extends TableSchema, Name extends string> implements Datasource<E, Name> {

    schema: E
    sourceAlias: Name
    options?: TableOptions

    constructor(schema: E, sourceAlias: Name, options?: TableOptions){

        if( !Number.isInteger(sourceAlias.charAt(0)) && sourceAlias.charAt(0).toUpperCase() === sourceAlias.charAt(0) ){
            throw new Error('alias cannot start with Uppercase letter')
        }

        this.schema = schema
        this.sourceAlias = sourceAlias
    }

    selectorMap(): SelectorMap<E>{
        const datasource = this
        //@ts-ignore
        const map = new Proxy( datasource.schema ,{
            get: (oTarget: Schema, sKey: string) => {
                
                if(typeof sKey === 'string'){
                    let prop = oTarget.propertiesMap[sKey]
                    if(prop instanceof FieldProperty){
                        // let tableAlias = quote(tableAlias)
                        // let fieldName: string = 
                        let alias = metaFieldAlias(prop)
                        
                        return new Column(alias, prop.definition, (entityRepository) => {
                            const client = entityRepository.orm.client()
                            let rawTxt = `${quote(client, datasource.sourceAlias)}.${quote(client, prop.fieldName)}`
                            return makeRaw(entityRepository, rawTxt)
                        })
                    }
                    if(prop instanceof ComputeProperty){
                        const cProp = prop
                        return (args?: any) => {
                            let alias = metaFieldAlias(cProp)
                            return new Column(alias, cProp.definition, (entityRepository) => {
                                const subquery: Scalarable<any> | Promise<Scalarable<any> > = cProp.compute.call(cProp, datasource, args)
                                return thenResult( subquery, scalarable => scalarable.toScalar().toRaw(entityRepository) )
                            })
                        }
                    }
                }

            }
        }) as SelectorMap<E>
        return map
    }

    getFieldProperty<Name extends string>(name: Name) : Column<Name, any> {
        //TODO
        throw new Error('NYI')
    }
    getComputeProperty<Name extends string, ARG extends any[], R extends PropertyTypeDefinition<any>>(name: string): CompiledComputeFunction<Name, ARG, R>{
        //TODO
        throw new Error('NYI')
    }
    // getAysncComputeProperty<Name extends string, ARG extends any[], R>(name: string): CompiledComputeFunctionPromise<Name, ARG, R>{
    //     //TODO
    //     throw new Error('NYI')
    // }
    
    toRaw(repository: EntityRepository<any>){
        const client = repository.orm.client()
        return makeRaw(repository, `${this.realSource(repository)} AS ${quote(client, this.sourceAlias)}`)
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

export class Dataset<SelectProps, SourceProps, SourcePropMap> implements Scalarable<any> {
    __type: 'Dataset' = 'Dataset'
    __whereRawItem: null |  ( (repository: EntityRepository<any>, selectorMap: SourcePropMap) => Promise<Scalar<BooleanType>> ) = null
    __selectItems: null | ( (repository: EntityRepository<any>, selectorMap: SourcePropMap) => Promise<SelectItem[]>) = null
    __fromItem?: null | Datasource<Schema, string> = null
    __joinItems:  Array<{type: 'inner' | 'left' | 'right', source: Datasource<Schema, string>, expression: Expression<any, any> }> = []
    
    nativeBuilderCallbacks: ((nativeBuilder: Knex.QueryBuilder) => Promise<void> | void)[] = []

    constructor(fromSource?: Datasource<Schema, string> | null){
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

    async selectedPropNames(repository: EntityRepository<any>): Promise<string[]>{
        if(!this.__selectItems){
            return []
        }
        return (await this.__selectItems(repository, this.getSelectorMap() ) ).map(item => {
            return item.actualAlias
        })
    }

    async toNativeBuilder(repository: EntityRepository<any>): Promise<Knex.QueryBuilder> {
        let nativeQB = repository.orm.getKnexInstance().clearSelect()
        
        if(this.__fromItem){
            const from = this.__fromItem.toRaw(repository)
            nativeQB.from(from)
        }

        let finalSelectorMap = this.getSelectorMap()

        await this.__joinItems.reduce( async(acc, item) => {
            await acc
            let finalExpr
            if(item.expression instanceof Function){
                finalExpr = await item.expression(finalSelectorMap)
            }else{
                finalExpr = item.expression
            }
            if(item.type === 'inner'){
                nativeQB.innerJoin(item.source.toRaw(repository), finalExpr)
            } else if(item.type === 'left'){
                nativeQB.leftJoin(item.source.toRaw(repository), finalExpr)
            } else if(item.type === 'right'){
                nativeQB.rightJoin(item.source.toRaw(repository), finalExpr)
            }
            return true
        }, Promise.resolve(true))
        if(this.__whereRawItem){
            const where = await this.__whereRawItem(repository, finalSelectorMap )
            nativeQB.where( where.toRaw(repository) )
        }
        if(this.__selectItems){
            nativeQB.select( await this.__selectItems(repository, finalSelectorMap ) )
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

    toScalar<T extends PropertyTypeDefinition>(t: PropertyTypeDefinition): DatasetScalar<T>{
        return new DatasetScalar(t, this)
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
            throw new Error('NYI')
    }
        
    props<S extends { [key: string]: Scalar<any> }, Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractFieldProps<SourceProps>, SourcePropMap> >>(named: S | 
        ((map: Y ) => (Promise<S> | S) ) ): 
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
        this.__selectItems = async (repository: EntityRepository<any>, selectorMap: SourcePropMap) => {
            const client = repository.orm.client()
            let nameMap: { [key: string]: Scalar<any> }
            if(named instanceof Function){
                const map = Object.assign({}, selectorMap, this.sqlKeywords<any, any>()) as Y
                nameMap = await named(map)
            }else {
                nameMap = named
            }

            let items = await Promise.all(Object.keys(nameMap).map( async(k) => {
                let scalar = nameMap[k] 
                let alias = k

                let text = scalar.toRaw(repository).toString().trim()

                if(text.includes(' ') && !( text.startsWith('(') && text.endsWith(')') ) ){
                    text = `(${text})`
                }
                const raw = makeRaw(repository, `${text} AS ${quote(client, alias)}`)

                return {
                    value: raw,
                    actualAlias: alias
                }
            }))
            return items
        }
        return this as any
    }

    sqlKeywords<X, Y>(){
        let sqlkeywords: SQLKeywords<X, Y> = {
            And: (...conditions: Expression<any, any>[]) => new AndOperator(conditions),
            Or: (...conditions: Expression<any, any>[]) => new OrOperator(conditions),
            Not: (condition: Expression<any, any>) => new NotOperator(condition)
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
        this.__whereRawItem = async (repository: EntityRepository<any>, selectorMap: SourcePropMap) => {
            let sources = this.__joinItems.map(item => item.source)
            if(!this.__fromItem){
                throw new Error('There must be a FROM before using filter.')
            }
            
            let map = Object.assign({}, selectorMap, this.sqlKeywords<X, SourcePropMap>() ) as Y
            let resolver = makeExpressionResolver<X, Y>(repository, this.__fromItem, sources, map)
            
            let boolScalar = await resolver(expression)
            return boolScalar
        }
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
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } | SQLKeywords<SourceProps, SourcePropMap> >
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<SelectProps,X,Y>{
        this.__joinItems.push( {
            type: "inner",
            source,
            expression
        })
        return this as any
    }
     
    leftJoin<S extends Schema, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractProps< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } | SQLKeywords<SourceProps, SourcePropMap> >
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
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } | SQLKeywords<SourceProps, SourcePropMap> >
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
        throw new Error('NYI')
    }

    schema(): SelectProps & Schema{
        throw new Error('NYI')
    }

    execute(): Promise<
        {
            [key in keyof SelectProps & string]: 
                SelectProps[key] extends Scalar<infer D>?
                    (
                        D extends PropertyTypeDefinition?  ReturnType< D["parseRaw"]>: never
                    )
                    // boolean
                : never
        }
    > {
        throw new Error('NYI')
    }
}


type RawExpression = (repository: EntityRepository<any>) => Knex.Raw | Promise<Knex.Raw> | Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export class Scalar<T extends PropertyTypeDefinition<any> >  {
    // __type: 'Scalar'
    // __definition: PropertyTypeDefinition | null

    readonly definition: PropertyTypeDefinition
    protected expression: RawExpression

    constructor(definition: PropertyTypeDefinition, expression: RawExpression){
        this.definition = definition
        this.expression = expression
    }


    equals(rightOperand: any): Scalar<BooleanType> {
        return new EqualOperator(this, rightOperand).toScalar()
    }


    toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw> {
        return thenResult(this.expression(repository), ex => {
            const newRaw = this.postTransform(repository, ex)
            return newRaw
        })
    }

    postTransform(repository: EntityRepository<any>, raw: Knex.Raw | Knex.QueryBuilder): Knex.Raw | Promise<Knex.Raw>{
        if(this.definition instanceof ComputePropertyTypeDefinition && this.definition.queryTransform){
            // let text = raw.toString().trim()
            // text = addBlanketIfNeeds(text)
            // let quotedRaw = makeRaw(repository, text)

            const client = repository.orm.client()
            const sql = this.definition.queryTransform(raw, null, 'column1', client)
            raw = makeRaw(repository, sql)
        }
        return raw
    }


    asColumn<Name extends string>(propName: Name): Column<Name, T> {
        return new Column(propName, this.definition, this.expression)
    }


    // toScalar(): Scalar<T>
    // clone(): Scalar<T>

    // is(operator: string, value: any): Scalar<BooleanType> {
    //     if(!expression){
    //         throw new Error('Only Dataset can apply count')
    //     }

    //     return makeScalar<BooleanType>(repository, makeRaw(repository, `(${expression.toString()}) ${operator} ?`, [value]), new BooleanType())
    // }
    
}


export class DatasetScalar<T extends PropertyTypeDefinition<any> > extends Scalar<T> {

    dataset: Dataset<any, any, any>

    constructor(definition: PropertyTypeDefinition, dataset: Dataset<any, any, any>){
        super(definition, (repository: EntityRepository<any>) => {
            return dataset.toNativeBuilder(repository)
        })
        this.dataset = dataset
    }

    postTransform(repository: EntityRepository<any>, raw: Knex.Raw): Knex.Raw | Promise<Knex.Raw>{
        if(this.definition instanceof ComputePropertyTypeDefinition && this.definition.queryTransform){
            const client = repository.orm.client()

            const definition = this.definition
            const oldRaw = raw
            const newRaw: Knex.Raw | Promise<Knex.Raw> = thenResult( this.dataset.selectedPropNames(repository), (extractedColumnNames) => {
                if(extractedColumnNames.length === 0){
                    throw new Error(`There is no selected column to be transformed as Computed Field. Please check your sql builder.`)
                }
    
                const sql = definition.queryTransform(oldRaw, extractedColumnNames, 'column1', client)
                const newRaw = makeRaw(repository, sql)
                return newRaw
            })
            return newRaw
        }
        return raw
    }
}


export class Column<Name extends string, T extends PropertyTypeDefinition<any>> extends Scalar<T>{
    alias: Name
    // scalarable: Scalarable<T> | Promise<Scalarable<T>>

    constructor(alias: Name, definition: PropertyTypeDefinition, expression: RawExpression){
        super(definition, expression)
        this.alias = alias
        // this.scalarable = scalarable
    }

    value(): { [key in Name]: Scalar<T> } {
        const key = this.alias
        //@ts-ignore
        return { [key]: this }
    }

    clone(): Column<Name, T> {
        return new Column(this.alias, this.definition, this.expression)
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

export const makeExpressionResolver = function<Props, M>(repository: EntityRepository<any>, fromSource: Datasource<any, any>, sources: Datasource<any, any>[], dictionary: M) {

    const resolver: ExpressionResolver<Props, M> = (expression: Expression<Props, M> | ExpressionFunc<Props, M>) => {
        let value
        if( expression instanceof Function) {
            value = expression(dictionary)
        } else {
            value = expression
        }
        if( value === null){
            return new Scalar(new BooleanType(), repository => makeRaw(repository, '?', [null]) )
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
            return value.toScalar(resolver)
        } else if(Array.isArray(value)){
            const expr = new OrOperator<Props, M>(...value )
            return resolver( expr )
        } else if(value instanceof Scalar){
            return value
        } else if (value instanceof Dataset) {
            throw new Error('Unsupport')
        } else if(value instanceof SimpleObjectClass){
            let dict = value as SimpleObject
            let scalars = Object.keys(dict).reduce( (scalars, key) => {
                
                let [sourceName, propName] = key.split('.')
                if(!propName){
                    propName = sourceName
                    sourceName = fromSource.sourceAlias//Object.keys(fromSource.tableAlias)[0]
                }
                let source = sources.find(s => fromSource.sourceAlias === sourceName)
                if(!source){
                    throw new Error(`cannot found source (${source})`)
                }

                let prop = source.schema.propertiesMap[propName]
                if(!prop){
                    throw new Error(`cannot found source (${source})`)
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
    
            }, [] as Scalar<BooleanType>[] )

            let arr = new AndOperator<Props, M>(...scalars)
            return resolver(arr)
        } else {
            throw new Error('Unsupport Where clause')
        }
    }

    return resolver
}

export async function resolveEntityProps<T extends typeof Entity, D extends T["schema"]>(source: Datasource<D, "root">, 
    props: ComputePropertyArgsMap<D> | undefined): Promise<{ [key: string]: Scalar<any> }> {
    
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
    let fieldCols = source.schema.properties.filter(prop => prop.type === 'FieldProperty')
        .map(prop => source.getFieldProperty<string, any>(prop.name).value() )
    let r = Object.assign({}, ...fieldCols, ...computedCols)
    return r as { [key: string]: Scalar<any> }
}
// export type EntityPropsResolver = <S extends Schema>() => RawFilter


// export function makePropsResolver<AcceptableSourceProps>(): EntityPropsResolver {


//     const resolver = (selector: Datasource<any>, querySelect: QuerySelect, row: Dataset) {
//         // let selector = getSelectorFunc()[0]
//         let stmtOrPromise: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = row.toQueryBuilder()
//         let allColumns: Array<Column | Promise<Column>> = []
//         if(querySelect && !Array.isArray(querySelect)){
//             let select = querySelect
//             if (select && Object.keys(select).length > 0) {

//                 let removeNormalPropNames = Object.keys(select).map((key: string) => {
//                     const item = select[key]
//                     if (item === false) {
//                         let prop = selector.schema.fieldProperties.find(p => p.name === key)
//                         if (!prop) {
//                             throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
//                         } else {
//                             if (!prop.definition.computeFunc) {
//                                 return prop.name
//                             }
//                         }
//                     }
//                     return null
//                 }).filter(notEmpty)

//                 if (removeNormalPropNames.length > 0) {
//                     const shouldIncludes = selector.schema.fieldProperties.filter(p => !removeNormalPropNames.includes(p.name))
//                     stmtOrPromise = thenResult(stmtOrPromise, s => s.clearSelect().select(...shouldIncludes))
//                 }

//                 //(the lifecycle) must separate into 2 steps ... register all computeProp first, then compile all
//                 let executedProps = Object.keys(select).map((key: string) => {
//                     const item = select[key]
//                     if (item === true) {
//                         let prop = selector.schema.fieldProperties.find(p => p.name === key)
//                         if (!prop) {
//                             throw new Error(`The property ${key} cannot be found in datasource '${selector}'`)
//                         }
//                         if (prop.definition.computeFunc) {
//                             return selector.$[prop.name]()
//                         }
//                     } else if (item instanceof SimpleObjectClass) {
//                         let options = item as QueryOptions

//                         let prop = selector.schema.fieldProperties.find(p => p.name === key && p.definition.computeFunc)

//                         if (!prop) {
//                             // if (options instanceof PropertyDefinition) {
//                             //     selector.registerProp(new NamedProperty(key, options))
//                             //     return selector.$$[key]()
//                             // } else {
//                             //     throw new Error('Temp Property must be propertyDefinition')
//                             // }
//                             throw new Error(`Cannot find Property ${key}`)
//                         } else {
//                             if (!prop.definition.computeFunc) {
//                                 throw new Error('Only COmputeProperty allows QueryOptions')
//                             }
//                             return selector.$$[key](options)
//                         }
//                     } else if (isScalar(item)){
//                         let scalar = item as Scalar
//                         return scalar.asColumn(key)
//                     }
//                     return null
//                 }).filter(notEmpty)
//                 allColumns.push(...executedProps)
//             }
//         } else if (querySelect && querySelect instanceof Array) {
//             let select = querySelect

//             let props = select.map(s => {
//                 if( isColumn(s)) {
//                     return s  as Column
//                 } else if( typeof s === 'string'){
//                     let prop = selector.schema.fieldProperties.find(p => p.name === s)
//                     if (!prop) {
//                         throw new Error(`The property ${s} cannot be found in schema '${selector.entityClass.name}'`)
//                     }
//                     if (prop.definition.computeFunc) {
//                         return selector.$$[prop.name]()
//                     } else {
//                         return selector._[prop.name]
//                     }
//                 }
//                 throw new Error('Unexpected type')
//             })

//             allColumns.push(...props)
//         }

//         // !important: must use a constant to reference the object before it is re-assigned
//         const prevStmt = stmtOrPromise
//         let stmtOrPromiseNext = thenResultArray(allColumns, columns => {
//             return columns.reduce((stmt, column) => {
//                 return thenResult(stmt, stmt => stmt.select(column))
//             }, prevStmt)
//         })

//         return thenResult(stmtOrPromiseNext, stmt => stmt.toRow())
//     }
// }


// function makeSelectItem(selector: Selector, prop: NamedProperty): SelectItem {
//     let tableAlias = quote(selector.tableAlias)
//     let fieldName: string = quote(prop.fieldName)
//     let a = metaFieldAlias(prop)
//     let raw = `${tableAlias}.${fieldName} AS ${quote(a)}`
//     return {
//         raw: makeRaw(raw),
//         actualAlias: a
//     }
// }


// const wrap = (col: Column | Promise<Column>) => {

//     let w = {}
//     w.count = () => {
//         // if(!expression){
//         //     throw new Error('only computedProp can use count()')
//         // }
//         // if(prop === '*'){
//         //     throw new Error('only computedProp can use count()')
//         // }

//         let p = (col: Column) => makeColumn(null, new NamedProperty(`${prop.name}`, Types.Number, null), 
//             makeBuilder().count().from(makeRaw(expression)) )

//         if(col instanceof Promise){
//             return new Promise( (resolve, reject) => {
//                 col.then(column => {
//                     resolve(p(column))
//                 })
//             })
//         }else{
//             return p(col)
//         }
        
        
//     }

//     return w
// }

    

// const extractColumnName = () => {

//     let columnsToBeTransformed: string[] = []
//     if( ast.type === 'select'){
//         let selectAst = ast
//         let columns = ast.columns
        
//         // then handle select items... expand columns

//         const handleColumns = (from: any[] | null, columns: any[] | Column[] | '*'): any[] | Column[] => {
//             if(columns === '*'){
//                 columns = [{
//                     expr: {
//                         type: 'column_ref',
//                         table: null,
//                         column: '*'
//                     },
//                     as: null
//                 }]
//             }

//             return columns.flatMap( (col: Column) => {
//                 if(col.expr.type === 'column_ref' && ( col.expr.column.includes('*') || col.expr.column.includes('$star') ) ){
//                     // if it is *... expand the columns..
//                     let moreColumns = Database._resolveStar(col, from)
//                     return moreColumns
//                     // @ts-ignore
//                 } else if(!col.as && col.expr.type === 'select' && col.expr.columns.length === 1){
//                     // @ts-ignore
//                     col.as = col.expr.columns[0].as
//                     if(!col.as){
//                         throw new Error('Unexpected Flow.')
//                     }
//                     return col
//                 } else {

//                     if(!col.as){
//                         col.as = makeid(5)
//                     }
//                     return col
//                 }
//             })
            
//         }

//         let processedColumns = handleColumns(selectAst.from, columns) as Column[]

//         //eliminate duplicated columns

//         processedColumns = processedColumns.reduce( (acc: any[], item: SimpleObject) => {
//             if( !acc.find( (x:any) => item.as === x.as ) ){
//                 acc.push(item)
//             }
//             return acc
//         },[] as any[])

//         columnsToBeTransformed = processedColumns.flatMap( (col: any) => {
//             return Database._extractColumnAlias(col) 
//         }) as string[]
    
//         ast.columns = processedColumns
//         subqueryString = getSqlParser().sqlify(ast)
//     } else {
//         throw new Error('Computed property must be started with Select')
//     }


// }

// export type QueryBuilderAccessableField = string | CompiledNamedPropertyGetter | CompiledNamedProperty | CompiledNamedPropertyWithSubQuery

// const resolveItem = (a: any, withoutAs: boolean = false) => {
//     if(a instanceof CompiledNamedPropertyWithSubQuery){
//         // it should be computedProp
//         let compiledNamedProperty = a.compiledNamedProperty
//         let derivedContent = a.subquery

//         if(withoutAs){
//             return `${derivedContent}`
//         } else {
//             return `${derivedContent} AS ${compiledNamedProperty.fieldAlias}`
//         }
//     } else if (a instanceof CompiledNamedPropertyGetter){
//         // it should be normal field prop
//         let compiledNamedProperty = a.get() as CompiledNamedProperty
//         return `${compiledNamedProperty.tableAlias}.${compiledNamedProperty.fieldName}`

//     } else if (a instanceof CompiledNamedProperty){
//         return `${a.tableAlias}.${a.fieldName}`
//     } else {
//         return a
//     }
// }

// export class QueryBuilder {

//     selectItems: Array<string> = new Array<string>()
//     fromItems: Array<string> = new Array<string>()
//     whereItems: Array<string> = new Array<string>()
//     limitValue: number | null = null
//     offsetValue: number | null = null

//     constructor(){
//     }

//     select(...args: Array<QueryBuilderAccessableField>){
//         let selectItems = args.map(a => {
//             let resolved = resolveItem(a)
//             if (typeof resolved === 'string'){
//                 //typeof a === 'boolean' || typeof a === 'number' || a instanceof Date
//                 return resolved
//             } else {
//                 throw new Error('Not supported Select Item.')
//             }
//         })
//         this.selectItems = selectItems
//         return this
//     }

//     from(...args: string[]){
//         this.fromItems = args
//         return this
//     }

//     whereRaw(rawSql: string, args: any[]){
//         let r = getKnexInstance().raw(rawSql, args.map(a => resolveItem(a, true)))
//         this.whereItems = this.whereItems.concat([r.toString()])
//         return this
//     }

//     where(...args: any[]){
//         args = args.map(a => resolveItem(a, true))
//         if(args.length === 1 && args[0] instanceof Object){
//             let map = args[0] as {[key:string]:any}
//             let items = Object.keys(map).map( (key) => `?? = ?`)
//             let values = Object.keys(map).reduce( (params, key) => {
//                 let arr = [key, map[key]]
//                 return params.concat(arr)
//             }, [] as any[])

//             let raw = getKnexInstance().raw( items.join(' AND '), values)

//             this.whereItems = this.whereItems.concat([raw.toString()])

//         } else if(args.length === 1 && typeof args[0] === 'string'){
//             this.whereItems = this.whereItems.concat([args[0]])
//         } else {
//             this.whereItems = this.whereItems.concat([args.join(' ')])
//         }
//         return this
//     }

//     limit(value: number){
//         this.limitValue = value
//         return this
//     }

//     offset(value: number){
//         this.offsetValue = value
//         return this
//     }

//     toString(): string{
//         let selectItem = this.selectItems
//         if(this.fromItems.length > 0 && selectItem.length === 0){
//             selectItem = selectItem.concat('*')
//         }
//         // throw new Error('NYI')
//         return `SELECT ${selectItem.join(', ')}${
//             this.fromItems.length > 0?' FROM ':''}${
//             this.fromItems.join(', ')}${
//             this.whereItems.length > 0?' WHERE ':''}${
//             this.whereItems.join(', ')}${
//             this.offsetValue === null?'':` OFFSET ${this.offsetValue} `}${
//             this.limitValue === null?'':` LIMIT ${this.limitValue} `
//         }`
//     }
// }

