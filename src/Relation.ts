import { compute, ComputeFunction, ComputeProperty, configure, Entity, ExecutionContext, field, FieldProperty, FieldPropertyDefinition, ormConfig, Schema, SelectorMap } from "."
import { Column, Dataset, Datasource, makeBuilder, Scalar, Scalarable } from "./Builder"
import { ConditionOperator, ValueOperator } from "./Operator"
import { ArrayOfType, BooleanType, NumberType, ObjectOfType, PropertyTypeDefinition, StringType } from "./PropertyType"



export type SimpleSelectAndFilter<S extends Schema> = {
    props?: QueryProps<S>
    filter?: QueryFilter
}

export type FilterFunction<Root extends Schema> = (ctx: ExecutionContext, root: Datasource<Root>) => {
    props?: QueryProps<Root>
    filter?: QueryFilter
}

export type RelationFilterFunction<Root extends Schema, Related extends Schema> = (ctx: ExecutionContext, root: Datasource<Root>, related: Datasource<Related>) => {
    props?: QueryProps<Root>
    filter?: QueryFilter
}

export type QueryProps<E extends Schema > = Partial<{
    [key in keyof Omit<E, keyof Schema> & string]:
            (
                E[key] extends ComputeProperty<infer D, infer Root, infer Arg, infer R>? 
                (
                    Arg[0]       
                ): 
                    E[key] extends FieldProperty<infer D>? 
                    Scalar<D> | boolean:
                    never
            )
}>

// const getModelBySchema = <T extends Schema>(ctx: ExecutionContext, schema: string): T => {
//     return ctx.models[schema].schema as T
// }

// function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, relatedRootKey?: string) {
    
//     let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"]>, args: SimpleSelectAndFilter< TypeClass["schema"]> | RelationFilterFunction<RootClass["schema"], TypeClass["schema"]>): Scalarable => {
//         let dataset = makeBuilder()

//         let relatedSource = getModelBySchema<TypeClass["schema"]>(context, schema).datasource(context)
        
//         if(args instanceof Function){
//             let c = args(context, root, relatedSource)
//             dataset.select( c.props )
//         } else {
//             dataset.select( args )
//         }

//         let relatedRootColumn = relatedSource.getFieldProperty(relatedRootKey?? ormConfig.primaryKeyName)

//         let fromClause = relatedSource.innerJoin(root, relatedRootColumn.equals(root.getFieldProperty(relatedBy) ) )
       
//         return dataset.from(fromClause)
//     }

//     return compute( new ObjectOfEntity<InstanceType<TypeClass>>(schema), computeFn )
// }

// function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, rootKey?: string){
    
//     let computeFn = (context: ExecutionContext, root: Datasource<TypeClass["schema"]>, args: SimpleSelectAndFilter< TypeClass["schema"] >): Scalarable => {
        
//         // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
//         //     return {
//         //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
//         //     }
//         // }).apply(args).toScalar(ArrayOf(schema))
//         throw new Error()
//     }

//     return compute( new ArrayOfType< ObjectOfEntity<InstanceType<TypeClass>> >( new ObjectOfEntity(schema) ), computeFn )
// }

function all<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass) {
    
    let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"]>, args?: SimpleSelectAndFilter< TypeClass["schema"]> | RelationFilterFunction<RootClass["schema"], TypeClass["schema"]>): Scalarable => {
        let dataset = makeBuilder()

        let rootSource = rootEntity.schema.datasource(context)
        
        if(args instanceof Function){
            let c = args(context, rootSource)
            dataset.select( c.props )
        } else {
            dataset.select( args )
        }

        let fromClause = rootSource
       
        return dataset.from(fromClause)
    }

    return compute( new ArrayOfType( new ObjectOfType(rootEntity) ), computeFn )
}

function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty, rootKey?: FieldProperty) {
    
    let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"]>, args?: SimpleSelectAndFilter< TypeClass["schema"]> | RelationFilterFunction<RootClass["schema"], TypeClass["schema"]>): Scalarable => {
        let dataset = makeBuilder()

        let relatedSource = relatedEntity.schema.datasource(context)
        
        if(args instanceof Function){
            let c = args(context, root, relatedSource)
            dataset.select( c.props )
        } else {
            dataset.select( args )
        }

        let relatedRootColumn = (rootKey? root.getFieldProperty(rootKey.name): undefined ) ?? root.getFieldProperty(ormConfig.primaryKeyName)

        let fromClause = relatedSource.innerJoin(root, relatedRootColumn.equals( relatedSource.getFieldProperty(relatedBy.name) ) )
       
        return dataset.from(fromClause)
    }

    return compute( new ObjectOfType(relatedEntity), computeFn )
}

function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty, rootKey?: FieldProperty) {
    
    let computeFn = (context: ExecutionContext, root: Datasource<TypeClass["schema"]>, args?: SimpleSelectAndFilter< TypeClass["schema"] >): Scalarable => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
        throw new Error()
    }

    return compute( new ArrayOfType( new ObjectOfType(relatedEntity) ), computeFn )
}



export type QueryFilterResolver = (value: QueryFilter) => Promise<Scalar> | Scalar
// export type ExpressionSelectorFunction = (...selectors: Selector[]) => Scalar
export type QueryEntityPropertyValue = null|number|string|boolean|Date|ValueOperator
export type QueryEntityPropertyKeyValues = {[key:string]: QueryEntityPropertyValue | QueryEntityPropertyValue[]}
export type Expression = ConditionOperator | Scalar | Promise<Scalar> | QueryEntityPropertyKeyValues | Array<Expression> | boolean


export type QueryFilter = Expression

export type QueryOrderBy = ( (string|Column) | {column: (string|Column), order: 'asc' | 'desc'} )[]

export type QueryArguments = {[key:string]: any}

export type QueryObject<S extends Schema> = {
    props?: QueryProps<S>,
    filter?: QueryFilter,
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type ObjectValue<T extends typeof Entity > = {
    [key in keyof T["schema"]]: 
        T["schema"][key] extends ComputeProperty<infer D>? ReturnType<D["parseRaw"]>:
        T["schema"][key] extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>:
        never;
} & InstanceType<T>


class ProductSchema extends Schema {
    name = field(StringType)
    shopId = field(NumberType)
    // shop = belongsTo<typeof Product, typeof Shop>('Shop', 'shopId')
    shop = belongsTo(Product, Shop, Product.schema.shopId)
    myABC = compute(StringType, (ctx: ExecutionContext, root: any, args: number): Scalarable => {
        throw new Error()
    })
}

class Product extends Entity{
    static schema = new ProductSchema()
    myName: number  = 5
}

class ShopSchema extends Schema {
    name = field(StringType)
    // products = hasMany<typeof Shop, typeof Product>('Product', 'shopId')
    products = hasMany(Shop, Product, Product.schema.shopId)
}

class Shop extends Entity {
    static schema = new ShopSchema()
}




// type Simple<Name extends string, T> = {[key in keyof Name & string as Name]: T }
// let xb: Simple<'a', Scalar<any> > // = { 'a': 5}
// let xc: Simple<'b', Scalar<any>> //= { 'b': 3}

// let xa = {
//     ...xb!,
//     ...xc!
// }

// export type C<N extends string, T> =  { [key in keyof N & string as N]: Scalar<T> }

// let zb: C<'a', any> // = { 'a': 5}
// let zc: C<'b', any> //= { 'b': 3}

// let xz = {
//     ...zb!,
//     ...zc!
// }


// let x: SelectorMap<ProductSchema>
// let cx = x!.shopId
// let temp: Scalar<BooleanType>
// let ccc = {
//     ...x!.name,
//     ...x!.myABC(5)
//     // temp: temp!
// }
// // let cccc = x!.shopId.shopId

// let aaa = makeBuilder().props(
//     ccc
// )

// aaa.execute().then(r => {
//     let result = r.myABC
//     result
// })




// let models = {
//     Product,
//     Shop
// }

// let f = function(x: {[key:string]: typeof Entity}){
    
// }


// models.Shop.createEach()

// let cc = x!.shop()

// type A = number
// let x: A
// let y: string

// function my<I>(a: I): I extends A? boolean: number {
//     throw new Error()
// }
// let c = my(x!)


const simpleQuery = <T extends Schema>(row: Dataset, selector: Datasource<T>, queryOptions: QueryObject<T>) => {
    let stmt = row.toQueryBuilder()

    let isWholeFilter = true

    if(queryOptions.limit){
        stmt = stmt.limit(queryOptions.limit)
        isWholeFilter = false
    }
    if(queryOptions.offset){
        stmt = stmt.offset(queryOptions.offset)
        isWholeFilter = false
    }
    if(queryOptions.orderBy){
        stmt = stmt.orderBy(queryOptions.orderBy)
        isWholeFilter = false
    }
    if(queryOptions.select){
        isWholeFilter = false
    }
    if(queryOptions.args){
        isWholeFilter = false
    }
    // if(queryOptions.fn){
    //     isWholeFilter = false
    // }

    let stmtOrPromise: Dataset | Promise<Dataset> = stmt
    if (queryOptions.select){
        stmtOrPromise = makeQuerySelectResolver(() => [selector])(queryOptions.select, row)
    }
    let filterOption: QueryFilter | null = null
    if(queryOptions.filter){
        filterOption = queryOptions.filter
        isWholeFilter = false
    }
    if(isWholeFilter){
        filterOption = queryOptions as QueryFilter
    }
    if(filterOption){
        const resolved = makeQueryFilterResolver(() => [selector])(filterOption)
        stmtOrPromise = thenResult(stmtOrPromise, stmt => thenResult(resolved, (r) => {
            stmt.toQueryBuilder().where(r).toRow()
            return stmt
        }))
    }

    if(!isWholeFilter){
        const expectedKeys = ['limit', 'offset', 'orderBy', 'select', 'filter']
        if(! Object.keys(queryOptions).every(key => expectedKeys.includes(key)) ) {
            throw new Error(`The query option must be with keys of [${expectedKeys.join(',')}]`)
        }
    }

    return stmtOrPromise
}



// export function makeQuerySelectResolver() {

//     return function querySelectResolver(selector: Datasource<any>, querySelect: QuerySelect, row: Dataset) {
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


// export function makeQueryFilterResolver( getSelectorFunc: () => Datasource[] ){

//     // console.log('aaaaaa', getSelectorFunc())
    
//     const resolveExpression: QueryFilterResolver = function(value: Expression) {
//         if (value === true || value === false) {
//             return makeScalar(makeRaw('?', [value]), Types.Boolean())
//         } else if(value instanceof ConditionOperator){
//             return value.toScalar(resolveExpression)
//         } else if(Array.isArray(value)){
//             return resolveExpression(Or(...value))
//         // } else if(value instanceof Function) {
//         //     const casted = value as ExpressionSelectorFunction
//         //     return casted(...(getSelectorFunc() ).map(s => s.interface!))
//         } else if(isScalar(value)){
//             return value as Scalar
//         } else if (isDataset(value)) {
//             throw new Error('Unsupport')
//         } else if(value instanceof SimpleObjectClass){
//             const firstSelector = getSelectorFunc()[0]
//             let dict = value as SimpleObject
//             let sqls = Object.keys(dict).reduce( (accSqls, key) => {
//                 let prop = firstSelector.getProperties().find((prop) => prop.name === key)
//                 if(!prop){
//                     throw new Error(`cannot found property '${key}'`)
//                 }

//                 let operator: ValueOperator
//                 if(dict[key] instanceof ValueOperator){
//                     operator = dict[key]
//                 }else if( Array.isArray(dict[key]) ){
//                     operator = Contain(...dict[key])
//                 } else if(dict[key] === null){
//                     operator = IsNull()
//                 } else {
//                     operator = Equal(dict[key])
//                 }

//                 if(!prop.definition.computeFunc){
//                     let converted = firstSelector.getNormalCompiled(key)
//                     accSqls.push( operator.toScalar(converted) )
//                 } else {
//                     let compiled = (firstSelector.getComputedCompiledPromise(key))()
//                     // if(compiled instanceof Promise){
//                     //     accSqls.push( compiled.then(col => operator.toRaw(col) ) )
//                     // } else {
//                     //     accSqls.push( operator.toRaw(compiled) )
//                     // }
//                     accSqls.push( thenResult(compiled, col => operator.toScalar(col)) )
//                 }

//                 return accSqls

//             }, [] as Array<Promise<Scalar> | Scalar> )
//             return resolveExpression(And(...sqls))
//         } else {
//             throw new Error('Unsupport Where clause')
//         }
//     }
//     return resolveExpression
// }