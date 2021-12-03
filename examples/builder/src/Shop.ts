import { Model } from "../../../dist/"
import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/"
import Product from "./Product"
export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    products = Shop.hasMany(Product, 'shopId', 'id')
}
