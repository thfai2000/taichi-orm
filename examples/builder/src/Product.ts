import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import { Dataset, Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { Model } from "../../../dist/Model"
import { Scalarable } from "../../../dist"
import { Expand } from "../../../dist/util"

export default class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    // shop = this.belongsTo(Shop, this.shopId)
        
    abc = Product.compute((context, root, arg?: number): Scalarable<NumberType> => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })

    myShop = Product.compute((context, root, arg?: number) => {
        let shop = context.findModelInstance(Shop)

        return new Dataset()
            .from(shop.datasource('s'))
            .where(({s}) => s.name.equals('dddd') )
            .selectProps('name')
    })

}
