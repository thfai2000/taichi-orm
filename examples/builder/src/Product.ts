import { Entity, EntityRepository, ORM, TableSchema } from "../../../dist"
import { BooleanType, NumberType, PrimaryKeyType, StringType, StringTypeNotNull } from "../../../dist/PropertyType"
// import { belongsTo, hasMany } from "../../../dist/Relation"
import { Dataset, makeRaw, Scalar, Scalarable } from "../../../dist/Builder"
// import { Shop } from "./orm"
import Shop from "./Shop"

export class ProductSchema extends TableSchema {
    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringTypeNotNull)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    get shop(){
        return this.belongsTo(Shop.schema, schema => schema.shopId)
    }
    myABC = this.compute(NumberType, (root, arg?: number): Scalarable<any> => {
        return {
            toScalar(d?){
                return new Scalar(d, (r) => makeRaw(r, `${5 + (arg ?? 0)}`) )
            }
        }
    })
}

export default class Product extends Entity{
    static schema = new ProductSchema()
    myName: number  = 5
}