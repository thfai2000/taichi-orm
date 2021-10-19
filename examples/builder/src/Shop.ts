import { Model } from "../../../dist/Model"
import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import Product from "./Product"
export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    products = Shop.hasMany(Product)
}
