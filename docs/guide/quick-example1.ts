import { ORM, Model, PrimaryKeyType, NumberType } from 'taichi-orm'

class ShopModel extends Model {
    id = this.field(PrimaryKeyType)
    products = ShopModel.hasMany(ProductModel, 'shopId')
}

class ProductModel extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = ProductModel.belongsTo(ShopModel, 'shopId')
}

(async() =>{

    // configure your orm
    const orm = new ORM({
        // register the models here
        models: {Shop: ShopModel, Product: ProductModel},
        // knex config with client sqlite3 / mysql / postgresql
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: ':memory:'
            }
        }
    })

    let {
        createModels,
        repos: {Shop, Product} 
    } = orm.getContext()

    // create the tables (if necessary)
    await createModels()

    let createdShop = await Shop.createOne({ id: 1 })
    let createdProducts = await Product.create([
      {shopId: createdShop.id, name: 'Product1'},
      {shopId: createdShop.id, name: 'Product2'}
    ])

    let allShops = await Shop.find()
    let allProducts = await Product.find()

})()