import { Entity, ORM, TableSchema } from "../../../dist"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "../../../dist/PropertyType"
import Product from "./Product"

export class ShopSchema extends TableSchema {
    id= this.field(PrimaryKeyType)
    uuid = this.field(StringType)
    name = this.field(StringType)
    hour= this.field(NumberType)
    get products(){
        return this.hasMany(Product.schema, schema => schema.shopId)
    }
}

export default class Shop extends Entity {
    static schema = new ShopSchema()
}