import { Dataset, makeRaw, Scalar } from "../../../dist/Builder"
import {snakeCase} from 'lodash'
import { ORM } from "../../../dist"
import ShopClass from './Shop'
import ProductClass from './Product'
import { PropertyTypeDefinition, UnknownPropertyTypeDefinition } from "../../../dist/PropertyType"


(async() => {


    // let a = Object.assign({e:8},{a:5},{b:6},Object.assign({c:7},{h:0}))
    // console.log('aaa', a)

    const orm = new ORM({
        models: {Shop: ShopClass, Product: ProductClass},
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


    let {
        createModels,
        dataset, 
        models: {Shop, Product} 
    } = orm.getRepository()


    await createModels()
    
    let s = Shop.datasource('shop')
    
    let p = Product.datasource('product')
    
    let myShopDS = new Dataset().from(s).selectProps("shop.id", "shop.name")
    
    const builder = await myShopDS.toNativeBuilder(orm.getRepository())
    console.log('sql1', builder.toString() )


    let shop1 = await Shop.createOne({
        name: '333',
        hour: 5
    })

    console.log('finished-1', shop1)
    
    for (let i = 0; i < 5; i++) {      
        await Product.createOne({
            ddd: 5,
            name: 'hello',
            shopId: shop1.id
        })
    }

    console.log('finished')

    let dd = new Dataset()
            .from(s)
            .innerJoin(p, ({product, shop}) => product.shopId.equals(shop.id))
            // .innerJoin(p, ({And}) => And({"product.id": 5}) )
            // .innerJoin(p, ({product}) => product.id.equals(6) )
            // .innerJoin(
            //     myShop,
            //     ({myShop, product, shop, And}) => And( myShop.id.equals(product.id), product.myABC(5) )
            // )
            // .filter(
            //     ({And, product, shop}) => And({
            //         "shop.id": 5,
            //         "shop.name": "ssss"
            //     }, product.name.equals(shop.name) )
            // )
            .selectProps(
                // "product.id",
                // "shop.id",
                "shop.name"
            )
            .where(
                ({shop, product, And}) => And(
                    shop.id.equals(1),
                    product.name.equals('hello')
                )
            )
            .select(
                ({shop, product}) => ({
                    // shop.id.value(),
                    ...shop.hour.value(),
                    ...product.shopId.equals(10).asColumn('nini').value(),
                    // xxx: xxx!,
                    ...product.ddd.value()
                })
            ).offset(0).limit(4000)
    
    let result = await orm.getRepository().execute(dd, {
        onSqlRun: console.log
    })
    console.log('xxx', result)


    let allShops = await Shop.find({
        where: ({root}) => root.name.equals('helloShopx')
    })
    console.log('aaa', allShops)
    console.time('simple')
    let allShopsX = await Shop.find({
        select: {
            products: (P) => ({
                select: {
                    myABC: 5,
                    shop: {
                        // props: {
                        //     products: {}
                        // },
                        // filter: ({root}) => root.name.equals(P.name)
                    }
                }
            })
        },
        where: ({root, Exists}) => Exists(
            new Dataset().from(
                Product.datasource('product')
            ).where( ({product}) => root.id.equals(product.shopId) )
        ),
        offset: 0,
        limit: 5000
    })
    console.log('aaaa', allShopsX[0].products.length)
    console.timeEnd('simple')


    await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .update({
            name: new Scalar(new UnknownPropertyTypeDefinition(), makeRaw(orm.getRepository(), '?', 'hello') )
        }).execute({
            onSqlRun: console.log
        })



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