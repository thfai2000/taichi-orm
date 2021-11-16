import {Model, ModelObjectRecord} from '../dist/model'
import {CFReturn, ConstructComputePropertyArgsDictFromSchema, ConstructValueTypeDictBySelectiveArg, DatabaseContext, ORM, SingleSourceArg, SingleSourceSelect} from '../dist'
import {snakeCase, omit, random} from 'lodash'
import {v4 as uuidv4} from 'uuid'
import { PrimaryKeyType, 
        StringNotNullType, 
        StringType,
        BooleanType,
        BooleanNotNullType,
        DecimalType,
        DecimalNotNullType,
        DateTimeType,
        DateTimeNotNullType,
        NumberType,
        NumberNotNullType
      } from '../dist/types'
import { FieldProperty } from '../dist/schema'
import { Scalar } from '../dist/builder'
import { expand, ExpandRecursively, ExtractComputePropWithArgDictFromSchema, ExtractSchemaFromModelType } from '../dist/util'

let shopData = [
  { id: 1, name: 'Shop 1', location: 'Shatin', tel: null},
  { id: 2, name: 'Shop 2', location: 'Yuen Long', tel: '12345678'},
  { id: 3, name: 'Shop 3', location: 'Tsuen Wan', tel: null},
  { id: 4, name: 'Shop 4', location: 'Tsuen Wan', tel: '12345678'},
  { id: 5, name: 'Shop 5', location: 'Tsuen Wan', tel: '12345678'},
  { id: 6, name: 'Shop 6', location: 'Tai Po', tel: null}
]

let productData = [
  { id: 1, name: 'Product 1a', shopId: 1, price: null, createdAt: null, isActive: null},
  { id: 2, name: 'Product 1b', shopId: 1, price: null, createdAt: null, isActive: null},
  { id: 3, name: 'Product 2a', shopId: 2, price: null, createdAt: null, isActive: null},
  { id: 4, name: 'Product 2b', shopId: 2, price: null, createdAt: null, isActive: null},
  { id: 5, name: 'Product 2b', shopId: 2, price: null, createdAt: null, isActive: null}
]

let colorData = [
  { id: 1, code: 'red'},
  { id: 2, code: 'orange'},
  { id: 3, code: 'yellow'},
  { id: 4, code: 'green'},
  { id: 5, code: 'blue'},
  { id: 6, code: 'black'},
  { id: 7, code: 'white'}
]

let productColorData = [
  { productId: 1, colorId: 1, type: 'main'},
  { productId: 1, colorId: 6, type: 'normal'},
  { productId: 1, colorId: 7, type: 'normal'},

  { productId: 2, colorId: 3, type: 'normal'},
  { productId: 2, colorId: 4, type: 'main'},
  //no main color for product 3
  { productId: 3, colorId: 2, type: 'normal'},
  { productId: 3, colorId: 5, type: 'normal'},
]

class Shop extends Model {
    id= this.field(PrimaryKeyType)
    name = this.field(new StringNotNullType({length: 255}))
    location = this.field(new StringNotNullType({length:255}))
    tel = this.field(StringType)
    products = Shop.hasMany(Product, 'shopId')
    productCount = Shop.compute( (parent): CFReturn<number> => {
      return parent.selectorMap.products().count()
    })
    hasProducts = Shop.compute( (parent): CFReturn<boolean> => {
      return parent.selectorMap.products().exists()
    })
    hasProductsAsync = Shop.compute( (parent): CFReturn<boolean> => {
      return new Scalar( async(context) => {
        return parent.selectorMap.products().exists()
      })
    })
    hasNoProducts = Shop.compute( (parent): CFReturn<boolean> => {
      return parent.selectorMap.products().exists().equals(false)
    })
    hasOver2Products =  Shop.compute( (parent): CFReturn<boolean> => {
      return parent.selectorMap.products().count().greaterThan(2)
    })
    hasEnoughProducts = Shop.compute( (parent, arg?: number): CFReturn<boolean> => {
      return parent.selectorMap.products().count().greaterThanOrEquals(arg ?? 1)
    })
    hasTwoProductsAndlocationHasLetterA = Shop.compute( (parent, arg?): CFReturn<boolean> => {
      return new Scalar( (context) => context.op.And(
          parent.selectorMap.products().count().equals(2),
          parent.selectorMap.location.like('%A%')
        )
      )
    })
}

class ProductColor extends Model{
  id= this.field(PrimaryKeyType)
  colorId = this.field(NumberNotNullType)
  productId = this.field(NumberNotNullType)
  type = this.field(new StringNotNullType({length: 50}))
}

class Color extends Model {
  id = this.field(PrimaryKeyType)
  code = this.field(new StringNotNullType({length: 50}))
}
class Product extends Model{
    id= this.field(PrimaryKeyType)
    name = this.field(StringType)
    isActive = this.field(BooleanType)
    price = this.field(new DecimalType({precision: 7, scale: 2}))
    createdAt = this.field(new DateTimeType({precision: 6}))
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId')
    colors = Product.hasManyThrough(ProductColor, Color, 'id', 'colorId', 'productId')
    mainColor = Product.compute<typeof Product, ModelObjectRecord<typeof Color> >(
      (parent): any => {
        return parent.selectorMap.colors({
          where: ({through}) => {
            return through.type.equals('main')
          }
        }).toScalar(false)
    })
}

// @ts-ignore
let config = JSON.parse(process.env.ENVIRONMENT)

let orm = new ORM({
    models: {Shop, Product, Color, ProductColor},
    entityNameToTableName: (className: string) => snakeCase(className),
    propNameTofieldName: (propName: string) => snakeCase(propName),
    knexConfig: config
})
let tablePrefix = () => `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`


const loadData = async (ctx: DatabaseContext<{
    Shop: typeof Shop;
    Product: typeof Product;
    Color: typeof Color;
    ProductColor: typeof ProductColor;
}>) => {
  await ctx.createModels()
  let {Shop, Product, Color, ProductColor} = ctx.models
  await Promise.all(shopData.map( async(d) => {
    return await Shop.createOne(d)
  }))

  await Promise.all(productData.map( async(d) => {
    return await Product.createOne(d)
  }))

  await Promise.all(colorData.map( async(d) => {
    return await Color.createOne(d)
  }))

  await Promise.all(productColorData.map( async(d) => {
    return await ProductColor.createOne(d)
  }))
}

describe('SelectProps - Custom Computed Fields with Where clause', () => {

  test('Query computed field', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models
    let id = 2
    let record = await Shop.findOne({
      selectProps: ['productCount', 'products'],
      where: {
        id
      }
    })
    expect(record.productCount).toBe( productData.filter(p => p.shopId === id).length)
  });
})

describe('SelectProps - Computed Fields using Standard Relations', () => {
  test('Query computed fields - hasMany + other custom props', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models
    let records = await Shop.find({
      selectProps: ['products', 'productCount', 'hasProducts', 'hasNoProducts', 'hasOver2Products']
    })

    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(expect.arrayContaining(
      shopData.map(shop => expect.objectContaining({
        ...shop,
        products: expect.arrayContaining(
          productData.filter(product => product.shopId === shop.id).map(product => expect.objectContaining(product))
        ),
        productCount: productData.filter(product => product.shopId === shop.id).length,
        hasProducts: productData.filter(product => product.shopId === shop.id).length > 0,
        hasNoProducts: productData.filter(product => product.shopId === shop.id).length === 0,
        hasOver2Products: productData.filter(product => product.shopId === shop.id).length > 2
      })))
    )
  });

  test('Query computed fields - belongsTo', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models
    let records = await Product.find({
      selectProps: ['shop']
    })
    expect(records).toHaveLength(productData.length)
    expect(records).toEqual(
      expect.arrayContaining(
          productData.map(product => expect.objectContaining({
            ...product,
            shop: expect.objectContaining(
              shopData.find(shop => product.shopId === shop.id)
            )
          }))
      )
    )
  });

  test('Query computed fields - hasThrough + multiple level', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models
    let records = await Shop.find({
      select: {
        products: {
          selectProps: ['colors', 'mainColor']
        }
      }
    })

    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(
      expect.arrayContaining( 
        shopData.map(shop => expect.objectContaining({
      ...shop,
      products: expect.arrayContaining(
        productData.filter(product => product.shopId === shop.id).map(product => expect.objectContaining({
          ...product,
          colors: expect.arrayContaining(
            productColorData.filter( pc => pc.productId === product.id ).map( 
                pc => {
                  let item = colorData.find(c => c.id === pc.colorId)
                  return item? expect.objectContaining(item): null
                }
          )),
          mainColor: 
            colorData.filter(c => c.id === productColorData.find( pc => pc.productId === product.id && pc.type === 'main' )?.colorId)
            .map(c => expect.objectContaining(c) )[0] ?? null

        }))
      )
    })))
    )
  });
})

describe('Select - Simple Query', () => {

  test('Mixed Select + SelectProps + Query by object filter', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let id = 2
    let record = await Shop.findOne({
      selectProps: ['productCount', 'hasProductsAsync'],
      select: {
        products: {}
      },
      where: {id}
    })

    expect(record).toEqual( expect.objectContaining({
      ...shopData.find(s => s.id === id),
      products: expect.arrayContaining(
          productData.filter(p => p.shopId === id).map( p => expect.objectContaining(p) )
      ),
      productCount: productData.filter(p => p.shopId === id).length,
      hasProductsAsync: productData.filter(p => p.shopId === id).length > 0
    }))
  })

  

  test('Mixed Select + SelectProps (With Multi Level)', async () => {

    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let records = await Shop.find({
      selectProps: ['productCount'],
      select: {
        products: {
          selectProps: ['colors'],
          select: {
            shop: {
              selectProps: ['products']
            }
          }
        }
      }
    })

    //TODO: fix the expected result
    expect(records).toEqual( expect.arrayContaining(
      shopData.map( shop => expect.objectContaining({
          ...shop,
          products: expect.arrayContaining(
            productData.filter(p => p.shopId === shop.id).map( p => expect.objectContaining( {
              ...p,
              colors: expect.arrayContaining( productColorData.filter(pc => pc.productId === p.id)
                .map( pc => expect.objectContaining( colorData.find(c => c.id === pc.colorId))) )
            }))
          ),
          productCount: productData.filter(p => p.shopId === shop.id).length
        })
      )
    ))

  });

  test('Select - Query with limit', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models
    let limit = 2
    let records = await Shop.find({
      where: ({root}) => root.id.greaterThan(2),
      limit
    })

    expect(records).toHaveLength(limit)
  });

})

describe('Select - Use Query Arguments', () => {

  test('Use Query Arguments', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let expectedCount = 3
    let records = await Shop.find({
      select: {
        hasEnoughProducts: expectedCount
      }
    })

    expect(records).toEqual( expect.arrayContaining(
      shopData.map( shop => expect.objectContaining({
          ...shop,
          hasEnoughProducts: productData.filter(p => p.shopId === shop.id).length >= expectedCount
        })
      )
    ))

  })

})

describe('Where - Operators', () => {

  test('Query by object filter - :value + equals() + notEquals()', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let id = 2
    let records = await Shop.find({
      where: {id}
    })
    let records2 = await Shop.find({
      where: ({root}) => root.id.equals(id)
    })

    expect(records).toHaveLength(1)
    expect(records).toEqual( expect.arrayContaining(
      shopData.filter(s => s.id === id).map( s => expect.objectContaining(s))
    ))

    expect(records2).toHaveLength(1)
    expect(records2).toEqual( expect.arrayContaining(
      shopData.filter(s => s.id === id).map( s => expect.objectContaining(s))
    ))

    let records3 = await Shop.find({
      where: ({root}) => root.id.notEquals(id)
    })

    const expectedNotEquals = shopData.filter(s => s.id !== id)
    expect(records3).toHaveLength(expectedNotEquals.length)
    expect(records3).toEqual( expect.arrayContaining(
      expectedNotEquals.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - :null + isNull() + isNotNull()', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let records = await Shop.find({where: ({root}) => root.tel.isNull() })
    let records2 = await Shop.find({ where: {tel: null}})

    const expected = shopData.filter(s => s.tel === null)

    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))

    expect(records2).toHaveLength(expected.length)
    expect(records2).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))

    let records3 = await Shop.find({where: ({root}) => root.tel.isNotNull() })

    const expectedNotNull = shopData.filter(s => s.tel !== null)
    expect(records3).toHaveLength(expectedNotNull.length)
    expect(records3).toEqual( expect.arrayContaining(
      expectedNotNull.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Not', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await loadData(ctx)
    let {Shop, Product, Color, ProductColor} = ctx.models

    let records = await Shop.find({
      where: ({Not}) => Not({
        location: 'Tsuen Wan',
        name: 'Shop 4'
      })
    })

    const expected = shopData.filter(s => !(s.location === 'Tsuen Wan' && s.name === 'Shop 4') )
    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))
  })

  // test('Query by object filter - in() + notIn()', async () => {
  //   let ctx = orm.getContext({tablePrefix: tablePrefix()})
  //   await loadData(ctx)
  //   let {Shop, Product, Color, ProductColor} = ctx.models

  //   let ids = [2,4,100]
  //   let expectedShops = shopData.filter(s => ids.includes(s.id) )
  //   let records = await Shop.find({where: {id: ids}})

  //   expect(records).toHaveLength(expectedShops.length)
  //   expect(records).toEqual( expect.arrayContaining(
  //     expectedShops.map( s => expect.objectContaining(s))
  //   ))
    
  //   let records2 = await models.Shop.find({id: Contain(...ids)})
  //   expect(records2).toHaveLength(expectedShops.length)
  //   expect(records2).toEqual( expect.arrayContaining(
  //     expectedShops.map( s => expect.objectContaining(s))
  //   ))
  // })

  // test('Query by object filter - Like', async () => {
  //   const likeStr = '2'
  //   let expectedShops = shopData.filter( s => s.name.includes(likeStr))
  //   let records = await models.Shop.find({name: Like(`%${likeStr}%`) })

  //   expect(records).toHaveLength(1)
  //   expect(records).toEqual( expect.arrayContaining(
  //     expectedShops.map( s => expect.objectContaining(s))
  //   ))
  // })

  // test('Query by object filter - Or Case', async () => {
  //   let id = 2, name = 'Shop 4'
  //   let records = await models.Shop.find({
  //     filter: Or(
  //       {id},
  //       {name}
  //     )
  //   })
  //   expect(records).toHaveLength(2)
  //   expect(records).toEqual( expect.arrayContaining(
  //     shopData.filter(s => s.id === id || s.name === name).map( s => expect.objectContaining(s))
  //   ))

  //   let records2 = await models.Shop.find({
  //     filter: [
  //       {id},
  //       {name}
  //     ]
  //   })
  //   expect(records2).toHaveLength(2)
  //   expect(records2).toEqual( expect.arrayContaining(
  //     shopData.filter(s => s.id === id || s.name === name).map( s => expect.objectContaining(s))
  //   ))

  // })


  // test('Query by object filter - And Case', async () => {
  //   let id = 2, name = 'Shop 4'
  //   let records = await models.Shop.find({
  //     filter: And(
  //       {id},
  //       {name}
  //     )
  //   })

  //   expect(records).toHaveLength(0)

  //   let records2 = await models.Shop.find({
  //     filter: [
  //       And({id: 2}, {name: 'Shop 2'}),
  //       And({id: 4}, {name: 'Shop 4'})
  //     ]
  //   })
  //   const expectedShopData = shopData.filter(s => [2,4].includes(s.id) )
  //   expect(records2).toHaveLength(expectedShopData.length)
  //   expect(records2).toEqual( expect.arrayContaining(
  //     expectedShopData.map( s => expect.objectContaining(s))
  //   ))

  // })

  // test('Filter by Computed Field', async () => {
  //   let records = await models.Shop.find({
  //     hasTwoProductsAndlocationHasLetterA: true
  //   })

  //   const expectedShopData = shopData.filter(s => productData.filter(p => p.shopId === s.id).length === 2 && s.location?.includes('a') )
  //   expect(records).toHaveLength(expectedShopData.length)
  //   expect(records).toEqual( expect.arrayContaining(
  //     expectedShopData.map( s => expect.objectContaining(s))
  //   ))

  // })

  
})