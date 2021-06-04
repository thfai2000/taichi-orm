import {builder, raw, startTransaction, configure, Schema, Entity, Types, models} from '../dist/'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('name', new Types.String(true, 255))
          schema.prop('location', new Types.String(false, 255))
      }
    }

    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop},
        createModels: true,
        enableUuid: config.client.startsWith('sqlite'),
        entityNameToTableName: (className: string) => tablePrefix + snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config
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

describe('Test Update - No transaction', () => {

  test('Update One', async () => {

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

    await models.Shop.create(shopData)
    let record2 = await models.Shop.updateOne({location: newLocation}, {
        id: findId
    })
    
    expect(record2).toEqual( expect.objectContaining({
      ...shopData.find(s => s.id === findId),
      location: newLocation
    }))

    //try to find it again, to prove it is commit
    let found = await models.Shop.find()
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Update One - Not found', async () => {

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    await models.Shop.create(shopData)
    let record = await models.Shop.updateOne({location: 'Nowhere'}, {
        id: 10
    })
    
    expect(record).toEqual(null)

    //try to find it again, to prove it is commit
    // try to find it again, to prove it is committed
    let found = await models.Shop.find()
    expect(found).toEqual(expect.arrayContaining(shopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  test('Update Many', async () => {
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

    await models.Shop.create(shopData)


    let updated = await models.Shop.update({location: newLocation}, {
        location: findLocation
    })

    expect(updated).toEqual(shopData.filter(s => s.location === findLocation).map(shop => expect.objectContaining({
      ...shop,
      location: newLocation
    })))

    // try to find it again, to prove it is committed
    let found = await models.Shop.find()
    expect(found).toEqual(expect.arrayContaining(expectedShopData.map(shop => expect.objectContaining({
      ...shop
    }))))

  })

  //TODO: update One but found more than one record, throw error
  //TODO: transaction update success updateOne
  //TODO: transaction update fail updateOne
  //TODO: transaction update success updateMany
  //TODO: transaction update fail updateMany

})


