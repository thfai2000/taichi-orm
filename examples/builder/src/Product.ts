import { NumberType, PrimaryKeyType, StringType, StringNotNullType, NumberNotNullType, DateNotNullType, BooleanNotNullType } from "../../../dist/"
import Shop from "./Shop"
import { ModelArrayRecord, ModelObjectRecord, Model } from "../../../dist/"
import { CFReturn } from "../../../dist"
import { Scalar } from "../../../dist/"


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
        return new Scalar( (context) => context.$.And(
            parent.$.availableStart.lessThan( new Date() ),
            parent.$.availableEnd.greaterThan( new Date() ),
            parent.$.remainingStock.greaterThan(0)
        ))
    })

    abc = Product.compute((parent, arg?: number): CFReturn<number> => {
        return Scalar.number(`5 + ?`, [arg ?? 0])
    })

    abc2 = Product.compute((parent, arg?: number): CFReturn<number> => {
        return Scalar.number(`5 + ? + ?`, [ parent.$.abc(), arg] )
    })

    // shopWithName = Product.compute<typeof Product, ModelObjectRecord<typeof Shop> >(
    //     (parent, args?): any => {
    //         return parent.$.shop(args as Undetermined).transform( ds => {
    //             const prevWhere = ds.getWhere()
    //             return ds.andWhere( () => 
    //                 parent.$.name.equals('hello')
    //             ).toScalar(false)
    //         })
    //     }
    // )

    shopWithName = Product.computeModelObject<typeof Product, typeof Shop>(
        (parent, args?): any => {
            //@ts-ignore
            return parent.$.shop(args).transform( ds => {
                return ds.andWhere( () => 
                    parent.$.name.equals('hello')
                ).toDScalarWithObjectType()
            })
        }
    )

    // myShopName = Product.compute((context, root, arg?: string): CFReturnModelArray<string | null> => {
    //     return root.selector().myShop().cast(StringType)
    // })

}