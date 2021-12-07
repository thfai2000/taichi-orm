import { Dataset, Scalar } from "../../../dist/"
import util from 'util'
import {snakeCase} from 'lodash'
import { CompiledComputeFunction, ComputeFunction, ComputeFunctionDynamicReturn, ORM, Selector } from "../../../dist"
import ShopClass from './Shop'
import ProductClass from './Product'
import { NumberNotNullType, ObjectType } from "../../../dist/"
import { ExtractPropDictFromSchema, ExtractSchemaFromModel, ExtractSchemaFromModelType } from "../../../dist/"
import { ComputeProperty, FieldProperty, ScalarProperty } from "../../../dist/"
import { ModelArrayRecord, ModelArrayRecordFunctionArg } from "../../../dist/"


(async() => {

    const orm = new ORM({
        models: {Shop: ShopClass, Product: ProductClass},
        entityNameToTableName: (className: string) => snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: ':memory:'
            }
        }
    })

    
    const {
        createModels,
        dataset, 
        scalar,
        insert,
        del,
        update,
        repos: {Shop, Product} 
    } = orm.getContext()

    const context = orm.getContext()


    await createModels()

    const s = Shop.datasource('shop')

    const p = Product.datasource('product')

    const myShopDS = new Dataset().from(s).select("shop.id", "shop.name")
    
    const builder = await myShopDS.toNativeBuilder(orm.getContext())
    console.log('sql1', builder.toString() )


    const shop1 = await insert(Shop.schema()).values([{
        name: 'shop',
        hour: 5
    }]).execute().getAffectedOne()

    console.log('finished-1', shop1)
    
    for (let i = 0; i < 5; i++) {    
        
        const product = await insert(Product.schema()).values([{
            ddd: 5,
            name: 'hello',
            availableStart: new Date(),
            availableEnd: new Date(),
            remainingStock: 2,
            shopId: shop1.id
        }])
        .execute().getAffectedOne()
        .withOptions({
            onSqlRun: console.log
        })
        console.log('product', product)
    }

    const anotherProducts = await insert(Product.schema()).values([{
        ddd: 5,
        name: 'hello',
        availableStart: new Date(),
        availableEnd: new Date(),
        remainingStock: 2,
        shopId: shop1.id
    }, {
        ddd: 8,
        name: 'hello2',
        availableStart: new Date(),
        availableEnd: new Date(),
        remainingStock: 2,
        shopId: shop1.id
    }])
    .execute().withAffected()

    console.log('product', anotherProducts.affected)

    console.log('finished')

    const result = await new Dataset()
            .from(s)
            .innerJoin(p, ({product, shop}) => product.shopId.equals(shop.id))
            // .innerJoin(p, ({And}) => And({"product.id": 5}) )
            // .innerJoin(p, ({product}) => product.id.equals(6) )
            // .innerJoin(
            //     myShop,
            //     ({myShop, product, shop, And}) => And( myShop.id.equals(product.id), product.myABC(5) )
            // )
            .select(
                "shop.id",
                "shop.name"
            )
            .where(
                ({shop, product, And}) => And(
                    shop.id.equals(1),
                    product.name.equals('hello')
                )
            )
            .andSelect(
                ({shop, product}) => ({
                    ...shop.$allFields,
                    hour: shop.hour,
                    b: product.abc2(2),
                    //@ts-ignore
                    c: product.shopWithName({
                        select: {
                            products: {}
                        }
                    }),
                    test: Scalar.number({sql:` 5 + ?`, args: [3]}),
                    products: shop.products({
                        select: {
                            shop: {
                                selectProps: ['products']
                            }
                        }
                    })
                })
            ).offset(0).limit(100).execute(context).withOptions({
                onSqlRun: console.log
            })
    
    console.log('xxx', util.inspect(result, {showHidden: false, depth: null, colors: true}))

    const r0 = await update()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .set({
            name: Scalar.value('?',['hello'])
        }).execute().withOptions({
            onSqlRun: console.log
        })

    const r = await dataset()
        .from(Shop.datasource("myShop"))
        .where({
            name: 'hello',
            hour: 5
        })
        // .select( ({myShop}) => myShop.$allFields)
        .select('name','myShop.id','myShop.products')
        // .toScalar(new ArrayType(Shop.schema()))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('test', util.inspect(r, {showHidden: false, depth: null, colors: true}))

    const r2 = await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop, And})=> And(
            myShop.hour.equals(myShop.hour),
            myShop.hour.equals(myShop.hour)
        ))
        .groupBy('hour')
        .select(({myShop}) => ({
            h1: myShop.hour,
            cnt: Scalar.number(`COUNT(?)`, [myShop.hour]),
            test: Scalar.number(`?`, [new Dataset().from(Shop.datasource('a')).select('id').limit(1)]),
            a: new Dataset().from(Shop.datasource('a')).select('id').limit(1).toDScalarWithType( 
                (ds) => new ObjectType(ds.schema()) 
            )
        }))
        .execute().withOptions({
            onSqlRun: console.log
        })

    console.log('test groupBy', r2[0])

    console.log('d1', await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .select(({myShop}) => ({
            ...myShop.$allFields
        }))
        .orderBy(({myShop}) => [myShop.hour])
        .execute())

    const deleted = await del()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .execute().withOptions({
            onSqlRun: console.log
        }).withPreflight()

    console.log('deleted', deleted)

    console.log('d2', await dataset()
        .from(Shop.datasource("myShop"))
        .where(({myShop}) => myShop.id.equals(1))
        .select(({myShop}) => ({
            ...myShop.$allFields
        }))
        .execute())


    const shops = await Shop.find({
        select: {
            products: {
                select: {
                    shop: {}
                }
            }
        },
        where: ({And})=> And({
            name: 'hello'
        })
    })

    console.log('aaaa1', shops)


    const allShopsX = await Shop.find({
        // selectProps: ['products'],
        select: {
            // products: {
            //     select: {
            //         shop: {}
            //     }
            // }
            products: ({root, And}: ModelArrayRecordFunctionArg<typeof Shop.modelClass>) => ({
                select: {
                    shop: {
                        select: {
                            products: {}
                        },
                        where: root.name.equals('shop')
                    },
                },
                orderBy: ['id', {value: And(1, 1), order: 'asc'}]
            })
        },
        where: ({root, Exists}) => Exists(
            new Dataset().from(
                Product.datasource('product')
            ).where( ({product}) => root.id.equals(product.shopId) ).select('id')
        ),
        orderBy: ['name', {value: 'id', order: 'asc'}],
        offset: 0,
        limit: 5000
    }).onSqlRun(console.log)

    console.log('aaaa2', allShopsX[0])

    // let s2 = Shop.dataset({
    //     select: {
    //         products: {}
    //     }
    // }).where({
    //     "id": 5
    // })

    // Done: dynamic result type on 'find'
    // Done: dataset api use DatabaseAction chain
    // Done: dataset toScalar ....without ArrayType
    // Done: refactor ObjectType, ArrayType....use pure Array approach
    // Done: relation helper function: use string as input field
    // Done: where Typescript Hints not working
    // Done: consider computedFunction dynamic result Typescript Hints
    // Done: deleteStatement
    // Done: repository.scalar() & scalar.execute
    // Done: orderBy
    // Done: equalOrGreaterThan, equalOrLessThan
    // Done: greaterThan, lessThan
    // Done: MODEL: CRUD...delete()
    // Done: failIfNone on query
    // Done: EXISTS, NOT, BETWEEN, 
    // Done: manyToMany Relation helper function
    // Done: fix all unit tests
    // Done: remove addSelectProps

    // TODO: add hooks for computed values
    // TODO: give typescripts hint on dataset Preflight and Affected query
    // TODO: minus, plus, divide, times, if case
    // TODO: having
    // TODO: SUM, MAX, MIN
    // TODO: create values ...if not null and no default, become compulsory 
    // TODO: add PropertType (ArrayType of primitive)
    // TODO: Scalar.boolean, Scalar.string
    // Discuss: Model.count
    // Discuss: think about migrate issue
    // TODO: Organize Error in a better way
    // TODO: avoid re-use same table alias
    // TODO: FullCount
    // - [ ] context allow global filter on specific tables (use case: soft delete)
    // - [ ] context allow read-only transaction... speed up query and safe to graphql query
    // - [ ] relations test cases
    // - [ ] vuepress to introduce ORM    
})();