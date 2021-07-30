import { compute, ComputeProperty, Entity, ExecutionContext, field, FieldProperty, TableSchema, Schema, SelectorMap } from "."
import { AddPrefix, Column, Dataset, Datasource, Expression, Scalar, Scalarable } from "./Builder"
// import { And, AndOperator, ValueOperator } from "./Operator"
import { ArrayOfType, BooleanType, NumberType, ObjectOfType, PrimaryKeyType, PropertyTypeDefinition, StringType } from "./PropertyType"
import { ExtractComputeProps, ExtractFieldProps, ExtractProps, ExtractSynComputeProps, UnionToIntersection } from "./util"

export type SelectableProps<E> = {
    [key in keyof E]: Scalar<any>
} | SelectableProps<E>[]


export type ComputePropertyArgsMap<E> = {
    [key in keyof ExtractComputeProps<E> & string ]:
            E[key] extends undefined?
            never:
            (
                E[key] extends ComputeProperty<infer D, infer Root, infer rootName, infer Arg, infer R>? 
                Arg: never
            )
}


export type SingleSourceArg<S extends TableSchema> = {
    props?: ComputePropertyArgsMap<S>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractProps<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >        
                >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}

export type SingleSourceFilter<S extends TableSchema> = Expression<
        UnionToIntersection< AddPrefix< ExtractProps<S>, '', ''> >,
        UnionToIntersection< { 'root': SelectorMap< S> }  >        
    >

// export type SingleSourceQueryFunction<S extends TableSchema, SName extends string> = (ctx: ExecutionContext, root: Datasource<S, SName>) => {
//     props?: ComputePropertyArgsMap<S>,
//     filter?: Expression<never>,
//     limit?: number,
//     offset?: number,
//     orderBy?: QueryOrderBy
// }

export type TwoSourcesArg<Root extends TableSchema, RootName extends string, Related extends TableSchema, RelatedName extends string> = {

    props?: ComputePropertyArgsMap<Root>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractProps< Root>, '', ''> | AddPrefix< ExtractProps< Root>, RootName> | AddPrefix< ExtractProps< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}


export type TwoSourcesFilterFunction<Root extends TableSchema, RootName extends string, Related extends TableSchema, RelatedName extends string> =
    (ctx: ExecutionContext, root: Datasource<Root, RootName>, related: Datasource<Related, RelatedName>) => {

    props?: ComputePropertyArgsMap<Root>,
    filter?: Expression< 
        UnionToIntersection< AddPrefix< ExtractProps< Root>, '', ''> | AddPrefix< ExtractProps< Root>, RootName> | AddPrefix< ExtractProps< Related>, RelatedName> >,
        UnionToIntersection< { [key in RootName ]: SelectorMap< Root> } | { [key in RelatedName ]: SelectorMap< Related> } >        
                >
    limit?: number,
    offset?: number,
    orderBy?: QueryOrderBy
}



// export type SelectableComputeProps<E > = Partial<{
//     [key in ( (keyof ExtractComputeProps<E>) & string)  as `$${key}`]:
//         E[key] extends ComputeProperty<infer D, infer Root, infer Arg, infer R>? 
//                 (
//                     Arg[0]       
//                 ): 
//                     // E[key] extends FieldProperty<infer D>? 
//                     // Scalar<D> | boolean:
//                     never
            
// }>

// export type SelectableProps<E > = 
//     (SelectableComputeProps<E> | (string & keyof E) | Column<(string & keyof E), any extends ComputeProperty<infer D>? D: never> )[]



// export type ExpressionSelectorFunction = (...selectors: Selector[]) => Scalar

// export type QueryEntityPropertyValue = null|number|string|boolean|Date|ValueOperator


// export type FilterEntityPropertyKeyValues<S> = 
// {
//     [key in keyof ExtractProps<S> & string]: QueryEntityPropertyValue | QueryEntityPropertyValue[]
// }

// export type SingleSourceFilter<S extends TableSchema = any> = Expression< FilterEntityPropertyKeyValues<S> >

// export type TwoSourcesFilter<S0 extends TableSchema, S1 extends TableSchema> =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<S0> | AddPrefix< FilterEntityPropertyKeyValues<S0>, 'root'>  | AddPrefix< FilterEntityPropertyKeyValues<S1>, 'related'> >>

// export type ThreeSourcesFilter<S0 extends TableSchema, S1 extends TableSchema, S2 extends TableSchema> =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<S0> | AddPrefix< FilterEntityPropertyKeyValues<S0>, 'root'>  | AddPrefix< FilterEntityPropertyKeyValues<S1>, 'related'> | AddPrefix< FilterEntityPropertyKeyValues<S2>, 'through'> >>



export type QueryOrderBy = ( (string| Column<any, any> ) | {column: (string|Column<any, any>), order: 'asc' | 'desc'} )[]
// export type QueryFilterResolver = (value: SingleSourceFilter) => Promise<Scalar> | Scalar


// const getModelBySchema = <T extends Schema>(ctx: ExecutionContext, schema: string): T => {
//     return ctx.models[schema].schema as T
// }

// function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, relatedRootKey?: string) {
    
//     let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"]>, args: SimpleSelectAndFilter< TypeClass["schema"]> | RelationFilterFunction<RootClass["schema"], TypeClass["schema"]>): Scalarable => {
//         let dataset = makeBuilder()

//         let relatedSource = getModelBySchema<TypeClass["schema"]>(context, schema).datasource(context)
        
//         if(args instanceof Function){
//             let c = args(context, root, relatedSource)
//             dataset.select( c.props )
//         } else {
//             dataset.select( args )
//         }

//         let relatedRootColumn = relatedSource.getFieldProperty(relatedRootKey?? ormConfig.primaryKeyName)

//         let fromClause = relatedSource.innerJoin(root, relatedRootColumn.equals(root.getFieldProperty(relatedBy) ) )
       
//         return dataset.from(fromClause)
//     }

//     return compute( new ObjectOfEntity<InstanceType<TypeClass>>(schema), computeFn )
// }

// function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(schema: string, relatedBy: string, rootKey?: string){
    
//     let computeFn = (context: ExecutionContext, root: Datasource<TypeClass["schema"]>, args: SimpleSelectAndFilter< TypeClass["schema"] >): Scalarable => {
        
//         // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
//         //     return {
//         //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
//         //     }
//         // }).apply(args).toScalar(ArrayOf(schema))
//         throw new Error()
//     }

//     return compute( new ArrayOfType< ObjectOfEntity<InstanceType<TypeClass>> >( new ObjectOfEntity(schema) ), computeFn )
// }

// function all<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass) {
    
//     let computeFn = (context: ExecutionContext, root: Datasource<RootClass["schema"], 'root'>, 
//         args?: SingleSourceQueryOptions< TypeClass["schema"]> | SingleSourceQueryFunction< TypeClass["schema"], 'root'> ): Scalarable => {
//         let dataset = makeBuilder()

//         let rootSource = rootEntity.schema.datasource('root', context)
        
//         if(args instanceof Function){
//             let c = args(context, rootSource)
//             return simpleQuery(dataset, rootSource, c)
//         } else {
//             return simpleQuery(dataset, rootSource, args)
//         }
//     }

//     return compute( new ArrayOfType( new ObjectOfType(rootEntity) ), computeFn )
// }

export function belongsTo<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty<PropertyTypeDefinition>, rootKey?: FieldProperty<PropertyTypeDefinition>) {
    
    let computeFn = (root: Datasource<RootClass["schema"], 'root'>, 
        args?: TwoSourcesArg<RootClass["schema"], 'root', TypeClass["schema"], 'related'>): Scalarable => {

        let dataset = new Dataset()

        let relatedSource = relatedEntity.schema.datasource('related')
        
        let relatedRootColumn = (rootKey? root.getFieldProperty(rootKey.name): undefined ) ?? root.getFieldProperty("id")
       
        let newDataset = dataset.from(relatedSource).innerJoin(root, relatedRootColumn.equals( relatedSource.getFieldProperty(relatedBy.name) ) )

        if(args?.props){
            // dataset.props(args.props)
        }
        if(args?.filter){
            newDataset = newDataset.filter(args.filter)
        }

        return newDataset
    }

    return compute( new ObjectOfType(relatedEntity), computeFn )
}

export function hasMany<RootClass extends typeof Entity, TypeClass extends typeof Entity>(rootEntity: RootClass, relatedEntity: TypeClass, relatedBy: FieldProperty<PropertyTypeDefinition>, rootKey?: FieldProperty<PropertyTypeDefinition>) {
    
    let computeFn = (root: Datasource<TypeClass["schema"], 'root'>, args?: TwoSourcesArg<RootClass["schema"], 'root', TypeClass["schema"], 'related'>): Scalarable => {
        
        // return schema.dataset().apply( (ctx: Context, source: Datasource) => {
        //     return {
        //         source: source.innerJoin(root, (rootKey? root._[rootKey]: root.pk ).equals(source._[relatedBy]) )
        //     }
        // }).apply(args).toScalar(ArrayOf(schema))
        throw new Error()
    }

    return compute( new ArrayOfType( new ObjectOfType(relatedEntity) ), computeFn )
}


// export type QueryObject<S extends Schema> = {
//     props?: QueryProps<S>,
//     filter?: QueryFilter<S>,
//     limit?: number,
//     offset?: number,
//     orderBy?: QueryOrderBy
// }

// export type ObjectValue<T extends typeof Entity > = {
//     [key in keyof T["schema"]]: 
//         T["schema"][key] extends ComputeProperty<infer D>? ReturnType<D["parseRaw"]>:
//         T["schema"][key] extends FieldProperty<infer D>? ReturnType<D["parseRaw"]>:
//         never;
// } & InstanceType<T>



// let f = s.asFromClause().innerJoin(p, s.$.id.equals(p.$.shopId) )

// console.log(f)


// let x : Expression< AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, 'product' >, {} > = {

// }

// console.log(x)

// let y :  AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, 'product' > 

// let f = s.asFromClause()

//  a: { o: 5, p:6},
//     b: {i: 1, j: 2}

// type AA = typeof c
// type BB = {
//     [key in keyof AA[ key2 in keyof AA] ]: number
// }

// type A =  Expression< UnionToIntersection< FilterEntityPropertyKeyValues<ShopSchema> | AddPrefix< FilterEntityPropertyKeyValues<ShopSchema>, '0'>  | AddPrefix< FilterEntityPropertyKeyValues<ProductSchema>, '1'> >>

// let aaa: A = {
//     "1.shopId": 5
// }

// type Simple<Name extends string, T> = {[key in keyof Name & string as Name]: T }
// let xb: Simple<'a', Scalar<any> > // = { 'a': 5}
// let xc: Simple<'b', Scalar<any>> //= { 'b': 3}

// let xa = {
//     ...xb!,
//     ...xc!
// }

// export type C<N extends string, T> =  { [key in keyof N & string as N]: Scalar<T> }

// let zb: C<'a', any> // = { 'a': 5}
// let zc: C<'b', any> //= { 'b': 3}

// let xz = {
//     ...zb!,
//     ...zc!
// }


// let x: SelectorMap<ProductSchema>
// let cx = x!.shopId
// let temp: Scalar<BooleanType>
// let ccc = {
//     ...x!.name,
//     ...x!.myABC(5)
//     // temp: temp!
// }
// // let cccc = x!.shopId.shopId

// let aaa = makeBuilder().props(
//     ccc
// )

// aaa.execute().then(r => {
//     let result = r.myABC
//     result
// })


// let models = {
//     Product,
//     Shop
// }

// let f = function(x: {[key:string]: typeof Entity}){
// }

// models.Shop.createEach()
// let cc = x!.shop()
// type A = number
// let x: A
// let y: string

// function my<I>(a: I): I extends A? boolean: number {
//     throw new Error()
// }
// let c = my(x!)







// const simpleQuery = <T extends TableSchema>(row: Dataset, selector: Datasource<T>, queryOptions: QueryObject<T>) => {
//     let stmt = row.toQueryBuilder()

//     let isWholeFilter = true

//     if(queryOptions.limit){
//         stmt = stmt.limit(queryOptions.limit)
//         isWholeFilter = false
//     }
//     if(queryOptions.offset){
//         stmt = stmt.offset(queryOptions.offset)
//         isWholeFilter = false
//     }
//     if(queryOptions.orderBy){
//         stmt = stmt.orderBy(queryOptions.orderBy)
//         isWholeFilter = false
//     }
//     if(queryOptions.select){
//         isWholeFilter = false
//     }
//     if(queryOptions.args){
//         isWholeFilter = false
//     }
//     // if(queryOptions.fn){
//     //     isWholeFilter = false
//     // }

//     let stmtOrPromise: Dataset | Promise<Dataset> = stmt
//     if (queryOptions.select){
//         stmtOrPromise = makeQuerySelectResolver(() => [selector])(queryOptions.select, row)
//     }
//     let filterOption: SingleSourceFilter | null = null
//     if(queryOptions.filter){
//         filterOption = queryOptions.filter
//         isWholeFilter = false
//     }
//     if(isWholeFilter){
//         filterOption = queryOptions as SingleSourceFilter
//     }
//     if(filterOption){
//         const resolved = makeQueryFilterResolver(() => [selector])(filterOption)
//         stmtOrPromise = thenResult(stmtOrPromise, stmt => thenResult(resolved, (r) => {
//             stmt.toQueryBuilder().where(r).toRow()
//             return stmt
//         }))
//     }

//     if(!isWholeFilter){
//         const expectedKeys = ['limit', 'offset', 'orderBy', 'select', 'filter']
//         if(! Object.keys(queryOptions).every(key => expectedKeys.includes(key)) ) {
//             throw new Error(`The query option must be with keys of [${expectedKeys.join(',')}]`)
//         }
//     }

//     return stmtOrPromise
// }