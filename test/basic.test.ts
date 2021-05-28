import {run, select, raw, configure, Schema, Entity, Types, models, getKnexInstance} from '../dist/'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('location', Types.String(255))
      }
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
          schema.prop('name', Types.String(255, true))
          schema.prop('isActive', Types.Boolean(true))
          schema.prop('price', Types.Decimal(5, 2, true))
          schema.prop('createdAt', Types.Date(true))
          schema.prop('shopId', Types.Number(true))
      }
    }

    class StrictProduct extends Entity{
    
      static register(schema: Schema){
          schema.prop('name', Types.String(255, false))
          schema.prop('isActive', Types.Boolean(false))
          schema.prop('price', Types.Decimal(5, 2, false))
          schema.prop('createdAt', Types.Date(false))
          schema.prop('shopId', Types.Number(false))
      }
    }


    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop, Product, StrictProduct},
        createModels: true,
        entityNameToTableName: (className: string) => tablePrefix + snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config
    })

    // console.log("sql", sql)
    // console.log('xxxxx', await getKnexInstance().raw('SELECT * FROM sqlite_master WHERE type=\'table\';') )
}

const clearDatabase = () => {

}

beforeEach( async () => {
    await initializeDatabase();
});

afterEach(() => {
    return clearDatabase();
});

describe('Basic Read and Write', () => {

  test('Create and Find Shop', async () => {
    let expectedShop1 = {
      id: 1,
      location: 'Shatin'
    }
    let shop1 = await models.Shop.createOne({
      ...expectedShop1,
      id: undefined
    })
    expect(shop1).toMatchObject(expectedShop1)

    let expectedShop2 = {
      id: 2,
      location: 'Yuen Long'
    }
    let shop2 = await models.Shop.createOne({
      ...expectedShop2,
      id: undefined
    })
    expect(shop2).toMatchObject(expectedShop2)
 
    let expectedProduct1 = {
      id: 1,
      name: 'Product 1',
      shopId: shop1.id
    }
    let product1 = await models.Product.createOne({
      ...expectedProduct1,
      id: undefined
    })

    expect(product1).toMatchObject(expectedProduct1)

    let expectedProduct2 = {
      id: 2,
      name: 'Product 2',
      shopId: shop1.id
    }
    let product2 = await models.Product.createOne({
      ...expectedProduct2,
      id: undefined
    })

    expect(product2).toMatchObject(expectedProduct2)

    let expectedProduct3 = {
      id: 3,
      name: 'Product 3',
      shopId: shop2.id
    }
    let product3 = await models.Product.createOne({
      ...expectedProduct3,
      id: undefined
    })

    expect(product3).toMatchObject(expectedProduct3)

    let foundShop1ById = await models.Shop.findOne( (stmt, s) => stmt.where(s({id: shop1.id})))
    let foundShop1ByLocation = await models.Shop.findOne( (stmt, s) => stmt.where(s({location: expectedShop1.location})))

    expect(foundShop1ById).toMatchObject(foundShop1ByLocation)
    expect(foundShop1ById).toMatchObject(expectedShop1)

    let foundShop2ById = await models.Shop.findOne( (stmt, s) => stmt.where(s({id: shop2.id})))
    expect(foundShop2ById).toMatchObject(expectedShop2)

    let foundShopNotExists =  await models.Shop.findOne( (stmt, s) => stmt.where(s({id: 100000})))
    expect(foundShopNotExists).toBeNull()

    let foundAllShop = await models.Shop.find()
    expect(foundAllShop).toEqual( expect.arrayContaining([expectedShop1, expectedShop2]))

    let foundProductsByShopId1 = await models.Product.find( (stmt, s) => stmt.where(s({shopId: shop1.id})) )
    expect(foundProductsByShopId1).toEqual( 
      expect.arrayContaining([
        expect.objectContaining(expectedProduct1), 
        expect.objectContaining(expectedProduct2)
      ])
    )

    let foundProductsByShopId2 = await models.Product.find( (stmt, s) => stmt.where(s({shopId: shop2.id})) )
    expect(foundProductsByShopId2).toEqual( expect.arrayContaining([expect.objectContaining(expectedProduct3)]) )

  });

})


describe('Type Parsing', () => {

  test('Parsing Value', async () => {
    let expectedProduct1 = {
      id: 1,
      name: 'My Product',
      isActive: true,
      price: 10002.05,
      createdAt: new Date(),
      shopId: 2
    }
    let product1 = await models.Product.createOne({
      ...expectedProduct1
    })

    expect(product1).toStrictEqual(expect.objectContaining(expectedProduct1))
  })


  test('Parsing Null', async () => {

    let expectedProduct2 = {
      id: 2,
      name: null,
      isActive: null,
      price: null,
      createdAt: null,
      shopId: null
    }
    let product2 = await models.Product.createOne({
      ...expectedProduct2
    })

    expect(product2).toStrictEqual(expect.objectContaining(expectedProduct2))

  })

  // TODO: not null checking: set null if the property cannot be null
  // TODO: test default value it null during creation

})

