import {builder, raw, startTransaction, configure, Schema, Entity, Types, models} from '../dist'
import {findIndex, snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('name', Types.String({nullable: true, length: 255}))
          schema.prop('location', Types.String({nullable: false, length: 255}))
      }
    }

    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop},
        createModels: true,
        enableUuid: config.client.startsWith('sqlite'),
        entityNameToTableName: (className: string) => snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config,
        globalContext: {
          tablePrefix
        }
    })
}

const clearDatabase = () => {

}

beforeEach( async () => {
    await initializeDatabase();
});

afterEach(() => {
    return clearDatabase();
});

describe('Test Delete - No transaction', () => {

  test('Delete One', async () => {

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    let findId = 5

    let expectedShopData = shopData = shopData.filter(s => s.id !== findId)

    await models.Shop.createEach(shopData)
    let record2 = await models.Shop.deleteOne({}, {
        id: findId
    })
    
    expect(record2).toEqual( expect.objectContaining({
      ...shopData.find(s => s.id === findId)
    }))

    //try to find it again, to prove it is commit
    let found = await models.Shop.find()
    expect(found).toHaveLength(expectedShopData.length)
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Delete One - Not found', async () => {

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    await models.Shop.createEach(shopData)
    let record = await models.Shop.deleteOne({}, {
        id: 10
    })
    
    expect(record).toEqual(null)

    //try to find it again, to prove it is commit
    let found = await models.Shop.find()
    expect(found).toHaveLength(shopData.length)
    expect(found).toEqual(expect.arrayContaining(shopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Delete Many', async () => {
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

    await models.Shop.createEach(shopData)

    let deleted = await models.Shop.delete({}, {
        location: findLocation
    })

    expect(deleted).toHaveLength(expectedDeleted.length)
    expect(deleted).toEqual(expectedDeleted.map(shop => expect.objectContaining({
      ...shop
    })))

    // try to find it again, to prove it is committed
    let found = await models.Shop.find()
    expect(found).toHaveLength(expectedRemaining.length)
    expect(found).toEqual(expect.arrayContaining(expectedRemaining.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  //TODO: update One but found more than one record, throw error
  //TODO: transaction update success updateOne
  //TODO: transaction update fail updateOne
  //TODO: transaction update success updateMany
  //TODO: transaction update fail updateMany

})


