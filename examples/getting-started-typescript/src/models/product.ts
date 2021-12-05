import { Model, PrimaryKeyType, NumberType } from 'taichi-orm'
import Shop from './shop'

export default class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(Shop, 'shopId')
}