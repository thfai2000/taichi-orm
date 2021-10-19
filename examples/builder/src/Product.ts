import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import { Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { Model } from "../../../dist/Model"
import { Scalarable } from "../../../dist"

export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = this.belongsTo(Shop, this.shopId)
    myABC = this.compute((root, arg?: number): Scalarable<NumberType> => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })
}