import {builder, raw, configure, Schema, Entity, Types, models, globalContext} from '../dist/'
import {snakeCase, omit} from 'lodash'
import {v4 as uuidv4} from 'uuid'
// const itif = (condition:boolean) => condition ? it : it.skip;
// import {clearSysFields} from './util'

// @ts-ignore
let config = JSON.parse(process.env.ENVIRONMENT)

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('name', new Types.String({nullable: true, length: 255}))
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

    await configure({
        models: {Shop, Product},
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

describe('Test Context Usage', () => {

  test('Create One - Success', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let record = await globalContext.withTransaction( async(ctx) => {
      let record = await ctx.models.Shop.createOne(shopData)
      return record
    })

    expect(record).toEqual( expect.objectContaining({
      ...shopData
    }))

    // try to find it again, to prove it is committed
    let found = await globalContext.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
    expect(found).toEqual( expect.objectContaining({
      ...shopData
    }))

  })

  test('Create One - Fail', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    let errorMessage = 'It is failed.'

    const t = async() => await globalContext.withTransaction( async(ctx) => {
    let record = await ctx.models.Shop.createOne(shopData)
    expect(record).toEqual( expect.objectContaining({
        ...shopData
    }))
    let found = await ctx.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
    expect(found).toEqual( expect.objectContaining({
        ...shopData
    }))
    throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)

    // try to find it again, to prove it is committed
    let found = await globalContext.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
    expect(found).toBeNull()
  })

  if(!config.client.startsWith('sqlite')){

      test('nested transactions', async() => {
        let shopData = 
          { id: 5, name: 'Shop 5', location: 'Shatin'}
        
        let record = await globalContext.withTransaction( async(ctx) => {
            let record = await ctx.models.Shop.createOne(shopData)
    
            let anotherShopData = { id: 6, name: 'Shop 6', location: 'Shatin'}
            let errorMessage = 'It is failed.'
    
            const t = async() => await ctx.withNewTransaction( async(ctx) => {
                let record = await ctx.models.Shop.createOne(anotherShopData)
                expect(record).toEqual( expect.objectContaining({
                    ...anotherShopData
                }))
                let found = await ctx.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', anotherShopData.id) )
                expect(found).toEqual( expect.objectContaining({
                    ...anotherShopData
                }))
                throw new Error(errorMessage)
            })
            await expect(t()).rejects.toThrow(errorMessage)

            // try to find it again, to prove it is committed
            let found = await ctx.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', anotherShopData.id) )

            expect(found).toBeNull()
            return record
        })
    
        expect(record).toEqual( expect.objectContaining({
          ...shopData
        }))
    
        // try to find it again, to prove it is committed
        let found = await globalContext.models.Shop.findOne( (stmt, s) => stmt.where(s.pk, '=', shopData.id) )
        expect(found).toEqual( expect.objectContaining({
          ...shopData
        }))
      })
  }

})