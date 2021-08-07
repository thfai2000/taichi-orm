import { Entity, EntityRepository, ORM, TableSchema } from "../../../dist"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "../../../dist/PropertyType"
// import { belongsTo, hasMany } from "../../../dist/Relation"
import { Dataset, Scalar, Scalarable } from "../../../dist/Builder"
// import { Shop } from "./orm"
import Shop from "./Shop"

export default class Product extends Entity{
    static get initSchema(){
        return new (class ProductSchema extends TableSchema {
            id = this.field(PrimaryKeyType)
            ddd = this.field(NumberType)
            // uuid = field(StringType)
            name = this.field(StringType)
            shopId = this.field(NumberType)
            get shop(){
                return Shop.hasMany(Product, schema => schema.shopId)
            }
            myABC = this.compute(StringType, (root, args: number): Scalarable<any> => {
                console.log('xxx', this, root)
                throw new Error()
            })
    })}
    
    myName: number  = 5
}