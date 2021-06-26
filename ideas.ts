type Source = boolean


type PickSchemaAttribute<T> = Pick<
  T,
  { [K in keyof T]: (
      T[K] extends ComputeFunction ? K: ( T[K] extends Function? never: K ) 
    ) 
    }[keyof T]
>;

type PureSchema<T> = Omit<T, 'find'>

// type PureSchema<T> = ExcludeMatchingProperties<ExcludeMatchingProperties<T, ComputeFunction<any> >, PropertyType>

type PropertyType = {}

type QueryProps<T> = Partial<{
        [key in keyof PureSchema<T>]: ( 
            PureSchema<T>[key] extends ComputeFunction ? Parameters<PureSchema<T>[key]>[1]: PureSchema<T>[key]
        )
    }>

type QueryOption<T> = {
    props?: QueryProps<T>
}

class Schema {
    
    find<T extends Schema>(this: T, args: QueryOption<T>){
        console.log(args)
    }

}

type ComputeFunction<R =any, ArgT = any> = (root: Source, args: ArgT, ctx: any) => R

type Argument<T extends Schema> = T


class Entity<T extends Schema>{

}

class ProductSchema extends Schema{
    name: PropertyType
    shop: ComputeFunction<boolean, QueryOption<ShopSchema>> = (s: Source, args) => {
        return false
    }
}

class ShopSchema extends Schema {
    name: PropertyType
    products: ComputeFunction<boolean, QueryOption<ProductSchema>> = (s: Source, args) => {
        return false
    }
}

class Product extends Entity<ProductSchema>{

}

type a = Exclude<Schema, Function>

let p = (new ProductSchema() ).find({
    props: {
        shop: {
            props: {
                products: {
                    props: {
                        
                    }
                }
            }
        }
    }
})







// Shop.find({
//     props: [],
//     filter: {}
// })

// Shop.find({
//     props: {
//         products: {
//             props: []
//         }
//     },
//     filter: {},
//     args: {
//     }
// })

// // Pros: easy
// // Cons: 
// // - all the columns are first Selector
// // - cannot futher join entity
// // - cannot specify the column sources


// // further join table     chain style
// // Dual case        join table?
// // use arguments    only at builder style?

// Dual.find( (ctx, source1, source2) => {
//     let shop = ctx.models.Shop.dataset()
//     let product = ctx.models.Product.dataset()

//     // if the prop name found, it is a arguments
//     // if the prop name didn't found, it is a new prop
//     return {
//         props: {
//             prop1: true,
//             prop2: args,
//             prop3ByArgFunc: (ctx, source1, source2) => {
//                 return {
//                     filter: And(
//                         source1.type.equals('main')
//                     )
//                 }
//             },
//             tempProp1: Dataset().props([
//                 //prop name is found, it is included without any argument passed
//                 // string or column
//             ]).from().filter().toScalar(EntityArray(ctx.models.Color)),
//             tempProp2: Dataset().toScalar(EntityObject(ctx.models.Color)),
//             tempProp3BySQLFunc: Count(shop._.id),
//             tempProp4BySQLFunc: Case(
//                 shop._.id.equals(5),
//             ),
         
//         },
//         from: shop.join(product, shop._.id.equals(product._.code) ).join(x),
//         filter: And(
//             t1._.name.equals(t2._.name),
//             t2._.name.isNotNull()
//         ),
//         orderBy: [shop._.code],
//         groupBy: null
//     }
// })

// // depreciate: Relation using custom Filter, achieve it in another way
// // depreciate selector as function
// // makeQueryFilterResolver attached to Row..

// // columns: add equals, isNull, isNotNull, notEquals, 
// // throw error if there are both fn and props
// // remove columns - fix, get the existing columns
// // rename select into props
// // rename QuerySelect to QueryProps
// // QueryProps: cater SQLFunction, ConditionOperator, ValueOperator
// // QueryWhere: cater SQLFunction...
// // add props() to Row   
// // add limit, offset, orderBy, groupBy
// // join() accepts SQLFunction, ConditionOperator, ValueOperator

// //toScalar, toEntity

// // make SQLFunction
// // add pick, pickAt


// Source {
//     _: {}
//     $: {}
//     $$: {}

//     innerJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
//     leftJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
//     rightJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
// }

// Dataset extends Source {
//     __type: 'Dataset'
//     // __mainSelector?: Selector | null
//     __expressionResolver: QueryFilterResolver
//     __selectItems: SelectItem[]
//     __fromSource: Source
//     __realSelect: Function
//     __realClearSelect: Function
//     __realClone: Function
//     __realFrom: Function
//     getInvolvedSource(): Source[]
//     getSelectedColumnNames(): string[]
//     toQueryBuilder(): Knex.QueryBuilder
//     toDataset(): Dataset
//     clone(): Dataset
//     clearSelect(): Dataset
//     select(...cols: Column[]): Dataset
//     filter(queryWhere: QueryFilter): Dataset
//     from(source: Source): Dataset
//     orderBy()
//     limit()
//     offset()
//     toScalar(type: PropertyType)        // execute the resolver -> querybuilder -> transformed by PropertyType
//     toNative()                          // execute the resolver -> querybuilder (translate props into columns...put into select... )
//     apply(option: QueryOption)          // it accept both function/object ...merge into different attributes

//     _props: {}
//     _excludeProps: []
//     _filter
//     _from
//     _orderBy
//     _limit
//     ...


// }

// // ComputeFunction must be transformed into Scalar

// interface Scalar {
//     __raw: Raw
//     transformedFrom: DataSet | Column
// }


// ComputeFunction = (root: Dataset, args: any, context: ExecutionContext) => {
//     return root._.name
// }


// Dataset.props().filter()


// PropResolver
// ConditionResolver


// Entity.source()
// Entity.dataset()



