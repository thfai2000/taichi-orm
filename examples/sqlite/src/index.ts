import {configure, Entity, Schema, Types, models, builder, raw, Builtin} from '../../../dist/'
import {snakeCase} from 'lodash'
import { Like } from '../../../dist/Operator'

let shopData = [
  { id: 1, name: 'Shop 1', location: 'Shatin'},
  { id: 2, name: 'Shop 2', location: 'Yuen Long'},
  { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
  { id: 4, name: 'Shop 4', location: 'Tsuen Wan'},
  { id: 5, name: 'Shop 5', location: 'Tsuen Wan'}
]

let productData = [
  { name: 'Product 1a', shopId: 1},
  { name: 'Product 1b', shopId: 1},
  { name: 'Product 2a', shopId: 2},
  { name: 'Product 2b', shopId: 2}
]


let colorData = [
  { id: 1, code: 'red'},
  { id: 2, code: 'orange'},
  { id: 3, code: 'yellow'},
  { id: 4, code: 'green'},
  { id: 5, code: 'blue'},
  { id: 6, code: 'black'},
  { id: 7, code: 'white'}
]

let productColorData = [
  { productId: 1, colorId: 1, type: 'main'},
  { productId: 1, colorId: 6, type: 'normal'},
  { productId: 1, colorId: 7, type: 'normal'},

  { productId: 2, colorId: 3, type: 'normal'},
  { productId: 2, colorId: 4, type: 'main'},
  //no main color for product 3
  { productId: 3, colorId: 2, type: 'normal'},
  { productId: 3, colorId: 5, type: 'normal'},
]


;(async() =>{

   // configure the orm
   class Shop extends Entity{

    static register(schema: Schema){
      schema.prop('name', Types.String({length: 255}))
      schema.prop('location', Types.String({length: 255}))
      schema.prop('products', Types.ArrayOf(Types.ObjectOf('Product', {
        compute: Builtin.ComputeFn.relatedFrom('Product', 'shopId')
      }) ) )
      schema.prop('productCount', Types.Number({
        compute: (shop) => {
          // let p = Product.selector()
          // return applyFilters( builder().select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop._.id, p._.shopId])), p) 
          return shop.$.products().count()
        }
      }))
      schema.prop('hasProducts', Types.Boolean({
        compute: (shop) => {
          return shop.$.products().exists()
        }
      }))
      schema.prop('hasNoProducts', Types.Boolean({
        compute: (shop) => {
          return shop.$.products().exists().is('=', false)
        }
      }))
      schema.prop('hasOver2Products', Types.Boolean({
        compute: (shop) => {
          return shop.$.productCount().is('>', 2)
        }
      }))
      schema.prop('hasProductsAsync', Types.Boolean({
        compute: async (shop) => {
          return await shop.$.products().exists()
        }
      }))
      schema.prop('hasEnoughProducts', Types.Boolean({
        compute: (shop, args) => {
          return shop.$.productCount().is('>=', args.count)
        }
      }))

      schema.prop('hasTwoProductsAndlocationHasLetterA', Types.Boolean({
        compute: (shop, args) => {
          return shop({
            location: Like('%a%'),
            productCount: 2
          })
        }
      }))

    }
  }
  
  class Product extends Entity{
  
    static register(schema: Schema){
      schema.prop('name', Types.String({length: 255}))
      schema.prop('createdAt', Types.DateTime({precision: 6}))
      schema.prop('shopId', Types.Number())
      // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
      schema.prop('shop', Types.ObjectOf('Shop', {
        compute: Builtin.ComputeFn.relatesTo('Shop', 'shopId')
      }))

      schema.prop('colors', 
        Types.ArrayOf(Types.ObjectOf('Color', {
          compute: Builtin.ComputeFn.relatesThrough('Color', 'ProductColor', 'colorId', 'productId') 
        }))
      )
      
      schema.prop('mainColor', 
        Types.ObjectOf('Color', {
          compute: Builtin.ComputeFn.relatesThrough('Color', 'ProductColor', 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
            return stmt.toQueryBuilder().andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
          })
        })
      )
    }
  }
  
  class Color extends Entity{
    static register(schema: Schema){
      schema.prop('code', Types.String({
        nullable: false,
        length: 50
      }))
    }
  }

  class ProductColor extends Entity{
    static register(schema: Schema){
      schema.prop('productId', Types.Number({nullable: false}))
      schema.prop('colorId', Types.Number({nullable: false}))
      schema.prop('type', Types.String({nullable: false, length: 50}))
    }
  }


  await configure({
      models: {Shop, Product, Color, ProductColor},
      createModels: true,
      enableUuid: true,
      entityNameToTableName: (className: string) => snakeCase(className),
      propNameTofieldName: (propName: string) => snakeCase(propName),
      knexConfig: {
        client: 'sqlite3',
        connection: {
          filename: ':memory:'
        }
      }
  })

  let record = await models.Shop.findOne({
    select: ['products', 'productCount', 'hasProductsAsync'],
    // select: {
    //   'products': true, 'productCount': true, 'hasProductsAsync':true
    // },
    where: {id: 5}
  }).onSqlRun(console.log)
    
})()