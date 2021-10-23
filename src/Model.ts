import { DatabaseActionOptions, DatabaseMutationRunner, DatabaseQueryRunner, DatabaseContext, ExecutionOptions, MutationName, PartialMutationEntityPropertyKeyValues, SingleSourceArg, SingleSourceFilter, ExtractValueTypeDictFromFieldProperties, ORM, ComputeFunction, Hook, SelectorMap, ConstructValueTypeDictBySelectiveArg, Scalarable, ComputeFunctionDynamicReturn, CompiledComputeFunctionDynamicReturn } from "."
import { v4 as uuidv4 } from 'uuid'
import { Expand, expandRecursively, ExtractFieldPropDictFromDict, ExtractFieldPropDictFromModel, ExtractFieldPropDictFromModelType, ExtractFieldPropNameFromModelType, ExtractPropDictFromDict, ExtractSchemaFromModel, ExtractSchemaFromModelType, notEmpty, SimpleObject, undoExpandRecursively } from "./util"
import { Expression, Scalar, Dataset, DScalar } from "./Builder"
import { ArrayType, FieldPropertyTypeDefinition, ObjectType, ParsableObjectTrait, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringNotNullType } from "./PropertyType"
import { ComputeProperty, Datasource, FieldProperty, Property, Schema, TableDatasource, TableOptions, TableSchema } from "./Schema"
import util from 'util'
// type FindSchema<F> = F extends SingleSourceArg<infer S>?S:boolean

export type ModelArrayRecord<MT extends typeof Model> = <SSA extends SingleSourceArg< ExtractSchemaFromModelType<MT>>>(arg?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<MT>>) => SSA) ) => DScalar<Dataset<ExtractSchemaFromModelType<MT>>, ArrayType< ParsableObjectTrait<
                ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<MT>, SSA>
            > >>
export type ModelObjectRecord<MT extends typeof Model> = <SSA extends SingleSourceArg< ExtractSchemaFromModelType<MT>>>(arg?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<MT>>) => SSA) ) => DScalar<Dataset<ExtractSchemaFromModelType<MT>>, ObjectType< ParsableObjectTrait<
            ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<MT>, SSA>
        > >>
        
export abstract class Model {

    #entityName: string
    #repository: ModelRepository<any>
    #schema: TableSchema<any> | null = null

    abstract id: FieldProperty<PrimaryKeyType>
    uuid?: FieldProperty<StringNotNullType> = undefined

    constructor(repository: ModelRepository<any>, entityName: string){
        this.#repository = repository
        this.#entityName = entityName
    }

    get modelName(){
        return this.#entityName
    }

    field<D extends FieldPropertyTypeDefinition<any> >(definition: (new (...args: any[]) => D) | D  ) {

        if(definition instanceof FieldPropertyTypeDefinition){
            return new FieldProperty<D>(definition)
        }
        return new FieldProperty<D>( new definition() )
    }

    static compute<M extends typeof Model, 
        ARG,
        P extends PropertyTypeDefinition<any>
        >(
            this: M,
            compute: (context: DatabaseContext<any>, source: Datasource<ExtractSchemaFromModel<InstanceType<M>>,any>, arg?: ARG) => Scalarable<P> | Promise<Scalarable<P>>
        ) 
            : ComputeProperty<
                ComputeFunction<Datasource<ExtractSchemaFromModel<InstanceType<M>>, any>, ARG, P>
            > {

        return new ComputeProperty(new ComputeFunction(compute))
    }

    static computeDynamic<M extends typeof Model,
        CCF extends CompiledComputeFunctionDynamicReturn
        >(
            this: M,
            compute: (context: DatabaseContext<any>, source: Datasource<ExtractSchemaFromModel<InstanceType<M>>,any>, arg?: Parameters<CCF>[0]) => Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never > | Promise<Scalarable< ReturnType<CCF> extends Scalar<infer P>?P: never >> 
        ) 
            : ComputeProperty< 
                ComputeFunctionDynamicReturn<Datasource<ExtractSchemaFromModel<InstanceType<M>>, any>, CCF>
            > {
        return new ComputeProperty(new ComputeFunctionDynamicReturn(compute))
    }

    hook(newHook: Hook){
        //TODO:
        // this.hooks.push(newHook)
    }

    schema<T extends Model>(this: T): ExtractSchemaFromModel<T> {

        if(!this.#schema){

            let props = {} as {[key:string]: Property}
            for (let field in this) {
                if(this[field] instanceof Property){
                    props[field] = this[field] as unknown as Property
                }
            }
            let z = Object.getOwnPropertyDescriptors(this.constructor.prototype)
            for (let field in z) {
                if(z[field] instanceof Property){
                    props[field] = z[field] as Property
                }
            }

            let schema = new TableSchema(this.#entityName, props, this.id, this.uuid)
            // schema.uuid = this.uuid
            // schema.id = this.id
            
            this.#schema = schema
        }
        return this.#schema
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    datasource<T extends Model, Name extends string>(this: T, name: Name, options?: TableOptions) : TableDatasource<ExtractSchemaFromModel<T>, Name>{
        // const source = new TableDatasource(this.schema(), name, options)
        return this.schema().datasource(name, options)
    }

    static hasMany<ParentModelType extends typeof Model, RootModelType extends typeof Model>(
        this: ParentModelType,
        relatedModelType: RootModelType, 
        relatedBy: string,
        parentKey: string = 'id'
        ){


        //() => new ArrayType(relatedSchemaFunc())
        return this.computeDynamic<ParentModelType, ModelArrayRecord<RootModelType> >((context: DatabaseContext<any>,
            parent, //: Datasource< ExtractSchemaFromModelType<ParentModelType>, any>, 
            args?
        ) => {

        // }
            
        // let computeFn = function<SSA extends SingleSourceArg< ExtractSchemaFromModelType<RootModelType>>>(
        //     context: DatabaseContext<any>,
        //     parent: Datasource< ExtractSchemaFromModelType<ParentModelType>, any>, 
        //     args?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<RootModelType>>) => SSA)
        //     ): Scalarable< ArrayType< Parsable<
        //         ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<RootModelType>, SSA>
        //     > > >{
            let dataset = new Dataset()

            let relatedModel = context.getRepository(relatedModelType)
            let relatedSource = relatedModel.datasource('root')

            let parentColumn = parent.getFieldProperty( parentKey  )
            let relatedByColumn = relatedSource.getFieldProperty( relatedBy  )
        
            let newDataset = dataset.from(relatedSource)

            let props = relatedSource.getAllFieldProperty()

            let resolvedArgs: SingleSourceArg< ExtractSchemaFromModelType<RootModelType>> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }

            if(resolvedArgs?.select){
                let computed = resolvedArgs.select
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return { [key]: relatedSource.getComputeProperty(key)(arg) }
                }).reduce( (acc,v) => Object.assign(acc, v), {})

                dataset.select(Object.assign(props, computedValues))
            }else {
                dataset.select(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.where){
               filters.push( resolvedArgs.where as any )
            }
            newDataset.where( ({And}) => And(...filters) )

            let r = newDataset.castToScalar( (ds) => new ArrayType(ds.schema() )) //as Schema<ConstructPropertyDictBySelectiveArg<RootModel, SSA>>) )

            return r
        })
    }

    static belongsTo<ParentModelType extends typeof Model, RootModelType extends typeof Model>(
        this: ParentModelType,
        relatedModelType: RootModelType,
        parentKey: string,
        relatedBy: string = 'id'
        )
        {
               
        return this.computeDynamic<ParentModelType, ModelObjectRecord<RootModelType> >((context: DatabaseContext<any>,
            parent,//: Datasource< ExtractSchemaFromModelType<ParentModelType>, any>, 
            args?
        ) => {

        // let computeFn = < SSA extends SingleSourceArg< ExtractSchemaFromModelType<RootModelType>> >(
        //     context: DatabaseContext<any>,
        //     parent: Datasource< ExtractSchemaFromModelType<ParentModelType>, any>, 
        //     args?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<RootModelType>>) => SSA),
        //     ): Scalarable< ObjectType<Parsable<
        //         ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<RootModelType>, SSA>
        //     >> > => {
            
            let dataset = new Dataset()
            let relatedSchema = context.getRepository(relatedModelType)
            let relatedSource = relatedSchema.datasource('root')

            let relatedByColumn = relatedSource.getFieldProperty( relatedBy )
            let parentColumn = parent.getFieldProperty( parentKey )
        
            let newDataset = dataset.from(relatedSource)

            let resolvedArgs: SingleSourceArg<ExtractSchemaFromModelType<RootModelType>> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap())
                } else {
                    resolvedArgs = args
                }
            }

            let props = relatedSource.getAllFieldProperty()
            if(resolvedArgs?.select){
                let computed = resolvedArgs.select
                let computedValues = Object.keys(computed).map(key => {
                    //@ts-ignore
                    let arg = computed[key]
                    return { [key]: relatedSource.getComputeProperty(key)(arg)}
                }).reduce( (acc,v) => Object.assign(acc, v), {})
                dataset.select(Object.assign(props, computedValues))
            }else {
                dataset.select(props)
            }
            let filters = [parentColumn.equals( relatedByColumn )]
            if(resolvedArgs?.where){
               filters.push( resolvedArgs.where as any )
            }
            newDataset.where( ({And}) => And(...filters) )

            let r = newDataset.castToScalar( (ds) => new ObjectType(ds.schema() ))

            return r as Scalarable< ObjectType<ParsableObjectTrait<any>>>
        })
    }
}


export class ModelRepository<MT extends typeof Model>{

    // #orm: ORM<any>
    #model: InstanceType<MT>
    #modelClass: MT
    #context: DatabaseContext<any>

    constructor(context: DatabaseContext<any>, modelClass: MT, modelName: string){
        // this.#orm = orm
        this.#context = context

        //must be the last statement because the creation of schema may require context
        this.#modelClass = modelClass
        //@ts-ignore
        this.#model = new modelClass(this as ModelRepository<MT>, modelName)
        // this.#modelClass.register()
    }

    get model(){
        return this.#model
    }

    get modelClass(){
        return this.#modelClass
    }

    get context(){
        return this.#context
    }

    datasource<Name extends string>(name: Name, options?: TableOptions) : Datasource<ExtractSchemaFromModelType<MT>, Name>{
        return this.#model.datasource(name, options)
    }

    get schema() {
        return this.#model.schema()
    }

    // get orm(){
    //     return this.#orm
    // }

    // createOne(data: PartialMutationEntityPropertyKeyValues<ExtractSchemaFromModelType<MT>>) {
        
    //     return new DatabaseMutationRunner<(ExtractValueTypeDictFromFieldProperties<InstanceType<MT>>)>(
    //         async (executionOptions: ExecutionOptions) => {
    //             let ds = this.context.dataset().insert(this.#modelClass.schema()).values(data)
    //             let id = this.context.executeAndReturn(ds)

    //             let result = await this.context.dataset().from(this.#modelClass.datasource('root')).select(({root})=> root.all).execute()

    //             // let result = await this._create(executionOptions, [data])
    //             if(!result[0]){
    //                 throw new Error('Unexpected Error. Cannot find the entity after creation.')
    //             }
    //             return result[0] as (ExtractValueTypeDictFromFieldProperties<InstanceType<MT>>)
    //         }
    //     )
    // }

    // // createEach(arrayOfData: PartialMutationEntityPropertyKeyValues<InstanceType<MT>>[]): DatabaseMutationRunner< (ConstructValueTypeDictBySelectiveArg<>)[], ExtractSchemaFromModelType<MT>>{
    // //     return new DatabaseMutationRunner< (ExtractValueTypeDictFromFieldProperties<InstanceType<MT>>)[], ExtractSchemaFromModelType<MT> >(
    // //         async (executionOptions: ExecutionOptions) => {
    // //             let result = await this._create(executionOptions, arrayOfData)
    // //             return result.map( data => {
    // //                     if(data === null){
    // //                         throw new Error('Unexpected Flow.')
    // //                     }
    // //                     return data as (ExtractValueTypeDictFromFieldProperties<InstanceType<MT>>)
    // //                 })
    // //         })
    // // }


    // /**
    //  * find one record
    //  * @param applyFilter 
    //  * @returns the found record
    //  */
    // findOne<F extends SingleSourceArg< ExtractSchemaFromModelType<MT> >>(applyFilter?: F): DatabaseQueryRunner<  ConstructValueTypeDictBySelectiveArg<ExtractSchemaFromModelType<MT>, F> >{        
    //     return new DatabaseQueryRunner(
    //         async (executionOptions: ExecutionOptions) => {
    //             let rows = await this._find(executionOptions, applyFilter)
    //             return rows[0] ?? null
    //         })
    // }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    find<F extends SingleSourceArg< ExtractSchemaFromModelType<MT> >>(applyFilter?: F): DatabaseQueryRunner<  Array< ConstructValueTypeDictBySelectiveArg<ExtractSchemaFromModelType<MT>, F> > >{
        return new DatabaseQueryRunner(
            async (executionOptions: ExecutionOptions) => {
                throw new Error('xxx')
                // let rows = await this._find(executionOptions, applyFilter)
                // return rows
        })
    }

    // private async _find<F extends SingleSourceArg< ExtractSchemaFromModelType<MT> >>(executionOptions: ExecutionOptions, applyOptions?: F ) {   
        
    //     const context = this.#context
    //     const entityClass = this.#modelClass

    //     let source = entityClass.datasource('root')

    //     let dataset = new Dataset()
    //         .select( await resolveEntityProps(source, applyOptions?.select) )
    //         .from(source)
    //         // .type(new ArrayOfEntity(entityClass))

    //     dataset = applyOptions?.where ? dataset.where(applyOptions?.where as Expression<any,any>) : dataset

    //     let wrappedDataset = new Dataset().select({
    //         root: dataset.toScalar()
    //     })

    //     let resultData = await context.execute(wrappedDataset).withOptions()

    //     let rows = resultData[0].root as Array< ConstructValueTypeDictBySelectiveArg<ExtractSchemaFromModelType<MT>, F> >
    //     return rows
    // }

    // updateOne<F extends SingleSourceFilter<InstanceType<MT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<MT>>, applyFilter?: F): DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>, InstanceType<MT>>{
    //     return new DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>, InstanceType<MT> >(
    //         async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<InstanceType<MT>> > ) => {
    //             let result = await this._update(executionOptions, data, applyFilter??null, true, false,  actionOptions)
    //             return result[0] ?? null
    //         }
    //     )
    // }

    // update<F extends SingleSourceFilter<InstanceType<MT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<MT>>, applyFilter?: F): DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>[], InstanceType<MT> >{
    //     return new DatabaseMutationRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>[], InstanceType<MT> >(
    //         async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<InstanceType<MT>> > ) => {
    //             let result = await this._update(executionOptions, data, applyFilter??null, false, false, actionOptions)
    //             return result
    //         }
    //     )
    // }

    // private async _update<F extends SingleSourceFilter<InstanceType<MT>>>(executionOptions: ExecutionOptions, data: SimpleObject,  
    //     applyFilter: F | null, 
    //     isOneOnly: boolean,
    //     isDelete: boolean,
    //     actionOptions: Partial<DatabaseActionOptions<InstanceType<MT>>>
    //    ) {

    //     const context = this.#context
    //     const entityClass = this.#modelClass

    //     const schema = entityClass
    //     const actionName = isDelete?'delete':'update'

    //     const rootSource = entityClass.datasource('root')
    //     let propValues = await this._prepareNewData(data, schema, actionName, executionOptions)

    //     // let deleteMode: 'soft' | 'real' | null = null
    //     // if(isDelete){
    //     //     deleteMode = existingContext.isSoftDeleteMode ? 'soft': 'real'
    //     // }

    //     const realFieldValues = this.extractRealField(schema, propValues)
    //     const input = {
    //         updateSqlString: !isDelete && Object.keys(realFieldValues).length > 0? 
    //                         (applyFilter? new Dataset()
    //                                         .from( rootSource )
    //                                         .where(applyFilter): 
    //                                         new Dataset().from(rootSource ).native( qb => qb.update(realFieldValues)) ): null,
    //         selectSqlString: (applyFilter? new Dataset()
    //                                         .from(rootSource)
    //                                         .where(applyFilter):
    //                                     new Dataset().from(rootSource) ),
    //         entityData: data
    //     }

    //     const schemaPrimaryKeyFieldName = schema.id.fieldName(context.orm)
    //     const schemaPrimaryKeyPropName = schema.id.name

    //     let fns = await context.startTransaction(async (trx) => {
    //         if(!input.selectSqlString || !input.entityData){
    //             throw new Error('Unexpected Flow.')
    //         }
    //         let updateStmt = input.updateSqlString
    //         let selectStmt = input.selectSqlString.addNative( qb => qb.select( schemaPrimaryKeyFieldName ) )
            
    //         let pks: number[] = []
    //         if (context.client().startsWith('pg')) {
    //             let targetResult
    //             if(updateStmt){
    //                 updateStmt = updateStmt.native( qb => qb.returning(schemaPrimaryKeyFieldName) )
    //                 targetResult = await context.executeStatement(updateStmt, {}, executionOptions)
    //             } else {
    //                 targetResult = await context.executeStatement(selectStmt, {}, executionOptions)
    //             }
    //             let outputs = await Promise.all((targetResult.rows as SimpleObject[] ).map( async (row) => {
    //                 let pkValue = row[ schemaPrimaryKeyFieldName ]
    //                 let record = await this.findOne({
    //                     //@ts-ignore
    //                     where: {[schemaPrimaryKeyPropName]: pkValue}
    //                 }).withOptions(executionOptions)
    //                 let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
    //                 if(isDelete){
    //                     await context.executeStatement( new Dataset().from(rootSource).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), {}, executionOptions)
    //                 }
    //                 // {
    //                 //     ...(querySelectAfterMutation? {select: querySelectAfterMutation}: {}),
    //                 //     where: { [entityClass.schema.primaryKey.name]: pkValue} 
    //                 // })

    //                 return finalRecord
    //             }))

    //             return outputs
    //         } else {

    //             if (context.client().startsWith('mysql')) {
    //                 let result = await context.executeStatement(selectStmt, {}, executionOptions)
    //                 pks = result[0].map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
    //             } else if (context.client().startsWith('sqlite')) {
    //                 let result = await context.executeStatement(selectStmt, {}, executionOptions)
    //                 pks = result.map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
    //             } else {
    //                 throw new Error('NYI.')
    //             }

    //             if(isOneOnly){
    //                 if(pks.length > 1){
    //                     throw new Error('More than one records were found.')
    //                 } else if(pks.length === 0){
    //                     return []
    //                 }
    //             }
    
    //             return await Promise.all(pks.flatMap( async (pkValue) => {
    //                 if (context.client().startsWith('mysql')) {
    //                     if(updateStmt){
    //                         let updateResult = await context.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), {}, executionOptions)
    //                         let numUpdates: number
    //                         numUpdates = updateResult[0].affectedRows
    //                         if(numUpdates > 1){
    //                             throw new Error('Unexpected flow.')
    //                         } else if(numUpdates === 0){
    //                             return null
    //                         } 
    //                     }
    //                     let record = await this.findOne({
    //                         //@ts-ignore
    //                         where: {[schemaPrimaryKeyPropName]: pkValue}
    //                     }).withOptions(executionOptions)
    //                     let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
    //                     if(isDelete){
    //                         await context.executeStatement( new Dataset().from(schema.datasource('root')).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), {}, executionOptions)
    //                     }
    //                     return finalRecord
                        
    //                 } else if (context.client().startsWith('sqlite')) {
    //                     if(updateStmt){
    //                         let updateResult = await context.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), {}, executionOptions)
    //                         let found = await this.findOne({
    //                             //@ts-ignore
    //                             where: {[schemaPrimaryKeyPropName]: pkValue}
    //                         }).withOptions(executionOptions)
    //                         let data = input.entityData!
    //                         let unmatchedKey = Object.keys(data).filter( k => data[k] !== (found as {[key:string]: any})[k])
    //                         if( unmatchedKey.length > 0 ){
    //                             console.log('Unmatched prop values', unmatchedKey.map(k => `${k}: ${data[k]} != ${(found as {[key:string]: any})[k]}` ))
    //                             throw new Error(`The record cannot be updated. `)
    //                         }
    //                     }
    //                     let record = await this.findOne({
    //                         //@ts-ignore
    //                         where: {[schemaPrimaryKeyPropName]: pkValue}
    //                     }).withOptions(executionOptions)
    //                     let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
    //                     if(isDelete){
    //                         await context.executeStatement( new Dataset().from(schema.datasource('root')).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), {}, executionOptions)
    //                     }
    //                     return finalRecord
    //                 } else {
    //                     throw new Error('NYI.')
    //                 }
    //             }))
    //         }


    //     }, executionOptions.trx)

    //     return fns.filter(notEmpty)
    // }

    // deleteOne<F extends SingleSourceFilter<InstanceType<MT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<MT>>, applyFilter?: F): DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>, InstanceType<MT>>{
    //     return new DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>, InstanceType<MT>>(
    //         async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< InstanceType<MT> > > ) => {
    //             let result = await this._update(executionOptions, data, applyFilter??null, true, true, actionOptions)
    //             return result[0] ?? null
    //         }
    //     )
    // }

    // delete<F extends SingleSourceFilter<InstanceType<MT>>>(data: SimpleObject, applyFilter?: F): DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>[], InstanceType<MT> >{
    //     return new DatabaseQueryRunner< ConstructValueTypeDictBySelectiveArg<InstanceType<MT>, {}>[], InstanceType<MT>>(
    //         async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< InstanceType<MT> > > ) => {
    //             let result = await this._update(executionOptions, data, applyFilter??null, false, true, actionOptions)
    //             return result
    //         }
    //     )
    // }

    // private extractRealField<S extends TableSchema>(schema: S, fieldValues: SimpleObject): any {
    //     const context = this.#context
    //     return Object.keys(fieldValues).reduce( (acc, key) => {
    //         let prop = schema.properties.find(p => p.name === key)
    //         if(!prop){
    //             throw new Error('Unexpected')
    //         }
    //         if(prop instanceof FieldProperty){
    //             acc[prop.fieldName(context.orm)] = fieldValues[key]
    //         }
    //         return acc
    //     }, {} as SimpleObject)        
    // }
}




// export async function resolveEntityProps<D extends Schema<any>>(source: Datasource<D, "root">, 
//     props?: Partial<ConstructComputePropertyArgsDictFromSchema<D>>): Promise<{ [key: string]: Scalar<any> }> {
    
//     let computedCols: { [key: string]: Scalar<any> }[] = []
//     if(props){
//         const castedProps = props as {[key:string]: any}
//         computedCols = Object.keys(castedProps).map( (propName) => {
 
//             const args = castedProps[propName]
//             let call = source.getComputeProperty(propName)
            
//             let col = call(args)
//             let colDict = col.value()

//             return colDict

//         })
//     }
//     let fieldCols = source.schema.properties.filter(prop => !(prop instanceof ComputeProperty) )
//         .map(prop => source.getFieldProperty(prop.name).value() )
//     let r = Object.assign({}, ...fieldCols, ...computedCols)
//     return r as { [key: string]: Scalar<any> }
// }




// private async _create(executionOptions: ExecutionOptions, values: PartialMutationEntityPropertyKeyValues<InstanceType<MT>>[]) {
//         const schema = this.#modelClass.schema()
//         const actionName = 'create'
//         const context = this.#context

//         if(!context){
//             throw new Error('Entity is not accessed through Repository')
//         }
        
//         let useUuid: boolean = !!context.orm.ormConfig.enableUuid
//         if (context.client().startsWith('sqlite')) {
//             if (!context.orm.ormConfig.enableUuid ){
//                 throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
//             }
//         }
        
//         const schemaPrimaryKeyFieldName = schema.id.fieldName(context.orm)
//         const schemaPrimaryKeyPropName = schema.id.name
//         const schemaUUIDPropName = schema.uuid?.name
        
//         let fns = await context.startTransaction(async (trx) => {

//             //replace the trx
//             executionOptions = {...executionOptions, trx: trx}

//             let allResults = await Promise.all(values.map(async (value) => {

//                 let propValues = await this._prepareNewData(value, schema, actionName, {trx})
//                 let newUuid = null
//                 if(useUuid){
//                     if(!schemaUUIDPropName){
//                         throw new Error('Not UUID field is setup')
//                     }
//                     newUuid = uuidv4()
//                     propValues[schemaUUIDPropName] = newUuid
//                 }
//                 let stmt = context.orm.getKnexInstance()( schema.tableName({tablePrefix: context.tablePrefix}) ).insert( this.extractRealField(schema, propValues) )
        
//                 if ( context.client().startsWith('pg')) {
//                     stmt = stmt.returning( schemaPrimaryKeyFieldName )
//                 }
//                 let input = {
//                     sqlString: stmt,
//                     uuid: newUuid
//                 }

//                 // let afterMutationHooks = schema.hooks.filter()

//                 // console.debug('======== INSERT =======')
//                 // console.debug(stmt.toString())
//                 // console.debug('========================')
//                 if (context.client().startsWith('mysql')) {
//                     let insertedId: number
//                     const insertStmt = input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id '
//                     const r = await context.executeStatement(insertStmt, {}, executionOptions)
//                     insertedId = r[0][0].insertId
//                     // let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId])  )
       
//                     let record = await this.findOne({
//                         where: {
//                             //@ts-ignore
//                             id: insertedId
//                         }
//                     }).withOptions(executionOptions)

//                     let b = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
//                     return b
//                 } else if (context.client().startsWith('sqlite')) {
//                     const insertStmt = input.sqlString.toString()
//                     const r = await context.executeStatement(insertStmt, {}, executionOptions)
//                     if(context.orm.ormConfig.enableUuid && schema.uuid){
//                         if(input.uuid === null){
//                             throw new Error('Unexpected Flow.')
//                         } else {
//                             let uuid = input.uuid
//                             let record = await this.findOne({
//                                 //@ts-ignore
//                                 where: ({root}) => root.uuid.equals(uuid)
//                             }).withOptions(executionOptions)

//                             // console.log('create findOne', record)

//                             return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
//                         }
//                     } else {
//                         throw new Error('Unexpected Flow.')
//                     }

//                 } else if (context.client().startsWith('pg')) {
//                     const insertStmt = input.sqlString.toString()
//                     let insertedId: number
//                     const r = await context.executeStatement(insertStmt, {}, executionOptions)
                    
//                     insertedId = r.rows[0][ schemaPrimaryKeyFieldName ]
//                     let record = await this.findOne({
//                         where: {
//                             //@ts-ignore
//                             id: insertedId
//                         }
//                     }).withOptions(executionOptions)

//                     return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)

//                 } else {
//                     throw new Error('Unsupport client')
//                 }
                
//             }))
//             return allResults

//         }, executionOptions.trx)

//         return fns
//     }



//  private async _prepareNewData<S extends TableSchema>(data: SimpleObject, schema: S, actionName: MutationName, executionOptions: ExecutionOptions) {
//         const context = this.#context

//         const entityName = schema.modelName
//         let propValues = Object.keys(data).reduce(( propValues, propName ) => {
//             let foundProp = schema.properties.find(p => {
//                 return p.name === propName
//             })
//             if (!foundProp) {
//                 throw new Error(`The Property [${propName}] doesn't exist in ${entityName}`)
//             }
//             const prop = foundProp
//             if(prop instanceof FieldProperty){
//                 let propertyValue = prop.definition.parseProperty(data[prop.name], context, prop.name)
//                 propValues[prop.name] = propertyValue
//             }
//             return propValues
//         }, {} as SimpleObject)

//         let hooks1 = schema.hooks.filter(h => h.name === 'beforeMutation' && h.propName && Object.keys(propValues).includes(h.propName) )
//         let hooks2 = schema.hooks.filter(h => h.name === 'beforeMutation' && !h.propName )

//         propValues = await hooks1.reduce( async (recordP, h) => {
//             let record = await recordP
//             let foundProp = schema.properties.find(p => {
//                 return p.name === h.propName
//             })
//             if(!foundProp){
//                 throw new Error('Unexpected.')
//             }
//             if(foundProp instanceof FieldProperty){
//                 record = await h.action(context, record, {
//                     hookName: h.name,
//                     mutationName: actionName,
//                     propertyName: foundProp.name,
//                     propertyDefinition: foundProp.definition,
//                     propertyValue: record[foundProp.name],
//                     rootClassName: entityName
//                 }, executionOptions)
//             }
//             return record
//         }, Promise.resolve(propValues) )

//         propValues = await hooks2.reduce( async(recordP, h) => {
//             let record = await recordP
//             record = await h.action(context, record, {
//                 hookName: h.name,
//                 mutationName: actionName,
//                 propertyName: null,
//                 propertyDefinition: null,
//                 propertyValue: null,
//                 rootClassName: entityName
//             }, executionOptions)
//             return record
//         }, Promise.resolve(propValues))
        
//         return propValues
//     }

//     private async afterMutation<R>(
//         record: R, 
//         schema: TableSchema,
//         actionName: MutationName,
//         inputProps: SimpleObject, 
//         executionOptions: ExecutionOptions): Promise<R> {

//         const context = this.#context

//         const entityName = schema.modelName

//         Object.keys(inputProps).forEach( key => {
//             if( !(key in record) ){
//                 record = Object.assign(record, { [key]: inputProps[key]})
//             }
//         })

//         const hooks1 = schema.hooks.filter(h => h.name === 'afterMutation' && h.propName && Object.keys(inputProps).includes(h.propName) )
//         const hooks2 = schema.hooks.filter(h => h.name === 'afterMutation' && !h.propName )

//         record = await hooks1.reduce( async (recordP, h) => {
//             let record = await recordP
//             let foundProp = schema.properties.find(p => {
//                 return p.name === h.propName
//             })
//             if(!foundProp){
//                 throw new Error('Unexpected.')
//             }
//             const foundPropName = foundProp.name
//             let propertyValue
//             if( foundPropName in record){
//                 propertyValue = (record as {[key:string]: any})[foundPropName]
//             } else {
//                 propertyValue = inputProps[foundProp.name]
//             }

//             if(foundProp instanceof FieldProperty){
//                 record = await h.action(context, record, {
//                     hookName: h.name,
//                     mutationName: actionName,
//                     propertyName: foundPropName,
//                     propertyDefinition: foundProp.definition,
//                     propertyValue: propertyValue,
//                     rootClassName: entityName
//                 }, executionOptions)
//             }

//             return record
//         }, Promise.resolve(record) )

//         record = await hooks2.reduce( async(recordP, h) => {
//             let record = await recordP
//             record = await h.action(context, record, {
//                 hookName: h.name,
//                 mutationName: actionName,
//                 propertyName: null,
//                 propertyDefinition: null,
//                 propertyValue: null,
//                 rootClassName: entityName
//             }, executionOptions)
//             return record
//         }, Promise.resolve(record))

//         return record
//     }