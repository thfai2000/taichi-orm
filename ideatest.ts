type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R

class Scalar<ResultObject> {
    constructor(private var1: any ) {}
}

type OmitMethod<T> =  Omit<T, keyof Schema>

// type ReplaceCompute<T> = {
//     [key in keyof T ]: 
//         T[key] extends ComputeFunction?  ReturnType<T[key]> :
//         T[key] extends PropertyType<infer R> ? R:
//         T[key];
// }

//type Comp = <S, Z, R = Z extends infer C? Pick<Z & S, AllowedNames<C, string | number>> : never>(arg: Z, schema: S) => R;



// type PropsFromQuery<S, T extends QueryOption<S>> = Pick<S, keyof T['props']>


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
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyType<infer R> ? R:
        never;
}>>


type ObjectValue<T> = OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (ReturnType<T[key]> extends Scalar<infer S> ? S: never):
        T[key] extends PropertyType<infer R> ? R:
        T[key];
}>

class PropertyType<T>{

}

// type QueryOption<T extends Schema> = {
//     props?: QueryProps<T>
// }

class Entity {

}

class Schema {
    static find<I extends Schema, X extends Schema>(this: typeof Schema & (new (...args: any[]) => I), options: QueryX<X> ): ObjectValue<X>{
        throw new Error()
    }

    static entityClass<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I) ){

        const s = this

        let entityClass = class extends Entity{
            constructor(){
                super()
                //TODO copy attributes  
            }
        }
        //TODO
        return entityClass
    }
}

class ProductSchema extends Schema{
    name: PropertyType<string>
    // shop: ComputeFunction<QueryOption<ShopSchema>, ObjectValue<ShopSchema> > = (s: any, args: QueryOption<ShopSchema>) => {
    //     throw new Error('')
    // }
    // myABC: ComputeFunction<number, boolean > = (s: any, args) => {
    //     throw new Error('')
    // }
    shop<I extends ShopSchema>(root: any, args: QueryX<I>): Scalar<ObjectValue<I>>{
        throw new Error()

    }
    myABC(root: any, args: number): Scalar<string> {
         throw new Error()
    }
}

class Dual extends Schema {
    [key:string]: any
}

class ShopSchema extends Schema{
    name: PropertyType<string>
    // products: ComputeFunction<QueryOption<ProductSchema>, ObjectValue<ProductSchema>[]>
    //  = (s: any, args: QueryOption<ProductSchema>) => {
    //     throw new Error('')
    // }
    products<I extends ShopSchema>(root: any, args: QueryX<ProductSchema> ): Scalar<ObjectValue<I>> {
         throw new Error()
    }
}

let b : QueryX<ProductSchema> = {
    props: {
        name: 'eee',
        myABC: 5,
        shop: {
            props: {
                products: {
                    props: {
                        name: 'ee',
                        // kite: 5
                    },
                    schema: class extends ProductSchema {
                        kite: PropertyType<string>
                    }
                }
            }
        }
    }
}

// function find<T>(option: QueryOption<T>): ObjectValue<T>{
//     throw new Error()
// }

let result = ProductSchema.find(b)


interface QueryX<S extends Schema>{
    props: QueryProps<S>, 
    schema?: typeof Schema & (new (...args: any[]) => S) 
}

let dynamic: <I extends Schema>(option: QueryX<I>) => QueryX<I>

let z = dynamic({
            props: {
                aaa: 'xx',
                products: {
                    props: {
                        name: ''
                    }
                }
            },
            schema: class B extends ShopSchema{
                aaa: PropertyType<string>
            }
        })
// let xx = (new AA())

let x = dynamic({
    props: {
        shop: z
    },
    schema: class AA extends ProductSchema{
        kkk: PropertyType<string>
    }
})

let a = ProductSchema.find(x)




// All fields are not undefined
// All normal fields nullable = depends
// All computed fields are nullable



// let a :RemoveQueryProps<ProductSchema>


// type CCC = {
//     [key in keyof ProductSchema] 
// }

