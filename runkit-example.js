require('sqlite3')
const {configure, Entity, Relations, Types, builder, raw} = require('llorm')


// declare some entities here:
class Shop extends Entity{

  static register(schema){
    schema.prop('name', new Types.String(true, 100))
    schema.prop('location', new Types.String(true, 255))
    schema.computedProp('products', new Types.ArrayOf(Product), Relations.has(Product, 'shopId') )
    schema.computedProp('productCount', new Types.Number(),  (shop, applyFilters) => {
        let p = Product.selector()
        return applyFilters( builder().select(raw('COUNT(*)') ).from(p.source).where( raw('?? = ??', [shop._.id, p._.shopId])), p) 
    })
  }
}

class Product extends Entity{

  static register(schema){
    schema.prop('name', new Types.String(true, 255))
    schema.prop('createdAt', new Types.DateTime())
    schema.prop('shopId', new Types.Number() )
    // computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
    schema.computedProp('shop', new Types.ObjectOf(Shop), Relations.belongsTo(Shop, 'shopId') )

    schema.computedProp('colors', 
      new Types.ArrayOf(Color), 
      Relations.relateThrough(Color, ProductColor, 'colorId', 'productId') 
    )
    
    schema.computedProp('mainColor', 
      new Types.ObjectOf(Color), 
      Relations.relateThrough(Color, ProductColor, 'colorId', 'productId', (stmt, relatedSelector, throughSelector) => {
        return stmt.andWhereRaw('?? = ?', [throughSelector._.type, 'main'])
      })
    )
  }
}

class Color extends Entity{
  static register(schema){
    schema.prop('code', new Types.String(false, 50))
  }
}

class ProductColor extends Entity{
  static register(schema){
    schema.prop('productId', new Types.Number(false))
    schema.prop('colorId', new Types.Number(false))
    schema.prop('type', new Types.String(false, 50))
  }
}


async function initData(){

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
  

  await Promise.all(shopData.map( async(d) => {
    return await Shop.createOne(d)
  }))
  
  await Promise.all(productData.map( async(d) => {
    return await Product.createOne(d)
  }))

  await Promise.all(colorData.map( async(d) => {
    return await Color.createOne(d)
  }))

  await Promise.all(productColorData.map( async(d) => {
    return await ProductColor.createOne(d)
  }))
}

;(async() =>{

    // configure database
    await configure({
      models: {Shop, Product, Color, ProductColor},
      createModels: true,
      enableUuid: true,
      knexConfig: {
          client: 'sqlite',
          connection: {
              filename: ':memory:'
          }
      }
    })

    // insert some data
    await initData()

    // computed fields are the relations
    // you can do complicated query in one go
    // Graph-like selecting Models "Shop > Product > Color"
    let records = await Shop.find( (stmt, root) => {
        return stmt.select(root.$.productCount(), root.$.products( (stmt, p) => {
          return stmt.select(p.$.mainColor(), p.$.colors( (stmt, c) => {
            return stmt.limit(2)
          }))
        }))
    })

    // Here you are
    console.log('results', records)

    // use computed fields for filtering
    // for example: find all shops with Product Count over 2
    let shopsWithAtLeast2Products = await Shop.find( (stmt, root) => {
      return stmt.select(root.$.products()).whereRaw('?? >= 2', [root.$.productCount()])
    })

    // Great!
    console.log('shopsWithAtLeast2Products', shopsWithAtLeast2Products)

})()


