import { compute, Entity, ExecutionContext, field, TableSchema } from "."
import { makeBuilder, Scalar, Scalarable } from "./Builder"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "./PropertyType"
import { belongsTo, hasMany } from "./Relation"

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
