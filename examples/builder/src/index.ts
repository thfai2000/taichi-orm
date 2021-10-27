import { Dataset, Scalar } from "../../../dist/Builder"
import util from 'util'
import {snakeCase} from 'lodash'
import { CompiledComputeFunction, ComputeFunction, ComputeFunctionDynamicReturn, ConstructValueTypeDictBySelectiveArg, ORM, SelectorMap, SingleSourceArg } from "../../../dist"
import ShopClass from './Shop'
import ProductClass from './Product'
import { ArrayType, FieldPropertyTypeDefinition, NumberNotNullType, NumberType, ObjectType, ParsableObjectTrait, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringType } from "../../../dist/PropertyType"
import { UnionToIntersection, ExtractFieldPropDictFromModel, ExtractSchemaFromModel, ExtractSchemaFromModelType, ExpandRecursively, Expand } from "../../../dist/util"
import { ComputeProperty, Datasource, FieldProperty, Schema } from "../../../dist/Schema"


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
        scalar,
        insert,
        update,
        models: {Shop, Product} 
    } = orm.getContext()

    let context = orm.getContext()


    await createModels()

    let eee = await scalar('5', [], NumberNotNullType).execute()

    let s = Shop.datasource('shop')
    
    let p = Product.datasource('product')

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
                    hour: shop.hour,
                    // nini: product.shopId.equals(10),
                    // DDD: product.ddd,
                    // a: product.abc(2),
                    b: product.abc2(2),
                    c: product.shopWithName({
                        select: {
                            // products: {}
                        }
                    }).transform( ds => ds.selectProps('root.products').toScalarWithType(ds => new ObjectType(ds.schema())) ),
                    // test: Scalar.number({sql:` 5 + ?`, args: [3]}),
                    products: shop.products({
                        select: {
                            shop: {
                                select: {
                                    products: {}
                                }
                            }
                        }
                    }),
                    // x: product.shop({
                    //     select: {
                    //         products: {}
                    //     }
                    // }),
                })
            ).offset(0).limit(100).execute(context).withOptions({
                onSqlRun: console.log
            })
    
    console.log('xxx', util.inspect(result, {showHidden: false, depth: null, colors: true}))

    let r0 = await update()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .set({
            name: Scalar.value('?',['hello'])
        }).execute().withOptions({
            onSqlRun: console.log
        })

    let r = await dataset()
        .from(Shop.datasource("myShop"))
        .where({
            name: 'hello',
            hour: 5
        })
        // .select( ({myShop}) => myShop.$allFields)
        .selectProps('name','myShop.id','myShop.products')
        // .toScalar(new ArrayType(Shop.schema))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('test', util.inspect(r, {showHidden: false, depth: null, colors: true}))

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
            a: new Dataset().from(Shop.datasource('a')).selectProps('id').limit(1).toScalarWithType( 
                (ds) => new ObjectType(ds.schema()) 
            )
        }))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('test groupBy', r2[0])


    //Done: dynamic result type on 'find'
    //Done: dataset api use DatabaseAction chain
    //Done: dataset toScalar ....without ArrayType
    //Done: refactor ObjectType, ArrayType....use pure Array approach
    //Done: relation helper function: use string as input field
    // Done: where Typescript Hints not working
    // Done: consider computedFunction dynamic result Typescript Hints

    // TODO: deleteStatement
    // TODO: orderBy
    // TODO: having
    // TODO: addSelectProps
    // fix all unit tests
    // repository.scalar() & scalar.execute
    // EXISTS, NOT, BETWEEN, 
    // greaterThan, lessThan
    // equalOrGreaterThan, equalOrLessThan
    // minus, plus
    // SUM, MAX, MIN
    // MODEL: CRUD...delete()
    // TODO: manyToMany Relation helper function
    // Scalar.boolean, Scalar.string
    // think about migrate issue
    // handle actionOptions failIfNone
    // TODO: avoid re-use same table alias
    // TODO: add PropertType (ArrayType of primivite)
    // TODO: Model.count



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