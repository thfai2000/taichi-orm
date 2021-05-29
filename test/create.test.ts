import {run, select, raw, configure, Schema, Entity, Types, models, getKnexInstance} from '../dist/'
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

describe('Test Create', () => {

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
    let x = models.Shop.create(shopData)
    // console.log('xxxxx', await x.toSQLString())
    let records = await x
    expect(records).toEqual(shopData.map(shop => expect.objectContaining({
      ...shop
    })))
  })

})

