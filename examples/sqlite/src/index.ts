import {configure, Entity, Schema, Types} from '../../../dist/'

class Shop extends Entity{
    static register(schema: Schema){
        schema.prop('location', Types.String(255))
        schema.computedProp('products', Types.Array(Product), (shop, injectFunc) => shop.hasMany(Product, 'shopId', injectFunc) )
    }
}

class Product extends Entity{
    static register(schema: Schema){
		schema.prop('name', Types.String(255, true))
		schema.prop('createdAt', Types.Date())
        schema.prop('shopId', Types.Number() )
		schema.computedProp('shop', Types.Object(Shop), (product, applyFilters) => product.belongsTo(Shop, 'shopId', applyFilters) )
	}
}

(async() =>{

    // configure the orm
    await configure({
        models: { Shop, Product },
        createModels: true,
        knexConfig: {
            client: 'sqlite3',
            connection: {
                filename: "file:memDb1?mode=memory&cache=shared",
                flags: ['OPEN_URI', 'OPEN_SHAREDCACHE']
            }
        }
    })

    /**
     * Basic
     */
    let myShops = await Shop.find()
    console.log('HERE:', myShops)

})()