//@filename: src/index.ts
import orm from './orm'

(async() =>{
  const {
    createModels,
    repos: {Shop, Product} 
  } = orm.getContext()

  // create the tables (if necessary)
  await createModels()

  const [createdShop1, createdShop2]  = await Shop.createEach([{ id: 1 }, {id: 2}])
  const createdProducts = await Product.createEach([
    {shopId: createdShop1.id },
    {shopId: createdShop2.id }
  ])

  //Find Shop with Id 2 and with related products
  const foundShop2 = await Shop.find({
    selectProps: ['products'],
    where: {id: 2}
  })

  console.log('Found', foundShop2)

})()