import {Schema, Entity, Types} from '../../../../dist/'
import Product from './Product';
let knex: any = require('knex')

export default class Color extends Entity{

    static register(schema: Schema){
        schema.prop('productId', [Types.Number] )
        schema.computedProp('product', Product, (color, injectFunc) => color.belongsTo(Product, 'productId', injectFunc) )
    }
}