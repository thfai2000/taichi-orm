import { compute, ComputeProperty, Entity, ExecutionContext, field, FieldProperty, TableSchema, Schema } from "."
import { Column, Dataset, Datasource, FromClause, makeBuilder, PartialK, Scalar, Scalarable } from "./Builder"
import { And, AndOperator, ValueOperator } from "./Operator"
import { ArrayOfType, BooleanType, NumberType, ObjectOfType, PrimaryKeyType, StringType } from "./PropertyType"
import { ExtractProps, ExtractSynComputeProps, UnionToIntersection } from "./util"



export type SingleSourceQueryOptions<S extends TableSchema> = {
    props?: SelectableProps<S>,
    filter?: SingleSourceFilter<S>,
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type SingleSourceQueryFunction<S extends TableSchema, SName extends string> = (ctx: ExecutionContext, root: Datasource<S, SName>) => {
    props?: SelectableProps<S>,
    filter?: Expression<never>,
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type TwoSourcesFilterFunction<Root extends TableSchema, RootName extends string, Related extends TableSchema, RelatedName extends string> =
    (ctx: ExecutionContext, root: Datasource<Root, RootName>, related: Datasource<Related, RelatedName>) => {

    props?: SelectableProps<Root>
    filter?: Expression<never>
}



// export type SelectableComputeProps<E > = Partial<{
//     [key in ( (keyof ExtractComputeProps<E>) & string)  as `$${key}`]:
//         E[key] extends ComputeProperty<infer D, infer Root, infer Arg, infer R>? 
//                 (
//                     Arg[0]       
//                 ): 
//                     // E[key] extends FieldProperty<infer D>? 
//                     // Scalar<D> | boolean:
//                     never
            
// }>

// export type SelectableProps<E > = 
//     (SelectableComputeProps<E> | (string & keyof E) | Column<(string & keyof E), any extends ComputeProperty<infer D>? D: never> )[]



// export type ExpressionSelectorFunction = (...selectors: Selector[]) => Scalar
export type QueryEntityPropertyValue = null|number|string|boolean|Date|ValueOperator
// export type FilterEntityPropertyKeyValues<S> = 
// {
//     [key in keyof ExtractProps<S> & string]: QueryEntityPropertyValue | QueryEntityPropertyValue[]
// }

export type SingleSourceFilter<S extends TableSchema = any> = Expression< FilterEntityPropertyKeyValues<S> >

export type TwoSourcesFilter<S0 extends TableSchema, S1 extends TableSchema> =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<S0> | AddPrefix< FilterEntityPropertyKeyValues<S0>, 'root'>  | AddPrefix< FilterEntityPropertyKeyValues<S1>, 'related'> >>

export type ThreeSourcesFilter<S0 extends TableSchema, S1 extends TableSchema, S2 extends TableSchema> =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<S0> | AddPrefix< FilterEntityPropertyKeyValues<S0>, 'root'>  | AddPrefix< FilterEntityPropertyKeyValues<S1>, 'related'> | AddPrefix< FilterEntityPropertyKeyValues<S2>, 'through'> >>



export type QueryOrderBy = ( (string| Column<any, any> ) | {column: (string|Column<any, any>), order: 'asc' | 'desc'} )[]
// export type QueryFilterResolver = (value: SingleSourceFilter) => Promise<Scalar> | Scalar


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
    
    let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"], 'root'>, 
        args?: SingleSourceQueryOptions< TypeClass["schema"]> | SingleSourceQueryFunction< TypeClass["schema"], 'root'> ): Scalarable => {
        let dataset = makeBuilder()

        let rootSource = rootEntity.schema.datasource('root', context)
        
        if(args instanceof Function){
            let c = args(context, rootSource)
            return simpleQuery(dataset, rootSource, c)
        } else {
            return simpleQuery(dataset, rootSource, args)
        }
    }

    return compute( new ArrayOfType( new ObjectOfType(rootEntity) ), computeFn )
}

function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty, rootKey?: FieldProperty) {
    
    let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"], 'root'>, 
        args?: SingleSourceQueryOptions< TypeClass["schema"]> | TwoSourcesFilterFunction<RootClass["schema"], 'root', TypeClass["schema"], 'related'>): Scalarable => {

        let dataset = makeBuilder()

        let relatedSource = relatedEntity.schema.datasource('related', context)
        
        if(args instanceof Function){
            let c = args(context, root, relatedSource)
            dataset.props( c.props )
        } else {
            dataset.props( args )
        }

        let relatedRootColumn = (rootKey? root.getFieldProperty(rootKey.name): undefined ) ?? root.$.id


        let fromClause = relatedSource.innerJoin(root, relatedRootColumn.equals( relatedSource.getFieldProperty(relatedBy.name) ) )
       
        return dataset.from(fromClause)
    }

    return compute( new ObjectOfType(relatedEntity), computeFn )
}

function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty, rootKey?: FieldProperty) {
    
    let computeFn = (context: ExecutionContext, root: Datasource<TypeClass["schema"], 'root'>, args?: SingleSourceQueryOptions< TypeClass["schema"] >): Scalarable => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
        throw new Error()
    }

    return compute( new ArrayOfType( new ObjectOfType(relatedEntity) ), computeFn )
}


// export type QueryObject<S extends Schema> = {
//     props?: QueryProps<S>,
//     filter?: QueryFilter<S>,
//     limit?: number,
//     offset?: number,
//     orderBy?: QueryOrderBy
// }

// export type ObjectValue<T extends typeof Entity > = {
//     [key in keyof T["schema"]]: 
//         T["schema"][key] extends ComputeProperty<infer D>? ReturnType<D["parseRaw"]>:
//         T["schema"][key] extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>:
//         never;
// } & InstanceType<T>


class ProductSchema extends TableSchema {

    id = field(PrimaryKeyType)
    // uuid = field(StringType)
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

class ShopSchema extends TableSchema {
    id= field(PrimaryKeyType)
    name = field(StringType)
    hour= field(NumberType)
    // products = hasMany<typeof Shop, typeof Product>('Product', 'shopId')
    products = hasMany(Shop, Product, Product.schema.shopId)
}

class Shop extends Entity {
    static schema = new ShopSchema()
}


// type A = UnionToIntersection<{
//     [key: string]: boolean
// } | {
//     a: number
//     b: number
// }>

// let zzz: A = {
//     a: 333,
//     eeeee: true,
//     ccc: true
// }
type B = {a: number, b: string}
type A = PartialK<{[key in keyof B ]: boolean}, keyof B>

let aaa = {
    a: true,
    c: 5
}

type C = typeof aaa extends A? boolean: number


let s = Shop.datasource('shop', null)

let p = Product.datasource('product', null)



// type A = ExtractSynComputeProps<ProductSchema>

let xxx: Scalar<BooleanType>

let dd = makeBuilder()
        .from(s)
        .innerJoin(p, ({product}) => product.id.equals(5) )
        .innerJoin(p, ({And}) => And({"product.id": 5}) )
        .innerJoin( 
            makeBuilder().from(s).fields("shop.id", "shop.name").datasource("myShop", null),
            ({myShop, product, shop, And}) => And( myShop.id.equals(product.id), product.myABC(5) )
        )
        .filter( 
            ({And, product, shop}) => And({
                "shop.id": 5,
                "shop.name": "ssss"
            }, product.name.equals(shop.name) )
        )
        .fields(
            "product.id",
            "shop.id",
            "myShop.name",
            "shop.id"
        )
        .props(
            ({shop}) => ({
                "product": xxx!,
                "aa": xxx!,
                ...shop.products().value()
            })
        )

// let f = s.asFromClause().innerJoin(p, s.$.id.equals(p.$.shopId) )

// console.log(f)


// let x : Expression< AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, 'product' >, {} > = {

// }

// console.log(x)

// let y :  AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, 'product' > 

// let f = s.asFromClause()

//  a: { o: 5, p:6},
//     b: {i: 1, j: 2}

// type AA = typeof c
// type BB = {
//     [key in keyof AA[ key2 in keyof AA] ]: number
// }

// type A =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<ShopSchema> | AddPrefix< FilterEntityPropertyKeyValues<ShopSchema>, '0'>  | AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, '1'> >>

// let aaa: A = {
//     "1.shopId": 5
// }

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


const simpleQuery = <T extends TableSchema>(row: Dataset, selector: Datasource<T>, queryOptions: QueryObject<T>) => {
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
    let filterOption: SingleSourceFilter | null = null
    if(queryOptions.filter){
        filterOption = queryOptions.filter
        isWholeFilter = false
    }
    if(isWholeFilter){
        filterOption = queryOptions as SingleSourceFilter
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



// export type EntityFilterResolver = (filter: SingleSourceFilter | null, ...sources: Datasource<any, any>[]) => RawFilter


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