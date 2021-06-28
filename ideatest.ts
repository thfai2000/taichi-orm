type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

class Scalar {
    constructor(private var1: any ) {}
}

type OmitMethod<T> =  Omit<T, 'find' | 'execute' | 'dataset'>

type RemoveQueryProps<T> = T


// type ReplaceCompute<T, S> = {
//     [key in keyof (T & S) ]: 
//         T[key] extends ComputeFunction? :
//         T[key] extends PropertyType<infer R> ? R:
//         T[key];
// }

type PropsFromQuery<S, T extends QueryOption<S>> = Pick<S, keyof T['props']>


// type A = Extract<{hello: number, x: number} | {test: number}, {hello: number, c: number}>




type FilterFlags<Base, Condition> = {
    [Key in keyof Base]: 
        Base[Key] extends Condition ? Key : never
};
type AllowedNames<Base, Condition> = 
        FilterFlags<Base, Condition>[keyof Base];
type SubType<Base, Condition> = 
        Pick<Base, AllowedNames<Base, Condition>>;

type A = {hello: any, test: any}
type B = {hello: number, test: number}
type C = {hello: boolean, test: boolean}

type D = Pick<C, AllowedNames<B, string | number>>;



type QueryProps<T> = Partial<RemoveQueryProps<OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? Parameters<T[key]>[1]: 
        T[key] extends PropertyType<infer R> ? R:
        never;
}>> | {[key: string]: Scalar }>


type ObjectValue<T> = OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? ReturnType<T[key]>:
        T[key] extends PropertyType<infer R> ? R:
        T[key];
}>

class PropertyType<T>{

}

type QueryOption<T> = {
    props?: QueryProps<T>
}


class Schema {
    static find<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I), option: QueryOption<I>): ObjectValue<I>{
        throw new Error()
    }
}

class ProductSchema extends Schema{
    name: PropertyType<string>
    // shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<ShopSchema> > = (s: any, args: QueryOption<ShopSchema>) => {
    //     throw new Error('')
    // }
    shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<PropsFromQuery<ShopSchema, QueryOption<ShopSchema>>> > = (s: any, args: QueryOption<ShopSchema>) => {
        throw new Error('')
    }
    myABC: ComputeFunction<number, boolean > = (s: any, args) => {
        throw new Error('')
    }
}

class ShopSchema extends Schema{
    name: PropertyType<string>
    // products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<ProductSchema>[]> = (s: any, args: QueryOption<ProductSchema>) => {
    //     throw new Error('')
    // }
    products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<PropsFromQuery<ProductSchema, QueryOption<ProductSchema>>>[]> = (s: any, args: QueryOption<ProductSchema>) => {
        throw new Error('')
    }
}

let b : QueryOption<ProductSchema> = {
    props: {
        myABC: 5,
        shop: {
            props: {
                products: {

                }
            }
        }
    }
}

function find<T>(option: QueryOption<T>): ObjectValue<T>{
    throw new Error()
}

let result = ProductSchema.find(b)


// let a :RemoveQueryProps<ProductSchema>

