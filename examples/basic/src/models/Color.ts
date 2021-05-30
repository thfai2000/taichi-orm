import {Schema, Entity, Types, Relations} from '../../../../dist/'
import Product from './Product';

export default class Color extends Entity{

    static register(schema: Schema){

        schema.prop('code', new Types.String(false, 50))
        schema.prop('productId', new Types.Number() )
        schema.computedProp('product', new Types.ObjectOf(Product), Relations.belongsTo(Product, 'productId') )
    }
}