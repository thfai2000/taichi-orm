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


describe('Test Delete - No transaction', () => {

  test('Delete One', async () => {
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

    let findId = 5
    let expectedShopData = shopData.filter(s => s.id !== findId)

    await Shop.createEach(shopData)
    let record2 = await Shop.deleteOne({
        id: findId
    })
    
    expect(record2).toEqual( expect.objectContaining({
      ...shopData.find(s => s.id === findId)
    }))

    //try to find it again, to prove it is commit
    let found = await Shop.find()
    expect(found).toHaveLength(expectedShopData.length)
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Delete One - Not found', async () => {
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

    await Shop.createEach(shopData)
    expect( async() => await Shop.deleteOne({
        id: 10
    })).rejects.toThrow('getPreflightOne finds Zero or Many Rows')

    //try to find it again, to prove it is commit
    let found = await Shop.find()
    expect(found).toHaveLength(shopData.length)
    expect(found).toEqual(expect.arrayContaining(shopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Delete Many', async () => {
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

    // let newLocation = 'Yuen Long'
    let findLocation = 'Tsuen Wan'
    
    let expectedDeleted = shopData.filter(s => s.location === findLocation)
    let expectedRemaining = shopData.filter(s => s.location !== findLocation)

    await Shop.createEach(shopData)

    let deleted = await Shop.delete({
        location: findLocation
    })

    expect(deleted).toHaveLength(expectedDeleted.length)
    expect(deleted).toEqual(expectedDeleted.map(shop => expect.objectContaining({
      ...shop
    })))

    // try to find it again, to prove it is committed
    let found = await Shop.find()
    expect(found).toHaveLength(expectedRemaining.length)
    expect(found).toEqual(expect.arrayContaining(expectedRemaining.map(shop => expect.objectContaining({
      ...shop
    }))))

  })
  
  //TODO: delete One but found more than one record, throw error

})

//TODO: transaction again
