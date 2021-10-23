import { NumberType, PrimaryKeyType, StringType, StringNotNullType, PropertyTypeDefinition } from "../../../dist/PropertyType"
import { Dataset, Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { Model, ModelRecord } from "../../../dist/Model"
import { CFReturn, ExtractValueTypeDictFromSchema, Scalarable } from "../../../dist"



export default class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')
    
    abc = Product.compute((context, root, arg?: number) => {
        return context.scalar(`5 + ?`, [arg ?? 0], NumberType)
    })

    abc2 = Product.compute((context, root, arg?: number): CFReturn<number | null> => {
        return context.scalar(`5 + ? + ?`, [ root.selectorMap().abc(), arg], NumberType)
    })

    // shopWithName = Product.computeDynamic<typeof Product, ModelRecord<typeof Shop> >(
    //     (context, root, args?): any => {

    //     return root.selectorMap().shop(args)
    // })

    // myShopName = Product.compute((context, root, arg?: string): CFReturnModelArray<string | null> => {
    //     return root.selectorMap().myShop().cast(StringType)
    // })

}