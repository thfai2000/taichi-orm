import types, {PropertyDefinition, StringType, StringTypeNotNull, ObjectOfType, BooleanType} from "./PropertyType"
import {Schema, Entity, FieldProperty} from "."
import { Column } from "./Builder"
import { Selector } from ".."

type UnionToIntersection<T> = 
  (T extends any ? (x: T) => any : never) extends 
  (x: infer R) => any ? R : never
  

class Scalar<ResultType> {
    constructor() {}
}

// type OmitMethod<T> =  Omit<T, (keyof Entity) | 'hooks'>

type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

type QueryBase = {
    props?: QueryProps<any>
    source?: Datasource<any>
    filter?: any   
}


type QueryX<S extends Schema> = {
    props?: QueryProps<S>
    filter?: any
}

type QueryY<Joins extends Datasource<any, any>[] = Datasource<any, any>[] > = (ctx: Context, ...source: Joins) => {
    props?: QueryProps<any>
    filter?: any 
}

type QueryProps<T extends Schema > = Partial<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyDefinition? Scalar<PropertyDefinition>:
        never;
}>

type ObjectValue<T extends typeof Entity > = {
    [key in keyof T["schema"]]: 
        T["schema"][key] extends ComputeFunction? (ReturnType<T["schema"][key]> extends Scalar<infer S> ? S: unknown):
        T["schema"][key] extends PropertyDefinition? ReturnType<T["schema"][key]["parseRaw"]>:
        never;
} & InstanceType<T>

class PropertyType<T>{

}

// abstract class Entity{


//     static schema: Schema

//     static dataset<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Dataset<I> {
//         throw new Error()
//     }

//     static datasource<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Datasource<I> {
//         throw new Error()
//     }

//     static find<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), 
//         options: QueryX< I["schema"] > ): 
//         ObjectValue< I > { 
//         throw new Error()
//     }

// }


class Context {
    // schemas: {[key:string]: Entity}
}

// interface Datasource<T1 extends Schema, Previous extends Datasource<any, any> = Datasource<any, any> > {
//     // hello: Scalar<any>
//     previous(): Previous

//     innerJoin<Left extends Datasource<any>, T2 extends Datasource<any>>(this: Left ,source: T2, condition: Scalar<BooleanType>): Datasource<T2, Left> 
//     // leftJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource[]
//     // rightJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource[]
// }


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


function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, relatedRootKey?: string){
    
    return (root: Datasource<RootClass["schema"]>, args: QueryX< TypeClass["schema"]> | QueryY<[Datasource<RootClass>, Datasource<TypeClass["schema"]>]> , context: Context): Scalar<ObjectValue< TypeClass >> => {

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

function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, rootKey?: string){
    
    return (root: Datasource<TypeClass["schema"]>, args: QueryX< TypeClass["schema"] >, context: Context): Scalar<ObjectValue< TypeClass >> => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
        throw new Error()
    }
}

class ProductSchema extends Schema {
    name = types.String({})
    shopId = types.Number()
    shop = belongsTo<typeof Product, typeof Shop>('Shop', 'shopId')
    myABC = (root: any, args: number): Scalar<string> => {
        throw new Error()
    }
}

class Product extends Entity{
    static schema = new ProductSchema()

    myName: number  = 5

}

class ShopSchema extends Schema {
    name = types.String({})
    products = hasMany<typeof Shop, typeof Product>('Product', 'shopId')
}

class Shop extends Entity {
    static schema = new ShopSchema()
    // newRecord(): {} {
    //     throw new Error("Method not implemented.")
    // }
}

let bbb = Product.find({
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


// let xaa : QueryProps<ProductSchema> = {
//     props
// }

// bbb.shop.products

// type SelectorMap<E extends typeof Entity> = { 
//     [key in keyof Omit<E["schema"], keyof Schema> & string as `$${key}`]:
//     E["schema"][key] extends ComputeFunction? 
//         (ReturnType<E["schema"][key]> extends Promise<infer S> ? 
//             (S extends Scalar<infer D>? Column<D>: unknown): 
//             (ReturnType<E["schema"][key]> extends Scalar<infer D>? Column<D>: unknown) ):
//     E["schema"][key] extends PropertyDefinition? Column<E["schema"][key]>:
//     never;
// }



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
        apple: new Scalar<BooleanType>(),
        shop: s.
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



// class ABC {
//     static a: boolean
// }

// type C<T extends typeof ABC> = {
//     [key in keyof T]: T[key] extends boolean? number: never
// }

// let ccc: C<typeof ABC>

// console.log(ccc!.a)
