import { NumberType, PrimaryKeyType, StringType, StringNotNullType, NumberNotNullType, DateNotNullType, BooleanNotNullType } from "../../../dist/types"
import Shop from "./Shop"
import { ModelArrayRecord, ModelObjectRecord, Model } from "../../../dist/model"
import { CFReturn } from "../../../dist"
import { Scalar } from "../../../dist/builder"
import { Undetermined } from "../../../dist/util"


export default class Product extends Model {

    id = this.field(PrimaryKeyType)
    ddd = this.field(NumberType)
    name = this.field(StringType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId', 'id')
    availableStart = this.field(DateNotNullType)
    availableEnd = this.field(DateNotNullType)
    remainingStock = this.field(NumberNotNullType)

    isActive = Product.compute((parent, arg?: number): CFReturn<boolean> => {
        return new Scalar( (context) => context.op.And(
            parent.selectorMap.availableStart.lessThan( new Date() ),
            parent.selectorMap.availableEnd.greaterThan( new Date() ),
            parent.selectorMap.remainingStock.greaterThan(0)
        ))
    })

    abc = Product.compute((parent, arg?: number): CFReturn<number> => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })

    abc2 = Product.compute((parent, arg?: number): CFReturn<number> => {
        return Scalar.number(`5 + ? + ?`, [ parent.selectorMap.abc(), arg] )
    })

    // shopWithName = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
    //     (parent, args?): any => {
    //         return parent.selectorMap.shop(args as Undetermined).transform( ds => {
    //             const prevWhere = ds.getWhere()
    //             return ds.andWhere( () => 
    //                 parent.selectorMap.name.equals('hello')
    //             ).toScalar(false)
    //         })
    //     }
    // )

    shopWithName = Product.computeModelObject<typeof Product, typeof Shop>(
        (parent, args?): any => {

            return parent.selectorMap.shop(args).transform( ds => {
                return ds.andWhere( () => 
                    parent.selectorMap.name.equals('hello')
                ).toScalar(false)
            })
        }
    )

    // myShopName = Product.compute((context, root, arg?: string): CFReturnModelArray<string | null> => {
    //     return root.selectorMap().myShop().cast(StringType)
    // })

}