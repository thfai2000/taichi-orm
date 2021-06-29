import types, {PropertyDefinition} from "./PropertyType"

class Scalar<ResultType> {
    constructor() {}
}

type OmitMethod<T> =  Omit<T, keyof Schema | 'hooks'>

type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

type QueryXObject<S extends Schema> = {
    props?: QueryProps<S>
    source?: Datasource
    filter?: any
}

type QueryX<S extends Schema> = QueryXObject<S> | ((ctx: Context, ...source: Datasource[]) => QueryXObject<S>)

type QueryProps<T extends Schema> = Partial<OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyDefinition? Scalar<PropertyDefinition>:
        never;
}>>

type ObjectValue<T extends Schema> = OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (ReturnType<T[key]> extends Scalar<infer S> ? S: unknown):
        T[key] extends PropertyDefinition? ReturnType<T[key]["parseRaw"]>:
        never;
}>

class PropertyType<T>{

}


abstract class Schema {

    static find<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I), options: QueryX<I> ): ObjectValue<I>{
        throw new Error()
    }

    static entityClass<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I) ){

        // const s = this

        // let entityClass = class extends Entity{
        //     constructor(){
        //         super()
        //         //TODO copy attributes  
        //     }
        // }
        //TODO
        return entityClass
    }

    static dataset<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I) ): Dataset<I> {
        throw new Error()
    }
}

class Context {
    // schemas: {[key:string]: Entity}
}

interface Datasource {
    _: {}
    $: {}
    $$: {}

    innerJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource
    leftJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource
    rightJoin(source: Datasource, leftColumn: Column, operator: string, rightColumn: Column): Datasource
}


class Dataset<T extends Schema> {


    apply(args: QueryX<T>) {
        // throw new Error("Method not implemented.")
        return this
    }

    toScalar(): ObjectValue<T>{
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


function belongsTo<TypeClass extends typeof Schema>(schema: TypeClass, relatedBy: string, relatedRootKey?: string){
    
    return (root: Datasource, args: QueryX< InstanceType<TypeClass> >, context: Context): Scalar<ObjectValue< InstanceType<TypeClass> >> => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (relatedRootKey? source._[relatedRootKey]: source.pk ).equals(root._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ObjectOf(schema))
    }
}

function hasMany<TypeClass extends typeof Schema>(schema: TypeClass, relatedBy: string, rootKey?: string){
    
    return (root: Datasource, args: QueryX< InstanceType<TypeClass> >, context: Context): Scalar<ObjectValue< InstanceType<TypeClass> >> => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
    }
}

class Product extends Schema{
   
    name = types.String({})
    shop = belongsTo(Shop, 'shopId')
    myABC(root: any, args: number): Scalar<string> {
            throw new Error()
    }

}

class Shop extends Schema{
    name = types.String({})
    products = hasMany(Product, 'shopId')
    
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

bbb.shop.products



class B extends Shop{
    aaa = types.String({})
    products = hasMany(AA, '','')
}
class AA extends Product{
    kkk = types.StringNotNull({})
    shop = belongsTo(B, '', '')

}

let a = AA.find({
    props: {
        kkk: 'ee',
        shop: {
            props: {
                aaa: 'xx',
                products: {
                    props: {
                        name: ''
                    }
                }
            }
        }
    }
})

a.shop.products
a.shop.aaa


// type A = {nullable: true}

// let c = <T>(a: T) : T extends A ? boolean: (string |null) => {
//     return a.nullable
// }
// let x = c({nullable:true})