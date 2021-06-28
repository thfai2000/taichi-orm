type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

class Scalar<ResultObject> {
    constructor(private var1: any ) {}
}

type OmitMethod<T> =  Omit<T, 'find' | 'execute' | 'dataset'>



type PropsFromQuery<S, T extends QueryOption<S>> = Pick<S, keyof T['props']>


// type A = Extract<{hello: number, x: number} | {test: number}, {hello: number, c: number}>

type Base = {hello: boolean}





type FilterFlags<Base, Condition> = {
    [Key in keyof Base]: 
        Base[Key] extends Condition ? Key : never
};
type AllowedNames<Base, Condition> = 
        FilterFlags<Base, Condition>[keyof Base];
type SubType<Base, Condition> = 
        Pick<Base, AllowedNames<Base, Condition>>;

// type A = {hello: any, test: any}
// type B = {hello: number, test: number, xxx: boolean}
// type C = {hello: boolean, test: boolean, abc: boolean}
// type Nothing<T> = T

// type D = Pick<C, AllowedNames<Nothing<B>, string | number>>;




type QueryProps<T> = Partial<OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? Parameters<T[key]>[1]: 
        T[key] extends PropertyType<infer R> ? R:
        never;
}> | {[key: string]: Scalar<any> }>


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
    removeProps?: string[]
}


class Schema {
    static find<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I), option: QueryOption<I>): ObjectValue<I>{
        throw new Error()
    }
}

class ProductSchema extends Schema{
    name: PropertyType<string>
    shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<ShopSchema> > = (s: any, args: QueryOption<ShopSchema>) => {
        throw new Error('')
    }
    // shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<PropsFromQuery<ShopSchema, QueryOption<ShopSchema>>> > = (s: any, args: QueryOption<ShopSchema>) => {
    //     throw new Error('')
    // }
    myABC: ComputeFunction<number, boolean > = (s: any, args) => {
        throw new Error('')
    }
}

class ShopSchema extends Schema{
    name: PropertyType<string>
    products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<ProductSchema>[]> = (s: any, args: QueryOption<ProductSchema>) => {
        throw new Error('')
    }
    // products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<PropsFromQuery<ProductSchema, QueryOption<ProductSchema>>>[]> = (s: any, args: QueryOption<ProductSchema>) => {
    //     throw new Error('')
    // }
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

// function find<T>(option: QueryOption<T>): ObjectValue<T>{
//     throw new Error()
// }

let result = ProductSchema.find(b)

type ReplaceCompute<T> = {
    [key in keyof T ]: 
        T[key] extends ComputeFunction?  ReturnType<T[key]> :
        T[key] extends PropertyType<infer R> ? R:
        T[key];
}

type Comp = <S, Z, R = Z extends infer C? Pick<Z & S, AllowedNames<C, string | number>> : never>(arg: Z, schema: S) => R;


let c: Comp
let z = c({s: 5, name: 33}, class extends Schema{
    name: PropertyType<string>
    my: PropertyType<string>
})


// All fields are not undefined
// All normal fields nullable = depends
// All computed fields are nullable



// let a :RemoveQueryProps<ProductSchema>

