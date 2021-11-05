import { Model } from "../../../dist/model"
import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/types"
import Product from "./Product"
export default class Shop extends Model {
    id= this.field(PrimaryKeyType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    products = Shop.hasMany(Product, 'shopId', 'id')
}
