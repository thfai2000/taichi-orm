import {Model} from '../dist/model'
import {ORM} from '../dist'
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
      

class Shop extends Model {
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    location = this.field(new StringNotNullType({length:255}))
    products = Shop.hasMany(Product, 'shopId')
}

class Product extends Model{
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    isActive = this.field(BooleanType)
    price = this.field(new DecimalType({precision: 7, scale: 2}))
    createdAt = this.field(new DateTimeType({precision: 6}))
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId')
}

class StrictProduct extends Model{
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringNotNullType)
    isActive = this.field(BooleanNotNullType)
    price = this.field(new DecimalNotNullType({precision: 7, scale: 2}))
    createdAt = this.field(new DateTimeNotNullType({precision: 6}))
    shopId = this.field(NumberNotNullType)
}

// @ts-ignore
let config = JSON.parse(process.env.ENVIRONMENT)

let orm = new ORM({
    models: {Shop, Product, StrictProduct},
    enableUuid: true,
    entityNameToTableName: (className: string) => snakeCase(className),
    propNameTofieldName: (propName: string) => snakeCase(propName),
    knexConfig: config
})
let tablePrefix = () => `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`


describe('Basic Read and Write', () => {

  test('Create and Find Shop', async () => {

    let repo = orm.getContext({tablePrefix: tablePrefix()})
    await repo.createModels()
    let {Shop, Product} = repo.models

    let expectedShop1 = {
      id: 1,
      location: 'Shatin'
    }
    let shop1 = await Shop.createOne({
      ...omit(expectedShop1, ['id'])
    })
    expect(shop1).toMatchObject(expect.objectContaining(expectedShop1))

    let expectedShop2 = {
      id: 2,
      location: 'Yuen Long'
    }
    let shop2 = await Shop.createOne({
      ...omit(expectedShop2, ['id'])
    })
    expect(shop2).toMatchObject(expect.objectContaining(expectedShop2))
 
    let expectedProduct1 = {
      id: 1,
      name: 'Product 1',
      shopId: shop1.id
    }
    let product1 = await Product.createOne({
      ...omit(expectedProduct1, ['id'])
    })

    expect(product1).toMatchObject(expect.objectContaining(expectedProduct1))

    let expectedProduct2 = {
      id: 2,
      name: 'Product 2',
      shopId: shop1.id
    }
    let product2 = await Product.createOne({
      ...omit(expectedProduct2, ['id'])
    })

    expect(product2).toMatchObject(expect.objectContaining(expectedProduct2))

    let expectedProduct3 = {
      id: 3,
      name: 'Product 3',
      shopId: shop2.id
    }
    let product3 = await Product.createOne({
      ...omit(expectedProduct3, ['id'])
    })

    expect(product3).toMatchObject(expect.objectContaining(expectedProduct3))

    let foundShop1ById = await Shop.findOne({
      where: {id: shop1.id}
    })
    let foundShop1ByLocation = await Shop.findOne({
      where: {location: expectedShop1.location}
    })

    expect(foundShop1ById).toMatchObject(expect.objectContaining(foundShop1ByLocation))
    expect(foundShop1ById).toMatchObject(expect.objectContaining(expectedShop1))

    let foundShop2ById = await Shop.findOne({
      where: {id: shop2.id}
    })
    expect(foundShop2ById).toMatchObject(expect.objectContaining(expectedShop2))

    let foundShopNotExists = await Shop.findOne({
      where: {id: 100000}
    })
    expect(foundShopNotExists).toBeNull()

    let foundAllShop = await Shop.find()
    expect(foundAllShop).toEqual(
      [
        expect.objectContaining(expectedShop1), 
        expect.objectContaining(expectedShop2)
      ] 
    )

    let foundProductsByShopId1 = await Product.find({
      where: {shopId: shop1.id}
    })
    expect(foundProductsByShopId1).toEqual( 
      [
        expect.objectContaining(expectedProduct1), 
        expect.objectContaining(expectedProduct2)
      ]
    )
    let foundProductsByShopId2 = await Product.find({
      where: {shopId: shop2.id}
    })
    expect(foundProductsByShopId2).toEqual( [expect.objectContaining(expectedProduct3)] )

  });

})

describe('Type Parsing', () => {

  test('Parsing Value', async () => {

    let repo = orm.getContext({tablePrefix: tablePrefix()})
    await repo.createModels()
    let {Product} = repo.models

    let expectedProduct1 = {
      id: 1,
      name: 'My Product',
      isActive: true,
      price: 10002.05,
      createdAt: new Date(),
      shopId: 2
    }
    let product1 = await Product.createOne({
      ...expectedProduct1
    })

    expect(product1).toEqual(expect.objectContaining(expectedProduct1))
  })


  test('Parsing Null', async () => {

    let repo = orm.getContext({tablePrefix: tablePrefix()})
    await repo.createModels()
    let {Product} = repo.models

    let expectedProduct2 = {
      id: 2,
      name: null,
      isActive: null,
      price: null,
      createdAt: null,
      shopId: null
    }
    let product2 = await Product.createOne({
      ...expectedProduct2
    })

    expect(product2).toEqual(expect.objectContaining(expectedProduct2))

  })

  // TODO: not null checking: set null if the property cannot be null
  // TODO: test default value it null during creation
  // TODO: test over length of string

})

