import {Model} from '../dist/'
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
      } from '../dist/'


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

afterAll( async () => {
  await orm.shutdown()
})

describe('Test Update - No transaction', () => {

  test('Update One', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.repos

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    let newLocation = 'Yuen Long'
    let findId = 5

    let expectedShopData = shopData = shopData.map(s => {
      return {
        ...s,
        location: s.id === findId? newLocation: s.location
      }
    })

    await Shop.createEach(shopData)
    let record2 = await Shop.updateOne({location: newLocation}, {
        id: findId
    })
    
    expect(record2).toEqual( expect.objectContaining({
      ...shopData.find(s => s.id === findId),
      location: newLocation
    }))

    //try to find it again, to prove it is commit
    let found = await Shop.find()
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Update One - Not found', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.repos

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    await Shop.createEach(shopData)

    let t = async() => await Shop.updateOne({location: 'Nowhere'}, {
        id: 10
    })
    
    await expect(t()).rejects.toThrow('getAffectedOne finds Zero or Many Rows')

  })

  test('Update Many', async () => {
    let ctx = orm.getContext({tablePrefix: tablePrefix()})
    await ctx.createModels()
    let {Shop, Product} = ctx.repos

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    let newLocation = 'Yuen Long'
    let findLocation = 'Tsuen Wan'
    
    let expectedShopData = shopData = shopData.map(s => {
      return {
        ...s,
        location: s.location === findLocation? newLocation: s.location
      }
    })

    await Shop.createEach(shopData)


    let updated = await Shop.update({location: newLocation}, {
        location: findLocation
    })

    expect(updated).toEqual(shopData.filter(s => s.location === findLocation).map(shop => expect.objectContaining({
      ...shop,
      location: newLocation
    })))

    // try to find it again, to prove it is committed
    let found = await Shop.find()
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  //TODO: update One but found more than one record, throw error

})

//TODO: update with transaction


