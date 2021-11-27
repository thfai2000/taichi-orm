const { ORM, Model, PrimaryKeyType, NumberType, StringType, StringNotNullType, DateNotNullType, NumberNotNullType } = require('taichi-orm')

class ShopModel extends Model{
  id = this.field(PrimaryKeyType)
  name = this.field(new StringType({length: 100}))
  location = this.field(new StringType({length: 255}))
  products = ShopModel.hasMany(ProductModel, 'shopId')
  productCount = ShopModel.compute( (parent) => {
    return parent.selector.products().count()
  })
}

class ColorModel extends Model{
  id = this.field(PrimaryKeyType)
  code = this.field(new StringNotNullType({length: 50}))
}

class ProductColorModel extends Model{
  id = this.field(PrimaryKeyType)
  productId = this.field(NumberNotNullType)
  colorId = this.field(NumberNotNullType)
  type = this.field(new StringNotNullType({length: 50}))
}

class ProductModel extends Model{

  id = this.field(PrimaryKeyType)
  name = this.field(new StringType({length: 100}))
  createdAt = this.field(DateNotNullType)
  shopId = this.field(NumberNotNullType)
  shop = ProductModel.belongsTo(ShopModel, 'shopId')
  colors = ProductModel.hasManyThrough(ProductColorModel, ColorModel, 'id', 'colorId', 'productId')

  colorsWithType = ProductModel.compute( (parent, type = 'main') => {
    return parent.selector.colors({
      where: ({through}) => through.type.equals(type)
    })
  })
}



;(async() =>{

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

    await orm.getContext().createModels()
    const { Shop, Product } = orm.getContext().models
    
    // computed fields are the relations
    // you can do complicated query in one go
    // Graph-like selecting Models "Shop > Product > Color"
    let records = await Shop.find({
      selectProps: ['productCount'],
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

    // Here you are
    console.log('results', records)

    // use computed fields for filtering
    // for example: find all shops with Product Count over 2
    let shopsWithAtLeast2Products = await Shop.find({
      where: ({root}) => root.productCount().greaterThan(2)
    })

    // Great!
    console.log('shopsWithAtLeast2Products', shopsWithAtLeast2Products)

    // make query with Console.log the sql statements
    let shops = await Shop.find({
      selectProps: ['products']
    }).onSqlRun(console.log)

    console.log('shops', shops)

})()


