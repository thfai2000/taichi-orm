import { Knex}  from "knex"
import { ValueSelector, CompiledComputeFunction, DatabaseContext, ComputeFunction, ExecutionOptions, DBQueryRunner, DBMutationRunner, MutationExecutionOptions } from "."
import { AndOperator, ConditionOperator, InOperator, EqualOperator, IsNullOperator, NotOperator, OrOperator, GreaterThanOperator, LessThanOperator, GreaterThanOrEqualsOperator, LessThanOrEqualsOperator, BetweenOperator, NotBetweenOperator, LikeOperator, SQLKeywords, constructSqlKeywords, NotInOperator, NotLikeOperator, NotEqualOperator, IsNotNullOperator, AssertionOperatorWrapper, ExistsOperator } from "./sqlkeywords"
import { BooleanType, BooleanNotNullType, DateTimeType, NumberType, NumberNotNullType, ObjectType, PropertyType, StringType, ArrayType, PrimaryKeyType, StringNotNullType, ParsableObjectTrait } from "./types"
import { ComputeProperty, Datasource, DerivedDatasource, DerivedTableSchema, FieldProperty, ScalarProperty, Schema, TableDatasource, TableSchema } from "./schema"
import { ExtractFieldPropDictFromSchema, ExtractPropDictFromSchema, ExtractValueTypeDictFromPropertyDict, ExtractValueTypeDictFromSchema, isFunction, makeid, notEmpty, quote, ScalarDictToValueTypeDict, SimpleObject, SimpleObjectClass, SQLString, thenResult, thenResultArray, UnionToIntersection, ConstructMutationFromValueTypeDict, ExtractSchemaFieldOnlyFromSchema, ExtractValueTypeDictFromSchema_FieldsOnly, isScalarMap, isArrayOfStrings } from "./util"
import { ArrayTypeDataset, ObjectTypeDataset } from "./model"

// type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn;

type ScalarDictToScalarPropertyDict<D> = {
    [key in keyof D]: D[key] extends Scalar<any, any>? ScalarProperty<D[key]>: never
}

type SelectedPropsToScalarPropertyDict<SourceProps, P> = {
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
                                ScalarProperty<Scalar<D, any>>:
                                (
                                    C extends ComputeProperty<ComputeFunction<any, any, infer S>>? 
                                    ScalarProperty<S>:
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


export type ExpressionFunc<O, M> = (map: UnionToIntersection< M | SQLKeywords<O, M> > ) => Expression<O, M>


export type ValueTypeDictForExpression<E> = {
    [key in keyof E]: 
        E[key] | AssertionOperatorWrapper | Scalar<any, any>
}

export type Expression<O, M> = 
    Partial<ValueTypeDictForExpression<ExtractValueTypeDictFromPropertyDict<O>> > 
    | ExpressionFunc<O, M>
    | AndOperator<O, M> 
    | OrOperator<O, M> 
    | NotOperator<O, M>
    | ExistsOperator<O, M>
    | Scalar<any, any>
    | Array<Expression<O, M> > 
    | boolean | string | Date | number

export type Prefixed<Prefix extends string, MainName extends string, Content> = {
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

    
    protected async scalarMap2RawMap(targetSchema: Schema<any>, nameMap: { [key: string]: Scalar<any, any> }, context: DatabaseContext<any>) {
        const client = context.client()
        return await Object.keys(nameMap).reduce( async (accP, k) => {

            const acc = await accP

            const prop = targetSchema.propertiesMap[k]

            if(prop instanceof FieldProperty){
                // let acc = await accP
                const scalar = nameMap[k]
                if(!scalar){
                    throw new Error(`cannot resolve field ${k}`)
                }
                const raw: Knex.Raw = await scalar.toRaw(context)
                let text = raw.toString().trim()
    
                if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                    text = `(${text})`
                }
                acc[prop.fieldName(context.orm)] = context.raw(text)
            }

            return acc
        }, Promise.resolve({} as {[key:string]: Knex.Raw<any>}) )
    }

    abstract toNativeBuilder(ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder>

    abstract execute(this: StatementBase, ctx?: DatabaseContext<any>): any
}

abstract class WhereClauseBase<SourceProps ={}, SelectorMap = {}, FromSource extends Datasource<any, any> = Datasource<any, any>>  extends StatementBase {

    protected fromItem: undefined | Datasource<Schema<any>, string> = undefined
    protected joinItems:  Array<{type: 'inner' | 'left' | 'right', source: Datasource<Schema<any>, string>, expression: Expression<any, any>}> = []
    protected whereRawItem: undefined |  Expression<any, any> = undefined

    protected getSelectorMap(): SelectorMap {
        const sources = this.joinItems.map(item => item.source)
        if(this.fromItem){
            sources.push(this.fromItem)
        }

        const selectorMap = sources.reduce( (acc, source) => {
            const t = source.sourceAlias
            acc[t] = source.$
            return acc
        }, {} as {[key:string]: ValueSelector<any> } )

        return selectorMap as any
    }

    getFrom(){
        return this.fromItem
    }
    getWhere(): Expression<any, any> | undefined{
        return this.whereRawItem
    }

    protected baseWhere<Y extends SelectorMap & SQLKeywords< SourceProps, SelectorMap >  >(expression: Expression< SourceProps, Y>): WhereClauseBase<SourceProps, SelectorMap, FromSource>{
        this.whereRawItem = expression
        return this
    }

    protected baseFrom<S extends Schema<any>, SName extends string>(source: Datasource<S, SName>):
        WhereClauseBase<
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: ValueSelector< S> }>, Datasource<S, SName>
        > {
            this.fromItem = source
            return this as any
        }

    protected baseInnerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "inner",
            source,
            expression
        })
        return this as any
    }
     
    protected baseLeftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "left",
            source,
            expression
        })
        return this as any
    }

    protected baseRightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): WhereClauseBase<X,Y, FromSource>{
        this.joinItems.push( {
            type: "right",
            source,
            expression
        })
        return this as any
    }

    protected async buildWhereClause(context: DatabaseContext<any>, nativeQB: Knex.QueryBuilder<any, unknown[]>) {
        const selectorMap = this.getSelectorMap()

        const resolver = makeExpressionResolver(selectorMap, this.fromItem, this.joinItems.map(item => item.source))

        Object.assign(selectorMap, constructSqlKeywords(resolver))

        await this.joinItems.reduce(async (acc, item) => {
            await acc
            const finalExpr = await resolver(item.expression).toRaw(context)

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

    cloneFrom(source: WhereClauseBase){
        this.fromItem = source.fromItem
        this.joinItems = source.joinItems
        this.whereRawItem = source.whereRawItem
    }

}

export class Dataset<ExistingSchema extends Schema<any>, SourceProps =any, SelectorMap =any, FromSource extends Datasource<any, any> = Datasource<any, any>> 
    extends WhereClauseBase<SourceProps, SelectorMap, FromSource>
    // implements Scalarable<ArrayType<ExistingSchema>, Dataset<ExistingSchema, SourceProps, SourcePropMap, FromSource> > 
    {

    // parsableType: ParsableTrait<any> | null = null
    // __type: 'Dataset' = 'Dataset'
    protected datasetSchema: null | DerivedTableSchema<any> = null

    #selectItems: { [key: string]: Scalar<any, any> } | null = null

    #orderByItems:  {value: Scalar<any, any>, order: 'asc'|'desc'}[] | null = null
    #groupByItems: Scalar<any, any>[] | null = null
    #limit: null | number = null
    #offset: null | number = null

    nativeBuilderCallbacks: ((nativeBuilder: Knex.QueryBuilder) => Promise<void> | void)[] = []

    constructor(context?: DatabaseContext<any> | null){
        super(context)
        // this.#fromItem = fromSource
        this.context = context ?? null
    }

    protected func2ScalarMap<S extends { [key: string]: Scalar<any, any>} , Y extends UnionToIntersection<SelectorMap | SQLKeywords< SourceProps, SelectorMap>>>(named: S | ((map: Y) => S)) {
        let nameMap: { [key: string]: Scalar<any, any>} 
        const selectorMap = this.getSelectorMap()
        const resolver = makeExpressionResolver(selectorMap, this.fromItem, this.joinItems.map(item => item.source))

        if (named instanceof Function) {
            Object.assign(selectorMap, constructSqlKeywords(resolver))
            const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        } else {
            nameMap = named
        }

        const result = Object.keys(nameMap).reduce((acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any, any>} )
        return result
    }

    protected func2ScalarArray<S extends Scalar<any, any>[] , Y extends UnionToIntersection<SelectorMap | SQLKeywords< SourceProps, SelectorMap>>>(named: S | ((map: Y) => S)) {
        let nameMap: Scalar<any, any>[]
        const selectorMap = this.getSelectorMap()
        const resolver = makeExpressionResolver(selectorMap, this.fromItem, this.joinItems.map(item => item.source))

        if (named instanceof Function) {
            Object.assign(selectorMap, constructSqlKeywords(resolver))
            const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        } else {
            nameMap = named
        }
        return nameMap
    }

    protected func2OrderItemArray<S extends ( (keyof SourceProps) | Scalar<any, any> | {value: (keyof SourceProps) | Scalar<any, any>, order: 'asc' | 'desc'}   )[] , Y extends UnionToIntersection<SelectorMap | SQLKeywords< SourceProps, SelectorMap>>>(named: S | ((map: Y) => S))
    : {value: Scalar<any, any>, order: 'asc'|'desc'}[] {
        let nameMap: S
        const selectorMap = this.getSelectorMap()
        const resolver = makeExpressionResolver(selectorMap, this.fromItem, this.joinItems.map(item => item.source))

        if (named instanceof Function) {
            Object.assign(selectorMap, constructSqlKeywords(resolver))
            const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords<any, any>(resolver)) as Y
            nameMap = named(map)
        } else {
            nameMap = named
        }

        return nameMap.map(item => {
            if(item instanceof Scalar){
                return {
                    value: item,
                    order: 'asc'
                }
            } else if(typeof item === 'string') {
                const p = this.propNameArray2ScalarMap([item])
                return {
                    value: Object.values(p)[0],
                    order: 'asc'
                }
            } else {
                const pair = item as {value: (keyof SourceProps) | Scalar<any, any>, order: 'asc' | 'desc'}
                
                // return new Scalar( async (context) => {
                //     const sql = `${ (await value.toRaw(context)).toString()} ${pair.order.toLowerCase() === 'desc'?'desc':'asc'}`
                //     return {sql}
                // })

                // let value: Scalar<any, any>
                if(typeof pair.value === 'string'){
                    const p = this.propNameToScalar(selectorMap, pair.value)
                    const value = Object.values(p)[0]
                    return {
                        value: value,
                        order: pair.order
                    }
                } else if(pair.value instanceof Scalar){
                    return {
                        value: pair.value,
                        order: pair.order
                    }
                } else {
                    throw new Error('Not allowed')
                }
            }
        })
    }

    private propNameToScalar(selectorMap: SelectorMap, key: string): { [key2: string]: Scalar<any, any>} {
        const map = selectorMap as unknown as {[key1: string]: { [key2: string]: Scalar<any, any>}}
        // eslint-disable-next-line prefer-const
        let [source, field] = key.split('.')
        let item: Scalar<any, any> | CompiledComputeFunction<any, any> | null = null
        if(!field){
            field = source
            if(!this.fromItem){
                throw new Error(`There must be a FROM`)
            }
            const from = this.fromItem.$ //as SelectorMap< {[key:string]: any}>
            item = from[field]
        }
        else {
            item = map[source][field]
        }

        if(!item){
            throw new Error(`Cannot resolve field ${key}`)
        }else if(item instanceof Scalar){
            return {[field]: item}
        }else {
            return {[field]: item()}
        }
    }

    protected propNameArray2ScalarMap(properties: string[]){
        const map = this.getSelectorMap() //as unknown as {[key1: string]: { [key2: string]: Scalar<any, any>}}
        const fields = properties
        const nameMap: { [key: string]: Scalar<any, any> } = fields.reduce( (acc, key:string) => {

            const keypair = this.propNameToScalar(map, key)
            acc = Object.assign({}, acc, keypair)    

            return acc
        }, {})
        return nameMap
    }

    protected async queryScalarMap2RawArray(nameMap: { [key: string]: Scalar<any, any> }, context: DatabaseContext<any>, includeAlias: boolean): Promise<Knex.Raw<any>[]> {
        const client = context.client()
        return await Promise.all(Object.keys(nameMap).map(async (k) => {

            // let acc = await accP
            const scalar = nameMap[k]
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await scalar.toRaw(context)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = context.raw(`${text}${includeAlias?` AS ${quote(client, k)}`:''}`)

            return newRaw
        }))
    }

    protected async queryScalarArray2RawArray(nameMap: Scalar<any, any>[], context: DatabaseContext<any>): Promise<Knex.Raw<any>[]> {
        const client = context.client()
        return await Promise.all(nameMap.map(async (k) => {

            // let acc = await accP
            const scalar = k
            if(!scalar){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await scalar.toRaw(context)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = context.raw(`${text}`)

            return newRaw
        }))
    }

    protected async orderByScalarArray2RawArray(nameMap: {value: Scalar<any, any>, order: 'asc'|'desc'}[], context: DatabaseContext<any>): Promise<
        Knex.Raw[]
        > {
        const client = context.client()
        return await Promise.all(nameMap.map(async (k) => {

            // let acc = await accP
            const pair = k
            if(!pair){
                throw new Error(`cannot resolve field ${k}`)
            }
            const raw: Knex.Raw = await pair.value.toRaw(context)
            let text = raw.toString().trim()

            if (text.includes(' ') && !(text.startsWith('(') && text.endsWith(')'))) {
                text = `(${text})`
            }
            const newRaw = context.raw(`${text} ${pair.order.toLowerCase() === 'desc'?'desc':'asc'}`)

            return newRaw
        }))
    }

    protected clearSchema() {
        this.datasetSchema = null
    }

    toDataset(): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource> {
        return this
    }
    
    selectItemsAlias(): string[]{
        if(!this.#selectItems){
            return []
        }
        const selectItems = this.#selectItems
        return Object.keys(selectItems)
    }

    native(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>{
        this.nativeBuilderCallbacks = []
        this.addNative(nativeBuilderCallback)
        return this
    }
    
    addNative(nativeBuilderCallback: (nativeBuilder: Knex.QueryBuilder) => void ): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>{
        this.nativeBuilderCallbacks.push(nativeBuilderCallback)
        return this
    }

    toDScalar<T extends Dataset<any, any, any, any>>(this: T): DScalar< ArrayTypeDataset<T>, T> {
        return this.toDScalarWithArrayType()
    }

    toDScalarWithArrayType<T extends Dataset<any, any, any, any>>(this: T): DScalar< ArrayTypeDataset<T>, T> {
        const a = new ArrayType(this.schema())
        return new DScalar(this, a, this.context)
    }

    toDScalarWithObjectType<T extends Dataset<any, any, any, any>>(this: T): DScalar< ObjectTypeDataset<T>, T> {
        const o = new ObjectType(this.schema()) as ObjectType<ParsableObjectTrait<any>>
        return new DScalar(this, o, this.context)
    }

    toDScalarWithType<T extends PropertyType<any>>(
        this: Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>,
        type: 
        T | 
        (new () => T) | 
        ((dataset: typeof this) => T)): DScalar<T, typeof this> {

        if(type instanceof PropertyType){
            return new DScalar(this, type, this.context) 
        } else if(isFunction(type)){
            return new DScalar(this, type(this), this.context)
        } else {
            return new DScalar(this, new type(), this.context) 
        }
    }

    where<Y extends SelectorMap & SQLKeywords< SourceProps, SelectorMap >  >(expression: Expression< SourceProps, Y>): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>{
        return this.baseWhere(expression) as any
    }

    andWhere<Y extends SelectorMap & SQLKeywords< SourceProps, SelectorMap >  >(expression: Expression< SourceProps, Y>): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>{
        const prevWhere = this.getWhere()
        if(prevWhere === undefined){
            return this.baseWhere(expression) as any
        } else {
            const prev = prevWhere
            const newExpression: ExpressionFunc< SourceProps, {}> = ({And}) =>  And(prev, expression) 
            return this.baseWhere( newExpression ) as any
        }
    }

    from<S extends Schema<any>, SName extends string>(source: Datasource<S, SName>):
        Dataset< Schema<{}>, 
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: ValueSelector< S> }>, Datasource<S, SName>
        > {
            return this.baseFrom(source) as any
        }

    innerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema<S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): Dataset<ExistingSchema,X,Y, FromSource>{
        
        return this.baseInnerJoin(source, expression) as any
    }
     
    leftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): Dataset<ExistingSchema,X,Y, FromSource>{
        return this.baseLeftJoin(source, expression) as any
    }

    rightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): Dataset<ExistingSchema,X,Y, FromSource>{
        return this.baseRightJoin(source, expression) as any
    }
    
    select<S extends { [key: string]: Scalar<any, any> }, Y extends UnionToIntersection< SelectorMap | SQLKeywords< SourceProps, SelectorMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            Schema<
                // (ExistingSchema extends Schema<infer Props>? Props: never) &
                ScalarDictToScalarPropertyDict<S>
            >
        , 
        SourceProps, SelectorMap, FromSource>;

    select<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            Schema<
                // (ExistingSchema extends Schema<infer Props>? Props: never) &
                SelectedPropsToScalarPropertyDict<SourceProps, P>
            >
        , 
        SourceProps, SelectorMap, FromSource>;
        
    select(...args: any[]){

        if(args.length === 0 ){
            throw new Error('select must have at least one argument')
        }
        if(args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function) ){
            const named = args[0]
            this.clearSchema()
            const result = this.func2ScalarMap(named)
    
            this.#selectItems = result
            return this as any
        } else if(isArrayOfStrings(args)){
            const properties = args
            this.clearSchema()
            this.#selectItems = this.propNameArray2ScalarMap(properties)
            return this as any
        }

        throw new Error('cannot handle unexpected arguments')
    }


    andSelect<S extends { [key: string]: Scalar<any, any> }, Y extends UnionToIntersection< SelectorMap | SQLKeywords< SourceProps, SelectorMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                ScalarDictToScalarPropertyDict<S>
            >
        , 
        SourceProps, SelectorMap, FromSource>;
        
    andSelect<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            Schema<
                (ExistingSchema extends Schema<infer Props>? Props: never) &
                SelectedPropsToScalarPropertyDict<SourceProps, P>
            >
        , 
        SourceProps, SelectorMap, FromSource>;

    andSelect(...args: any[]){
        if(args.length === 0 ){
            throw new Error('select must have at least one argument')
        }
        if(args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function) ){
            const named = args[0]
            this.clearSchema()
            const result = this.func2ScalarMap(named)

            this.#selectItems = Object.assign({}, this.#selectItems, result)
            return this as any
        } else if(isArrayOfStrings(args)){
            const properties = args
            this.clearSchema()
            this.#selectItems = Object.assign({}, this.#selectItems, this.propNameArray2ScalarMap(properties) )
            return this as any
        }

        throw new Error('cannot handle unexpected arguments')
    }
    
    groupBy<S extends Array<Scalar<any, any>>, Y extends UnionToIntersection< SelectorMap | SQLKeywords< SourceProps, SelectorMap> >>(named: S | 
        ((map: Y ) => S ) ):
        Dataset<
        ExistingSchema
        , 
        SourceProps, SelectorMap, FromSource>;

    groupBy<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
        ExistingSchema
        , 
        SourceProps, SelectorMap, FromSource>;
    
    groupBy(...args: any[]){
    
        if(args.length === 0 ){
            throw new Error('select must have at least one argument')
        }
        if(args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function) ){
            const named = args[0]
            const result = this.func2ScalarArray(named)
    
            this.#groupByItems = result
            return this as any

        } else if(isArrayOfStrings(args)){
            const properties = args
            const dict = this.propNameArray2ScalarMap(properties as string[])
            this.#groupByItems = Object.keys(dict).map(k => dict[k])
            return this as any
        }
    }

    orderBy<Q extends ( Scalar<any, any> | {value: Scalar<any, any>, order: 'asc' | 'desc'}   )[], 
        Y extends UnionToIntersection< SelectorMap | SQLKeywords< SourceProps, SelectorMap> >>(named: Q | 
        ((map: Y ) => Q ) ):
        Dataset<
        ExistingSchema
        , 
        SourceProps, SelectorMap, FromSource>;

    // orderBy<P extends keyof SourceProps>(...properties: P[]): 
    //     Dataset<
    //     ExistingSchema
    //     , 
    //     SourceProps, SourcePropMap, FromSource>;

    orderBy(...args: any[]){
    
        if(args.length !== 1 ){
            throw new Error('must be one argument')
        }
        const resolved = this.func2OrderItemArray(args[0])
        this.#orderByItems = resolved
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


    limit(limit: number | null): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource> {
        this.#limit = limit
        return this
    }

    offset(offset: number | null): Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource> {
        this.#offset = offset
        return this
    }

    datasource<T extends Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>, Name extends string>(this: T, name: Name): DerivedDatasource<T, Name> {
        return this.schema().datasource(name)
    }

    schema<T extends Dataset<ExistingSchema, SourceProps, SelectorMap, FromSource>>(this: T)
    : DerivedTableSchema<T> {

        if(!this.datasetSchema){

            this.datasetSchema = new DerivedTableSchema(this)
        }
        return this.datasetSchema
    }

    selectItems() {
        return this.#selectItems
    }
    // hasSelectedItems(){
    //     return Object.keys(this.#selectItems ?? {}).length > 0
    // }

    async toNativeBuilder(ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = ctx ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        const nativeQB = context.orm.getKnexInstance().clearSelect()
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

        if(this.#groupByItems){
            const groupByItems = await this.queryScalarArray2RawArray(this.#groupByItems, context)
            if(groupByItems.length === 0){
                throw new Error('No groupByItems')
            }
            nativeQB.groupByRaw( groupByItems.map(item => item.toString()).join(',') )
        }

        if(this.#orderByItems){
            const orderByItems = await this.orderByScalarArray2RawArray(this.#orderByItems, context)
            if(orderByItems.length === 0){
                throw new Error('No groupByItems')
            }
            nativeQB.orderByRaw( orderByItems.map(item => item.toString()).join(',') )
        }
    
        await Promise.all(this.nativeBuilderCallbacks.map( async(callback) => {    
            await callback(nativeQB)
        }))

        return nativeQB
    }

    execute<S extends Schema<any>>(this: Dataset<S, any, any, any>, ctx?: DatabaseContext<any>): 
        DBQueryRunner<ExtractValueTypeDictFromSchema<S>[], false>
    {
        const context = ctx ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }
        const current = this

        return new DBQueryRunner< ExtractValueTypeDictFromSchema<S>[], false>(
                context,
                async function(this: DBQueryRunner< ExtractValueTypeDictFromSchema<S>[], false>, executionOptions: ExecutionOptions){

                    const nativeSql = await current.toNativeBuilder(this.context)

                    const data = await this.context.executeStatement(nativeSql, {}, executionOptions)
        
                    // console.log('data', data)
                    let rows: any
                    if(this.context.client().startsWith('mysql')){
                        rows = data[0][0]
                    } else if(this.context.client().startsWith('sqlite')){
                        rows = data
                    } else if(this.context.client().startsWith('pg')){
                        rows = data.rows[0]
                    } else {
                        throw new Error('Unsupport client.')
                    }

                    if(!Array.isArray(rows)){
                        throw new Error('Unexpected.')
                    }
            
                    const len = rows.length
                    const schema = current.schema()
                    
                    await schema.prepareForParsing(this.context)

                    const parsedRows = new Array(len) as ExtractValueTypeDictFromPropertyDict< (S extends Schema<infer Dict>?Dict:never) >[]
                    // console.log(schema)
                    for(let i=0; i <len;i++){
                        parsedRows[i] = schema.parseRaw(rows[i], this.context)
                    }
                
                    // console.timeEnd('parsing')
                    // console.log('parsed', parsedRows)

                    // if(this.options.failIfNone && (Array.isArray(parsedRows) && parsedRows[0].length === 0) ){
                    //     throw new Error('The query result is empty')
                    // }
                    return parsedRows
                })
    }
}

export class InsertStatement<T extends TableSchema<{
        id: FieldProperty<PrimaryKeyType>,
        // uuid?: FieldProperty<StringNotNullType>
    }>> 
    extends StatementBase {
    [x: string]: any

    #insertIntoSchema: T
    #insertItems: { [key: string]: Scalar<any, any> }[] | null = null
    // #uuidForInsertion: string | null = null

    constructor(insertToSchema: T, context?: DatabaseContext<any> | null){
        super(context)
        this.#insertIntoSchema = insertToSchema
    }

    // insertInfo(){
    //     return {
    //         schema: this.#insertIntoSchema,
    //         // uuid: this.#uuidForInsertion
    //     }
    // }

    values<S extends Partial<ExtractValueTypeDictFromPropertyDict<ExtractFieldPropDictFromSchema<T>>> , Y extends UnionToIntersection< SQLKeywords< '', {}> >>
    (arrayOfkeyValues: S[] | ((map: Y ) => S[] )): InsertStatement<T>{
        
        let arrayOfNameMap: { [key: string]: any | Scalar<any, any> }[]
        const selectorMap = {}
        const resolver = makeExpressionResolver(selectorMap, undefined, [])
        
        if(arrayOfkeyValues instanceof Function){    
            Object.assign(selectorMap, this.sqlKeywords(resolver) )
            const map = Object.assign({}, constructSqlKeywords<any, any>(resolver)) as Y
            arrayOfNameMap = arrayOfkeyValues(map)
        } else {
            arrayOfNameMap = arrayOfkeyValues
        }

        this.#insertItems = arrayOfNameMap.map(nameMap => Object.keys(nameMap).reduce( (acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any, any> } ))


        return this
    }

    async toNativeBuilder(ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {
        return this.toNativeBuilderWithSpecificRow(null, ctx)
    }

    async toNativeBuilderWithSpecificRow(atRowIdx: number | null, ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = ctx ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        let nativeQB = context.orm.getKnexInstance().from(this.#insertIntoSchema.tableName(context))
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

    
        if(!this.#insertItems){
            throw new Error('No insert Items')
        }

        const targetSchema = this.#insertIntoSchema
        const schemaPrimaryKeyFieldName = targetSchema.id.fieldName(context.orm)
        const schemaPrimaryKeyPropName = targetSchema.id.name
        // const schemaUUIDPropName = targetSchema.uuid?.name
        // const schemaUUIDFieldName = targetSchema.uuid?.fieldName(context.orm)

        // let useUuid: boolean = !!context.orm.ormConfig.enableUuid
        // if (context.client().startsWith('sqlite')) {
        //     if (!context.orm.ormConfig.enableUuid ){
        //         throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
        //     }
        // }
        // let additionalFields = {}
        // if(useUuid){
        //     if(!schemaUUIDPropName) {
        //         throw new Error('No UUID')
        //     }
        //     additionalFields = {[schemaUUIDPropName]: Scalar.value(`:uuid`, [], new StringNotNullType() )}
        // }
        const filteredInsertItems = atRowIdx === null? this.#insertItems : [this.#insertItems[atRowIdx]]

        const insertItems = await Promise.all(filteredInsertItems.map( async(insertItem) => await this.scalarMap2RawMap(this.#insertIntoSchema, Object.assign({}, insertItem), context)))
        
        nativeQB.insert( insertItems )

        if ( context.client().startsWith('pg')) {
            nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName)
        }

        return nativeQB        
    }

    getInsertItems(){
        return this.#insertItems
    }

    execute(context?: DatabaseContext<any>) {
        const ctx = context ?? this.context

        if(!ctx){
            throw new Error('There is no repository provided.')
        }
        //@ts-ignore
        const statement = this

        return new DBMutationRunner<{
                            id: number;
                        }[] | null, 
                        T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>(
            ctx,
            async function(
                this: DBMutationRunner<{
                            id: number;
                        }[] | null, 
                        T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>,
                executionOptions: MutationExecutionOptions<T>) {
                
                if(!statement.getInsertItems()){
                    throw new Error('Unexpected')
                }

                return await this.context.startTransaction(async (trx) => {

                    //replace the trx
                    executionOptions = {...executionOptions, trx: trx}

                    const executionFuncton = async() => {
                        // let afterMutationHooks = schema.hooks.filter()

                        if (!this.latestQueryAffectedFunctionArg || this.context.client().startsWith('pg')) {
                            const queryBuilder = statement.toNativeBuilder(this.context)
                            const insertStmt = queryBuilder.toString()
                            // let insertedId: number
                            const r = await this.context.executeStatement(insertStmt, {}, executionOptions)

                            if( this.context.client().startsWith('pg')){
                                return Object.keys(r.rows[0]).map(k => ({id: r.rows[0][k] as number }) )
                            } else {
                                return null
                            }
                            // return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
            
                        } else {
                            if (this.context.client().startsWith('mysql')) {
                                let insertedId: number
                                //allow concurrent insert
                                return await Promise.all(statement.getInsertItems()!.map( async (item, idx) => {
                                    const queryBuilder = await statement.toNativeBuilderWithSpecificRow(idx, this.context)
                                    const insertStmt = queryBuilder.toString() + '; SELECT LAST_INSERT_ID() AS id '
                                    const r = await this.context.executeStatement(insertStmt, {}, executionOptions)
                                    insertedId = r[0][0].id
                                    return {id: insertedId}
                                }))

                            } else if (this.context.client().startsWith('sqlite')) {
                                //only allow one by one insert
                                return await statement.getInsertItems()!.reduce( async (preAcc, item, idx) => {
                                    const acc = await preAcc
                                    const queryBuilder = await statement.toNativeBuilderWithSpecificRow(idx, this.context)
                                    const insertStmt = queryBuilder.toString()
                                    // let uuid = uuidv4()
                                    await this.context.executeStatement(insertStmt, {}, executionOptions)
                                    const result = await this.context.executeStatement('SELECT last_insert_rowid() AS id', {}, executionOptions)
                                    // console.log('inserted id...', result)
                                    acc.push({id: result[0].id})
                                    return acc

                                }, Promise.resolve([]) as Promise<{id: number}[]>) 
                
                            } else {
                                throw new Error('Unsupport client')
                            }

                        }

                    }
                    
                    const insertedIds = await executionFuncton()

                    if(this.latestQueryAffectedFunctionArg){
    
                        const queryAffectedFunctionArg = this.latestQueryAffectedFunctionArg
                        
                        const queryAffectedFunction = async() => {
                            
                            const i = insertedIds as {id: number}[]
                            const schema = statement.#insertIntoSchema as TableSchema<{id: FieldProperty<PrimaryKeyType>}>
    
                            const queryDataset = this.context.dataset()
                                .from(schema.datasource('root'))
                                .where( ({root}) => root.id.in(i.map(r => r.id)) )
                                .select( ({root}) => root.$allFields ) as unknown as Dataset<ExtractSchemaFieldOnlyFromSchema<T>>
                            
                            const finalDs = (await queryAffectedFunctionArg(queryDataset as any))
                            const result = await finalDs.execute().withOptions(executionOptions)
                            return result
                            
                        }
    
                        this.affectedResult = (await queryAffectedFunction()) as any[]
                    }

                    return insertedIds

                }, executionOptions.trx)

            }
        )
    }

}

export class UpdateStatement<SourceProps ={}, SelectorMap ={}, FromSource extends TableDatasource<any, any> = TableDatasource<any, any>> 
    extends WhereClauseBase<SourceProps, SelectorMap, FromSource>
    {

    #updateItems: { [key: string]: Scalar<any, any> } | null = null

    constructor(ctx?: DatabaseContext<any>){
        super(ctx)
    }

    from<S extends TableSchema<any>, SName extends string>(source: TableDatasource<S, SName>):
        UpdateStatement< 
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: ValueSelector< S> }>, TableDatasource<S, SName>
        > {
            return this.baseFrom(source) as any
        }

    where<Y extends SelectorMap & SQLKeywords< SourceProps, SelectorMap >  >(expression: Expression< SourceProps, Y>): UpdateStatement<SourceProps, SelectorMap, FromSource>{
        return this.baseWhere(expression) as any
    }

    innerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        
        return this.baseInnerJoin(source, expression) as any
    }
     
    leftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseLeftJoin(source, expression) as any
    }

    rightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseRightJoin(source, expression) as any
    }

    set<S extends Partial< ConstructMutationFromValueTypeDict< ExtractValueTypeDictFromPropertyDict<ExtractFieldPropDictFromSchema< (FromSource extends Datasource<infer DS, any>?DS:never)>>>> , 
        Y extends UnionToIntersection< SelectorMap | SQLKeywords< SourceProps, SelectorMap> >>
    (keyValues: S | ((map: Y ) => S )): UpdateStatement<SourceProps, SelectorMap, FromSource>{
        
        let nameMap: { [key: string]: any | Scalar<any, any> }
        const selectorMap = this.getSelectorMap()
        
        const resolver = makeExpressionResolver(selectorMap, this.fromItem, this.joinItems.map(item => item.source))
        
        if(keyValues instanceof Function){    
            Object.assign(selectorMap, constructSqlKeywords(resolver) )
            const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords<any, any>(resolver)) as Y
            nameMap = keyValues(map)
        } else {
            nameMap = keyValues
        }

        this.#updateItems = Object.keys(nameMap).reduce( (acc, key) => {
            acc[key] = resolver(nameMap[key])
            return acc
        }, {} as { [key: string]: Scalar<any, any> } )


        return this
    }

    // cloneAsDataset(ctx?: DatabaseContext<any>){
    //     const context = ctx ?? this.context

    //     if(!context){
    //         throw new Error('There is no repository provided.')
    //     }
    //     ctx?.dataset().
    // }

    async toNativeBuilder(ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = ctx ?? this.context

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

        const updateItems = await this.scalarMap2RawMap(this.fromItem.schema(), this.#updateItems, context)
        if(Object.keys(updateItems).length === 0 && !this.fromItem){
            throw new Error('No UPDATE and FROM are provided for Dataset')
        }
        nativeQB.update( updateItems )

        if ( context.client().startsWith('pg')) {
            const schemaPrimaryKeyFieldName = (this.fromItem as unknown as TableDatasource<any, any>).schema().id.fieldName(context.orm)
            nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName)
        }

        return nativeQB
    }

    execute(context?: DatabaseContext<any>) {

        const ctx = context ?? this.context
        if(!ctx){
            throw new Error('There is no repository provided.')
        }

        const fromSource = this.fromItem as unknown as TableDatasource<TableSchema<{id: FieldProperty<any>}>, any>
        const schema = fromSource.schema()
        const statement = this 
        type T = (FromSource extends TableDatasource<infer S, any>?S: never)
        type CurrentSchemaFieldOnly = ExtractSchemaFieldOnlyFromSchema<T>
        type I = number[] | null

        return new DBMutationRunner<I, T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>(
            ctx,
            async function(this: DBMutationRunner<I, T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>,
                executionOptions: MutationExecutionOptions<T>) {
                
                const updatedIds = await this.context.startTransaction(async (trx) => {
                    executionOptions = {...executionOptions, trx}
                    
                    if(!this.latestPreflightFunctionArg && !this.latestQueryAffectedFunctionArg){
                        const nativeSql = await statement.toNativeBuilder(this.context)
                        const result = await this.context.executeStatement(nativeSql, {}, executionOptions)
                        if (this.context.client().startsWith('pg')) {
                            const updatedIds: number[] =result.rows.map( (row: any) => Object.keys(row).map(k => row[k])[0] )
                            return updatedIds
                        }
                        return null
                    } else {

                        const dataset = this.context.dataset() as Dataset<CurrentSchemaFieldOnly, any, any, FromSource >
                        dataset.cloneFrom(statement)
                        dataset.select({...dataset.getFrom()!.$.$allFields })

                        const finalDataset = this.latestPreflightFunctionArg? (await this.latestPreflightFunctionArg(dataset)): dataset
                        this.preflightResult = await finalDataset.execute().withOptions(executionOptions) as any[]
                        
                        const updatedIds = (this.preflightResult ?? []).map( (r:any) => r.id)

                        await statement.execute().withOptions(executionOptions)

                        if(this.latestQueryAffectedFunctionArg){
                            const queryDataset = this.context.dataset()
                            .from( schema.datasource('root') )
                            .where( ({root}) => root.id.in(...updatedIds) )
                            .select( ({root}) => root.$allFields ) as unknown as Dataset<CurrentSchemaFieldOnly>

                            const finalDataset = await this.latestQueryAffectedFunctionArg(queryDataset)
                            this.affectedResult = await finalDataset.execute().withOptions(executionOptions) as any[]
                        }

                        return updatedIds
                    }
                    
                }, executionOptions.trx)
                
                return updatedIds
            }
        )
    }
}


export class DeleteStatement<SourceProps ={}, SelectorMap ={}, FromSource extends TableDatasource<any, any> = TableDatasource<any, any>> 
    extends WhereClauseBase<SourceProps, SelectorMap, FromSource>
    {

    #updateItems: { [key: string]: Scalar<any, any> } | null = null

    constructor(ctx?: DatabaseContext<any>){
        super(ctx)
    }

    from<S extends TableSchema<any>, SName extends string>(source: TableDatasource<S, SName>):
        UpdateStatement< 
            UnionToIntersection< AddPrefix< ExtractPropDictFromSchema< S>, '', ''> | AddPrefix< ExtractPropDictFromSchema< S>, SName> >,
            UnionToIntersection< { [key in SName ]: ValueSelector< S> }>, TableDatasource<S, SName>
        > {
            return this.baseFrom(source) as any
        }

    where<Y extends SelectorMap & SQLKeywords< SourceProps, SelectorMap >  >(expression: Expression< SourceProps, Y>): UpdateStatement<SourceProps, SelectorMap, FromSource>{
        return this.baseWhere(expression) as any
    }

    innerJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        
        return this.baseInnerJoin(source, expression) as any
    }
     
    leftJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseLeftJoin(source, expression) as any
    }

    rightJoin<S extends Schema<any>, SName extends string, 
        X extends UnionToIntersection< SourceProps | AddPrefix< ExtractPropDictFromSchema< S>, SName>>,
        Y extends UnionToIntersection< SelectorMap | { [key in SName ]: ValueSelector< S> }>
        >(source: Datasource<S, SName>, 
        expression: Expression<X, Y>): UpdateStatement<X,Y, FromSource>{
        return this.baseRightJoin(source, expression) as any
    }

    async toNativeBuilder(ctx?: DatabaseContext<any>): Promise<Knex.QueryBuilder> {

        const context = ctx ?? this.context

        if(!context){
            throw new Error('There is no repository provided.')
        }

        if(!this.fromItem){
            throw new Error('No from item')
        }
        const from = await this.fromItem.toRaw(context)
        let nativeQB = context.orm.getKnexInstance().from(from)
        //@ts-ignore
        nativeQB.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'

        await this.buildWhereClause(context, nativeQB)

        nativeQB.delete()

        if ( context.client().startsWith('pg')) {
            const schemaPrimaryKeyFieldName = (this.fromItem as unknown as TableDatasource<any, any>).schema().id.fieldName(context.orm)
            nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName)
        }

        return nativeQB
    }

    execute(context?: DatabaseContext<any>) {

        const ctx = context ?? this.context
        if(!ctx){
            throw new Error('There is no repository provided.')
        }

        const fromSource = this.fromItem as unknown as TableDatasource<TableSchema<{id: FieldProperty<any>}>, any>
        const schema = fromSource.schema()
        const statement = this 
        type T = (FromSource extends TableDatasource<infer S, any>?S: never)
        type CurrentSchemaFieldOnly = ExtractSchemaFieldOnlyFromSchema<T>
        type I = number[] | null

        return new DBMutationRunner<I, T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>(
            ctx,
            async function(this: DBMutationRunner<I, T, ExtractValueTypeDictFromSchema_FieldsOnly<T>[], ExtractValueTypeDictFromSchema_FieldsOnly<T>[], false, false>,
                executionOptions: MutationExecutionOptions<T>) {
                
                const updatedIds = await this.context.startTransaction(async (trx) => {
                    executionOptions = {...executionOptions, trx}
                    
                    if(!this.latestPreflightFunctionArg && !this.latestQueryAffectedFunctionArg){
                        const nativeSql = await statement.toNativeBuilder(this.context)
                        const result = await this.context.executeStatement(nativeSql, {}, executionOptions)
                        if (this.context.client().startsWith('pg')) {
                            const updatedIds: number[] =result.rows.map( (row: any) => Object.keys(row).map(k => row[k])[0] )
                            return updatedIds
                        }
                        return null
                    } else {
                        
                        const dataset = this.context.dataset() as Dataset<CurrentSchemaFieldOnly, any, any, FromSource >
                        dataset.cloneFrom(statement)
                        dataset.select({...dataset.getFrom()!.$.$allFields })
                        
                        const finalDataset = this.latestPreflightFunctionArg? (await this.latestPreflightFunctionArg(dataset)): dataset
                        this.preflightResult = await finalDataset.execute().withOptions(executionOptions) as any[]
                        
                        const updatedIds = (this.preflightResult ?? []).map( (r:any) => r.id)

                        await statement.execute().withOptions(executionOptions)
                        
                        if(this.latestQueryAffectedFunctionArg){
                            const queryDataset = this.context.dataset()
                            .from( schema.datasource('root') )
                            .where( ({root}) => root.id.in(...updatedIds) )
                            .select( ({root}) => root.$allFields ) as unknown as Dataset<CurrentSchemaFieldOnly>

                            const finalDataset = await this.latestQueryAffectedFunctionArg(queryDataset)
                            this.affectedResult = await finalDataset.execute().withOptions(executionOptions) as any[]
                        }
                        return updatedIds
                    }
                    
                }, executionOptions.trx)
                
                return updatedIds
            }
        )
    }

}

export type SQLStringWithArgs = {sql: string, args?: any[]}
export type RawUnit<T extends PropertyType<any> = any> = 
    string | Promise<string> 
    | SQLStringWithArgs | Promise<SQLStringWithArgs> 
    | Knex.Raw | Promise<Knex.Raw> 
    | Knex.QueryBuilder | Promise<Knex.QueryBuilder> 
    | Scalar<T, any> | Promise<Scalar<T, any>>
    | Dataset<any, any, any, any> | Promise<Dataset<any, any, any, any>>
    | Promise<
        string | SQLStringWithArgs | Knex.Raw | Knex.QueryBuilder | Scalar<T, any> | Dataset<any, any, any, any>
    >


export type RawExpression<T extends PropertyType<any> = any> = ( (context: DatabaseContext<any>) => RawUnit<T>) | RawUnit<T>

function isSQLStringWithArgs(value: any): value is SQLStringWithArgs{
    const keys = Object.keys(value)
    if(keys.length === 1 && keys.includes('sql')){
        return true
    } else if(keys.length === 2 && keys.includes('sql') && keys.includes('args')) {
        return true
    }
    return false
}



export class Scalar<T extends PropertyType<any>, Value extends Knex.Raw | Dataset<any, any, any, any>  > {

    readonly declaredDefinition?: PropertyType<any> | null
    protected expressionOrDataset: RawExpression<T>
    protected context: DatabaseContext<any> | null = null
    #calculatedDefinition: PropertyType<any> | null = null
    #calculatedRaw: Knex.Raw | null = null
    #lastContext: DatabaseContext<any> | null = null
    // #afterResolvedHook: ((value: Value) => void | Promise<void>) | null = null
    
    // protected dataset:  | null = null
    constructor(expressionOrDataset: RawExpression<T> | ((context: DatabaseContext<any>) => Value) | ((context: DatabaseContext<any>) => Promise<Value>), 
        definition?: T | (new (...args: any[]) => T) | null,
        context?: DatabaseContext<any> | null){
        if(definition instanceof PropertyType){
            this.declaredDefinition = definition
        } else if(definition)
        {
            this.declaredDefinition = new definition()
        }
        this.expressionOrDataset = expressionOrDataset
        this.context = context ?? null
    }

    static value<D extends PropertyType<any>>(sql: string, args?: any[], definition?: D | (new (...args: any[]) => D) ): Scalar<D, any>;
    static value<D extends PropertyType<any>>(value: RawUnit, definition?: D | (new (...args: any[]) => D)): Scalar<D, any>;
    static value<D extends PropertyType<any>>(...args: any[]): Scalar<D, any>{
        if(typeof args[0] ==='string' && Array.isArray(args[1])){
            return this.value({sql: args[0], args: args[1]}, args[2])
        }
        return new Scalar(args[0], args[1])
    }

    static number(sql: string, args?: any[]): Scalar<NumberNotNullType, any>;
    static number<T extends RawUnit>(value: T): Scalar<NumberNotNullType, any>;
    static number(...args: any[]): Scalar<NumberNotNullType, any>{
        if(typeof args[0] ==='string' && Array.isArray(args[1])){
            return this.number({sql: args[0], args: args[1]})
        }
        return new Scalar(args[0], NumberNotNullType)
    }

    isNull(): Scalar<BooleanNotNullType, any> {
        return new IsNullOperator(this).toScalar()
    }

    isNotNull(): Scalar<BooleanNotNullType, any> {
        return new IsNotNullOperator(this).toScalar()
    }

    looseEquals(rightOperand: any | DScalar<any, any>): Scalar<BooleanNotNullType, any> {
        if(rightOperand === null || rightOperand === undefined){
            return this.isNull()
        } else if(rightOperand instanceof DScalar){
            const d = rightOperand
            return this.in(rightOperand)
        }
        return this.equals(rightOperand)
    }

    looseNotEquals(rightOperand: any | DScalar<any, any>): Scalar<BooleanNotNullType, any> {
        if(rightOperand === null || rightOperand === undefined){
            return this.isNotNull()
        } else if(rightOperand instanceof DScalar){
            const d = rightOperand
            return this.notIn(rightOperand)
        }
        return this.notEquals(rightOperand)
    }
    
    equals(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new EqualOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    notEquals(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new NotEqualOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    like(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new LikeOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    notLike(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new NotLikeOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    in(...rightOperands: any[]): Scalar<BooleanNotNullType, any> {
        const rights = rightOperands.length === 1 && Array.isArray(rightOperands[0]) ? rightOperands[0]: rightOperands

        return new InOperator(this, ...(rights.map(r => resolveValueIntoScalar(r))) ).toScalar()
    }

    notIn(...rightOperands: any[]): Scalar<BooleanNotNullType, any> {
        const rights = rightOperands.length === 1 && Array.isArray(rightOperands[0]) ? rightOperands[0]: rightOperands

        return new NotInOperator(this, ...(rights.map(r => resolveValueIntoScalar(r))) ).toScalar()
    }

    greaterThan(rightOperand: any): Scalar<BooleanNotNullType, any>{
        return new GreaterThanOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    lessThan(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new LessThanOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    greaterThanOrEquals(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new GreaterThanOrEqualsOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    lessThanOrEquals(rightOperand: any): Scalar<BooleanNotNullType, any> {
        return new LessThanOrEqualsOperator(this, resolveValueIntoScalar(rightOperand) ).toScalar()
    }

    between(rightOperand1: any, rightOperand2: any): Scalar<BooleanNotNullType, any> {
        return new BetweenOperator(this, resolveValueIntoScalar(rightOperand1), resolveValueIntoScalar(rightOperand2) ).toScalar()
    }

    notBetween(rightOperand1: any, rightOperand2: any): Scalar<BooleanNotNullType, any> {
        return new NotBetweenOperator(this, resolveValueIntoScalar(rightOperand1), resolveValueIntoScalar(rightOperand2) ).toScalar()
    }

    // private toRealRaw() {
    //     return this.expressionOrDataset
    // }

    // geValue(): Value {
    //     return this.expressionOrDataset
    // }

    // setValue<NewValue extends  RawExpression<T>>(value: ((lastValue: Value) => NewValue) ): Scalar<T, NewValue> {
    //     if(value instanceof Function){

    //     }
    // }

    // setType<P extends PropertyType<any>>(definition?: P | (new (...args: any[]) => P )): Scalar<P>{
    //     const d = definition ??  this.definition
    //     return new Scalar(this.toRealRaw(), d, this.context)
    // }

    definitionForParsing(): PropertyType<any>{
        return this.#calculatedDefinition ?? this.declaredDefinition ?? new PropertyType()
    }

    // afterResolved<Current extends Scalar<any, any> >(this: Current, callback: (value: Value) => void | Promise<void> ): Current{
    //     this.#afterResolvedHook = callback
    //     return this
    // }

    transform<T extends PropertyType<any>, NewValue extends Knex.Raw | Dataset<any, any, any, any>>(
            fn: (value: Value, context: DatabaseContext<any>) => Scalar<T, NewValue> | Promise<Scalar<T, NewValue>>
        ): Scalar<T, NewValue> {
        
        const s = new Scalar<T, NewValue>( (context) => {
            const rawOrDataset = this.resolveIntoRawOrDataset(context, this.expressionOrDataset) as Value | Promise<Value>
            return thenResult( rawOrDataset, rawOrDataset => fn(rawOrDataset, context) )
        })

        return s
    }

    protected async resolveDefinition(ctx: DatabaseContext<any>, ex: RawExpression): Promise<PropertyType<any>> {
        return thenResult(ex, ex => {
            if(ex instanceof Dataset){
                return this.resolveDefinition(ctx, ex.toDScalarWithArrayType() )
            } else if(ex instanceof Scalar ){
                if(ex.declaredDefinition){
                    return ex.declaredDefinition
                } else {
                    const raw = ex.expressionOrDataset
                    return this.resolveDefinition(ctx, raw)
                }
            } else if(ex instanceof Function) {
                return this.resolveDefinition(ctx, ex(ctx))
            } else {
                return new PropertyType()
            }
        })
    }

    private async calculateDefinition(context?: DatabaseContext<any>):  Promise<PropertyType<any>>  {
        const ctx = (context ?? this.context)
        if(!ctx){
            throw new Error('There is no repository provided')
        }
        
        return await this.resolveDefinition(ctx, this)
        // this.#cachedDefinition = await resolveDefinition(this)
        // console.log('cacched definition', this.#cachedDefinition)
        // return this.#cachedDefinition
    }

    private calculateRaw(context?: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> {
        
        const ctx = (context ?? this.context)
        if(!ctx){
            throw new Error('There is no repository provided')
        }
        const expressionOrDataset = this.expressionOrDataset

        const raw = thenResult( this.getDefinition(ctx), definition =>  {
            // if(!definition){
            //     console.log('......', this.declaredDefinition, this.calculateDefinition, this.expressionOrDataset.toString())
            //     // throw new Error('It cannot toRaw because without definition')
            // }
            return thenResult( this.resolveIntoRawOrDataset(ctx, expressionOrDataset), rawOrDataset => {
                
                // let e: void | Promise<void> | boolean = true
                // if(this.#afterResolvedHook){
                //     e = this.#afterResolvedHook(rawOrDataset)
                // }

                if(!(rawOrDataset instanceof Dataset)){
                    const next = ctx.raw(rawOrDataset.toString())
                    return (definition ?? new PropertyType()).transformQuery(next, ctx)
                } else {
                    return (definition ?? new PropertyType()).transformQuery(rawOrDataset, ctx)
                }
            
                
            })

        })
        return raw

    }

    protected resolveIntoRawOrDataset(context: DatabaseContext<any>, raw: RawExpression):
        ( Knex.Raw<any> | Promise<Knex.Raw<any>> | Dataset<any, any, any> | Promise< Dataset<any, any, any> >) {

        return thenResult(raw, ex => {

            if(ex instanceof Dataset){
                // console.log('here 1')
                return ex
            } else if(ex instanceof Scalar) {
                // console.log('here 2')
                return this.resolveIntoRawOrDataset(context, ex.expressionOrDataset )
                
            } else if( ex instanceof Function){
                // console.log('resolve', ex.toString())
                return this.resolveIntoRawOrDataset(context, ex(context))
            } else if (typeof ex === 'string') {

                return context.raw(ex)
            } else if (isSQLStringWithArgs(ex)){
                if(!ex.args){
                    return context.raw(ex.sql)
                } else {
                    const rawArgs = ex.args.map( (arg) => {
                        if(arg instanceof Scalar){
                            return arg.toRaw(context)
                        } else if(arg instanceof Dataset){
                            return arg.toNativeBuilder(context)
                        }
                        return arg
                    })
                    return thenResultArray(rawArgs, rawArgs => thenResult(rawArgs, rawArgs => context.raw(ex.sql, rawArgs)) )
                }
            }
            return ex
        })
    }
    
    async getDefinition(context?: DatabaseContext<any>): Promise<PropertyType<any>>{
        if(context && this.#lastContext !== context){
            this.#calculatedRaw = null
        }

        if(!this.#calculatedDefinition){
            this.#calculatedDefinition = await this.calculateDefinition(context)
            // console.log('calculate the definition....', this.#calculatedDefinition)
            this.#lastContext = context ?? null
        }
        return this.#calculatedDefinition
    }

    async toRaw(context?: DatabaseContext<any>): Promise<Knex.Raw> {

        if(context && this.#lastContext !== context){
            this.#calculatedRaw = null
        }

        if(!this.#calculatedRaw){
            this.#calculatedRaw = await this.calculateRaw(context)
            this.#lastContext = context ?? null
        }
        return this.#calculatedRaw
    }

    // toScalar<C extends Scalar<T, Value>>(this: C): C{
    //     return this
    // }

    execute(this: Scalar<T, Value>, context?: DatabaseContext<any>)
    : DBQueryRunner<T extends PropertyType<infer D>? D: any, false> 
        {
        const ctx = context ?? this.context

        if(!ctx){
            throw new Error('There is no repository provided.')
        }
        const currentScalar = this

        return new DBQueryRunner<T extends PropertyType<infer D>? D: never, false>(
            ctx,
            async function(this: DBQueryRunner<T extends PropertyType<infer D>? D: never, false>, executionOptions: ExecutionOptions) {

                const result = await this.context.dataset().select({
                    root: currentScalar
                }).execute().withOptions(executionOptions)

                return result[0].root as Promise<T extends PropertyType<infer D>? D: never>
            }
        )
    } 
}

export class DScalar<T extends PropertyType<any>, DS extends Dataset<any, any, any, any>> extends Scalar<T, DS> {
    
    // #isArray: boolean

    constructor(
            content: Dataset<any, any, any, any> |
            DScalar<any, any> |
            ( (context: DatabaseContext<any>) => Dataset<any, any, any, any> | Promise<Dataset<any, any, any, any>> | DScalar<any, any> | Promise<DScalar<any, any>>),
            definition?: T | (new (...args: any[]) => T) | null,
        context?: DatabaseContext<any> | null){
            super(
                    (async (context: DatabaseContext<any>) => {
                        let resolved: Dataset<any, any, any, any> | DScalar<any, any>
                        if(content instanceof Function){
                            resolved = await content(context)
                        } else {
                            resolved = content
                        }
                        if(resolved instanceof Dataset && !definition) {
                            return resolved.toDScalarWithType( (ds) => new ArrayType(ds.schema()) )
                        }
                        return resolved
                    }) as RawExpression<any>
                    , definition, context)
            // this.#isArray = isArray

        }
    
    // get isArray(){
    //     return this.#isArray
    // }

    count(this: DScalar<any, DS>): Scalar<NumberNotNullType, any> {
        return super.transform( (value, ctx)=> {
            if(value instanceof Dataset){
                return value.select( () => ({ count: new Scalar('Count(1)') }) ).toDScalarWithType(NumberNotNullType)
            }
            throw new Error('count is only applicable to Dataset.')
        })
    }

    exists(this: DScalar<any, DS>): Scalar<BooleanNotNullType, any> {
        return super.transform( (value, ctx)=> {
            if(value instanceof Dataset){
                return ctx.$.Exists(value)
            }
            throw new Error('count is only applicable to Dataset.')
        })
    }

    transform<NewDScalar extends DScalar<any, any>  >(
            fn: (value: DS, context: DatabaseContext<any>) => NewDScalar | Promise<NewDScalar>
        ): NewDScalar {
        
        const s = new DScalar( (context) => {
            const rawOrDataset = this.resolveIntoRawOrDataset(context, this.expressionOrDataset)
            return thenResult( rawOrDataset, rawOrDataset => fn(rawOrDataset as DS, context) )
        }) as NewDScalar

        return s
    }

    asArrayType(this: DScalar<any, DS>): DScalar< ArrayTypeDataset<DS>, DS>{
        return this.transform( (preValue, context)=> {
            return preValue.toDScalarWithType( (ds) => new ArrayType(ds.schema()) )
        }) as DScalar< ArrayTypeDataset<DS>, DS>
    }

    asObjectType(this: DScalar<any, DS>): DScalar< ObjectTypeDataset<DS>, DS>{
        return this.transform( (preValue, context)=> {
            return preValue.toDScalarWithType( (ds) => new ObjectType(ds.schema()) )
        }) as DScalar< ObjectTypeDataset<DS>, DS>
    }
}

export function resolveValueIntoScalar(value: any): any{
    if( value === null){
        return new Scalar((context: DatabaseContext<any>) => context.raw('?', [null]))
    } else if (typeof value === 'boolean') {
        const boolValue = value
        return new Scalar((context: DatabaseContext<any>) => context.raw('?', [boolValue]), new BooleanType())
    } else if (typeof value === 'string'){
        const stringValue = value
        return new Scalar((context: DatabaseContext<any>) => context.raw('?', [stringValue]), new StringType())
    } else if (typeof value === 'number'){
        const numberValue = value
        return new Scalar((context: DatabaseContext<any>) => context.raw('?', [numberValue]), new NumberType())
    } else if (value instanceof Date){
        const dateValue = value
        return new Scalar((context: DatabaseContext<any>) => context.raw('?', [dateValue]), new DateTimeType())
    } else if(value instanceof ConditionOperator){
        return value.toScalar()
    } else if (value instanceof Dataset) {
        return value.toDScalarWithArrayType()
    }
    return value
}

export type ExpressionResolver<Props, M> = (expression: Expression<Props, M>) => Scalar<any, any>

export const makeExpressionResolver = function<Props, M>(dictionary: UnionToIntersection< M | SQLKeywords<Props, M> >, fromSource?: Datasource<any, any>, sources?: Datasource<any, any>[]) {

    const resolver: ExpressionResolver<Props, M> = (expression: Expression<Props, M>): Scalar<any, any> => {
        let value
        if( expression instanceof Function) {
            value = expression(dictionary)
        } else {
            value = expression
        }
        value = resolveValueIntoScalar(value)
        if(value instanceof Scalar){
            return value
        } else if(Array.isArray(value)){
            const expr = new OrOperator<Props, M>(resolver, ...value)
            return resolver( expr )
        } else if( (fromSource) && value instanceof SimpleObjectClass){
            const dict = value as SimpleObject
            const scalars = Object.keys(dict).reduce( (scalars, key) => {
                
                let source: Datasource<any, any> | null | undefined = null
                let [sourceName, propName] = key.split('.')
                if(!propName){
                    // if(!fromSource){
                    //     throw new Error(`There must be a FROM before using in 'where'.`)
                    // }
                    propName = sourceName
                    source = fromSource
                } else{
                    source = [fromSource, ...(sources?sources:[]) ].find(s => s && s.sourceAlias === sourceName)
                }
                if(!source){
                    // console.log('sources', sources, sourceName)
                    throw new Error(`cannot found source (${sourceName})`)
                }

                const prop = source.schema().propertiesMap[propName]
                if(!prop){
                    throw new Error(`cannot found prop (${propName})`)
                }
                
                const operatorScalar = (leftOperatorEx: any, rightOperatorEx: any) => {
                    const leftOperator = resolver(leftOperatorEx)

                    let finalScalar: Scalar<any, any>
                    if(rightOperatorEx instanceof AssertionOperatorWrapper) {
                        finalScalar = rightOperatorEx.toScalar(leftOperatorEx)
                    } else if(rightOperatorEx === null){
                        finalScalar = new IsNullOperator(leftOperator).toScalar()
                    } else {
                        finalScalar = new EqualOperator(leftOperator, resolver(rightOperatorEx)).toScalar()
                    }
                    return finalScalar
                }
                
                if(prop instanceof FieldProperty || prop instanceof ScalarProperty){
                    const converted = source.getFieldProperty(propName)
                    scalars.push( operatorScalar(converted, dict[key]) )
                } else if(prop instanceof ComputeProperty){
                    const compiled = (source.getComputeProperty(propName))()
                    scalars.push( operatorScalar(compiled, dict[key]) )
                }
    
                return scalars
    
            }, [] as Scalar<BooleanNotNullType, any>[] )

            const arr = new AndOperator<Props, M>(resolver, ...scalars)
            return resolver(arr)
        } else {
            throw new Error('Unsupport value')
        }
    }

    return resolver
}
