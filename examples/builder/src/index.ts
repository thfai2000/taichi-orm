import { Dataset, makeRaw, Scalar, Scalarable } from "../../../dist/Builder"
import {snakeCase} from 'lodash'
import { EntityPropertyKeyValues, EntityWithOptionalProperty, FieldProperty, ORM, SingleSourceArg, TableSchema } from "../../../dist"
import ShopClass, { ShopSchema } from './Shop'
import ProductClass from './Product'
import { ArrayType, FieldPropertyTypeDefinition, NumberNotNullType, NumberType, PrimaryKeyType, PropertyTypeDefinition, StringType } from "../../../dist/PropertyType"
import { Expand, ExtractFieldProps } from "../../../dist/util"

(async() => {

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
                "shop.id",
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
                    ...shop.hour.value(),
                    ...product.shopId.equals(10).asColumn('nini').value(),
                    ...product.ddd.value(),
                    test: Scalar.number(` 5 + ?`, [3]),
                    ...shop.products().value()
                })
            ).offset(0).limit(4000)
    
    let result = await orm.getRepository().execute(dd, {
        onSqlRun: console.log
    })
    console.log('xxx', result)

    let c: ExtractFieldProps<ShopSchema>
    let b: Expand<EntityPropertyKeyValues< ExtractFieldProps<ShopSchema>>>

    let a: Expand<EntityWithOptionalProperty<ShopSchema, {}>>


    let allShops = await Shop.find({
        where: ({root}) => root.name.equals('helloShopx')
    })
    console.log('aaa', allShops[0])
    console.time('simple')
    let allShopsX = await Shop.find({
        select: {
            products: (P) => ({
                select: {
                    myABC: 5,
                    shop: {
                        select: {
                            products: {}
                        },
                        where: ({root}) => root.name.equals(P.name)
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

    console.log('aaaa', allShopsX[0])
    console.timeEnd('simple')


    await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .update({
            name: Scalar.value(`?`,['hello'])
        }).execute({
            onSqlRun: console.log
        })

    let r = await dataset()
        .from(Shop.datasource("myShop"))
        .selectProps('name','myShop.id','myShop.products')
        .toScalar(new ArrayType(Shop.schema))
        .execute({
            onSqlRun: console.log
        })


    console.log('test groupBy', await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop, And})=> And(
            myShop.hour.equals(myShop.hour),
            myShop.hour.equals(myShop.hour)
        ))
        .groupByProps('hour')
        .select(({myShop}) => ({
            h1: myShop.hour,
            cnt: Scalar.value(`COUNT(?)`, [myShop.hour]),
            test: Scalar.number(`?`, [new Dataset().from(Shop.datasource('a')).selectProps('id').limit(1)]),
            a: new Dataset().from(Shop.datasource('a')).selectProps('id').limit(1).toScalar(NumberNotNullType)
        }))
        .execute({
            onSqlRun: console.log
        }))

        //TODO: dynamic result type on 'find'
        //TODO: dataset api use DatabaseAction chain

        // TODO: orderBy
        // TODO: having
        // TODO: addSelectProps
        // fix all unit tests
        // repository.scalar()
        // EXISTS, NOT, BETWEEN, 
        // greaterThan, lessThan
        // equalOrGreaterThan, equalOrLessThan
        // minus, plus
        // SUM, MAX, MIN
        // delete()
        // Scalar.boolean, Scalar.string
        // think about migrate issue
        // handle actionOptions failIfNone
})();