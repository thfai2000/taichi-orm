import {builder, raw, configure, Schema, Entity, Types, models, globalContext} from '../dist/'
import {snakeCase, omit} from 'lodash'
import {v4 as uuidv4} from 'uuid'
// import {clearSysFields} from './util'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('location', new Types.String({nullable: false, length: 255}))
      }
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
          schema.prop('name', new Types.String({nullable: true, length: 255}))
          schema.prop('isActive', new Types.Boolean())
          schema.prop('price', new Types.Decimal({precision: 7, scale: 2}))
          schema.prop('createdAt', new Types.DateTime({precision: 6}))
          schema.prop('shopId', new Types.Number())
      }
    }



    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop, Product},
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

// test('test jest', () => {
//   expect([1,2,3]).toEqual([1,3,2]);

// })

describe('Test Context Usage', () => {
  test('Create and Find Shop', async () => {

    let expectedShop1 = {
        id: 1,
        location: 'Shatin'
    }

    let shop1 = await globalContext.startTransaction( async(newContext) => {
        return await newContext.models.Shop.createOne({
            ...omit(expectedShop1, ['id'])
        })
    })
    expect(shop1).toMatchObject(expect.objectContaining(expectedShop1))

    let shop2 = await globalContext.models.Shop.findOne({id: shop1.id})

    expect(shop2).toMatchObject(expect.objectContaining(expectedShop1))

  });

})