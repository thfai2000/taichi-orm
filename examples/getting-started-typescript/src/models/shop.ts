//@filename: src/models/shop.ts
import { Model, PrimaryKeyType, NumberType } from 'taichi-orm'
import Product from './product'

export default class Shop extends Model {
    id = this.field(PrimaryKeyType)
    products = Shop.hasMany(Product, 'shopId')
}