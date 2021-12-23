# Access Control

Imagine your Entity Product can be accessible by certain users. You can define a property that indicate it is accessible or not.

```ts
export default class Product extends Model {

    id = this.field(PrimaryKeyType)

    isAccessibleByUserId = Product.compute((parent, userId: number): ScalarWithPropertyType<boolean> => {
        // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
        return new DScalar(context => context.dataset()
          .from( UserProduct.datasource('up') )
          .where({
            'up.userId': userId,
            'up.productId': parent.id
          }).exists()
        )
    })
```

Then you can use it like a function.
```ts
  const currentUserId = 1

  let targetProducts = await Product.find({
    where: ({root, And}) => And(
      { isActive: true },
      root.isAccessibleByUserId(currentUserId)  // the function call return a boolean Scalar
    )
  })

```

## Role-Based Access Control

If you find some logics are often repeated on many Models. It is suggested to create a util function. Let say you want all Entities has Role-Based Access Control. Here are the related tables Role, User, RoleEntity. 

```
User  
- id
- roleId

Role
- id

RoleEntity
- roleId
- entityName   (Model which that role can access)
```

We define a Model class as a base class of the other models you want to be protected with Access Control
```ts
//rbacModel.ts
export default class RBACModel extends Model {

    static propertyOfEditableByUserId(entityName: string){

      return Product.compute((parent, userId: number): ScalarWithPropertyType<boolean> => {
          // here we use a query builder to query another Model 'UserProduct' to find out if the product can be accessed by a user
          return new DScalar(context => context.dataset()
            .from( Role.datasource('role') )
            .innerJoin( User.datasource('user'), ({role, user}) => user.roleId.equals(role.id))
            .innerJoin( RoleEntity.datasource('re'), ({role, re}) => role.id.equals(re.roleId) )
            .where( ({re}) => re.entityName.equals( entityName ))
            .exists()
          )
      })
    }
}
```


```ts
//product.ts
export default class Product extends RBACModel {
  id = this.field(PrimaryKeyType)

  //use the static method to create a property
  isEditableByUserId = Product.propertyOfEditableByUserId('product')
}
```

```ts
  const currentUserId = 1

  let products = await Product.find({
    where: ({root}) => 
      root.isEditableByUserId(currentUserId)  // the function call return a boolean Scalar
  })
```

