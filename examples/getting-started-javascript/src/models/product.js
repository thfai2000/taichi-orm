//@filename: src/models/product.js
const { Model, PrimaryKeyType, NumberType } = require('taichi-orm')

module.exports = class Product extends Model {
    id = this.field(PrimaryKeyType)
    shopId = this.field(NumberType)
    shop = Product.belongsTo(require('./shop'), 'shopId')
}