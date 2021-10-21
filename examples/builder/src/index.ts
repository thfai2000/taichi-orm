import { Column, Dataset, makeRaw, Scalar } from "../../../dist/Builder"
import {snakeCase} from 'lodash'
import { ConstructPropertyDictBySelectiveArg, ORM, SelectorMap, SingleSourceArg } from "../../../dist"
import ShopClass from './Shop'
import ProductClass from './Product'
import { ArrayType, FieldPropertyTypeDefinition, NumberNotNullType, NumberType, ObjectType, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringType } from "../../../dist/PropertyType"
import { UnionToIntersection, ExtractFieldPropDictFromModel, ExtractSchemaFromModel, ExtractSchemaFromModelType } from "../../../dist/util"
import { Schema } from "../../../dist/Schema"


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
        insert,
        update,
        models: {Shop, Product} 
    } = orm.getContext()


    await createModels()


    let a = await Shop.find({
        select: {
            products: {
                select: {
                    shop: {}
                }
            }
        }
    })

    
    let s = Shop.datasource('shop')
    
    let p = Product.datasource('product')

    let col = s.selectorMap().products({
        select: {
            shop: {}
        }
    })

    let aaa = await col.execute()


    type A =  <F extends SingleSourceArg<ExtractSchemaFromModelType<typeof ProductClass>>>( args?: F | ((root: SelectorMap<ExtractSchemaFromModelType<typeof ProductClass>>) => F) | undefined) => 
        Column<"products", ArrayType<Schema<ConstructPropertyDictBySelectiveArg<ExtractSchemaFromModelType<typeof ProductClass>, F>>>>

    let aaaaa : A

    let cc = await aaaaa!({
        select: {
            shop: {}
        }
    }).execute()
    

    
    let myShopDS = new Dataset().from(s).selectProps("shop.id", "shop.name")
    
    const builder = await myShopDS.toNativeBuilder(orm.getContext())
    console.log('sql1', builder.toString() )


    let shop1 = await insert(Shop.schema).values({
        name: 'shop',
        hour: 5
    }).executeAndReturn()

    console.log('finished-1', shop1)
    
    for (let i = 0; i < 5; i++) {    
        
        let product = await insert(Product.schema).values({
            ddd: 5,
            name: 'hello',
            shopId: shop1.id
        })
        .executeAndReturn()
        .withOptions({
            onSqlRun: console.log
        })
        console.log('product', product)
    }

    console.log('finished')

    let result = await new Dataset()
            .from(s)
            .innerJoin(p, ({product, shop}) => product.shopId.equals(shop.id))
            // .innerJoin(p, ({And}) => And({"product.id": 5}) )
            // .innerJoin(p, ({product}) => product.id.equals(6) )
            // .innerJoin(
            //     myShop,
            //     ({myShop, product, shop, And}) => And( myShop.id.equals(product.id), product.myABC(5) )
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
                    ...shop.$allFields,
                    ...shop.hour.value(),
                    ...product.shopId.equals(10).asColumn('nini').value(),
                    ...product.ddd.value(),
                    test: Scalar.number(` 5 + ?`, [3]),
                    ...shop.products().value()
                })
            ).offset(0).limit(4000).execute(orm.getContext()).withOptions({
                onSqlRun: console.log
            })
    
    console.log('xxx', result)

    let r0 = await update()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .set({
            name: Scalar.value(`?`,['hello'])
        }).execute().withOptions({
            onSqlRun: console.log
        })

    let r = await dataset()
        .from(Shop.datasource("myShop"))
        .selectProps('name','myShop.id','myShop.products')
        // .toScalar(new ArrayType(Shop.schema))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('testttttttttttttt', r)

    let r2 = await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop, And})=> And(
            myShop.hour.equals(myShop.hour),
            myShop.hour.equals(myShop.hour)
        ))
        .groupByProps('hour')
        .select(({myShop}) => ({
            h1: myShop.hour,
            cnt: Scalar.number(`COUNT(?)`, [myShop.hour]),
            test: Scalar.number(`?`, [new Dataset().from(Shop.datasource('a')).selectProps('id').limit(1)]),
            a: new Dataset().from(Shop.datasource('a')).selectProps('id').limit(1).castToScalar( 
                (ds) => new ObjectType(ds.schema()) 
                )
        }))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('test groupBy', r2[0].a)


    //Done: dynamic result type on 'find'
    //Done: dataset api use DatabaseAction chain
    //Done: dataset toScalar ....without ArrayType
    
    // TODO: relation helper function: use string as input field
    // TODO: deleteStatement
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
    // TODO: manyToMany Relation helper function
    // Scalar.boolean, Scalar.string
    // think about migrate issue
    // handle actionOptions failIfNone
    // TODO: avoid re-use same table alias



    // let allShops = await Shop.find({
    //     where: ({root}) => root.name.equals('helloShopx')
    // })
    // console.log('aaa', allShops[0])
    // console.time('simple')
    // let allShopsX = await Shop.find({
    //     select: {
    //         products: (P) => ({
    //             select: {
    //                 myABC: 5,
    //                 shop: {
    //                     select: {
    //                         products: {}
    //                     },
    //                     where: ({root}) => root.name.equals('shop')
    //                 }
    //             }
    //         })
    //     },
    //     where: ({root, Exists}) => Exists(
    //         new Dataset().from(
    //             Product.datasource('product')
    //         ).where( ({product}) => root.id.equals(product.shopId) )
    //     ),
    //     offset: 0,
    //     limit: 5000
    // })

    // console.log('aaaa', allShopsX[0])
    // console.timeEnd('simple')
})();