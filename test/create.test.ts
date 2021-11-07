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
  name =this.field(StringNotNullType)
  location = this.field(new StringNotNullType({length:255}))
  products = Shop.hasMany(Product, 'shopId')
}

class Product extends Model{
  id= this.field(PrimaryKeyType)
  name = this.field(StringType)
  isActive = this.field(BooleanType)
  price = this.field(new DecimalType({precision: 7, scale: 2}))
  createdAt = this.field(new DateTimeType({precision: 6}))
  shopId = this.field(NumberType)
  shop = Product.belongsTo(Shop, 'shopId')
}

// @ts-ignore
let config = JSON.parse(process.env.ENVIRONMENT)

let orm = new ORM({
  models: {Shop, Product},
  entityNameToTableName: (className: string) => snakeCase(className),
  propNameTofieldName: (propName: string) => snakeCase(propName),
  knexConfig: config
})
let tablePrefix = () => `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`



describe('Test Create - No transaction', () => {

  test('Create One', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models


    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await Shop.createOne(shopData)
    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))

    //try to find it again, to prove it can get it
    let found = await Shop.findOne({where: {id: 5}})
    expect(found).toEqual( expect.objectContaining({
      ...shopData
    }))
  })


  test('Create Many', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    let records = await Shop.createEach(shopData)
    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))

    //try to find it again, to prove it can get it
    let found = await Shop.find()
    expect(found).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))

  })

})

describe('Test Create - with transaction', () => {

  test('Create One - Success', async () => {

    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models


    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await ctx.startTransaction( async(trx) => {
      let record = await Shop.createOne(shopData).usingConnection(trx)
      return record
    })

    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))

    // try to find it again, to prove it is committed
    let found = await Shop.findOne({where: {id: shopData.id}})
    expect(found).toEqual( expect.objectContaining({
      ...shopData
    }))

  })

  test('Create One - Fail', async () => {

    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models

    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    let errorMessage = 'It is failed.'
    
    const t = async() => await ctx.startTransaction( async(trx) => {
      let record = await Shop.createOne(shopData).usingConnection(trx).onSqlRun(console.log)
      expect(record).toEqual( expect.objectContaining({
        ...shopData
      }))
      // console.log('xxxxx', await Shop.find().usingConnection(trx))
      let found = await Shop.findOne({
        where: {id: shopData.id}
      }).usingConnection(trx)
      expect(found).toEqual( expect.objectContaining({
        ...shopData
      }))
      throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)
    // try to find it again, to prove it is committed
    let found = await Shop.findOneOrNull({
        where: {id: shopData.id}
      })
    expect(found).toBeNull()
  })

  test('Create Many - Success', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]
    let records = await ctx.startTransaction( async(trx) => {
      return await Shop.createEach(shopData).usingConnection(trx)
    })

    expect(records).toHaveLength(shopData.length)
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))
    // try to find it again, to prove it is committed
    let found = await Shop.find()
    expect(found).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))

  })

  test('Create Many - Fail', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.models

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]
    let errorMessage = 'It is failed.'

    let t = async() => await ctx.startTransaction( async(trx) => {
      let records = await Shop.createEach(shopData).usingConnection(trx)
      expect(records).toEqual(shopData.map(shop => expect.objectContaining({
        ...shop
      })))
      // find again
      let found = await Shop.find().usingConnection(trx)
      expect(found).toEqual(shopData.map(shop => expect.objectContaining({
        ...shop
      })))
      throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)

    // try to find it again, to prove it is rollback
    let found = await Shop.find()
    expect(found).toEqual([])
    
  })

})

