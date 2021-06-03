import {Entity, Schema, Types, Relations} from '../../../../dist';
import Shop from './Shop';
import Color from './Color';

export default class Product extends Entity{

    static register(schema: Schema){

		schema.prop('name', new Types.String(true, 255))

		schema.prop('createdAt', new Types.DateTime())

        schema.prop('shopId', new Types.Number() )

		// computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
		
		schema.computedProp('shop', new Types.ObjectOf(Shop), Relations.belongsTo(Shop, 'shopId') )

		schema.computedProp('colors', new Types.ArrayOf(Color), Relations.has(Color, 'productId') )

		
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