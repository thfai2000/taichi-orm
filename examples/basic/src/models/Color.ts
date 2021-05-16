import {Schema, Entity, Types} from '../../../../dist/'
import Product from './Product';

export default class Color extends Entity{

    static register(schema: Schema){

        schema.prop('code', Types.String(50))
        schema.prop('productId', Types.Number() )
        schema.computedProp('product', Types.Object(Product), (color, applyFilters) => color.belongsTo(Product, 'productId', applyFilters) )
    }
}