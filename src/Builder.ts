import { Knex}  from "knex"
import { getKnexInstance, TableSchema, SelectorMap, ExecutionContext, CompiledComputeFunction, CompiledComputeFunctionPromise, FieldProperty, Schema, field } from "."
import { And, AndOperator, ConditionOperator, Contain, Equal, IsNull, Or, SQLKeywords, ValueOperator } from "./Operator"
import { BooleanType, NumberType, PropertyTypeDefinition } from "./PropertyType"
import { ExtractFieldProps, SimpleObject, SimpleObjectClass, UnionToIntersection } from "./util"

// type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn;

// type Dataset<TRecord = any, TResult = any> = {
//     [Property in keyof Knex.QueryBuilder<TRecord, TResult>]: 
//         Knex.QueryBuilder<TRecord, TResult>[Property] extends (...a: any) => Knex.QueryBuilder<TRecord, TResult> ? 
//             ReplaceReturnType< Knex.QueryBuilder<TRecord, TResult>[Property], Dataset> : ( Knex.QueryBuilder<TRecord, TResult>[Property] extends Knex.QueryBuilder<TRecord, TResult> ?  Dataset : Knex.QueryBuilder<TRecord, TResult>[Property]  )
// }

declare module "knex" {
    export namespace Knex {
        interface QueryBuilder{
            toRow(): Dataset<any, any, any>
            // toRaw(): Knex.Raw
            toQueryBuilder(): Knex.QueryBuilder
        }

        interface Raw {
            clone: Function
            __type: 'Raw' | 'Scalar' | 'FromClause' | 'Dataset'
        }
    }
}



export type FieldPropertyValueMap<E> =  Partial<{
    [key in keyof E]:
        E[key] extends Prefixed<any, any, infer C>? (
                C extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>: never
             ): E[key] extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>: never
             
}>

export type Expression<O, M> = ((map: M) => Expression<O, M>) | Partial<FieldPropertyValueMap<O>>  | AndOperator<O, M> | Scalar | Promise<Scalar> | Array<Expression<O, M> > | boolean


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

export interface Scalarable {
    toScalar<T extends PropertyTypeDefinition>(d: T): Scalar<T>
}

export interface Datasource<E extends Schema, alias extends string> {
    // (value: QueryFilter): Promise<Scalar> | Scalar
    // impl: Datasource
    schema: E
    executionContext: ExecutionContext
    $: SelectorMap<E>
    //TODO: implement
    getFieldProperty: <Name extends string, T>(name: Name) => Column<Name, T>    
    getComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunction<Name, ARG, R>
    getAysncComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunctionPromise<Name, ARG, R>
    tableAlias: {
        [key in keyof [alias] as alias]: string 
    }
    // allNormal: () => Column<any, any>[]
    // asFromClause: () => FromClause< 
    //         AddPrefix< FilterEntityPropertyKeyValues<E>, alias>,
    //         {[key in alias]: FilterEntityPropertyKeyValues<E>}
    //     >
}

export interface TableDatasource<E extends TableSchema, Name extends string> extends Datasource<E, Name> {
    tableName: string
}
export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any>
} | SelectableProps<E>[]

// type ConvertProps<NewProps, SourceProps> = 
export type ValuesOf<T extends any[]>= T[number];




export interface Dataset<SelectProps, SourceProps, SourcePropMap> extends Knex.Raw, Scalarable {
    __type: 'Dataset'
    // __mainSelector?: Selector | null
    // __expressionResolver: QueryFilterResolver
    __selectItems: SelectItem[]
    __fromSource: FromClause<any, any>
    __realSelect: Function
    __realClearSelect: Function

    __realClone: Function //TODO: override the clone function
    __realFrom: Function
    // getInvolvedSelectors(): Datasource<any>[]
    extractColumns(): string[]
    toQueryBuilder(): Knex.QueryBuilder
    // toRaw(): Knex.Raw
    toDataset(): Dataset<SelectProps, SourceProps, SourcePropMap>

    //TODO: implement
    toScalar<T extends PropertyTypeDefinition>(d: T): Scalar<T>
    clone(): Dataset<SelectProps, SourceProps, SourcePropMap>
    clearSelect(): Dataset<any, SourceProps, SourcePropMap>
    
    // select(...cols: Column[]): Dataset<T, any, any>
    
    props<P extends keyof SourceProps>(...properties: P[]): 
        Dataset<
            UnionToIntersection<
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
        SourceProps, SourcePropMap>

    props<S extends {[key: string]: Scalar<any>}, P extends keyof SourceProps>(named: S, ...properties: P[]): 
        Dataset<
            UnionToIntersection<
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
        SourceProps, SourcePropMap>

    filter(filter?: Expression<SourceProps, 
        UnionToIntersection< SourcePropMap | SQLKeywords<SourceProps, SourcePropMap> >        
                > ): Dataset<SelectProps, SourceProps, SourcePropMap>

    from<D>(source: D): 
        D extends Datasource<infer S, infer SName>?
        Dataset<any, 
            UnionToIntersection< AddPrefix< ExtractFieldProps< S>, '', ''> | AddPrefix< ExtractFieldProps< S>, SName> >,
            UnionToIntersection< { [key in SName ]: SelectorMap< S> } >
        >
        :never

    innerJoin<D>(source: D, 
        condition:  D extends Datasource<infer S, infer SName>? 
        Expression<
            UnionToIntersection< SourceProps | AddPrefix< ExtractFieldProps< S>, SName>>,
            UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } | SQLKeywords<SourceProps, SourcePropMap> >
        >: unknown ):
        
        D extends Datasource<infer S, infer SName>?
            Dataset<any, 
            UnionToIntersection< SourceProps | AddPrefix< ExtractFieldProps< S>, SName>>,
            UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } >
            >
            : never
     
    leftJoin<S extends Schema, SName extends string>(source: Datasource<S, SName>, condition: Scalar<BooleanType>):Dataset<any, 
        UnionToIntersection< SourceProps | AddPrefix< ExtractFieldProps< S>, SName>>,
        UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } >
    >

    rightJoin<S extends Schema, SName extends string>(source: Datasource<S, SName>, condition: Scalar<BooleanType>):Dataset<any, 
        UnionToIntersection< SourceProps | AddPrefix< ExtractFieldProps< S>, SName>>,
        UnionToIntersection< SourcePropMap | { [key in SName ]: SelectorMap< S> } >
    >

    //TODO: implement
    datasource<Name extends string>(name: Name): Datasource<SelectProps & Schema, Name>

    //TODO: implement
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
    >
}

// export interface Column<T = any> {
//     __actualAlias: string
//     clone(): Column<T>
// }

export type Column<Name extends string, T> = {
    [key in keyof Name & string as Name]: Scalar<T>
} & Scalar<T>

export interface Scalar<T = any> extends Knex.Raw {
    __type: 'Scalar'
    // __selector: Selector | null
    // __namedProperty: NamedProperty
    __definition: PropertyTypeDefinition | null
    __expression: Knex.QueryBuilder | Knex.Raw
    count(): Scalar<NumberType> 
    exists(): Scalar<BooleanType> 
    equals: (value: any) => Scalar<BooleanType>
    is(operator: string, value: any): Scalar<BooleanType> 
    toRaw(): Knex.Raw
    toScalar(): Scalar<T>
    clone(): Scalar<T>
    asColumn<Name extends string>(propName: string & Name): Column<Name, T>         //TODO: implement rename
}

export interface FromClause<Props, PropMap> extends Knex.Raw {
    __type: 'FromClause'
    // __raw: string
    __parentSource: FromClause<any, any> | null
    __realClone: Function

    
}

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

export const makeBuilder = function<T extends {}>(mainSelector?: Datasource<any, any> | null, cloneFrom?: Dataset<T, any, any>) : Dataset<T, any, any> {
    let sealBuilder: Dataset<T, any, any>
    if(cloneFrom){
        if(!isDataset(cloneFrom)){
            throw new Error('Unexpected Flow.')
        }
        sealBuilder = cloneFrom.__realClone()
        sealBuilder.__selectItems = cloneFrom.__selectItems.map(item => {
            return {
                actualAlias: item.actualAlias,
                value: isScalar(item)? (item as unknown as Scalar).clone() : (isDataset(item)? (item as unknown as Dataset).toQueryBuilder().clone(): item.toString() )
            }
        })
        sealBuilder.__fromSource = cloneFrom.__fromSource

    } else {
        sealBuilder = getKnexInstance().clearSelect() as unknown as Dataset<T, any, any>
        sealBuilder.__selectItems = []
    }

    // @ts-ignore
    sealBuilder.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    sealBuilder.__type = 'Dataset'
    sealBuilder.__realSelect = sealBuilder.select
    // sealBuilder.__mainSelector = mainSelector
    // sealBuilder.__expressionResolver = makeQueryFilterResolver( () => sealBuilder.getInvolvedSelectors().map(s => s.impl) )


    sealBuilder.getInvolvedSelectors = () => {
        //TODO: get the involved from Source
        let s: FromClause | null = sealBuilder.__fromSource
        let selectors = []
        while(s){
            selectors.unshift(s.__selector)
            s = s.__parentSource
        }
        return selectors
    }

    // override the select methods
    sealBuilder.select = function(...args: any[]){

        let converted: SelectItem[] = args.flatMap( item => {

            if(item instanceof Promise){
                console.log('\x1b[33m%s\x1b[0m', 'Maybe you called any computed Property that is an Async Function but you haven\'t \'await\' it before placing it into the QueryBuilder.')
                throw new Error('Invalid Select Item.')
            } else if(item === '*'){
                throw new Error("Currently it doesn't support using '*'. Please use Selector.all")
            } else if(Array.isArray(item) && item.find( subitem => isColumn(subitem) )){
                throw new Error("Detected that array of 'Scalar' is placed into select expression. Please use ES6 spread syntax to place the columns.")
            } else if(isColumn(item) ){
                let casted = item as Column<any>
                let expression = casted.__expression
                let definition = casted.__definition
                let alias = casted.__actualAlias

                let finalExpr: string
                if(definition && definition.queryTransform){

                    if(isDataset(expression)){
                        let castedExpression = expression as unknown as Dataset
                        let extractedColumnNames = castedExpression.extractColumns()
                        if(extractedColumnNames.length === 0){
                            throw new Error(`There is no selected column to be transformed as Computed Field '${casted.__actualAlias}'. Please check your sql builder.`)
                        }
                        finalExpr = definition.queryTransform(castedExpression, extractedColumnNames, 'column1').toString()
                    
                    } else if(isScalar(expression)){
                        finalExpr = definition.queryTransform(expression, null, 'column1').toString()
                    } else {
                        throw new Error('QueryBuilders which are not created through TaiChi are not supported.')
                    }

                } else {
                    finalExpr = expression.toString()
                }

                let text = finalExpr.toString().trim()

                if(text.includes(' ') && !( text.startsWith('(') && text.endsWith(')') ) ){
                    text = `(${text})`
                }
                return [{
                    value: makeRaw(`${text} AS ${quote(alias)}`),
                    actualAlias: alias
                }]
            }

            return [{
                value: item,
                actualAlias: parseName(item)
            }]
        })

        //check exists in columns before
        let pool = this.__selectItems.map(item => item.value.toString())
        let duplicated = converted.filter(item => pool.includes( item.value.toString() ))
        if( duplicated.length > 0 ){
            throw new Error(`Duplicated Columns '${duplicated.map(d => d.actualAlias).join(',')}' are detected.`)
        }

        this.__selectItems = this.__selectItems.concat(converted)

        let values = converted.map(c => c.value)
        return this.__realSelect(...values)
    }

    sealBuilder.__realClearSelect = sealBuilder.clearSelect
    sealBuilder.clearSelect = function(){
        sealBuilder.__selectItems = []
        return sealBuilder.__realClearSelect()
    }

    sealBuilder.__realClone = sealBuilder.clone
    sealBuilder.clone = function(){
        return makeBuilder(null, sealBuilder)
    }

    sealBuilder.extractColumns = (): string[] => {
        // let ourBuilder = castAsRow(builderOrRaw)
        return sealBuilder.__selectItems.map(item => {
            return item.actualAlias
        })
    }

    sealBuilder.toQueryBuilder = (): Knex.QueryBuilder => {
        return sealBuilder as unknown as Knex.QueryBuilder
    }

    sealBuilder.toDataset = (): Dataset => {
        return sealBuilder 
    }

    sealBuilder.__realFrom = sealBuilder.from
    sealBuilder.from = (source: FromClause) => {
        sealBuilder.__fromSource = source
        sealBuilder.__realFrom(source)
        return sealBuilder
    }

    sealBuilder.filter = (expression: Expression<any>): Dataset => {
        if(!sealBuilder.__fromSource){
            throw new Error('There is no source declared before you carry out filter.')
        }

        let resolver = makeExpressionResolver(sources)

        let boolScalar = await resolver(expression)


        sealBuilder.toQueryBuilder().where( sealBuilder.__expressionResolver(queryWhere))
        return sealBuilder
    }

    //after the select is override, add default 'all'
    if(mainSelector){
        sealBuilder = sealBuilder.select(...mainSelector.all).from(mainSelector)
    }

    return sealBuilder
}

export const makeRaw = (first: any, ...args: any[]) => {
    let r = getKnexInstance().raw(first, ...args)
    // @ts-ignore
    r.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    r.clone = () => {
        return makeRaw(r.toString())
    }
    r.__type = 'Raw'
    return r
}

export const makeScalar = <T extends PropertyTypeDefinition>(expression: Knex.Raw | Knex.QueryBuilder, definition: T | null = null): Scalar<T> => {

    let text = expression.toString().trim()

    text = addBlanketIfNeeds(text)
    let scalar: Scalar<any> = makeRaw(text) as Scalar<any>
    scalar.__type = 'Scalar'
    scalar.__expression = expression.clone()
    // column.__fieldName = fieldName
    scalar.__definition = definition
    // column.__selector = selector

    scalar.count = (): Scalar<NumberType> => {
        if(!expression){
            throw new Error('Only Dataset can apply count')
        }
        let definition = new NumberType()
        let expr = makeBuilder().toQueryBuilder().count().from(makeRaw(`(${expression.toString()}) AS ${quote(makeid(5))}`))

        return makeScalar<NumberType>(expr, definition)
    }

    scalar.exists = (): Scalar<BooleanType> => {
        if(!expression){
            throw new Error('Only Dataset can apply exists')
        }

        return makeScalar<BooleanType>(makeRaw(`EXISTS (${expression.toString()})`), new BooleanType())
    }

    scalar.equals = (value: any): Scalar<BooleanType> => {

        return makeScalar<BooleanType>( Equal(value).toRaw(scalar), new BooleanType())
    }

    scalar.is = (operator: string, value: any): Scalar<BooleanType> => {
        if(!expression){
            throw new Error('Only Dataset can apply count')
        }

        return makeScalar<BooleanType>(makeRaw(`(${expression.toString()}) ${operator} ?`, [value]), new BooleanType())
    }

    scalar.clone = () =>{
        return makeScalar<T>(expression, definition)
    }

    scalar.toRaw = () => {
        return scalar
    }
    
    return scalar
}

export const makeColumn = <T = any>(alias: string, col: Scalar<T>) : Column<T> => {
    let column = col.clone() as Column<T>
    column.__actualAlias = alias
    column.clone = () =>{
        return makeColumn<T>(alias, col)
    }
    return column
}

export const makeFromClause = (parentSource: FromClause | null, joinText: string | null, selector: Datasource<any> | null, condition: Scalar<BooleanType> | null ): FromClause => {
    let t = selector?.toString() ?? ''

    joinText  = (joinText ?? '').trim()

    let raw = `${joinText} ${t}${joinText.length === 0 || !condition?'':` ON ${condition.toString()}`}`

    let target = makeRaw(raw) as unknown as FromClause
    target.__type = 'FromClause'
    // target.__raw = raw
    target.__parentSource = parentSource
    
    target.innerJoin = (source: Datasource<any>, condition: Scalar<BooleanType>) => {
        let s = makeFromClause(target, `${target.toString()} INNER JOIN`, source, condition)
        return s
    }

    target.leftJoin = (source: Datasource<any>, condition: Scalar<BooleanType>) => {
        let s = makeFromClause(target, `${target.toString()} LEFT JOIN`, source, condition)
        return s
    }

    target.rightJoin = (source: Datasource<any>, condition: Scalar<BooleanType>) => {
        let s = makeFromClause(target, `${target.toString()} RIGHT JOIN`, source, condition)
        return s
    }

    target.__realClone = target.clone
    target.clone = () => {
        let newT = makeRaw(raw) as unknown as FromClause
        newT.__type = 'FromClause'
        // newT.__selector = target.__selector
        // newT.__raw = target.__raw
        newT.__parentSource = target.__parentSource
        return newT
    }

    return target
}

// export const extractColumns = (builder: Knex.QueryBuilder): string[] => {
    
//     // let ourBuilder = castAsRow(builderOrRaw)
//     return builder.__selectItems.map(item => {
//         return item.actualAlias
//     })
// }

const parseName = (item: any) => {
    let text = item.toString().trim()

    let e = /((?<![\\])[`'"])((?:.(?!(?<![\\])\1))*.?)\1/g
    let r = e.exec(text)
    if(r){
        let last = r[0]
        while( (r = e.exec(text) )){
            last = r[0]
        }
        return last
    } else {
        let e = /\b[\. ]+([a-zA-Z0-9\_\$]*)$/
        let r = e.exec(text)
        if(r && r[1]){
            return r[1]
        }else {
            return text
        }
    }
}

export type ExpressionResolver<Props> = (value: Expression<Props>) => Scalar

export const makeExpressionResolver = function<Props>(fromClause: FromClause<Props>) {

    const sources: Datasource<Schema, any>[]
    
    const resolver: ExpressionResolver<Props> = <Props>(value: Expression<Props>) => {
        if (value === true || value === false) {
            return makeScalar(makeRaw('?', [value]), new BooleanType() )
        } else if(value instanceof ConditionOperator){
            return value.toScalar(resolver)
        } else if(Array.isArray(value)){
            return resolver(Or<Props>(...value))
        } else if(isScalar(value)){
            return value as Scalar
        } else if (isDataset(value)) {
            throw new Error('Unsupport')
        } else if(value instanceof SimpleObjectClass){
            let dict = value as SimpleObject
            let sqls = Object.keys(dict).reduce( (accSqls, key) => {
                
                let [sourceName, propName] = key.split('.')
                if(!propName){
                    propName = sourceName
                    sourceName = Object.keys(sources[0]?.tableAlias)[0]
                }
                let source = sources.find(s => s.tableAlias[sourceName] = sourceName)
                if(!source){
                    throw new Error(`cannot found source (${source})`)
                }

                let prop = source.schema.propertiesMap[propName]
                if(!prop){
                    throw new Error(`cannot found source (${source})`)
                }
                
                let operator: ValueOperator
                if(dict[key] instanceof ValueOperator){
                    operator = dict[key]
                }else if( Array.isArray(dict[key]) ){
                    operator = Contain(...dict[key])
                } else if(dict[key] === null){
                    operator = IsNull()
                } else {
                    operator = Equal(dict[key])
                }
    
                if(prop instanceof FieldProperty){
                    let converted = source.getFieldProperty(propName)
                    accSqls.push( operator.toScalar(converted) )
                } else {
                    let compiled = (source.getComputeProperty(propName))()
                    if(compiled instanceof Promise){
                        throw new Error('Unsupported Async Computed Property in Expression Resolver')
                    }
                    accSqls.push(  operator.toScalar(compiled) )
                }
    
                return accSqls
    
            }, [] as Array<Scalar> )

            let arr = And(...sqls)
            return resolver(arr)
        } else {
            throw new Error('Unsupport Where clause')
        }
    }

    return resolver

}



export type EntityPropsResolver = <S extends Schema>() => RawFilter


export function makePropsResolver<AcceptableSourceProps>(): EntityPropsResolver {


    const resolver = (selector: Datasource<any>, querySelect: QuerySelect, row: Dataset) {
        // let selector = getSelectorFunc()[0]
        let stmtOrPromise: Knex.QueryBuilder | Promise<Knex.QueryBuilder> = row.toQueryBuilder()
        let allColumns: Array<Column | Promise<Column>> = []
        if(querySelect && !Array.isArray(querySelect)){
            let select = querySelect
            if (select && Object.keys(select).length > 0) {

                let removeNormalPropNames = Object.keys(select).map((key: string) => {
                    const item = select[key]
                    if (item === false) {
                        let prop = selector.schema.fieldProperties.find(p => p.name === key)
                        if (!prop) {
                            throw new Error(`The property ${key} cannot be found in schema '${selector.entityClass.name}'`)
                        } else {
                            if (!prop.definition.computeFunc) {
                                return prop.name
                            }
                        }
                    }
                    return null
                }).filter(notEmpty)

                if (removeNormalPropNames.length > 0) {
                    const shouldIncludes = selector.schema.fieldProperties.filter(p => !removeNormalPropNames.includes(p.name))
                    stmtOrPromise = thenResult(stmtOrPromise, s => s.clearSelect().select(...shouldIncludes))
                }

                //(the lifecycle) must separate into 2 steps ... register all computeProp first, then compile all
                let executedProps = Object.keys(select).map((key: string) => {
                    const item = select[key]
                    if (item === true) {
                        let prop = selector.schema.fieldProperties.find(p => p.name === key)
                        if (!prop) {
                            throw new Error(`The property ${key} cannot be found in datasource '${selector}'`)
                        }
                        if (prop.definition.computeFunc) {
                            return selector.$[prop.name]()
                        }
                    } else if (item instanceof SimpleObjectClass) {
                        let options = item as QueryOptions

                        let prop = selector.schema.fieldProperties.find(p => p.name === key && p.definition.computeFunc)

                        if (!prop) {
                            // if (options instanceof PropertyDefinition) {
                            //     selector.registerProp(new NamedProperty(key, options))
                            //     return selector.$$[key]()
                            // } else {
                            //     throw new Error('Temp Property must be propertyDefinition')
                            // }
                            throw new Error(`Cannot find Property ${key}`)
                        } else {
                            if (!prop.definition.computeFunc) {
                                throw new Error('Only COmputeProperty allows QueryOptions')
                            }
                            return selector.$$[key](options)
                        }
                    } else if (isScalar(item)){
                        let scalar = item as Scalar
                        return scalar.asColumn(key)
                    }
                    return null
                }).filter(notEmpty)
                allColumns.push(...executedProps)
            }
        } else if (querySelect && querySelect instanceof Array) {
            let select = querySelect

            let props = select.map(s => {
                if( isColumn(s)) {
                    return s  as Column
                } else if( typeof s === 'string'){
                    let prop = selector.schema.fieldProperties.find(p => p.name === s)
                    if (!prop) {
                        throw new Error(`The property ${s} cannot be found in schema '${selector.entityClass.name}'`)
                    }
                    if (prop.definition.computeFunc) {
                        return selector.$$[prop.name]()
                    } else {
                        return selector._[prop.name]
                    }
                }
                throw new Error('Unexpected type')
            })

            allColumns.push(...props)
        }

        // !important: must use a constant to reference the object before it is re-assigned
        const prevStmt = stmtOrPromise
        let stmtOrPromiseNext = thenResultArray(allColumns, columns => {
            return columns.reduce((stmt, column) => {
                return thenResult(stmt, stmt => stmt.select(column))
            }, prevStmt)
        })

        return thenResult(stmtOrPromiseNext, stmt => stmt.toRow())
    }
}


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

