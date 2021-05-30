import {run, select, raw, configure, Schema, Entity, Types, Relations, models} from '../dist'
import {snakeCase, omit} from 'lodash'
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
  { id: 4, name: 'Product 2b', shopId: 2}
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
        schema.prop('name', Types.String(100))
        schema.prop('location', Types.String(255))
        schema.computedProp('products', Types.Array(Product), Relations.has(Product, 'shopId') )
        schema.computedProp('productCount', Types.Number(),  (shop, applyFilters) => {
            let p = Product.selector()
            return applyFilters( select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop._.id, p._.shopId])), p) 
        })
      }
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
        schema.prop('name', Types.String(255, true))
        schema.prop('createdAt', Types.DateTime(6, true))
        schema.prop('shopId', Types.Number())
        // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
        schema.computedProp('shop', Types.Object(Shop), Relations.belongsTo(Shop, 'shopId') )

        schema.computedProp('colors', 
          Types.Array(Color), 
          Relations.relateThrough(Color, ProductColor, 'colorId', 'productId') 
        )
        
        schema.computedProp('mainColor', 
          Types.Object(Color), 
          Relations.relateThrough(Color, ProductColor, 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
            return stmt.andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
          })
        )
      }
    }
    
    class Color extends Entity{
      static register(schema: Schema){
        schema.prop('code', Types.String(50))
      }
    }

    class ProductColor extends Entity{
      static register(schema: Schema){
        schema.prop('productId', Types.Number(false))
        schema.prop('colorId', Types.Number(false))
        schema.prop('type', Types.String(50, false))
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

beforeEach( async () => {
    await initializeDatabase();
});

afterEach(() => {
    return clearDatabase();
});

describe('Using with Knex', () => {

  test('Query with limit', async () => {
    let limit = 2
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.where(root.pk, '>', 2).limit(limit)
    })
    expect(records).toHaveLength(limit)
    // expect(records).toBe(expect.)
  });

})

describe('Computed Fields using Standard Relations', () => {
  test('Query computed fields - has', async () => {
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.select('*', root.$.products())
    })
    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop,
      products: productData.filter(product => product.shopId === shop.id).map(product => expect.objectContaining(product))
    })))
  });

  test('Query computed fields - belongsTo', async () => {
    let records = await models.Product.find( (stmt, root) => {
        return stmt.select('*', root.$.shop())
    })
    expect(records).toHaveLength(productData.length)
    expect(records).toEqual(productData.map(product => expect.objectContaining({
      ...product,
      shop: expect.objectContaining(
        shopData.find(shop => product.shopId === shop.id)
      )
    })))
  });

  test('Query computed fields - hasThrough + multiple level', async () => {
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.select('*', root.$.products( (stmt, p) => {
          return stmt.select('*', p.$.colors(), p.$.mainColor() )
        }))
    })
    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop,
      products:
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
    })))

  });

})


describe('custom Computed Fields', () => {

  test('Query computed field', async () => {
    let record = await models.Shop.findOne( (stmt, root) => {
        return stmt.select('*', root.$.productCount()).where(root.pk, '=', 2)
    })
    expect(record.productCount).toBe(2)
  });

})





