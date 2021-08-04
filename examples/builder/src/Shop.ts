import { Entity, ORM, TableSchema } from "../../../dist"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "../../../dist/PropertyType"
import Product from "./Product"

export default class Shop extends Entity {
    static get schema(){
        return new (class ShopSchema extends TableSchema {
            id= this.field(PrimaryKeyType)
            name = this.field(StringType)
            hour= this.field(NumberType)
            get products(){
                return Product.belongsTo(Shop, schema => schema.shopId)
            }
    })}
}