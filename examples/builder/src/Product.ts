import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import { Dataset, Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { Model } from "../../../dist/Model"
import { Scalarable } from "../../../dist"
import { Expand } from "../../../dist/util"

class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = this.belongsTo(Shop, this.shopId)
        
    abc = (this as Product).compute((root, arg?: number): Scalarable<NumberType> => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })

    myShop = (this as Product).compute((root, arg?: number): Scalarable<NumberType> => {
        
        return new Dataset().from(context.models.Shop)
    })

}
