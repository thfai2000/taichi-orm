import {Entity, Types, Schema, select} from '../../../../dist';
import Product from './Product';

export default class Shop extends Entity{

    static register(schema: Schema){
        schema.prop('location', Types.String(255))

        schema.computedProp('products', Types.Array(Product), (shop, applyFilters) => shop.hasMany(Product, 'shopId', applyFilters) )
        
        schema.computedProp('productCount', Types.Number(),  (shop, applyFilters) => {
            let p = Product.selector()
            return select('COUNT(*)').from(p.source).where(shop.$.id, '=', p.$.shopId)
        })

        // When Entity.create, Entity.update, Entity.delete is called
        // the ORM will evalute the property (or computedProp)
        // `UPDATE FROM products p SET name = newName WHERE id = ?`
        // if it is different, the hook will be called.
        // when Entity.create, the beforeValue must be null
        // schema.onMutation('products', async (trans, rootStmt, newValue, beforeValueFunc) => {

        //     // let recordsForDelete = beforeValue?.filter(b => !afterValue.find(a => a.pid === p.id) ) ?? []
        //     let recordsForUpdate = newValue.filter(p => p.id)
        //     let recordsForCreate = newValue.filter(p => !p.id)

        //     beforeValueFunc = 'SELECT 1 FROM shop WHERE shop.id = product.shop_id'

        //     `DELETE FROM products
        //      WHERE ID NOT IN (${recordsForUpdate.map( ({id})=> id )}) AND EXISTS (${beforeValueFunc()})`
        //     Product.delete( (stmt, s) => {
        //         stmt.where(... beforeValueFunc(s.shopId) )
        //     })

        //     //beforeValue contains args meta info
        //     recordsForUpdate.forEach( r => {
        //         Product.update(p, (stmt, s) => {
        //             stmt.where({[s.id]: r.id})
        //         })
        //     })

        //     Product.createMany()
        //     `INSERT INTO products
        //      SELECT ..... ${recordsForCreate}
        //     `
        // })

        // schema.onAccess()
    }

}