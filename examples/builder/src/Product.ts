import { NumberType, PrimaryKeyType, StringType, StringNotNullType, PropertyTypeDefinition } from "../../../dist/PropertyType"
import { Dataset, Scalar} from "../../../dist/Builder"
import Shop from "./Shop"
import { Model } from "../../../dist/Model"
import { Scalarable } from "../../../dist"
import { Expand } from "../../../dist/util"

export default class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    uuid = this.field(StringNotNullType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, this.shopId)
        
    abc = Product.compute((context, root, arg?: number) => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })

    abc2 = Product.compute((context, root, arg?: number): Scalarable<PropertyTypeDefinition<number | null>> => {
        return Scalar.number(`5 + ?`, [ root.selectorMap().abc() ])
    })

    myShop = Product.compute((context, root, arg?: string): Scalarable<PropertyTypeDefinition<{name: string | null}[]>> => {

        return new Dataset()
            .from(context.findModelRepository(Shop).datasource('s'))
            .innerJoin(root, ({root, s}) => root.shopId.equals(s.id))
            .where(({s}) => s.name.equals(arg ?? 'myShop') )
            .selectProps('name')
    })

    myShopName = Product.compute((context, root, arg?: string): Scalarable<PropertyTypeDefinition<string | null>> => {

        return new Dataset()
            .from(context.findModelRepository(Shop).datasource('s'))
            .innerJoin(root, ({root, s}) => root.shopId.equals(s.id))
            .where(({s}) => s.name.equals(arg ?? 'myShop') )
            .selectProps('name').castToScalar(StringType)
    })

}