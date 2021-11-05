import {  DBMutationRunner, DBQueryRunner, DatabaseContext, ExecutionOptions, MutationName, SingleSourceArg, ComputeFunction, Hook, SelectorMap, ConstructValueTypeDictBySelectiveArg, Scalarable, ComputeFunctionDynamicReturn, CompiledComputeFunctionDynamicReturn, SingleSourceWhere, DBActionOptions, ConstructScalarPropDictBySelectiveArg } from "."
import { v4 as uuidv4 } from 'uuid'
import { ExtractPropDictFromModelType, ExtractSchemaFromModel, ExtractSchemaFromModelType, UnionToIntersection, ExtractValueTypeDictFromSchema_FieldsOnly, ExtractPropDictFromSchema } from "./util"
import {  Scalar, Dataset, AddPrefix } from "./builder"
import { ArrayType, FieldPropertyTypeDefinition, ObjectType, ParsableObjectTrait, ParsableTrait, PrimaryKeyType, PropertyType, StringNotNullType } from "./types"
import { ComputeProperty, Datasource, FieldProperty, Property, Schema, TableDatasource, TableOptions, TableSchema } from "./schema"
// import util from 'util'
// type FindSchema<F> = F extends SingleSourceArg<infer S>?S:boolean

export type DetermineDatasetFromModelType<MT extends typeof Model> =
    Dataset<
        ExtractSchemaFromModelType<MT>,
        UnionToIntersection< AddPrefix< ExtractPropDictFromModelType<MT>, '', ''> | AddPrefix< ExtractPropDictFromModelType<MT>, 'root'> >,
        UnionToIntersection< { 'root': SelectorMap< ExtractSchemaFromModelType<MT> > }>, 
        Datasource<ExtractSchemaFromModelType<MT>, 'root'>
    >

export type ModelArrayRecord<MT extends typeof Model> = <SSA extends SingleSourceArg< ExtractSchemaFromModelType<MT>>>(arg?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<MT>>) => SSA) ) => Scalar< ArrayType< ParsableObjectTrait<
                ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<MT>, SSA>
            > >, DetermineDatasetFromModelType<MT>>
export type ModelObjectRecord<MT extends typeof Model> = <SSA extends SingleSourceArg< ExtractSchemaFromModelType<MT>>>(arg?: SSA | ((root: SelectorMap<ExtractSchemaFromModelType<MT>>) => SSA) ) => Scalar< ObjectType< ParsableObjectTrait<
            ConstructValueTypeDictBySelectiveArg< ExtractSchemaFromModelType<MT>, SSA>
        > >, DetermineDatasetFromModelType<MT>>
        
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
        S extends Scalar<any, any>
        >(
            this: M,
            compute: (context: DatabaseContext<any>, parent: Datasource<ExtractSchemaFromModel<InstanceType<M>>,any>, arg?: ARG) => S | Promise< S >
        )
            : ComputeProperty<
                ComputeFunction<Datasource<ExtractSchemaFromModel<InstanceType<M>>, any>, ARG, S>
            >;

    static compute<M extends typeof Model,
            CCF extends CompiledComputeFunctionDynamicReturn
        >(
            this: M,
            compute: (context: DatabaseContext<any>, source: Datasource<ExtractSchemaFromModel<InstanceType<M>>,any>, arg?: Parameters<CCF>[0]) => ReturnType<CCF> | Promise<ReturnType<CCF>> 
        ) 
            : ComputeProperty< 
                ComputeFunctionDynamicReturn<Datasource<ExtractSchemaFromModel<InstanceType<M>>, any>, CCF>
            >;

    static compute(...args: any[])
    {
        return new ComputeProperty(new ComputeFunction(args[0]))
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
        return this.compute<ParentModelType, ModelArrayRecord<RootModelType> >((context: DatabaseContext<any>,
            parent, //: Datasource< ExtractSchemaFromModelType<ParentModelType>, any>, 
            args?
        ) => {

            let dataset = context.dataset()

            let relatedModel = context.getRepository(relatedModelType)
            let relatedSource = relatedModel.datasource('root')

            let parentColumn = parent.getFieldProperty( parentKey  )
            let relatedByColumn = relatedSource.getFieldProperty( relatedBy  )
        
            let newDataset = dataset.from(relatedSource)

            let props = relatedSource.getAllFieldProperty()

            let resolvedArgs: SingleSourceArg< ExtractSchemaFromModelType<RootModelType>> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap)
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

            let r = newDataset.toScalarWithType( (ds) => new ArrayType(ds.schema() )) as Scalar< ArrayType<ParsableObjectTrait<any>>, any>

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
               
        return this.compute<ParentModelType, ModelObjectRecord<RootModelType> >((context: DatabaseContext<any>,
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
            
            let dataset = context.dataset()
            let relatedSchema = context.getRepository(relatedModelType)
            let relatedSource = relatedSchema.datasource('root')

            let relatedByColumn = relatedSource.getFieldProperty( relatedBy )
            let parentColumn = parent.getFieldProperty( parentKey )
        
            let newDataset = dataset.from(relatedSource)

            let resolvedArgs: SingleSourceArg<ExtractSchemaFromModelType<RootModelType>> | undefined
            
            if(args){
                if(args instanceof Function){
                    resolvedArgs = args(relatedSource.selectorMap)
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

            let r = newDataset.toScalarWithType( (ds) => new ObjectType(ds.schema() ))

            return r as Scalar< ObjectType<ParsableObjectTrait<any>>, any>
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

    datasource<Name extends string>(name: Name, options?: TableOptions) {
        return this.#model.datasource(name, options)
    }

    get schema() {
        return this.#model.schema()
    }

    createOne(data: Partial<ExtractValueTypeDictFromSchema_FieldsOnly<ExtractSchemaFromModelType<MT>>>) {
        return this.context.insert(this.#model.schema()).values([data]).execute().getAffectedOne()
    }

    createEach(arrayOfData: Partial<ExtractValueTypeDictFromSchema_FieldsOnly<ExtractSchemaFromModelType<MT>>>[]) {
        return this.context.insert(this.#model.schema()).values(arrayOfData).execute().getAffected()
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    findOne<F extends SingleSourceArg< ExtractSchemaFromModelType<MT> >>(args?: F) {
        return this.dataset(args).execute().getFirstRow()
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    find<F extends SingleSourceArg< ExtractSchemaFromModelType<MT> >>(args?: F) {
        return this.dataset(args).execute()
    }

    update(data: Partial<ExtractValueTypeDictFromSchema_FieldsOnly<ExtractSchemaFromModelType<MT>>>, args?: SingleSourceArg<ExtractSchemaFromModelType<MT>>["where"] ){
        return this.context.update().set(data).from(this.#model.schema().datasource('root')).where(args ?? {}).execute()
    }

    updateOne(data: Partial<ExtractValueTypeDictFromSchema_FieldsOnly<ExtractSchemaFromModelType<MT>>>, args?: SingleSourceArg<ExtractSchemaFromModelType<MT>>["where"] ){
        return this.context.update().set(data).from(this.#model.schema().datasource('root')).where(args ?? {}).execute().getAffectedOne()
    }
   
    /**
     * return a dataset with selected all field Property
     * 
     * @param applyFilter 
     * @returns dataset with selected all field Property
     */
    dataset<F extends SingleSourceArg<ExtractSchemaFromModelType<MT>>>(args: F | undefined) {
        let source = this.model.datasource('root')
        let dataset = this.context.dataset().from(source)

        let props = source.getAllFieldProperty()

        let resolvedArgs: SingleSourceArg<ExtractSchemaFromModelType<MT>> | undefined

        if (args) {
            if (args instanceof Function) {
                resolvedArgs = args(source.selectorMap)
            } else {
                resolvedArgs = args
            }
        }
        if (resolvedArgs?.where) {
            dataset.where(resolvedArgs.where)
        }

        if (resolvedArgs?.select) {
            let computed = resolvedArgs.select
            let computedValues = Object.keys(computed).map(key => {
                //@ts-ignore
                let arg = computed[key]
                return { [key]: source.getComputeProperty(key)(arg) }
            }).reduce((acc, v) => Object.assign(acc, v), {})

            dataset.select(Object.assign(props, computedValues))
        } else {
            dataset.select(props)
        }
        return dataset as unknown as Dataset<Schema<ConstructScalarPropDictBySelectiveArg<
            ExtractSchemaFromModelType<MT>, F
        > >,
        UnionToIntersection<AddPrefix<ExtractPropDictFromSchema<ExtractSchemaFromModel<InstanceType<MT>>>, "", ""> | AddPrefix<ExtractPropDictFromSchema<ExtractSchemaFromModel<InstanceType<MT>>>, "root", ".">>, {
            root: SelectorMap<ExtractSchemaFromModel<InstanceType<MT>>>;
        }, Datasource<ExtractSchemaFromModel<InstanceType<MT>>, "root">
        >
    }

    delete(args?: SingleSourceArg<ExtractSchemaFromModelType<MT>>["where"] ){
        return this.context.del().from(this.#model.schema().datasource('root')).where(args ?? {}).execute()
    }

    deleteOne(args?: SingleSourceArg<ExtractSchemaFromModelType<MT>>["where"] ){
        return this.context.del().from(this.#model.schema().datasource('root')).where(args ?? {}).execute().getAffectedOne()
    }
}



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