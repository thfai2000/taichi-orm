class Scalar<ResultType> {
    constructor() {}
}

// type OmitMethod<T> =  Omit<T, keyof Entity>

type ComputeFunction = (root: any, args: any, ctx: any) => any
interface QueryX<E extends typeof Entity>{
    props: QueryProps< ReturnType<E["registerSchema"]> >
}

type QueryProps<T extends Schema> = Partial<{
    [key in keyof T]: 
        T[key] extends ComputeFunction? (Parameters<T[key]>[1] extends QueryX<infer I>? QueryX<I>: Parameters<T[key]>[1] ): 
        T[key] extends PropertyType<infer R> ? R:
        never;
}>


type ObjectValue<T extends Schema> = {
    [key in keyof T]: 
        T[key] extends ComputeFunction? (ReturnType<T[key]> extends Scalar<infer S> ? S: never):
        T[key] extends PropertyType<infer R> ? R:
        never;
}

type ObjectValueOfEntity<E extends typeof Entity> = ObjectValue< ReturnType<E["registerSchema"]> >


class PropertyType<T>{

}

class Dataset<T extends typeof Entity> {

    apply(args: QueryX<T>) {
        // throw new Error("Method not implemented.")
        return this
    }

    toScalar(): ObjectValueOfEntity<T>{
        throw new Error()
    }
}

class Entity {

    static registerSchema<I extends Entity>(this: I & (new (...args: any[]) => I) ): Schema {
        throw new Error()
    }

    static find<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>), options: QueryX<I> ): ObjectValueOfEntity<I>{
        throw new Error()
    }

    // static entityClass<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ){

    //     const s = this

    //     let entityClass = class extends Entity{
    //         constructor(){
    //             super()
    //             //TODO copy attributes  
    //         }
    //     }
    //     //TODO
    //     return entityClass
    // }

    static dataset<I extends typeof Entity>(this: I & (new (...args: any[]) => InstanceType<I>) ): Dataset<I> {
        throw new Error()
    }
}

class Context {
    schemas: {[key:string]: typeof Entity}
}

function Field(){
    
}

function RelationProperty<X extends typeof Entity>(entityClass: X){
    
    return (root: any, args: QueryX< X >, context: Context): Scalar< ObjectValueOfEntity< X > > => {
        throw new Error()
        // return entityClass.dataset().apply(args).toScalar()
    }
}

interface Schema {
    [key: string]: PropertyType<any> | ComputeFunction
}


class Product extends Entity{
    static override registerSchema(){
        return {
            name: new PropertyType<string>(),

            shop: RelationProperty(Shop),
                
            myABC(root: any, args: number, context: Context): Scalar<string> {
                 throw new Error()
            }
        }
    }
}
class Shop extends Entity{
    static override registerSchema(){
        return {
            name: new PropertyType<string>(),
            products: RelationProperty(Product)
        }
    }
}


let x = Product.dataset()


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



let y: QueryX<typeof Shop>

y = {
    props: {
        products: {
            props: {

            }
        }
    }
}





class B extends Shop{
    // aaa: PropertyType<string>
    // products = RelationProperty(AA)
    static override registerSchema(){
        return {
            ...super.registerSchema(),
            aaa: new PropertyType<string>(),
            products: RelationProperty(AA)
        }
    }
}
class AA extends Product{
    
    // shop = RelationProperty(B)
    static override registerSchema(){
        return {
            ...super.registerSchema(),
            shop: RelationProperty(B),
            kkk: new PropertyType<string>()
        }
    }
}

let a = Product.find({
    props: {
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

a.shop
