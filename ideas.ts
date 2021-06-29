// type Source = boolean

// // type PickSchemaAttribute<T> = Pick<
// //   T,
// //   { [K in keyof T]: (
// //       T[K] extends ComputeFunction ? K: ( T[K] extends Function? never: K ) 
// //     ) 
// //     }[keyof T]
// // >;


// // type PureSchema<T> = ExcludeMatchingProperties<ExcludeMatchingProperties<T, ComputeFunction<any> >, PropertyType>

// type ReplaceCompute<T> = {
//         [key in keyof T]: 
//             T[key] extends ComputeFunction? Parameters<T[key]>[1]:
//             T[key] extends PropertyType<infer R> ? R:
//             T[key];
//     }

// type PropsFromQuery<T extends QueryOption<Schema<E>, E>, E extends Entity> = ReplaceCompute<T['props']>


// type PureSchema<T extends Schema<any> > = Omit<T, 'find' | 'execute' | 'dataset'>

// class PropertyType<T> {

// }
// type ComputeFunction<ArgT = any, R =any> = (root: Source, args: ArgT, ctx: any) => R

// type QueryProps<T extends Schema<E>, E extends Entity> = Partial<{
//         [key in keyof PureSchema<T>]: 
//             PureSchema<T>[key] extends ComputeFunction? Parameters<PureSchema<T>[key]>[1]: 
//             PureSchema<T>[key] extends PropertyType<infer R> ? R:
//             PureSchema<T>[key];
//     }>
    
// type QueryOption<T extends Schema<E>, E extends Entity> = {
//     props?: QueryProps<T, E>
// }

// type EntityProps<T extends Schema<any>> = Partial<{
//         [key in keyof PureSchema<T>]:
//             PureSchema<T>[key] extends ComputeFunction<infer Arg, infer R> ? R: 
//             PureSchema<T>[key] extends PropertyType<infer R> ? R: 
//             number;
        
//     }>

// class Schema<E extends Entity>{
    
// }

// // function dataset<E extends Entity, S extends Schema<E>>(schema: S){
// //     return new Dataset<S, {props: {}}>({props: {}})
// // }

// // function execute<E extends Entity, S extends Schema<E>, Config extends QueryOption<S>>(schema: S, dataset: Dataset<S, Config>): E & ExtractProps<Config>{
// //     throw new Error('xxx')
// // }

// function find<E extends Entity, S extends Schema<E>>(schema: S, args: QueryOption<Schema<E>, E>){
//     // let d = dataset(schema)
//     // let n = d.apply<NewConfig>(args)
//     // let x = execute(schema, n)
//     return 5
// }


// class Dataset<S extends Schema<E>, E extends Entity, DynamicConfigObject extends QueryOption<S, E> = {props: {}}>{

//     constructor(private config: DynamicConfigObject){}

//     apply<NewConfig extends QueryOption<S, E>>(this: Dataset<S, DynamicConfigObject>, option: NewConfig){
//         let props = Object.assign({}, this.config.props, option.props)
//         //@ts-ignore
//         let newConfig: NewConfig | DynamicConfigObject = {props}
//         return new Dataset<S, typeof newConfig>( newConfig)
//     }

//     toScalar(){

//     }
// }





// class Entity{

// }

// class ProductSchema extends Schema<Product>{
//     name: PropertyType<string>
//     shop: ComputeFunction<QueryOption<ShopSchema, Shop>, PropsFromQuery<QueryOption<ShopSchema, Shop>, Shop> > = (s: Source, args: QueryOption<ShopSchema, Shop>) => {
//         throw new Error('')
//     }
// }

// class ShopSchema extends Schema<Shop>{
//     name: PropertyType<string>
//     products: ComputeFunction<QueryOption<ProductSchema, Product>, PropsFromQuery<QueryOption<ProductSchema, Product>, Product> > = (s: Source, args: QueryOption<ProductSchema, Product>) => {
//         throw new Error('')
//     }
// }

// class Product extends Entity{

// }
// class Shop extends Entity{

// }


// let schema = new ProductSchema()
// // let d = new Dataset<ProductSchema, {props: {} }>({props: {} })

// // let c = d.apply({props: {name: 'iiii', shop: null }})

// // let a = dataset(schema)

// let p = find<Product, ProductSchema>(schema, {
//     props: {
//         shop: {
//             props: {
//                 products: {
//                     props: {
                        
//                     }
//                 }
//             }
//         }
//     }
// })


// let a : QueryOption<Schema<Product>, Product> = {
//     props: {
        
//     }
// }







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

Dual.find( (ctx, source1, source2) => {
    let shop = ctx.models.Shop.dataset()
    let product = ctx.models.Product.dataset()

    // if it is a sqlFunction or valueOperator or ConditionOperator....
    // else if the prop name didn't found, it is a new prop
    // else if the prop name found and it is normal prop.... true/false to show/visible
    // else it is a arguments....
    return {
        props: {
            noramlProp1: true,
            prop2: args,
            prop3ByArgFunc: (ctx, source1, source2) => {
                return {
                    filter: And(
                        source1.type.equals('main')
                    )
                }
            },
            tempProp1: Dataset().props([
                //prop name is found, it is included without any argument passed
                // string or column
            ]).from().filter().toScalar(EntityArray(ctx.models.Color)),
            tempProp2: Dataset().toScalar(EntityObject(ctx.models.Color)),
            tempProp3BySQLFunc: Count(shop._.id),
            tempProp4BySQLFunc: Case(
                shop._.id.equals(5),
            ),
         
        },
        from: shop.join(product, shop._.id.equals(product._.code) ).join(x),
        filter: And(
            t1._.name.equals(t2._.name),
            t2._.name.isNotNull()
        ),
        orderBy: [shop._.code],
        groupBy: null
    }
})

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



