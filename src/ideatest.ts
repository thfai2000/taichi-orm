import { compute, Entity, field, ORM, TableSchema } from "."
import { Dataset, Scalar, Scalarable } from "./Builder"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "./PropertyType"
import { belongsTo, hasMany } from "./Relation"


(async() => {
 
    class ProductSchema extends TableSchema {
    
        id = field(PrimaryKeyType)
        ddd = field(NumberType)
        // uuid = field(StringType)
        name = field(StringType)
        shopId = field(NumberType)
        // shop = belongsTo<typeof Product, typeof Shop>('Shop', 'shopId')
        shop = belongsTo(Product, Shop, Product.schema.shopId)
        myABC = compute(StringType, (root: any, args: number): Scalarable => {
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
    
    
    let orm = new ORM({
        models: {Shop, Product}
    })
    
    let repository = orm.getRepository()
    repository.outputSchema('/schema')
    await repository.createModels()
    
    
    let s = repository.models.Shop.datasource('shop')
    
    let p = repository.models.Product.datasource('product')
    
    let myShop = new Dataset().from(s).fields("shop.id", "shop.name").datasource("myShop")
    
    // type A = ExtractSynComputeProps<ProductSchema>
    
    let xxx: Scalar<BooleanType>
    
    let dd = new Dataset()
            .from(s)
            .innerJoin(p, ({product}) => product.id.equals(5) )
            .innerJoin(p, ({And}) => And({"product.id": 5}) )
            .innerJoin( 
                myShop,
                ({myShop, product, shop, And}) => And( myShop.id.equals(product.id), product.myABC(5) )
            )
            .filter( 
                ({And, product, shop}) => And({
                    "shop.id": 5,
                    "shop.name": "ssss"
                }, product.name.equals(shop.name) )
            )
            .fields(
                // "product.id",
                // "shop.id",
                "myShop.name"
            )
            // .props(
            //     ({shop}) => ({
            //         "product": xxx!,
            //         "aa": xxx!,
            //         // ...shop.products().value()
            //     })
            // )
            .props(
                ({shop, product}) => Object.assign(
                    shop.id.value(),
                    shop.hour.value(),
                    product.shopId.equals(5).named('nini'),
                    product.ddd.value()
                )
            )
    
    let result = await orm.getRepository().query(dd)
    console.log('xxx', result)
})()