import {configure, Schema, Entity, Types, Builtin, models, raw, column, Selector} from '../dist'
import {And, Contain, Like, Equal, NotEqual, Or, IsNotNull, IsNull, Not} from '../dist/Operator'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'
import { Knex } from 'knex'

let shopData = [
  { id: 1, name: 'Shop 1', location: 'Shatin'},
  { id: 2, name: 'Shop 2', location: 'Yuen Long'},
  { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
  { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
  { id: 5, name: 'Shop 5', location: 'Tsuen Wan'},
  { id: 6, name: 'Shop 6', location: null}
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
        schema.prop('name', Types.String({length: 255}))
        schema.prop('location', Types.String({length: 255}))
        schema.prop('products', Types.ArrayOf(Types.ObjectOf('Product', {
          compute: Builtin.ComputeFn.relatedFrom('Product', 'shopId')
        }) ) )
        schema.prop('productCount', Types.Number({
          compute: (shop) => {
            // let p = Product.selector()
            // return applyFilters( builder().select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop._.id, p._.shopId])), p) 
            return shop.$.products().count()
          }
        }))
        schema.prop('hasProducts', Types.Boolean({
          compute: (shop) => {
            return shop.$.products().exists()
          }
        }))
        schema.prop('hasNoProducts', Types.Boolean({
          compute: (shop) => {
            return shop.$.products().exists().is('=', false)
          }
        }))
        schema.prop('hasOver2Products', Types.Boolean({
          compute: (shop) => {
            return shop.$.productCount().is('>', 2)
          }
        }))
        schema.prop('hasProductsAsync', Types.Boolean({
          compute: async (shop) => {
            return await shop.$.products().exists()
          }
        }))
        schema.prop('hasEnoughProducts', Types.Boolean({
          compute: (shop, args) => {
            return shop.$.productCount().is('>=', args.count)
          }
        }))

        schema.prop('hasTwoProductsAndlocationHasLetterA', Types.Boolean({
          compute: (shop, args) => {
            return shop({
              location: Like('%a%'),
              productCount: 2
            })
          }
        }))

      }
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
        schema.prop('name', Types.String({length: 255}))
        schema.prop('createdAt', Types.DateTime({precision: 6}))
        schema.prop('shopId', Types.Number())
        // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
        schema.prop('shop', Types.ObjectOf('Shop', {
          compute: Builtin.ComputeFn.relatesTo('Shop', 'shopId')
        }))

        schema.prop('colors', 
          Types.ArrayOf(Types.ObjectOf('Color', {
            compute: Builtin.ComputeFn.relatesThrough('Color', 'ProductColor', 'colorId', 'productId') 
          }))
        )
        
        schema.prop('mainColor', 
          Types.ObjectOf('Color', {
            compute: Builtin.ComputeFn.relatesThrough('Color', 'ProductColor', 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
              return stmt.toQueryBuilder().andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
            })
          })
        )
      }
    }
    
    class Color extends Entity{
      static register(schema: Schema){
        schema.prop('code', Types.String({
          nullable: false,
          length: 50
        }))
      }
    }

    class ProductColor extends Entity{
      static register(schema: Schema){
        schema.prop('productId', Types.Number({nullable: false}))
        schema.prop('colorId', Types.Number({nullable: false}))
        schema.prop('type', Types.String({nullable: false, length: 50}))
      }
    }


    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop, Product, Color, ProductColor},
        createModels: true,
        enableUuid: config.client.startsWith('sqlite'),
        entityNameToTableName: (className: string) => snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config,
        globalContext: {
          tablePrefix
        }
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



describe('Select - Simple Query', () => {

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
    let records = await models.Shop.find( function(stmt, root){
        return stmt.toQueryBuilder().where(root.pk, '>', 2).limit(limit)
    })

    expect(records).toHaveLength(limit)
  });

})

describe('Select - Computed Fields using Standard Relations', () => {
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

describe('Select - Custom Computed Fields', () => {

  test('Query computed field', async () => {
    let id = 2
    let record = await models.Shop.findOne( (stmt, root) => {
        return stmt.select(root.$.productCount()).toQueryBuilder().where(root.pk, '=', id)
    })
    expect(record.productCount).toBe( productData.filter(p => p.shopId === id).length)

  });

})


describe('Select - Mixed Query', () => {

  // test("Standard", async() => {
  //   const time = '2020-01-01 12:20:01'

  //   let records = await models.Shop.find({
  //     select: {
  //       'productCount': true, 
  //       'products': {select: ['colors']} , 
  //       'currentTime': Types.DateTime({ compute: s => column(raw(`'${time}'`)) })
  //     },
  //   })

  //   expect(records).toEqual( expect.arrayContaining(
  //     shopData.map( shop => expect.objectContaining({
  //         ...shop,
  //         products: expect.arrayContaining(
  //           productData.filter(p => p.shopId === shop.id).map( p => expect.objectContaining( {
  //             ...p,
  //             colors: expect.arrayContaining( productColorData.filter(pc => pc.productId === p.id)
  //               .map( pc => expect.objectContaining( colorData.find(c => c.id === pc.colorId))) )
  //           }))
  //         ),
  //         productCount: productData.filter(p => p.shopId === shop.id).length,
  //         currentTime: new Date(time)
  //       })
  //     )
  //   ))

  // })

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


describe('Select - Use Query Arguments', () => {

  test('Use Query Arguments', async () => {
    let expectedCount = 3
    let records = await models.Shop.find({
      select: {
        'products': true,
        'hasEnoughProducts': { 
          args: {count : expectedCount}
        }
      }
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

describe('Where - Operators', () => {

  test('Query by object filter - Equal and IsNull', async () => {
    let id = 2
    let records = await models.Shop.find({id: Equal(id)})

    expect(records).toHaveLength(1)
    expect(records).toEqual( expect.arrayContaining(
      shopData.filter(s => s.id === id).map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - IsNull', async () => {

    let records = await models.Shop.find({location: IsNull()})
    let records2 = await models.Shop.find({location: null})

    const expected = shopData.filter(s => s.location === null)

    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))

    expect(records2).toHaveLength(expected.length)
    expect(records2).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - IsNotNull', async () => {
    let records = await models.Shop.find({location: IsNotNull()})
    const expected = shopData.filter(s => s.location !== null)
    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Not Equal', async () => {
    let id = 2
    let records = await models.Shop.find({id: NotEqual(id)})
    const expected = shopData.filter(s => s.id !== id)
    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Not', async () => {
    let records = await models.Shop.find({where: Not({
      location: 'Tsuen Wan',
      name: 'Shop 4'
    })})

    const expected = shopData.filter(s => !(s.location === 'Tsuen Wan' && s.name === 'Shop 4') )
    expect(records).toHaveLength(expected.length)
    expect(records).toEqual( expect.arrayContaining(
      expected.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Contain', async () => {
    let ids = [2,4,100]
    let expectedShops = shopData.filter(s => ids.includes(s.id) )
    let records = await models.Shop.find({id: ids})

    expect(records).toHaveLength(expectedShops.length)
    expect(records).toEqual( expect.arrayContaining(
      expectedShops.map( s => expect.objectContaining(s))
    ))
    
    let records2 = await models.Shop.find({id: Contain(...ids)})
    expect(records2).toHaveLength(expectedShops.length)
    expect(records2).toEqual( expect.arrayContaining(
      expectedShops.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Like', async () => {
    const likeStr = '2'
    let expectedShops = shopData.filter( s => s.name.includes(likeStr))
    let records = await models.Shop.find({name: Like(`%${likeStr}%`) })

    expect(records).toHaveLength(1)
    expect(records).toEqual( expect.arrayContaining(
      expectedShops.map( s => expect.objectContaining(s))
    ))
  })

  test('Query by object filter - Or Case', async () => {
    let id = 2, name = 'Shop 4'
    let records = await models.Shop.find({
      where: Or(
        {id},
        {name}
      )
    })
    expect(records).toHaveLength(2)
    expect(records).toEqual( expect.arrayContaining(
      shopData.filter(s => s.id === id || s.name === name).map( s => expect.objectContaining(s))
    ))

    let records2 = await models.Shop.find({
      where: [
        {id},
        {name}
      ]
    })
    expect(records2).toHaveLength(2)
    expect(records2).toEqual( expect.arrayContaining(
      shopData.filter(s => s.id === id || s.name === name).map( s => expect.objectContaining(s))
    ))

  })


  test('Query by object filter - And Case', async () => {
    let id = 2, name = 'Shop 4'
    let records = await models.Shop.find({
      where: And(
        {id},
        {name}
      )
    })

    expect(records).toHaveLength(0)

    let records2 = await models.Shop.find({
      where: [
        And({id: 2}, {name: 'Shop 2'}),
        And({id: 4}, {name: 'Shop 4'})
      ]
    })
    const expectedShopData = shopData.filter(s => [2,4].includes(s.id) )
    expect(records2).toHaveLength(expectedShopData.length)
    expect(records2).toEqual( expect.arrayContaining(
      expectedShopData.map( s => expect.objectContaining(s))
    ))

  })


  test('Filter by Computed Field', async () => {
    let records = await models.Shop.find({
      hasTwoProductsAndlocationHasLetterA: true
    })

    const expectedShopData = shopData.filter(s => productData.filter(p => p.shopId === s.id).length === 2 && s.location?.includes('a') )
    expect(records).toHaveLength(expectedShopData.length)
    expect(records).toEqual( expect.arrayContaining(
      expectedShopData.map( s => expect.objectContaining(s))
    ))

  })

  
})