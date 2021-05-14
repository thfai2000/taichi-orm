import {Schema, Entity} from '../../../../dist/'
import Product from './Product';
let knex: any = require('knex')

export default class Color extends Entity{

    static register(schema: Schema){
        schema.computedProp('product', Product, (color) => color.belongsTo(Product, 'productId') )
    }
}