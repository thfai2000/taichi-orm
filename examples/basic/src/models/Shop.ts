import {Entity, Types, Schema} from '../../../../dist';
import Product from './Product';
let knex: any = require('knex')


export default class Shop extends Entity{

    static register(schema: Schema){
        schema.computedProp('products', Product.Array, (shop, injectFunc) => shop.hasMany(Product, 'shopId', injectFunc) )
    }
}