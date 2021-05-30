import {run, select, raw, startTransaction, configure, Schema, Entity, Types, models, getKnexInstance} from '../dist/'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('name', Types.String(255, true))
          schema.prop('location', Types.String(255, false))
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

describe('Test Create - No transaction', () => {

  test('Create One', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await models.Shop.createOne(shopData)
    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))
  })


  test('Create Many', async () => {
    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    let records = await models.Shop.create(shopData)
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))
  })

})

describe('Test Create - with transaction', () => {

  test('Create One - Success', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await startTransaction( async(trx) => {
      let record = await models.Shop.createOne(shopData).usingConnection(trx)
      return record
    })

    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))
    
    // try to find it again, to prove it is committed
    let found = await models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
    expect(found).toEqual( expect.objectContaining({
      ...shopData
    }))

  })

  test('Create One - Fail', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    let errorMessage = 'It is failed.'
    
    const t = async() => await startTransaction( async(trx) => {
      let record = await models.Shop.createOne(shopData).usingConnection(trx)
      expect(record).toEqual( expect.objectContaining({
        ...shopData
      }))
      let found = await models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) ).usingConnection(trx)
      expect(found).toEqual( expect.objectContaining({
        ...shopData
      }))
      throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)
    // try to find it again, to prove it is committed
    let found = await models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
    expect(found).toBeNull()
  })

  test('Create Many - Success', async () => {
    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]
    let records = await startTransaction( async(trx) => {
      return await models.Shop.create(shopData).usingConnection(trx)
    })

    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))
    // try to find it again, to prove it is committed
    let found = await models.Shop.find()
    expect(found).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))

  })

  test('Create Many - Fail', async () => {
    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]
    let errorMessage = 'It is failed.'

    let t = async() => await startTransaction( async(trx) => {
      let records = await models.Shop.create(shopData).usingConnection(trx)
      expect(records).toEqual(shopData.map(shop => expect.objectContaining({
        ...shop
      })))
      // find again
      let found = await models.Shop.find().usingConnection(trx)
      expect(found).toEqual(shopData.map(shop => expect.objectContaining({
        ...shop
      })))
      throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)

    // try to find it again, to prove it is rollback
    let found = await models.Shop.find()
    expect(found).toEqual([])
    
  })

})

