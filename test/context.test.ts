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
  uuid = this.field(StringNotNullType)
  location = this.field(new StringNotNullType({length:255}))
  products = Shop.hasMany(Product, 'shopId')
}

class Product extends Model{
  id= this.field(PrimaryKeyType)
  uuid = this.field(StringNotNullType)
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
  enableUuid: true,
  entityNameToTableName: (className: string) => snakeCase(className),
  propNameTofieldName: (propName: string) => snakeCase(propName),
  knexConfig: config
})
let tablePrefix = () => `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`




describe('Test Context Usage', () => {

  test('Create One - Success', async () => {
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    
    let repo = orm.getContext({tablePrefix: tablePrefix()})
    await repo.createModels()
    let {Shop, Product} = repo.models

    let record = await  repo.startTransaction( async(ctx) => {
      let record = await Shop.createOne(shopData).usingConnectionIfAny(ctx)
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
    let shopData = 
      { id: 5, name: 'Shop 5', location: 'Shatin'}
    let errorMessage = 'It is failed.'

    let repo = orm.getContext({tablePrefix: tablePrefix()})
    await repo.createModels()
    let {Shop, Product} = repo.models


    const t = async() => await repo.startTransaction( async(ctx) => {
      let record = await Shop.createOne(shopData).usingConnectionIfAny(ctx)
      expect(record).toEqual( expect.objectContaining({
          ...shopData
      }))
        let found = await Shop.findOne({where: {id: shopData.id}}).usingConnectionIfAny(ctx)
      expect(found).toEqual( expect.objectContaining({
          ...shopData
      }))
      throw new Error(errorMessage)
    })

    await expect(t()).rejects.toThrow(errorMessage)

    // try to find it again, to prove it is committed
    let found = await Shop.findOne(({where: {id: shopData.id}}))
    expect(found).toBeNull()
  })

  if(!config.client.startsWith('sqlite')){

      test('nested transactions', async() => {
        let shopData = 
          { id: 5, name: 'Shop 5', location: 'Shatin'}
        
        let repo = orm.getContext({tablePrefix: tablePrefix()})
        await repo.createModels()
        let {Shop, Product} = repo.models
        
        let record = await repo.startTransaction( async(ctx) => {
            let record = await Shop.createOne(shopData).usingConnectionIfAny(ctx)
    
            let anotherShopData = { id: 6, name: 'Shop 6', location: 'Shatin'}
            let errorMessage = 'It is failed.'
    
            const t = async() => await repo.startTransaction( async(ctx) => {
                let record = await Shop.createOne(anotherShopData).usingConnectionIfAny(ctx)
                expect(record).toEqual( expect.objectContaining({
                    ...anotherShopData
                }))
              let found = await Shop.findOne({where: {id: anotherShopData.id}}).usingConnectionIfAny(ctx)
                expect(found).toEqual( expect.objectContaining({
                    ...anotherShopData
                }))
                throw new Error(errorMessage)
            })
            await expect(t()).rejects.toThrow(errorMessage)

            // try to find it again, to prove it is committed
          let found = await Shop.findOne({where: {id: anotherShopData.id}}).usingConnectionIfAny(ctx)

            expect(found).toBeNull()
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
  }

})