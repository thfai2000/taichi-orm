require('sqlite3')
const { ORM, Model, PrimaryKeyType, StringType, StringNotNullType, DateType, NumberNotNullType } = require('taichi-orm')

/*
 * Runkit doesn't support Class Properties
 * So we assign properties in constructor
 */
class ShopModel extends Model{
  constructor(...args){
    super(...args)
    this.id = this.field(PrimaryKeyType)
    this.name = this.field(new StringType({length: 100}))
    this.products = ShopModel.hasMany(ProductModel, 'shopId')
  }
}

class ColorModel extends Model{
  constructor(...args){
    super(...args)
    this.id = this.field(PrimaryKeyType)
    this.code = this.field(new StringNotNullType({length: 50}))
  }
}

class ProductColorModel extends Model{
  constructor(...args){
    super(...args)
    this.id = this.field(PrimaryKeyType)
    this.productId = this.field(NumberNotNullType)
    this.colorId = this.field(NumberNotNullType)
    this.type = this.field(new StringNotNullType({length: 50}))
  }
}

class ProductModel extends Model{
  constructor(...args){
    super(...args)
    this.id = this.field(PrimaryKeyType)
    this.name = this.field(new StringType({length: 100}))
    this.createdAt = this.field(DateType)
    this.shopId = this.field(NumberNotNullType)
    this.shop = ProductModel.belongsTo(ShopModel, 'shopId')
    this.colors = ProductModel.hasManyThrough(ProductColorModel, ColorModel, 'id', 'colorId', 'productId')
    //computed property created based on colors
    this.colorsWithType = ProductModel.compute( (parent, type = 'main') => {
      return parent.$.colors({
        where: ({through}) => through.type.equals(type)
      })
    })
  }
}

(async() =>{
    // configure database
    const orm = new ORM({
        models: {
          Shop: ShopModel, 
          Product: ProductModel, 
          Color: ColorModel, 
          ProductColor: ProductColorModel
        },
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: ':memory:'
            }
        }
    })
    try{

      // create tables
      await orm.getContext().createModels()
      const { Shop, Product, Color, ProductColor } = orm.getContext().repos

      // prepare the database
      const [createdShop1, createdShop2] = await Shop.createEach([{name: 'Shop1'}, {name: 'Shop2'}])
      const [createdProduct1] = await Product.createEach([
        {name: 'Product1', shopId: createdShop1.id},
        {name: 'Product2', shopId: createdShop2.id},
        {name: 'Product3', shopId: createdShop2.id}
      ])
      const [createdColor1, createdColor2] = await Color.createEach([{code: 'red'}, {code: 'blue'}])
      await ProductColor.createEach([
        {productId: createdProduct1.id, colorId: createdColor1.id, type: 'main'},
        {productId: createdProduct1.id, colorId: createdColor2.id, type: 'minor'}
      ])

      let s = await Shop.dataset({
        select: {}
      }).execute()
      
      // computed fields are the relations
      // you can do complicated query in one go
      // Graph-like selecting Models "Shop > Product > Color"
      let records = await Shop.find({
        select: {
          products: {
            select: {
              colors: {
                limit: 2
              },
              colorsWithType: 'main'
            }
          }
        }
      })
  
      console.log('Shop with related entities', records)
  
      // use computed fields for filtering
      // for example: find all shops with Product Count is at least 2
      let shopsWithAtLeast2Products = await Shop.find({
        where: ({root}) => root.products().count().greaterThanOrEquals(2)
      })
  
      console.log('Shops with at least 2 products', shopsWithAtLeast2Products)
  
      // Console.log the sql statements
      await Shop.find({
        selectProps: ['products']
      }).onSqlRun(console.log)
      

    }finally{
      await orm.shutdown()
    }


})()


