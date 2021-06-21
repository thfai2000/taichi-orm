import {configure, Schema, Entity, Types, Builtin, models, raw, column, Selector} from '../dist'
import {And, Contain, Like, Equal, NotEqual, Or, IsNotNull, IsNull, Not} from '../dist/Operator'
import {relationProp} from '../dist/Common'
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
        schema.prop('name', new Types.String({length: 255}))
        schema.prop('location', new Types.String({length: 255}))
        relationProp(schema, 'products').hasMany('Product', 'shopId')
        
        schema.prop('productCount', new Types.Number({
          compute: (shop) => {
            return shop.$.products().count()
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
        relationProp(schema, 'shop').belongsTo('Shop', 'shopId')

        relationProp(schema, 'productColors').ownMany('ProductColor', 'productId')

        relationProp(schema, 'colors').hasManyThrough('Color', 'ProductColor', 'colorId', 'productId')

        relationProp(schema, 'mainColor').hasManyThrough('Color', 'ProductColor', 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
            return stmt.andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
        })
        
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
        schema.prop('type', new Types.String({nullable: false, length: 50}))
        schema.prop('productId', new Types.Number({nullable: false}))
        
        schema.prop('colorId', new Types.Number({nullable: false}))
        relationProp(schema, 'color').belongsTo('Color', 'colorId')
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


describe('relations', () => {
    test('Create by OwnedMany + hasMany', async () => {

      let expectedData = [
        {id: 30, name: 'Product X1', productColors: [{type: 'main', color: 1}, {type: 'second', color: 2}]},
        {id: 31, name: 'Product X2', productColors: [{type: 'main', color: 3}, {type: 'second', color: 4}]}
      ]

      const createdProducts = await models.Product.createEach(
        await Promise.all(
          expectedData.map( async(d) => ({...d, productColors: 
              await Promise.all(d.productColors.map(
                async(pc) => ({...pc, color: await models.Color.findOne({id: pc.color}) })
              ))
            })
          )
        )
      )

      expect(createdProducts).toHaveLength(expectedData.length)
      expect(createdProducts).toEqual( expect.arrayContaining(
        expectedData.map(d => expect.objectContaining({
                ...d,
                productColors: expect.arrayContaining(d.productColors.map( pc => 
                  expect.objectContaining({
                    ...pc,
                    productId: d.id,
                    colorId: pc.color,
                    color: expect.objectContaining( colorData.find(d => d.id === pc.color) )
                  })
                ))
              })
          )
        )
      )

      // console.log('xxxxx', createdProducts)

      // const createdShop = await models.Shop.createOne({
      //   name: 'Shop X',
      //   location: 'Kowloon',
      //   products: [createdProducts]
      // })



    })
})