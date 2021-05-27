import {configure, Entity, getKnexInstance, Schema, Types} from '../../../dist/'

class Shop extends Entity{
    static register(schema: Schema){
        schema.prop('name', Types.String(255))
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
        client: 'sqlite',
        connection: ':memory:'
        // connection: {
        //     filename: "file:memDb1?mode=memory",
        //     flags: ['OPEN_URI']
        // },
        // pool: {
        //     min: 1, 
        //     max: 1,
        //     idleTimeoutMillis: 360000*1000 
        // }
    })
    /**
     * Basic
     */
    let myShops = await Shop.find()
    console.log('HERE:', myShops)

    let shopData = [
      { name: 'Shop 1', location: 'Shatin'},
      { name: 'Shop 2', location: 'Yuen Long'},
      // { id: 3, name: 'Shop 3', location: 'Tsuen Wan'},
    ]

    await Promise.all(shopData.map( async(d) => {
      console.log('eeeeeeee 1')
      return await Shop.createOne(d)
    }))

})()