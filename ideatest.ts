class Scalar<ResultType> {
    constructor() {}
}

type OmitMethod<T> =  Omit<T, keyof Schema>

type ComputeFunction<ArgT = any, R =any> = (root: any, args: ArgT, ctx: any) => R
interface QueryX<S extends Schema>{
    props: QueryProps<S>
}

type QueryProps<T extends Schema> = Partial<OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyType<infer R> ? R:
        never;
}>>

type ObjectValue<T extends Schema> = OmitMethod<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (ReturnType<T[key]> extends Scalar<infer S> ? S: unknown):
        T[key] extends PropertyType<infer R> ? R:
        never;
}>

class PropertyType<T>{

}

class Entity {

}

class Dataset<T extends Schema> {

    apply(args: QueryX<T>) {
        // throw new Error("Method not implemented.")
        return this
    }

    toScalar(): ObjectValue<T>{
        throw new Error()
    }
}

class Schema {
    static find<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I), options: QueryX<I> ): ObjectValue<I>{
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

    static dataset<I extends Schema>(this: typeof Schema & (new (...args: any[]) => I) ): Dataset<I> {
        throw new Error()
    }
}

class Context {
    schemas: {[key:string]: Schema}
}

function RelationProperty<TypeClass extends typeof Schema>(schema: TypeClass){
    
    return (root: any, args: QueryX< InstanceType<TypeClass> >, context: Context): Scalar<ObjectValue< InstanceType<TypeClass> >> => {
        
        return schema.dataset().apply(args).toScalar()
    }
}

class ProductSchema extends Schema{
    name: PropertyType<string>
    shop = RelationProperty(ShopSchema)

    myABC(root: any, args: number): Scalar<string> {
         throw new Error()
    }
}

class ShopSchema extends Schema{
    name: PropertyType<string>
    products = RelationProperty(ProductSchema)
}

let bbb = ProductSchema.find({
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



class B extends ShopSchema{
    aaa: PropertyType<string>
    products = RelationProperty(AA)
}
class AA extends ProductSchema{
    kkk: PropertyType<string>
    shop = RelationProperty(B)
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
