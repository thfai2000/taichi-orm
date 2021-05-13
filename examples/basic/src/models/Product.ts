import {Entity, Schema, Types, More} from '../../../../dist';
import Shop from './Shop';
let knex: any = require('knex')
export default class Product extends Entity{

    static register(schema: Schema){

		// model.increments('id').primary();

	    // model.primaryKey('id', Types.AutoIncrement);	//t.increments('id').primary();
			
		schema.prop('name', [Types.String(255, true), More.NotNull])

		// prop('stock', Types.Number)
		schema.prop('createdAt', [Types.Date, More.Null])

		// prop('shopId', Shop.schema.entity.id.type)
        schema.prop('shopId', [Types.Number] )

		// computeProp - not a actual field. it can be relations' data or formatted value of another field. It even can accept arguments...
		
		schema.computedProp('shop', Shop, () => Product.belongsTo(Shop, 'shopId') )
		
		// schema.computedProp('colors', Types.arrayOf(Color), false, hasMany(Color, SKUColor, 'colorId', 'skuId') )
		
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