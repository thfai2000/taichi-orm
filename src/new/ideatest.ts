import types, {PropertyDefinition, StringType, StringTypeNotNull, ObjectOfType, BooleanType} from "./PropertyType"


type UnionToIntersection<T> = 
  (T extends any ? (x: T) => any : never) extends 
  (x: infer R) => any ? R : never
  

class Scalar<ResultType> {
    constructor() {}
}

type OmitMethod<T> =  Omit<T, (keyof Entity) | 'hooks'>

type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

type QueryBase = {
    props?: QueryProps<any>
    source?: Datasource<any>
    filter?: any   
}


type QueryX<S extends Entity> = {
    props?: QueryProps<S>
    filter?: any
}

type QueryY<Joins extends Datasource<any, any>[] = Datasource<any, any>[] > = (ctx: Context, ...source: Joins) => {
    props?: QueryProps<any>
    filter?: any 
}

type QueryProps<E extends Entity, T = OmitMethod<E> > = Partial<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyDefinition? Scalar<PropertyDefinition>:
        never;
}>

type ObjectValue<E extends Entity, T = OmitMethod<E> > = {
    [key in keyof T]: 
        T[key] extends ComputeFunction? (ReturnType<T[key]> extends Scalar<infer S> ? S: unknown):
        T[key] extends PropertyDefinition? ReturnType<T[key]["parseRaw"]>:
        never;
} & ReturnType<E["newRecord"]>

class PropertyType<T>{

}

abstract class Entity<R = {}>{

    // static dataset<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Dataset<I> {
    //     throw new Error()
    // }

    // static datasource<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Datasource<I> {
    //     throw new Error()
    // }

    // static find<I extends Entity>(this: (new (...args: any[]) => I), options: QueryX<I> ): ObjectValue<I>{ 
    //     throw new Error()
    // }


    dataset<I extends Entity>(this: I): Dataset<I> {
        throw new Error()
    }

    datasource<I extends Entity>(this: I ): Datasource<I> {
        throw new Error()
    }

    find<I extends Entity>(this: I, options: QueryX<I> ): ObjectValue<I>{ 
        throw new Error()
    }

    abstract newRecord(...args: any[]): R




    // static entityClass<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ){

    //     // const s = this

    //     // let entityClass = class extends Entity{
    //     //     constructor(){
    //     //         super()
    //     //         //TODO copy attributes  
    //     //     }
    //     // }
    //     //TODO
    //     // return entityClass
    //     throw new Error()
    // }
}


class Context {
    // schemas: {[key:string]: Entity}
}

interface Datasource<T1 extends Entity, Previous extends Datasource<any, any> = Datasource<any, any> > {
    // hello: Scalar<any>
    previous(): Previous

    innerJoin<Left extends Datasource<any>, T2 extends Datasource<any>>(this: Left ,source: T2, condition: Scalar<BooleanType>): Datasource<T2, Left> 
    // leftJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource[]
    // rightJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource[]
}


class Dataset<T extends Entity, Joins extends Datasource<any, any>[] = Datasource<any, any>[] > {

    sources: Joins
    ctx: any

    constructor(ctx: any, ...joins: Joins){
        this.ctx = ctx
        this.sources = joins
    }

    apply(args: QueryBase){
        // throw new Error("Method not implemented.")
        // if(args instanceof Function){
        //     const query = args(this.ctx, ...this.sources)
        //     return this.apply(query)

        // }else {
        //     if(args.source){
        //         let source = args.source.previous()
        //         let sources = [...this.sources, source]
        //         return new Dataset(this.ctx, ...sources)
        //     }else {
        //         return new Dataset(this.ctx, ...this.sources)
        //     }
        // }
        return this
    }

    toScalar(p: PropertyDefinition): ObjectValue<T>{
        throw new Error()
    }

    // __type: 'Dataset'
    // // __mainSelector?: Selector | null
    // __expressionResolver: QueryFilterResolver
    // __selectItems: SelectItem[]
    // __fromSource: Source
    // __realSelect: Function
    // __realClearSelect: Function
    // __realClone: Function
    // __realFrom: Function
    // getInvolvedSource(): Source[]
    // getSelectedColumnNames(): string[]
    // toQueryBuilder(): Knex.QueryBuilder
    // toDataset(): Dataset
    // clone(): Dataset
    // clearSelect(): Dataset
    // select(...cols: Column[]): Dataset
    // filter(queryWhere: QueryFilter): Dataset
    // from(source: Source): Dataset
    // orderBy()
    // limit()
    // offset()
    // toScalar(type: PropertyType)        // execute the resolver -> querybuilder -> transformed by PropertyType
    // toNative()                          // execute the resolver -> querybuilder (translate props into columns...put into select... )
    // apply(option: QueryOption)          // it accept both function/object ...merge into different attributes

    // _props: {}
    // _excludeProps: []
    // _filter
    // _from
    // _orderBy
    // _limit


}


function belongsTo<RootClass extends Entity, TypeClass extends Entity>(schema: string, relatedBy: string, relatedRootKey?: string){
    
    return (root: Datasource<RootClass>, args: QueryX< TypeClass> | QueryY<[Datasource<RootClass>, Datasource<TypeClass>]> , context: Context): Scalar<ObjectValue< TypeClass >> => {

        let relatedSource = context.models[schema].datasource()
        let c = {}
        if(args instanceof Function){
            c = args(context, root,relatedSource )
        } else {
            c = args
        }
        let r = { source: relatedSource.innerJoin(root, (relatedRootKey? relatedSource._[relatedRootKey]: relatedSource.pk ).equals(root._[relatedBy]) ) }
       
        return schema.dataset().apply( Object.assign({}, c, r) ).toScalar(new ObjectOfType(schema))
        throw new Error()
    }
}

function hasMany<RootClass extends Entity, TypeClass extends Entity>(schema: string, relatedBy: string, rootKey?: string){
    
    return (root: Datasource<TypeClass>, args: QueryX< TypeClass >, context: Context): Scalar<ObjectValue< TypeClass >> => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
        throw new Error()
    }
}

class Product extends Entity<ProductRecord>{
    name = types.String({})
    shop = belongsTo<Product, Shop>('Shop', 'shopId')
    myABC(root: any, args: number): Scalar<string> {
            throw new Error()
    }
    newRecord(): ProductRecord {
        return new ProductRecord()
    }
}

class ProductRecord {
    myName: string = ''
}


class Shop extends Entity {
    newRecord(): {} {
        throw new Error("Method not implemented.")
    }
    name = types.String({})
    products = hasMany<Shop, Product>('Product', 'shopId')
}

let bbb = (new Product).find({
    props: {
        shop: {
            props: {
                products: {
                    props: {
                        name: ''
                    }
                }
            }
        }
    }
}) 

bbb.shop.products.myName



function find<T extends {
        [key: string]: Scalar<any>
    }>(options: {
    props: T
    source?: Datasource<any>
    filter?: any
}): {
    [key in keyof T]: T[key] extends Scalar<infer D>? (D extends PropertyDefinition ? ReturnType< D["parseRaw"]>: never):
            never;
}{
    throw new Error()
}

let p = Product.datasource()
let s = Shop.datasource()

let apple = find({
    props: {
        apple: new Scalar<BooleanType>()
    }
})

apple.apple


// let add = find<{a: StringTypeNotNull, s: StringTypeNotNull}>({
//     props: {
//         a: p._.id,
//         s: s._.id
//     },
//     source: p.join(s),
//     filter: {}
// })

// a.shop.products
// a.shop.aaa

// let ccc = find<
//     {a: StringTypeNotNull, s: StringTypeNotNull},  
//     // {x: StringTypeNotNull, y: StringTypeNotNull},
//     // {c: StringTypeNotNull, d: StringTypeNotNull}

// >( (ctx, d0, d1) => ({
//     props: {
//         a: d0.hello,
//         s: d1._.id
//     },
//     source: p,
//     filter: {}
// }))

// let aa :QueryXObject<{a: StringType }> = {
//     props: {

//     }
// }



type A = UnionToIntersection<{x: number} | {t: boolean} >



class ABC {
    static a: boolean
}

type C<T extends typeof ABC> = {
    [key in keyof T]: T[key] extends boolean? number: never
}

let ccc: C<typeof ABC>

console.log(ccc!.a)
