import { TableSchema } from "../../../dist"
import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import Product from "./Product"

export default class Shop extends TableSchema {
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    products = this.hasMany(Product, schema => schema.shopId)
}