import {run, select, raw, configure, Schema, Entity, Types, models} from '../dist'
import {snakeCase} from 'lodash'
import {v4 as uuidv4} from 'uuid'

const initializeDatabase = async () => {
    // configure the orm
    class Shop extends Entity{

      static register(schema: Schema){
          schema.prop('name', Types.String(100))
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

    // @ts-ignore
    let config = JSON.parse(process.env.ENVIRONMENT)

    await configure({
        models: {Shop, Product, Color},
        createModels: true,
        entityNameToTableName: (className: string) => tablePrefix + snakeCase(className),
        propNameTofieldName: (propName: string) => snakeCase(propName),
        knexConfig: config
    })

    let shopData = [
      { id: 1, name: 'Shop 1', location: 'Shatin'},
      { id: 2, name: 'Shop 2', location: 'Yuen Long'},
      { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
      { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
      { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
    ]

    await Promise.all(shopData.map( async(d) => {
      return await models.Shop.createOne(d)
    }))
    
    let productData = [
      { name: 'Product 1a', shopId: 1},
      { name: 'Product 1b', shopId: 1},
      { name: 'Product 2a', shopId: 2},
      { name: 'Product 2b', shopId: 2}
    ]

    await Promise.all(productData.map( async(d) => {
      return await models.Product.createOne(d)
    }))
}

const clearDatabase = () => {

}

beforeEach( async () => {
    await initializeDatabase();
});

afterEach(() => {
    return clearDatabase();
});

describe('Query', () => {

  test('Query by knex methods', async () => {
    let records = await models.Shop.find( (stmt, root) => {
        return stmt.where(root.id, '>', 2).limit(2)
    })

    expect(records).toHaveLength(2)
    // expect(records).toBe(expect.)


  });

  // test('Query computed fields', async () => {


  // });

})


