import {Entity, Types, Schema} from '../../../../dist';
import Product from './Product';

export default class Shop extends Entity{

    static register(schema: Schema){

        schema.prop('location', Types.String(255))
        schema.computedProp('products', Types.Array(Product), (shop, injectFunc) => shop.hasMany(Product, 'shopId', injectFunc) )
    }
}