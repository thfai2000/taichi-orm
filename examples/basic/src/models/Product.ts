import {Entity, Schema, Types} from '../../../../dist';
import Shop from './Shop';
import Color from './Color';

export default class Product extends Entity{

    static register(schema: Schema){

		schema.prop('name', Types.String(255, true))

		schema.prop('createdAt', Types.Date())

        schema.prop('shopId', Types.Number() )

		// computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
		
		schema.computedProp('shop', Types.Object(Shop), (product, applyFilters) => product.belongsTo(Shop, 'shopId', applyFilters) )

		schema.computedProp('colors', Types.Array(Color), (product, applyFilters) => product.hasMany(Color, 'productId', applyFilters) )
		
		// model.computedProp('deliveryOptions', Types.arrayOf(DeliveryChannel), false,
		// 	(args, rootTable) => {
			
		// 	  let dc = DeliveryChannel.table()
		// 	  let sdo = SkuDeliveryOption.table()
			
		// 	  let b = select(dc.all)
		// 		.join(sdo, sdo.deliveryChannelId, '=', dc.id)
		// 		.where(
		// 			sdo.sku, '=', rootTable.id
		// 		)
			  
		// 	  if(args.carrier){
		// 		b = b.andWhere(
		// 			knex.raw( '?? = ?', [dc.carrier, args.carrier])
		// 		)
		// 	  }
			  
		// 	  return b
		// 	}
		// )

		
	}

}