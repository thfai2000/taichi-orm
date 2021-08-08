import { Dataset, Scalar, Scalarable } from "../../../dist/Builder"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "../../../dist/PropertyType"
import {snakeCase} from 'lodash'
import { ORM } from "../../../dist"
import Shop from './Shop'
import Product from './Product'
import { Knex } from "knex"


(async() => {

    const orm = new ORM({
        models: {Shop, Product},
        enableUuid: true,
        entityNameToTableName: (className: string) => snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: {
            client: 'sqlite3',
            connection: {
            filename: ':memory:'
            }
        }
    })

    let repository = orm.getRepository()
    // repository.outputSchema('/schema')
    await repository.createModels()
    
    let s = repository.models.Shop.datasource('shop')
    
    let p = repository.models.Product.datasource('product')
    
    let myShopDS = new Dataset().from(s).fields("shop.id", "shop.name")
    
    const builder = await myShopDS.toNativeBuilder(repository)
    console.log('xxxxxxxaax', builder.toString() )

    let myShop = myShopDS.datasource("myShop")
    
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
            // .fields(
            //     // "product.id",
            //     // "shop.id",
            //     "myShop.name"
            // )
            .props(
                ({shop, product}) => ({
                    // shop.id.value(),
                    ...shop.hour.value(),
                    ...product.shopId.equals(5).asColumn('nini').value(),
                    xxx: xxx!,
                    ...product.ddd.value()
                })
            )
    
    let result = await orm.getRepository().query(dd)
    console.log('xxx', result)
})()


// let c = {
//         ...{a: 5},
//         ...{b: 5},
//         ...{c: 5},
//         ...{d: 6},
//         ...{e: 8},
//         ...{f: 5}
//     }
// console.log(c)