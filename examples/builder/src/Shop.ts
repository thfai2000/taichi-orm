import { Entity, TableSchema } from "../../../dist"
import { NumberType, PrimaryKeyType, StringType, StringNotNullType } from "../../../dist/PropertyType"
import Product from "./Product"

export class ShopSchema extends TableSchema {
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    get products(){
        return this.hasMany(Product.schema, schema => schema.shopId)
    }
}

export default class Shop extends Entity {
    static schema = new ShopSchema()
}