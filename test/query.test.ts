import {configure, Schema, Entity, Types, Relations, models, raw} from '../dist'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'
// import {clearSysFields} from './util'

let shopData = [
  { id: 1, name: 'Shop 1', location: 'Shatin'},
  { id: 2, name: 'Shop 2', location: 'Yuen Long'},
  { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
  { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
  { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
]

let productData = [
  { id: 1, name: 'Product 1a', shopId: 1},
  { id: 2, name: 'Product 1b', shopId: 1},
  { id: 3, name: 'Product 2a', shopId: 2},
  { id: 4, name: 'Product 2b', shopId: 2},
  { id: 5, name: 'Product 2b', shopId: 2}
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

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
        schema.prop('name', new Types.String({length: 255}))
        schema.prop('location', new Types.String({length: 255}))
        schema.prop('products', new Types.ArrayOf(new Types.ObjectOf(Product, {
          compute: Relations.has(Product, 'shopId')
        }) ) )
        schema.prop('productCount', new Types.Number({
          compute: (shop) => {
            // let p = Product.selector()
            // return applyFilters( builder().select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop._.id, p._.shopId])), p) 
            return shop.$.products().count()
          }
        }))
        schema.prop('hasProducts', new Types.Boolean({
          compute: (shop) => {
            return shop.$.products().exists()
          }
        }))
        schema.prop('hasNoProducts', new Types.Boolean({
          compute: (shop) => {
            return shop.$.products().exists().is('=', false)
          }
        }))
        schema.prop('hasOver2Products', new Types.Boolean({
          compute: (shop) => {
            return shop.$.productCount().is('>', 2)
          }
        }))
        schema.prop('hasProductsAsync', new Types.Boolean({
          compute: async (shop) => {
            return await shop.$.products().exists()
          }
        }))
        schema.prop('hasEnoughProducts', new Types.Boolean({
          compute: (shop, args) => {
            return shop.$.productCount().is('>=', args.count)
          }
        }))

      }
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
        schema.prop('name', new Types.String({length: 255}))
        schema.prop('createdAt', new Types.DateTime({precision: 6}))
        schema.prop('shopId', new Types.Number())
        // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
        schema.prop('shop', new Types.ObjectOf(Shop, {
          compute: Relations.belongsTo(Shop, 'shopId')
        }))

        schema.prop('colors', 
          new Types.ArrayOf(new Types.ObjectOf(Color, {
            compute: Relations.relateThrough(Color, ProductColor, 'colorId', 'productId') 
          }))
        )
        
        schema.prop('mainColor', 
          new Types.ObjectOf(Color, {
            compute: Relations.relateThrough(Color, ProductColor, 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
              return stmt.andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
            })
          })
        )
      }
    }
    
    class Color extends Entity{
      static register(schema: Schema){
        schema.prop('code', new Types.String({
          nullable: false,
          length: 50
        }))
      }
    }

    class ProductColor extends Entity{
      static register(schema: Schema){
        schema.prop('productId', new Types.Number({nullable: false}))
        schema.prop('colorId', new Types.Number({nullable: false}))
        schema.prop('type', new Types.String({nullable: false, length: 50}))
      }
    }


    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop, Product, Color, ProductColor},
        createModels: true,
        enableUuid: config.client.startsWith('sqlite'),
        entityNameToTableName: (className: string) => tablePrefix + snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config
    })

    await Promise.all(shopData.map( async(d) => {
      return await models.Shop.createOne(d)
    }))

    
    await Promise.all(productData.map( async(d) => {
      return await models.Product.createOne(d)
    }))


    await Promise.all(colorData.map( async(d) => {
      return await models.Color.createOne(d)
    }))

    await Promise.all(productColorData.map( async(d) => {
      return await models.ProductColor.createOne(d)
    }))
}

const clearDatabase = () => {

}

beforeAll( async () => {
    await initializeDatabase();
});

afterAll(() => {
    return clearDatabase();
});

describe('Simple Query', () => {

  test('Query by object filter', async () => {
    let id = 2
    let record = await models.Shop.findOne({id})

    expect(record).toEqual( expect.objectContaining(shopData.find(s => s.id === id)) )
  })

  test('Query by object filter + select computed fields', async () => {
    let id = 2
    let record = await models.Shop.findOne({
      select: ['products', 'productCount', 'hasProductsAsync'],
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

  test('Query with limit', async () => {
    let limit = 2
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.where(root.pk, '>', 2).limit(limit)
    })

    expect(records).toHaveLength(limit)
  });

})

describe('Computed Fields using Standard Relations', () => {
  test('Query computed fields - has', async () => {
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.select(root.$.products(), root.$.productCount(), root.$.hasProducts(), root.$.hasNoProducts(), root.$.hasOver2Products())
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
    let records = await models.Product.find( (stmt, root) => {
        return stmt.select(root.$.shop())
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
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.select(root.$.products( (stmt, p) => {
          return stmt.select(p.$.colors(), p.$.mainColor() )
        }))
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

describe('custom Computed Fields', () => {

  test('Query computed field', async () => {
    let id = 2
    let record = await models.Shop.findOne( (stmt, root) => {
        return stmt.select(root.$.productCount()).where(root.pk, '=', id)
    })
    expect(record.productCount).toBe( productData.filter(p => p.shopId === id).length)

  });

})


describe('Mixed Query', () => {

  test("Standard", async() => {
    const time = '2020-01-01 12:20:01'

    let records = await models.Shop.find({
      select: [
        'productCount', 
        {'products': {select: ['colors']} }, 
        {'currentTime': new Types.DateTime({ compute: s => raw(`'${time}'`) })} 
      ],
    })

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
          productCount: productData.filter(p => p.shopId === shop.id).length,
          currentTime: new Date(time)
        })
      )
    ))

  })

  test('Query computed field', async () => {

    let records = await models.Shop.find( (stmt, root) => 
      stmt.select(root.$.productCount(), root.$.products({
        select: ['colors']
      }))
    )

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
})


describe('Mixed Query', () => {

  test('Use Query Arguments', async () => {
    let expectedCount = 3
    let records = await models.Shop.find({
      select: [
        'products',
        {
          'hasEnoughProducts': { 
            args: {count : expectedCount}
          }
        }
      ]
    })

    expect(records).toEqual( expect.arrayContaining(
      shopData.map( shop => expect.objectContaining({
          ...shop,
          products: expect.arrayContaining(
            productData.filter(p => p.shopId === shop.id).map( p => expect.objectContaining( {
              ...p
            }))
          ),
          hasEnoughProducts: productData.filter(p => p.shopId === shop.id).length >= expectedCount
        })
      )
    ))

  })

})
