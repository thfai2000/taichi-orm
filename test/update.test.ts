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

describe('Test Create - No transaction', () => {

  test('Update One', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await models.Shop.createOne(shopData)
    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))

    let record2 = await models.Shop.updateOne({location: 'Yuen Long'}, {
        id: 5
    })
    
    expect(record2).toEqual( expect.objectContaining({
      ...shopData,
      location: 'Yuen Long'
    }))




  })


})


