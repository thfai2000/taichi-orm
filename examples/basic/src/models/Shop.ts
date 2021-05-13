import {Entity, Types, Schema} from '../../../../dist';
import Product from './Product';
let knex: any = require('knex')


export default class Shop extends Entity{

    static register(schema: Schema){

        schema.computedProp('products', Product.Array, (map) => {
            // console.log('aaaaa', map)
            return Shop.hasMany(Product, map.id) 
        })
    }
}