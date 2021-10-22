import { Knex}  from "knex"
import { v4 as uuidv4 } from 'uuid'
import { ConstructComputePropertyArgsDictFromSchema, SelectorMap, CompiledComputeFunction, DatabaseContext, ComputeFunction, ExtractValueTypeDictFromPropertyDict, Scalarable, ExecutionOptions, DatabaseQueryRunner, ExtractValueTypeDictFromSchema, DatabaseMutationRunner, PropertyDefinition } from "."
import { AndOperator, ConditionOperator, ContainOperator, EqualOperator, IsNullOperator, NotOperator, OrOperator, AssertionOperator, ExistsOperator } from "./Operator"
import { BooleanType, BooleanNotNullType, DateTimeType, FieldPropertyTypeDefinition, NumberType, NumberNotNullType, ObjectType, ParsableTrait, PropertyTypeDefinition, StringType, ArrayType, PrimaryKeyType, StringNotNullType } from "./PropertyType"
import { ComputeProperty, Datasource, DerivedDatasource, FieldProperty, ScalarProperty, Schema, TableSchema } from "./Schema"
import { expandRecursively, ExpandRecursively, ExtractFieldPropDictFromDict, ExtractFieldPropDictFromSchema, ExtractPropDictFromDict, ExtractPropDictFromSchema, isFunction, makeid, notEmpty, quote, ScalarDictToValueTypeDict, SimpleObject, SimpleObjectClass, SQLString, thenResult, thenResultArray, UnionToIntersection } from "./util"

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

type ScalarDictToScalarPropertyDict<D> = {
    [key in keyof D]: D[key] extends Scalar<infer P>? ScalarProperty<P>: never
}

type SelectedPropsToScalarDict<SourceProps, P> = {
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
                            (C extends FieldProperty<infer D>?
                                ScalarProperty<D>:  
                                (
                                    C extends ComputeProperty<ComputeFunction<any, any, infer P>>? 
                                    ScalarProperty<P>:
                                    (
                                        C extends ScalarProperty<any>? 
                                        C:
                                        never
                                    )
                                )
                            )
                            : 
                            never
                        ): never
            }


export type MutationEntityPropertyKeyValues<E> = {
    [key in keyof E]:
        E[key] extends Prefixed<any, any, infer C>? (
                C extends FieldProperty<infer D>? (D extends FieldPropertyTypeDefinition<infer Primitive>? (Primitive | Scalar<D> ): never): never
             ): E[key] extends FieldProperty<infer D>? (D extends FieldPropertyTypeDefinition<infer Primitive>? (Primitive | Scalar<D> ): never): never
             
}

export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => AndOperator<Props, PropMap>,
    Or: (...condition: Array<Expression<Props, PropMap> > ) => OrOperator<Props, PropMap>,
    Not: (condition: Expression<Props, PropMap>) => NotOperator<Props, PropMap>,
    Exists: (dataset: Dataset<any, any, any>) => ExistsOperator<Props, PropMap>
}

export type ExpressionFunc<O, M> = (map: UnionToIntersection< M | SQLKeywords<O, M> > ) => Expression<O, M>

export type Expression<O, M> = Partial<MutationEntityPropertyKeyValues<O>>  
    | AndOperator<O, M> 
    | OrOperator<O, M> 
    | NotOperator<O, M>
    | ExistsOperator<O, M>
    | Scalar<any>
    | Array<Expression<O, M> > 
    | boolean | string | Date | number

export type Prefixed<Prefix extends string, MainName extends String, Content> = {
    type: 'Prefixed',
    prefix: Prefix,
    mainName: MainName,
    content: Content
}

export type AddPrefix<E, k extends string, delimitor extends string = '.'> = {
    [key in keyof E & string as `${k}${delimitor}${key}`]: Prefixed<k, key, E[key]>
}

abstract class StatementBase {

    protected context?: DatabaseContext<any> | null = null

    constructor(context?: DatabaseContext<any> | null){
        this.context = context
    }

    protected sqlKeywords<X, Y>(resolver: ExpressionResolver<X, Y>){
        let sqlkeywords: SQLKeywords<X, Y> = {
            And: (...conditions: Expression<X, Y>[]) => new AndOperator(resolver, ...conditions),
            Or: (...conditions: Expression<X, Y>[]) => new OrOperator(resolver, ...conditions),
            Not: (condition: Expression<X, Y>) => new NotOperator(resolver, condition),
            Exists: (dataset: Dataset<any, any, any>) => new ExistsOperator(resolver, dataset)
        }
        return sqlkeywords
    }

    protected async scalarMap2RawMap(targetSchema: Schema<any>, nameMap: { [key: string]: Scalar<any> }, context: DatabaseContext<any>) {
        const client = context.client()
        return await Object.keys(nameMap).reduce( async (accP, k) => {

            const acc = await accP

            let prop = targetSchema.propertiesMap[k]

            if(prop instanceof FieldProperty){
                // let acc = await accP
                let scalar = nameMap[k]
                if(!scalar){
                    throw new Error(`cannot resolve field ${k}`)
                }
                const raw: Knex.Raw = await scalar.toRaw(context)
                let text = raw.toString().trim()
    
                if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                    text = `(${text})`
                }
                acc[prop.fieldName(context.orm)] = makeRaw(context, text)
            }

            return acc
        }, Promise.resolve({} as {[key:string]: Knex.Raw<any>}) )
    }

    abstract toNativeBuilder(repo?: DatabaseContext<any>): Promise<Knex.QueryBuilder>

    abstract execute(this: StatementBase, repo?: DatabaseContext<any>): any
}

abstract class WhereClauseBase<SourceProps ={}, SourcePropMap = {}, FromSource extends Datasource<any, any> = Datasource<any, any>>  extends StatementBase {

    protected fromItem: null | Datasource<Schema<any>, string> = null
    protected joinItems:  Array<{type: 'inner' | 'left' | 'right', source: Datasource<Schema<any>, string>, expression: Expression<any, any> | ExpressionFunc<any, any>  }> = []
    protected whereRawItem: null |  Expression<any, any> = null

    protected getSelectorMap(): SourcePropMap {
        let sources = this.joinItems.map(item => item.source)
        if(this.fromItem){
            sources.push(this.fromItem)
        }

        const sourcePropMap = sources.reduce( (acc, source) => {
            const t = source.sourceAlias
            acc[t] = source.selectorMap()
            return acc
        }, {} as {[key:string]: SelectorMap<any> } )

        return sourcePropMap as any
    }

    protected baseWhere<X extends ExtractPropDictFromDict<SourceProps>, Y extends SourcePropMap & SQLKeywords< X, SourcePropMap >  >(expression: Expression< X, Y> | ExpressionFunc<X, Y> ): WhereClauseBase<SourceProps, SourcePropMap, FromSource>{
        this.whereRawItem = expression
        return this
    }

    protected baseFrom<S extends Schema<any>, SName extends string>(source: Datasource<S, SName>):
        WhereClauseBase<
            UnionToIntersection< AddPrefix< ExtractPropDictFromDict< S>, '', ''> | AddPrefix< ExtractPropDictFromDict< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> }>, Datasource<S, SName>
        > {
            this.fromItem = source
            return this as any
        }

    protected baseInnerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y >): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "inner",
            source,
            expression
        })
        return this as any
    }
     
    protected baseLeftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "left",
            source,
            expression
        })
        return this as any
    }

    protected baseRightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "right",
            source,
            expression
        })
        return this as any
    }

    protected async buildWhereClause(context: DatabaseContext<any>, nativeQB: Knex.QueryBuilder<any, unknown[]>) {
        let selectorMap = this.getSelectorMap()

        let resolver = makeExpressionResolver(this.fromItem, this.joinItems.map(item => item.source), selectorMap)

        Object.assign(selectorMap, this.sqlKeywords(resolver))

        await this.joinItems.reduce(async (acc, item) => {
            await acc
            let finalExpr = await resolver(item.expression).toRaw(context)

            if (item.type === 'inner') {
                nativeQB.innerJoin(await item.source.toRaw(context), finalExpr)
            } else if (item.type === 'left') {
                nativeQB.leftJoin(await item.source.toRaw(context), finalExpr)
            } else if (item.type === 'right') {
                nativeQB.rightJoin(await item.source.toRaw(context), finalExpr)
            }
            return true
        }, Promise.resolve(true))

        if (this.whereRawItem) {
            const where: Knex.Raw = await resolver(this.whereRawItem).toRaw(context)
            nativeQB.where(where)
        }
    }

}

export class Dataset<ExistingSchema extends Schema<{}>, SourceProps ={}, SourcePropMap ={}, FromSource extends Datasource<any, any> = Datasource<any, any>> 
    extends WhereClauseBase<SourceProps, SourcePropMap, FromSource>
    implements Scalarable<any> {

    // parsableType: ParsableTrait<any> | null = null
    // __type: 'Dataset' = 'Dataset'
    protected datasetSchema: null | Schema<any> = null

    #selectItems: { [key: string]: Scalar<any> } | null = null
   
    
    #groupByItems: { [key: string]: Scalar<any> } | null = null
    #limit: null | number = null
    #offset: null | number = null

    nativeBuilderCallbacks: ((nativeBuilder: Knex.QueryBuilder) => Promise<void> | void)[] = []

    constructor(context?: DatabaseContext<any> | null){
        super(context)
        // this.#fromItem = fromSource
        this.context = context ?? null
    }

    // get actionType(): Action{
    //     if(this.#selectItems && Object.keys(this.#selectItems).length > 0)
    //         return 'select'
    //     if(this.#updateItems && Object.keys(this.#updateItems).length > 0)
    //         return DatasetAction.Update
    //     throw new Error('NYI')
    // }

    protected func2ScalarMap<S extends { [key: string]: Scalar<any>} , Y extends UnionToIntersection<SourcePropMap | SQLKeywords<ExtractPropDictFromDict<SourceProps>, SourcePropMap>>>(named: S | ((map: Y) => S)) {
        let nameMap: { [key: string]: Scalar<any>} 
        let selectorMap = this.getSelectorMap()
        let resolver = makeExpressionResolver(this.fromItem, this.joinItems.map(item => item.source), selectorMap)

        if (named instanceof Function) {
            Object.assign(selectorMap, this.sqlKeywords(resolver))
            const map = Object.assign({}, this.getSelectorMap(), this.sqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        } else {
            nameMap = named
        }

        const result = Object.keys(nameMap).reduce((acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any>} )
        return result
    }

    protected propNameArray2ScalarMap(properties: string[]){
        let map = this.getSelectorMap() as unknown as {[key1: string]: { [key2: string]: Scalar<any>}}
        let fields = properties
        let nameMap: { [key: string]: Scalar<any> } = fields.reduce( (acc, key:string) => {
            let [source, field] = key.split('.')
            let item: Scalar<any> | CompiledComputeFunction<any, any> | null = null
            if(!field){
                field = source
                if(!this.fromItem){
                    throw new Error(`There must be a FROM`)
                }
                let from = this.fromItem.selectorMap() //as SelectorMap< {[key:string]: any}>
                item = from[field]
            }
            else {
                item = map[source][field]
            }

            if(!item){
                throw new Error('Cannot resolve field')
            }else if(item instanceof Scalar){
                acc = Object.assign({}, acc, {[field]: item})
            }else {
                acc = Object.assign({}, acc, {[field]: item()})    
            }
            
            return acc
        }, {})
        return nameMap
    }

    protected async queryScalarMap2RawArray(nameMap: { [key: string]: Scalar<any> }, context: DatabaseContext<any>, includeAlias: boolean): Promise<Knex.Raw<any>[]> {
        const client = context.client()
        return await Promise.all(Object.keys(nameMap).map(async (k) => {

            // let acc = await accP
            let scalar = nameMap[k]
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await scalar.toRaw(context)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = makeRaw(context, `${text}${includeAlias?` AS ${quote(client, k)}`:''}`)

            return newRaw
        }))
    }

    protected clearSchema() {
        this.datasetSchema = null
    }

    toDataset(): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource> {
        return this
    }
    

    selectItemsAlias(): string[]{
        if(!this.#selectItems){
            return []
        }
        const selectItems = this.#selectItems
        return Object.keys(selectItems)
    }

    native(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource>{
        this.nativeBuilderCallbacks = []
        this.addNative(nativeBuilderCallback)
        return this
    }
    
    addNative(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource>{
        this.nativeBuilderCallbacks.push(nativeBuilderCallback)
        return this
    }

    toScalar<T extends Dataset<any, any, any, any>>(this: T): Scalar<ArrayType<ExistingSchema>> {
        return new Scalar(this, new ArrayType(this.schema()), this.context) //as unknown as Scalar<T> 
    }

    castToScalar<T extends PropertyTypeDefinition<any>>(
        this: Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource>,
        type: 
        T | 
        (new () => T) | 
        ((dataset: typeof this) => T)): Scalar<T> {

        if(type instanceof PropertyTypeDefinition){
            return new Scalar(this, type, this.context) //as unknown as Scalar<T> 
        } else if(isFunction(type)){
            return new Scalar(this, type(this), this.context)
        } else {
            return new Scalar(this, new type(), this.context) 
        }
    }

    where<X extends ExtractPropDictFromDict<SourceProps>, Y extends SourcePropMap & SQLKeywords< X, SourcePropMap >  >(expression: Expression< X, Y> | ExpressionFunc<X, Y> ): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource>{
        return this.baseWhere(expression) as any
    }

    from<S extends Schema<any>, SName extends string>(source: Datasource<S, SName>):
        Dataset< Schema<{}>, 
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> }>, Datasource<S, SName>
        > {
            return this.baseFrom(source) as any
        }

    innerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y >): Dataset<ExistingSchema,X,Y, FromSource>{
        
        return this.baseInnerJoin(source, expression) as any
    }
     
    leftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<ExistingSchema,X,Y, FromSource>{
        return this.baseLeftJoin(source, expression) as any
    }

    rightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): Dataset<ExistingSchema,X,Y, FromSource>{
        return this.baseRightJoin(source, expression) as any
    }
    
    selectProps<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                SelectedPropsToScalarDict<SourceProps, P>
            >
        , 
        SourceProps, SourcePropMap, FromSource>{
       
        this.clearSchema()
        this.#selectItems = this.propNameArray2ScalarMap(properties as string[])
        return this as any
    }

    groupByProps<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                SelectedPropsToScalarDict<SourceProps, P>
            >
        , 
        SourceProps, SourcePropMap, FromSource>{
       
        this.#groupByItems = this.propNameArray2ScalarMap(properties as string[])
        return this as any
    }

    select<S extends { [key: string]: Scalar<any> }, Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractPropDictFromDict<SourceProps>, SourcePropMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                ScalarDictToScalarPropertyDict<S>
            >
        , 
        SourceProps, SourcePropMap, FromSource> {
        
        this.clearSchema()
        const result = this.func2ScalarMap<S, Y>(named)

        this.#selectItems = result
        return this as any
    }

    groupBy<S extends { [key: string]: Scalar<any> }, Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractPropDictFromDict<SourceProps>, SourcePropMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                ScalarDictToScalarPropertyDict<S>
            >
        , 
        SourceProps, SourcePropMap, FromSource> {

        const result = this.func2ScalarMap<S, Y>(named)

        this.#groupByItems = result
        return this as any
    }
    
    //<ExistingSchema, SourceProps, SourcePropMap, FromSource>
    // clone<T extends typeof Dataset>(d: T): InstanceType<T> {
    //     const newDataset = new d()
    //     newDataset.fromItem = this.fromItem
    //     newDataset.#joinItems = this.#joinItems.map(i => i)
    //     newDataset.#selectItems = this.#selectItems
    //     newDataset.whereRawItem = this.whereRawItem
    //     newDataset.nativeBuilderCallbacks = this.nativeBuilderCallbacks.map(i => i)
    //     newDataset.#updateItems = this.#updateItems
    //     newDataset.#groupByItems = this.#groupByItems
    //     newDataset.#insertItems = this.#insertItems
    //     newDataset.#insertToSchema = this.#insertToSchema
    //     newDataset.#uuidForInsertion = this.#uuidForInsertion
    //     return newDataset as any
    // }


    limit(limit: number | null): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource> {
        this.#limit = limit
        return this
    }

    offset(offset: number | null): Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource> {
        this.#offset = offset
        return this
    }

    datasource<Name extends string>(name: Name): Datasource<any, Name> {
        return new DerivedDatasource(this, name)
    }

    schema(): ExistingSchema {
        if(!this.#selectItems){
            throw new Error('No selectItems for a schema')
        }
        if(!this.datasetSchema){
            const selectItems = this.#selectItems
            const propertyMap =  Object.keys(selectItems).reduce((acc, key) => {
                acc[key] = new ScalarProperty(selectItems[key])
                return acc
            }, {} as {[key:string]: ScalarProperty<any>})
            
            let schema = new Schema(propertyMap)
            this.datasetSchema = schema
        }
        return this.datasetSchema as ExistingSchema
    }

    // hasSelectedItems(){
    //     return Object.keys(this.#selectItems ?? {}).length > 0
    // }

    async toNativeBuilder(repo?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        let nativeQB = context.orm.getKnexInstance().clearSelect()
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'


        if(!this.#selectItems || Object.keys(this.#selectItems).length === 0){
            throw new Error('Not selectItems')
        }

        if(this.fromItem){
            const from = await this.fromItem.toRaw(context)
            nativeQB.from(from)
        }

        await this.buildWhereClause(context, nativeQB)

        if(this.#groupByItems){
            const groupByItems = await this.queryScalarMap2RawArray(this.#groupByItems, context, false)
            if(groupByItems.length === 0){
                throw new Error('No groupByItems')
            }
            nativeQB.groupByRaw( groupByItems.map(item => item.toString()).join(',') )
        }

        if(this.#offset) {
            nativeQB.offset(this.#offset)
        }

        if(this.#limit) {
            nativeQB.limit(this.#limit)
        }

        if(this.#selectItems){
            const selectItems = await this.queryScalarMap2RawArray(this.#selectItems, context, true)
            if(selectItems.length === 0 && !this.fromItem){
                throw new Error('No SELECT and FROM are provided for Dataset')
            }
            nativeQB.select( selectItems )
        }
    
        await Promise.all(this.nativeBuilderCallbacks.map( async(callback) => {    
            await callback(nativeQB)
        }))

        return nativeQB
    }

    execute<S extends Schema<any>>(this: Dataset<S, any, any, any>, repo?: DatabaseContext<any>): 
        DatabaseQueryRunner<ExpandRecursively< ExtractValueTypeDictFromSchema<S>[] >>
    {
        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }
        const current = this

        return new DatabaseQueryRunner<ExpandRecursively< ExtractValueTypeDictFromSchema<S>[] >>(

                async (executionOptions: ExecutionOptions) => {

                    const nativeSql = await current.toNativeBuilder(context)

                    let data = await context.executeStatement(nativeSql, {}, executionOptions)
        
                    // console.log('data', data)
                    let rows: any
                    if(context.client().startsWith('mysql')){
                        rows = data[0][0]
                    } else if(context.client().startsWith('sqlite')){
                        rows = data
                    } else if(context.client().startsWith('pg')){
                        rows = data.rows[0]
                    } else {
                        throw new Error('Unsupport client.')
                    }

                    if(!Array.isArray(rows)){
                        throw new Error('Unexpected.')
                    }
            
                    const len = rows.length
                    const schema = current.schema()
                    
                    await schema.prepareForParsing(context)

                    let parsedRows = new Array(len) as ExtractValueTypeDictFromPropertyDict< (S extends Schema<infer Dict>?Dict:never) >[]
                    // console.log(schema)
                    for(let i=0; i <len;i++){
                        parsedRows[i] = schema.parseRaw(rows[i], context)
                    }
                
                    // console.timeEnd('parsing')
                    // console.log('parsed', parsedRows)
                    return expandRecursively(parsedRows)
                })
    }
}

export class InsertStatement<T extends TableSchema<any>> 
    extends StatementBase {

    #insertIntoSchema: T
    #insertItems: { [key: string]: Scalar<any> } | null = null
    #uuidForInsertion: string | null = null

    constructor(insertToSchema: T, context?: DatabaseContext<any> | null){
        super(context)
        this.#insertIntoSchema = insertToSchema
    }

    insertInfo(){
        return {
            schema: this.#insertIntoSchema,
            uuid: this.#uuidForInsertion
        }
    }

    values<S extends Partial<MutationEntityPropertyKeyValues<ExtractFieldPropDictFromSchema<T>>> , Y extends UnionToIntersection< SQLKeywords< '', {}> >>
    (keyValues: S | ((map: Y ) => S )): InsertStatement<T>{
        
        let nameMap: { [key: string]: any | Scalar<any> }
        let selectorMap = {}
        let resolver = makeExpressionResolver(null, [], selectorMap)
        
        if(keyValues instanceof Function){    
            Object.assign(selectorMap, this.sqlKeywords(resolver) )
            const map = Object.assign({}, this.sqlKeywords<any, any>(resolver)) as Y
            nameMap = keyValues(map)
        } else {
            nameMap = keyValues
        }

        this.#insertItems = Object.keys(nameMap).reduce( (acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any> } )


        return this
    }

    async toNativeBuilder(repo?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        let nativeQB = context.orm.getKnexInstance().from(this.#insertIntoSchema.tableName(context))
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

    
        if(!this.#insertItems){
            throw new Error('No insert Items')
        }

        let targetSchema = this.#insertIntoSchema
        const schemaPrimaryKeyFieldName = targetSchema.id.fieldName(context.orm)
        const schemaPrimaryKeyPropName = targetSchema.id.name
        const schemaUUIDPropName = targetSchema.uuid?.name
        const schemaUUIDFieldName = targetSchema.uuid?.fieldName(context.orm)

        let useUuid: boolean = !!context.orm.ormConfig.enableUuid
        if (context.client().startsWith('sqlite')) {
            if (!context.orm.ormConfig.enableUuid ){
                throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
            }
        }

        let additionalFields = {}
        if(useUuid){
            if(!schemaUUIDPropName) {
                throw new Error('No UUID')
            }
            additionalFields = {[schemaUUIDPropName]: Scalar.value(`:uuid`, [], new StringNotNullType() )}
        }

        const insertItems = await this.scalarMap2RawMap(this.#insertIntoSchema, Object.assign({}, this.#insertItems, additionalFields), context)
     
        nativeQB.insert( insertItems )

        if ( context.client().startsWith('pg')) {
            nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName)
        }

        return nativeQB        
    }

    executeAndReturn(repo?: DatabaseContext<any>)
     {
        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }
        
        return new DatabaseQueryRunner( async(executionOptions) => {
            let fns = await context.startTransaction(async (trx) => {
                executionOptions = {...executionOptions, trx}
                
                const ds = this
                let {id, uuid} = await ds.execute(context).withOptions(executionOptions)

                
                if(id === null){
                    if(!uuid){
                        throw new Error('Unexpected.')
                    }
                    // let info = ds.insertInfo()
                    const schema = this.#insertIntoSchema as TableSchema<{id: FieldProperty<any>, uuid: FieldProperty<any>}>
                    
                    let result = await context.dataset()
                        .from(schema.datasource('root'))
                        .where( ({root}) => root.uuid.equals(uuid))
                        .select( ({root}) => root.$allFields ).execute().withOptions(executionOptions) 

                    return result[0] as unknown as ExtractValueTypeDictFromPropertyDict<ExtractFieldPropDictFromSchema<T>>

                } else {
                    const schema = this.#insertIntoSchema as TableSchema<{id: FieldProperty<PrimaryKeyType>}>

                    let result = await context.dataset()
                        .from(schema.datasource('root'))
                        .where( ({root}) => root.id.equals(id))
                        .select( ({root}) => root.$allFields ).execute().withOptions(executionOptions)
                    
                    return result[0] as unknown as ExtractValueTypeDictFromPropertyDict<ExtractFieldPropDictFromSchema<T>>
                }
                
            }, executionOptions.trx)
            return fns
        })
    }

    execute(repo?: DatabaseContext<any>) {
        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }
        return new DatabaseMutationRunner(

            async (executionOptions: ExecutionOptions) => {
                const queryBuilder = await this.toNativeBuilder(context)


                let insertedId = await context.startTransaction(async (trx) => {

                    //replace the trx
                    executionOptions = {...executionOptions, trx: trx}
        
                    // let afterMutationHooks = schema.hooks.filter()
        
                    // console.debug('======== INSERT =======')
                    // console.debug(stmt.toString())
                    // console.debug('========================')
                    if (context.client().startsWith('mysql')) {
                        let insertedId: number
                        const insertStmt = queryBuilder.toString() + '; SELECT LAST_INSERT_ID() AS id '
                        const r = await context.executeStatement(insertStmt, {}, executionOptions)
                        insertedId = r[0][0].id
                        // let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId])  )
            
                        return {id: insertedId}
                    } else if (context.client().startsWith('sqlite')) {
                        const insertStmt = queryBuilder.toString()
                        let uuid = uuidv4()
                        const r = await context.executeStatement(insertStmt, {uuid}, executionOptions)
    
                        return {id: null, uuid}
        
                    } else if (context.client().startsWith('pg')) {
                        const insertStmt = queryBuilder.toString()
                        let insertedId: number
                        const r = await context.executeStatement(insertStmt, {}, executionOptions)
                        
                        insertedId = Object.keys(r.rows[0]).map(k => r.rows[0][k])[0]
                        return {id: insertedId}
                        // return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
        
                    } else {
                        throw new Error('Unsupport client')
                    }
                    
                }, executionOptions.trx)

                return insertedId
            })
    }

}

export class UpdateStatement<SourceProps ={}, SourcePropMap ={}, FromSource extends Datasource<any, any> = Datasource<any, any>> 
    extends WhereClauseBase<SourceProps, SourcePropMap, FromSource>
    {

    #updateItems: { [key: string]: Scalar<any> } | null = null

    constructor(repo?: DatabaseContext<any>){
        super(repo)
    }

    from<S extends Schema<any>, SName extends string>(source: Datasource<S, SName>):
        UpdateStatement< 
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> }>, Datasource<S, SName>
        > {
            return this.baseFrom(source) as any
        }

    where<X extends ExtractPropDictFromDict<SourceProps>, Y extends SourcePropMap & SQLKeywords< X, SourcePropMap >  >(expression: Expression< X, Y> | ExpressionFunc<X, Y> ): UpdateStatement<SourceProps, SourcePropMap, FromSource>{
        return this.baseWhere(expression) as any
    }

    innerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y >): UpdateStatement<X,Y, FromSource>{
        
        return this.baseInnerJoin(source, expression) as any
    }
     
    leftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseLeftJoin(source, expression) as any
    }

    rightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromDict< S>, SName>>,
        Y extends UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y> | ExpressionFunc<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseRightJoin(source, expression) as any
    }

    set<S extends Partial<MutationEntityPropertyKeyValues<ExtractFieldPropDictFromSchema< (FromSource extends Datasource<infer DS, any>?DS:never)>>> , 
        Y extends UnionToIntersection< SourcePropMap | SQLKeywords< ExtractPropDictFromDict<SourceProps>, SourcePropMap> >>
    (keyValues: S | ((map: Y ) => S )): UpdateStatement<SourceProps, SourcePropMap, FromSource>{
        
        let nameMap: { [key: string]: any | Scalar<any> }
        let selectorMap = this.getSelectorMap()
        let resolver = makeExpressionResolver(this.fromItem, this.joinItems.map(item => item.source), selectorMap)
        
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


        return this
    }

    async toNativeBuilder(repo?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }
                
        if(!this.#updateItems){
            throw new Error('No update items')
        }
        if(!this.fromItem){
            throw new Error('No from item')
        }
        const from = await this.fromItem.toRaw(context)
        let nativeQB = context.orm.getKnexInstance().from(from)
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

        await this.buildWhereClause(context, nativeQB)

        const updateItems = await this.scalarMap2RawMap(this.fromItem.schema, this.#updateItems, context)
        if(Object.keys(updateItems).length === 0 && !this.fromItem){
            throw new Error('No UPDATE and FROM are provided for Dataset')
        }
        nativeQB.update( updateItems )

        return nativeQB
    }


    execute<S extends Schema<any>>(repo?: DatabaseContext<any>) {

        const context = repo ?? this.context
        if(!context){
            throw new Error('There is no repository provided.')
        }

        return new DatabaseMutationRunner(
            async (executionOptions: ExecutionOptions) => {
                const nativeSql = await this.toNativeBuilder(context)
                let data = await context.executeStatement(nativeSql, {}, executionOptions)
                return data
            })
    }

}


type RawUnit<T extends PropertyTypeDefinition<any> = any> = Knex.Raw | Promise<Knex.Raw> | Knex.QueryBuilder | Promise<Knex.QueryBuilder> | Promise<Scalar<T>> | Scalar<T> | Dataset<any, any, any, any> | Promise<Dataset<any, any, any, any>>
type RawExpression<T extends PropertyTypeDefinition<any> = any> = ( (context: DatabaseContext<any>) => RawUnit<T>) | RawUnit<T>

export class Scalar<T extends PropertyTypeDefinition<any>> implements Scalarable<T> {
    // __type: 'Scalar'
    // __definition: PropertyTypeDefinition | null

    // #cachedDefinition: PropertyTypeDefinition<any> | null = null
    readonly declaredDefinition?: T | null
    protected expressionOrDataset: RawExpression<T>
    protected context: DatabaseContext<any> | null = null
    #calculatedDefinition: PropertyTypeDefinition<any> | null = null
    #calculatedRaw: Knex.Raw | null = null
    
    // protected dataset:  | null = null
    constructor(expressionOrDataset: RawExpression<T>, 
        definition?: T | (new (...args: any[]) => T) | null,
        context?: DatabaseContext<any> | null){
        if(definition instanceof PropertyTypeDefinition){
            this.declaredDefinition = definition
        } else if(definition)
        {
            this.declaredDefinition = new definition()
        }
        this.expressionOrDataset = expressionOrDataset
        this.context = context ?? null
    }

    static value<D extends PropertyTypeDefinition<any>>(sql: string, args?: any[], definition?: D): Scalar<D>{
        return new Scalar( (context: DatabaseContext<any>) => {
            if(!args){
                return makeRaw(context, sql)
            } else {
                const rawArgs = args.map( (arg) => {
                    if(arg instanceof Scalar){
                        return arg.toRaw(context)
                    } else if(arg instanceof Dataset){
                        return arg.toNativeBuilder(context)
                    }
                    return arg
                })
                return thenResultArray(rawArgs, rawArgs => thenResult(rawArgs, rawArgs => makeRaw(context, sql, rawArgs)) )
            }
        }, definition)
    }

    static numberNotNull(sql: string, args: any[]) {
        return Scalar.value(sql, args, new NumberNotNullType() )
    }

    static number(sql: string, args: any[]) {
        return Scalar.value(sql, args, new NumberType() )
    }
    
    equals(rightOperand: any): Scalar<BooleanNotNullType> {
        return new EqualOperator(this, rightOperand).toScalar()
    }

    private toRealRaw() {
        return this.expressionOrDataset
    }

    definitionForParsing(){
        return this.#calculatedDefinition ?? this.declaredDefinition ?? new PropertyTypeDefinition()
    }

    private async calculateDefinition(context?: DatabaseContext<any>):  Promise<PropertyTypeDefinition<any>>  {
        const repo = (context ?? this.context)
        if(!repo){
            throw new Error('There is no repository provided')
        }

        const resolveDefinition = (ex: RawExpression ): PropertyTypeDefinition<any> | Promise<PropertyTypeDefinition<any>>  => {
            return thenResult(ex, ex => {
                if(ex instanceof Dataset){
                    return resolveDefinition(ex.toScalar())
                } else if(ex instanceof Scalar ){

                    if(ex.declaredDefinition){
                        return ex.declaredDefinition
                    } else {
                        let raw = ex.toRealRaw()
                        return resolveDefinition(raw)
                    }
                } else if(ex instanceof Function) {
                    return resolveDefinition(ex(repo))
                } else {
                    return new PropertyDefinition()
                }
            })
        }
        
        return await resolveDefinition(this)
        // this.#cachedDefinition = await resolveDefinition(this)
        // console.log('cacched definition', this.#cachedDefinition)
        // return this.#cachedDefinition
    }

    private calculateRaw(context?: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> {
        
        const repo = (context ?? this.context)
        if(!repo){
            throw new Error('There is no repository provided')
        }
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
                    return resolveIntoRawOrDataset(ex(repo))
                }
                // console.log('here 3')
                return ex
            })
        }

        let raw = thenResult( this.getDefinition(repo), definition =>  {
            // if(!definition){
            //     console.log('......', this.declaredDefinition, this.calculateDefinition, this.expressionOrDataset.toString())
            //     // throw new Error('It cannot toRaw because without definition')
            // }
            return thenResult( resolveIntoRawOrDataset(expressionOrDataset), rawOrDataset => {
                
                if(!(rawOrDataset instanceof Dataset)){
                    const next = makeRaw(repo, rawOrDataset.toString())
                    return (definition ?? new PropertyTypeDefinition()).transformQuery(next, repo)
                } else {
                    return (definition ?? new PropertyTypeDefinition()).transformQuery(rawOrDataset, repo)
                }
            })

        })

        // console.log('xxxxxxxx', raw.toString())
        return raw

    }

    async getDefinition(context?: DatabaseContext<any>): Promise<PropertyTypeDefinition<any>>{
        if(!this.#calculatedDefinition){
            this.#calculatedDefinition = await this.calculateDefinition(context)
            // console.log('calculate the definition....', this.#calculatedDefinition)
        }
        return this.#calculatedDefinition
    }

    async toRaw(context?: DatabaseContext<any>): Promise<Knex.Raw> {
        if(!this.#calculatedRaw){
            this.#calculatedRaw = await this.calculateRaw(context)
        }
        return this.#calculatedRaw
    }

    // asColumn<Name extends string>(propName: Name): Column<Name, T> {
    //     return new Column(propName, this.expressionOrDataset, this.declaredDefinition, this.context)
    // }

    toScalar(){
        return this
    }

    // castToScalar<P extends PropertyTypeDefinition<any>>(definition?: P | (new (...args: any[]) => P )): Scalar<P>{
    //     const d = definition ??  this.definition
    //     return new Scalar(this.toRealRaw(), d, this.context)
    // }

    execute(repo?: DatabaseContext<any>): 
        DatabaseQueryRunner<ExpandRecursively< T extends PropertyTypeDefinition<infer D>? D: any >> {
        const context = repo ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        return new DatabaseQueryRunner<ExpandRecursively< T extends PropertyTypeDefinition<infer D>? D: any >>(
            async (executionOptions: ExecutionOptions) => {
                // let result = await context.execute( new Dataset().select({root: this}), executionOptions)

                // //@ts-ignore
                // return result[0].root as any
                throw new Error('NYI')
            }
        )


    }
}

// export class Column<Name extends string, T extends PropertyTypeDefinition<any>> extends Scalar<T>{
//     alias: Name
//     // scalarable: Scalarable<T> | Promise<Scalarable<T>>

//     constructor(alias: Name, expressionOrDataset: RawExpression, 
//         definition?: T | (new (...args: any[]) => T) | null, context?: DatabaseContext<any> | null){
//         super(expressionOrDataset, definition, context)
//         this.alias = alias
//         // this.scalarable = scalarable
//     }

//     value(): { [key in Name]: Scalar<T> } {
//         const key = this.alias
//         //@ts-ignore
//         return { [key]: new Scalar( this.expressionOrDataset, this.declaredDefinition, this.context) }
//     }

//     clone(): Column<Name, T> {
//         return new Column(this.alias, this.expressionOrDataset, this.declaredDefinition, this.context)
//     }
// }

export const makeRaw = (context: DatabaseContext<any>, sql: any, args?: any[]) => {
    let r = context.orm.getKnexInstance().raw(sql, args ?? [])
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
            return new Scalar(context => makeRaw(context, '?', [null]))
        } else if (typeof value === 'boolean') {
            const boolValue = value
            return new Scalar(context => makeRaw(context, '?', [boolValue]), new BooleanType())
        } else if (typeof value === 'string'){
            const stringValue = value
            return new Scalar(context => makeRaw(context, '?', [stringValue]), new StringType())
        } else if (typeof value === 'number'){
            const numberValue = value
            //TODO
            return new Scalar(context => makeRaw(context, '?', [numberValue]), new NumberType())
        } else if (value instanceof Date){
            const dateValue = value
            //TODO
            return new Scalar(context => makeRaw(context, '?', [dateValue]), new DateTimeType())
        } else if(value instanceof ConditionOperator){
            return value.toScalar()
        } else if(Array.isArray(value)){
            const expr = new OrOperator<Props, M>(resolver, ...value)
            return resolver( expr )
        } else if(value instanceof Scalar){
            return value
        } else if (value instanceof Dataset) {
            return value.toScalar()
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
                    // console.log('sources', sources, sourceName)
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
                
                if(prop instanceof FieldProperty || prop instanceof ScalarProperty){
                    let converted = source.getFieldProperty(propName)
                    scalars.push( makeOperator(converted, dict[key]).toScalar() )
                } else if(prop instanceof ComputeProperty){
                    let compiled = (source.getComputeProperty(propName))()
                    if(compiled instanceof Promise){
                        throw new Error('Unsupported Async Computed Property in Expression Resolver')
                    }
                    scalars.push( makeOperator(compiled, dict[key]).toScalar() )
                }
    
                return scalars
    
            }, [] as Scalar<BooleanNotNullType>[] )

            let arr = new AndOperator<Props, M>(resolver, ...scalars)
            return resolver(arr)
        } else {
            throw new Error('Unsupport Where clause')
        }
    }

    return resolver
}
