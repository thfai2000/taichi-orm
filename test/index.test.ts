import {run, select, raw, configure, Schema, Selector, Entity, Types, models} from '../dist/'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'



const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('location', Types.String(255))
    
          schema.computedProp('products', Types.Array(Product), (shop, applyFilters) => shop.hasMany(Product, 'shopId', applyFilters) )
          
          schema.computedProp('productCount', Types.Number(),  (shop, applyFilters) => {
              let p = Product.selector()
              return applyFilters( select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop.id, p._.shopId])), p) 
          })
      }
    
    }
    
    class Product extends Entity{
    
      static register(schema: Schema){
    
          schema.prop('name', Types.String(255, true))
    
          schema.prop('createdAt', Types.Date())
    
          schema.prop('shopId', Types.Number() )
    
          // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
          schema.computedProp('shop', Types.Object(Shop), (product, applyFilters) => product.belongsTo(Shop, 'shopId', applyFilters) )
    
          schema.computedProp('colors', Types.Array(Color), (product, applyFilters) => product.hasMany(Color, 'productId', applyFilters) )
              
      }
    }
    
    class Color extends Entity{
    
      static register(schema: Schema){
          schema.prop('code', Types.String(50))
          schema.prop('productId', Types.Number() )
          schema.computedProp('product', Types.Object(Product), (color, applyFilters) => color.belongsTo(Product, 'productId', applyFilters) )
      }
    }

    let tablePrefix = `${process.env.JEST_WORKER_ID}_${uuidv4().replace(/[-]/g, '_')}_`

    let a = await configure({
        models: {Product, Shop, Color},
        createModels: true,
        entityNameToTableName: (className: string) => tablePrefix + snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: {
            client: 'mysql2',
            connection: {
                host : '127.0.0.1',
                user : 'example',
                password : 'example',
                database : 'example',
                port: 3306
            }
        }
    })
}

const clearDatabase = () => {

}


beforeAll( async () => {
    await initializeDatabase();
});

afterAll(() => {
    return clearDatabase();
});


test('Create Simple Object', async () => {

    let record = await models.Shop.createOne({
      location: 'Shatin'
    })
    expect(record).toMatchObject({location: 'Shatin'})
});