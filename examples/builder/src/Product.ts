import { NumberType, PrimaryKeyType, StringType, StringNotNullType, PropertyTypeDefinition } from "../../../dist/PropertyType"
import { Dataset, Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { ModelArrayRecord, ModelObjectRecord, Model } from "../../../dist/Model"
import { CFReturn, ExtractValueTypeDictFromSchema, Scalarable } from "../../../dist"
import { expand, expandRecursively } from "../../../dist/util"



export default class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')
    
    abc = Product.compute((context, parent, arg?: number): CFReturn<number> => {
        return context.scalar(`5 + ?`, [arg ?? 0], NumberType)
    })

    abc2 = Product.compute((context, parent, arg?: number): CFReturn<number> => {
        return context.scalar(`5 + ? + ?`, [ parent.selectorMap.abc(), arg], NumberType)
    })

    shopWithName = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
        (context, parent, args?): any => {
        return parent.selectorMap.shop(args).transform( ds => {
            const prevWhere = ds.getWhere()

            return ds.where( ({And}) => 
                    And(
                        prevWhere? prevWhere: {},
                        parent.selectorMap.name.equals('hello')
                    )
                )
        })
    })

    // myShopName = Product.compute((context, root, arg?: string): CFReturnModelArray<string | null> => {
    //     return root.selectorMap().myShop().cast(StringType)
    // })

}