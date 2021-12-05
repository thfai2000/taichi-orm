//@filename: src/models/shop.js
const { Model, PrimaryKeyType, NumberType } = require('taichi-orm')

module.exports = class Shop extends Model {
    id = this.field(PrimaryKeyType)
    products = Shop.hasMany(require('./product'), 'shopId')
}