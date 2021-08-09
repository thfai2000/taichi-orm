import { Entity, EntityRepository, ORM, TableSchema } from "../../../dist"
import { BooleanType, NumberType, PrimaryKeyType, StringType } from "../../../dist/PropertyType"
// import { belongsTo, hasMany } from "../../../dist/Relation"
import { Dataset, makeRaw, Scalar, Scalarable } from "../../../dist/Builder"
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
            myABC = this.compute(NumberType, (root, args: number): Scalarable<any> => {
                return {
                    toScalar(d?){
                        return new Scalar(d, (r) => makeRaw(r,`5`))
                    }
                }
            })
    })}
    
    myName: number  = 5
}