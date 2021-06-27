type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

class Scalar {
    constructor(private var1: any ) {}
}

type OmitMethod<T> =  Omit<T, 'find' | 'execute' | 'dataset'>

type RemoveQueryProps<T> = T

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
    shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<ShopSchema> > = (s: any, args: QueryOption<ShopSchema>) => {
        throw new Error('')
    }
    myABC: ComputeFunction<number, boolean > = (s: any, args) => {
        throw new Error('')
    }
}

class ShopSchema extends Schema{
    name: PropertyType<string>
    products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<ProductSchema>[]> = (s: any, args: QueryOption<ProductSchema>) => {
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



let a :RemoveQueryProps<ProductSchema>

