import { DatabaseActionOptions, DatabaseMutationRunner, DatabaseQueryRunner, DatabaseContext, ExecutionOptions, FieldProperty, MutationName, PartialMutationEntityPropertyKeyValues, SingleSourceArg, SingleSourceFilter, TableSchema, EntityFieldPropertyKeyValues, EntityWithOptionalProperty, ORM } from "."
import { v4 as uuidv4 } from 'uuid'
import { Expand, ExtractFieldProps, ExtractProps, notEmpty, SimpleObject, undoExpandRecursively } from "./util"
import { Dataset, Datasource, Expression, resolveEntityProps, TableOptions } from "./Builder"
import { ArrayType, FieldPropertyTypeDefinition } from "./PropertyType"

// type FindSchema<F> = F extends SingleSourceArg<infer S>?S:boolean


export class ModelRepository<TT extends typeof TableSchema>{

    #orm: ORM<any, any>
    #modelClass: InstanceType<TT>
    #context: DatabaseContext<any, any>

    constructor(orm: ORM<any, any>, context: DatabaseContext<any, any>, modelClass: TT, modelName: string){
        this.#orm = orm
        this.#context = context

        //must be the last statement because the creation of schema may require context
        //@ts-ignore
        this.#modelClass = new modelClass(this as ModelRepository<TT>, modelName)
        this.#modelClass.register()
    }

    get modelClass(){
        return this.#modelClass
    }

    get context(){
        return this.#context
    }

    datasource<Name extends string>(name: Name, options?: TableOptions) : Datasource<InstanceType<TT>, Name>{
        return this.#modelClass.datasource(name, options)
    }

    get schema() {
        return this.#modelClass
    }

    get orm(){
        return this.#orm
    }

    createOne(data: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>): DatabaseMutationRunner< (EntityFieldPropertyKeyValues<InstanceType<TT>>), InstanceType<TT>>{
        
        return new DatabaseMutationRunner< (EntityFieldPropertyKeyValues<InstanceType<TT>>), InstanceType<TT>>(
            async (executionOptions: ExecutionOptions) => {
                let result = await this._create(executionOptions, [data])
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return result[0] as (EntityFieldPropertyKeyValues<InstanceType<TT>>)
            }
        )
    }

    createEach(arrayOfData: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>[]): DatabaseMutationRunner< (EntityFieldPropertyKeyValues<InstanceType<TT>>)[], InstanceType<TT>>{
        return new DatabaseMutationRunner< (EntityFieldPropertyKeyValues<InstanceType<TT>>)[], InstanceType<TT> >(
            async (executionOptions: ExecutionOptions) => {
                let result = await this._create(executionOptions, arrayOfData)
                return result.map( data => {
                        if(data === null){
                            throw new Error('Unexpected Flow.')
                        }
                        return data as (EntityFieldPropertyKeyValues<InstanceType<TT>>)
                    })
            })
    }

    private async _create(executionOptions: ExecutionOptions, values: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>[]) {
        const schema = this.#modelClass
        const actionName = 'create'
        const context = this.#context

        if(!context){
            throw new Error('Entity is not accessed through Repository')
        }
        
        let useUuid: boolean = !!context.orm.ormConfig.enableUuid
        if (context.client().startsWith('sqlite')) {
            if (!context.orm.ormConfig.enableUuid ){
                throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
            }
        }
        
        const schemaPrimaryKeyFieldName = schema.id.fieldName(context.orm)
        const schemaPrimaryKeyPropName = schema.id.name
        const schemaUUIDPropName = schema.uuid?.name
        
        let fns = await context.startTransaction(async (trx) => {

            //replace the trx
            executionOptions = {...executionOptions, trx: trx}

            let allResults = await Promise.all(values.map(async (value) => {

                let propValues = await this._prepareNewData(value, schema, actionName, {trx})
                let newUuid = null
                if(useUuid){
                    if(!schemaUUIDPropName){
                        throw new Error('Not UUID field is setup')
                    }
                    newUuid = uuidv4()
                    propValues[schemaUUIDPropName] = newUuid
                }
                let stmt = context.orm.getKnexInstance()( schema.tableName({tablePrefix: context.tablePrefix}) ).insert( this.extractRealField(schema, propValues) )
        
                if ( context.client().startsWith('pg')) {
                    stmt = stmt.returning( schemaPrimaryKeyFieldName )
                }
                let input = {
                    sqlString: stmt,
                    uuid: newUuid
                }

                // let afterMutationHooks = schema.hooks.filter()

                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (context.client().startsWith('mysql')) {
                    let insertedId: number
                    const insertStmt = input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id '
                    const r = await context.executeStatement(insertStmt, executionOptions)
                    insertedId = r[0][0].insertId
                    // let record = await this.findOne(entityClass, existingContext, (stmt, t) => stmt.toQueryBuilder().whereRaw('?? = ?', [t.pk, insertedId])  )
       
                    let record = await this.findOne({
                        where: {
                            //@ts-ignore
                            id: insertedId
                        }
                    }).withOptions(executionOptions)

                    let b = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
                    return b
                } else if (context.client().startsWith('sqlite')) {
                    const insertStmt = input.sqlString.toString()
                    const r = await context.executeStatement(insertStmt, executionOptions)
                    if(context.orm.ormConfig.enableUuid && schema.uuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let record = await this.findOne({
                                //@ts-ignore
                                where: ({root}) => root.uuid.equals(uuid)
                            }).withOptions(executionOptions)

                            // console.log('create findOne', record)

                            return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
                        }
                    } else {
                        throw new Error('Unexpected Flow.')
                    }

                } else if (context.client().startsWith('pg')) {
                    const insertStmt = input.sqlString.toString()
                    let insertedId: number
                    const r = await context.executeStatement(insertStmt, executionOptions)
                    
                    insertedId = r.rows[0][ schemaPrimaryKeyFieldName ]
                    let record = await this.findOne({
                        where: {
                            //@ts-ignore
                            id: insertedId
                        }
                    }).withOptions(executionOptions)

                    return await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)

                } else {
                    throw new Error('Unsupport client')
                }
                
            }))
            return allResults

        }, executionOptions.trx)

        return fns
    }

    private async _prepareNewData<S extends TableSchema>(data: SimpleObject, schema: S, actionName: MutationName, executionOptions: ExecutionOptions) {
        const context = this.#context

        const entityName = schema.modelName
        let propValues = Object.keys(data).reduce(( propValues, propName ) => {
            let foundProp = schema.properties.find(p => {
                return p.name === propName
            })
            if (!foundProp) {
                throw new Error(`The Property [${propName}] doesn't exist in ${entityName}`)
            }
            const prop = foundProp
            let propertyValue = prop.definition.parseProperty(data[prop.name], context, prop.name)
            
            propValues[prop.name] = propertyValue
            return propValues
        }, {} as SimpleObject)

        let hooks1 = schema.hooks.filter(h => h.name === 'beforeMutation' && h.propName && Object.keys(propValues).includes(h.propName) )
        let hooks2 = schema.hooks.filter(h => h.name === 'beforeMutation' && !h.propName )

        propValues = await hooks1.reduce( async (recordP, h) => {
            let record = await recordP
            let foundProp = schema.properties.find(p => {
                return p.name === h.propName
            })
            if(!foundProp){
                throw new Error('Unexpected.')
            }
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundProp.name,
                propertyDefinition: foundProp.definition,
                propertyValue: record[foundProp.name],
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(propValues) )

        propValues = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(propValues))
        
        return propValues
    }

    private async afterMutation<R>(
        record: R, 
        schema: TableSchema,
        actionName: MutationName,
        inputProps: SimpleObject, 
        executionOptions: ExecutionOptions): Promise<R> {

        const context = this.#context

        const entityName = schema.modelName

        Object.keys(inputProps).forEach( key => {
            if( !(key in record) ){
                record = Object.assign(record, { [key]: inputProps[key]})
            }
        })

        const hooks1 = schema.hooks.filter(h => h.name === 'afterMutation' && h.propName && Object.keys(inputProps).includes(h.propName) )
        const hooks2 = schema.hooks.filter(h => h.name === 'afterMutation' && !h.propName )

        record = await hooks1.reduce( async (recordP, h) => {
            let record = await recordP
            let foundProp = schema.properties.find(p => {
                return p.name === h.propName
            })
            if(!foundProp){
                throw new Error('Unexpected.')
            }
            const foundPropName = foundProp.name
            let propertyValue
            if( foundPropName in record){
                propertyValue = (record as {[key:string]: any})[foundPropName]
            } else {
                propertyValue = inputProps[foundProp.name]
            }

            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: foundPropName,
                propertyDefinition: foundProp.definition,
                propertyValue: propertyValue,
                rootClassName: entityName
            }, executionOptions)

            return record
        }, Promise.resolve(record) )

        record = await hooks2.reduce( async(recordP, h) => {
            let record = await recordP
            record = await h.action(context, record, {
                hookName: h.name,
                mutationName: actionName,
                propertyName: null,
                propertyDefinition: null,
                propertyValue: null,
                rootClassName: entityName
            }, executionOptions)
            return record
        }, Promise.resolve(record))

        return record
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    findOne<F extends SingleSourceArg<InstanceType<TT>>>(applyFilter: F = {} as F): DatabaseQueryRunner<  EntityWithOptionalProperty<InstanceType<TT>, F> ,  InstanceType<TT> >{        
        return new DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, F> , InstanceType<TT>>(
        async (executionOptions: ExecutionOptions) => {
            let rows = await this._find(executionOptions, applyFilter?? null)
            return rows[0] ?? null
        })
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    find<F extends SingleSourceArg<InstanceType<TT>>>(applyFilter: F = {} as F): DatabaseQueryRunner<  Array< EntityWithOptionalProperty<InstanceType<TT>, F> >,  InstanceType<TT> >{
        return new DatabaseQueryRunner< Array<  EntityWithOptionalProperty<InstanceType<TT>, F> >, InstanceType<TT> >(
            async (executionOptions: ExecutionOptions) => {
                let rows = await this._find(executionOptions, applyFilter?? null)
                return rows
        })
    }

    private async _find<F extends SingleSourceArg<InstanceType<TT>>>(executionOptions: ExecutionOptions, applyOptions: F ) {   
        
        const context = this.#context
        const entityClass = this.#modelClass

        let source = entityClass.datasource('root')

        // let options: SingleSourceQueryOptions<D> | null
        // if(applyFilter instanceof Function){
        //     const f = applyFilter
        //     options = applyFilter(existingContext, source)
        // }else {
        //     options = applyFilter
        // }
        let dataset = new Dataset()
            .select( await resolveEntityProps(source, applyOptions?.select ) )
            .from(source)
            // .type(new ArrayOfEntity(entityClass))

        dataset = applyOptions?.where ? dataset.where(applyOptions?.where as Expression<any,any>) : dataset
        // console.debug("========== FIND ================")
        // console.debug(sqlString.toString())
        // console.debug("================================")

        // console.log('xxxxxxx', dataset.toScalar(new ArrayOfEntity(entityClass)))

        let wrappedDataset = new Dataset().select({
            root: dataset.toScalar(new ArrayType(entityClass))
        })

        let resultData = await context.execute(wrappedDataset, executionOptions)

        let rows = resultData[0].root as Array<  EntityWithOptionalProperty<InstanceType<TT>, F> >
        return rows
    }

    updateOne<F extends SingleSourceFilter<InstanceType<TT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>, applyFilter?: F): DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>, InstanceType<TT>>{
        return new DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>, InstanceType<TT> >(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<InstanceType<TT>> > ) => {
                let result = await this._update(executionOptions, data, applyFilter??null, true, false,  actionOptions)
                return result[0] ?? null
            }
        )
    }

    update<F extends SingleSourceFilter<InstanceType<TT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>, applyFilter?: F): DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>[], InstanceType<TT> >{
        return new DatabaseMutationRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>[], InstanceType<TT> >(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions<InstanceType<TT>> > ) => {
                let result = await this._update(executionOptions, data, applyFilter??null, false, false, actionOptions)
                return result
            }
        )
    }

    private async _update<F extends SingleSourceFilter<InstanceType<TT>>>(executionOptions: ExecutionOptions, data: SimpleObject,  
        applyFilter: F | null, 
        isOneOnly: boolean,
        isDelete: boolean,
        actionOptions: Partial<DatabaseActionOptions<InstanceType<TT>>>
       ) {

        const context = this.#context
        const entityClass = this.#modelClass

        const schema = entityClass
        const actionName = isDelete?'delete':'update'

        const rootSource = entityClass.datasource('root')
        let propValues = await this._prepareNewData(data, schema, actionName, executionOptions)

        // let deleteMode: 'soft' | 'real' | null = null
        // if(isDelete){
        //     deleteMode = existingContext.isSoftDeleteMode ? 'soft': 'real'
        // }

        const realFieldValues = this.extractRealField(schema, propValues)
        const input = {
            updateSqlString: !isDelete && Object.keys(realFieldValues).length > 0? 
                            (applyFilter? new Dataset()
                                            .from( rootSource )
                                            .where(applyFilter): 
                                            new Dataset().from(rootSource ).native( qb => qb.update(realFieldValues)) ): null,
            selectSqlString: (applyFilter? new Dataset()
                                            .from(rootSource)
                                            .where(applyFilter):
                                        new Dataset().from(rootSource) ),
            entityData: data
        }

        const schemaPrimaryKeyFieldName = schema.id.fieldName(context.orm)
        const schemaPrimaryKeyPropName = schema.id.name

        let fns = await context.startTransaction(async (trx) => {
            if(!input.selectSqlString || !input.entityData){
                throw new Error('Unexpected Flow.')
            }
            let updateStmt = input.updateSqlString
            let selectStmt = input.selectSqlString.addNative( qb => qb.select( schemaPrimaryKeyFieldName ) )
            
            let pks: number[] = []
            if (context.client().startsWith('pg')) {
                let targetResult
                if(updateStmt){
                    updateStmt = updateStmt.native( qb => qb.returning(schemaPrimaryKeyFieldName) )
                    targetResult = await context.executeStatement(updateStmt, executionOptions)
                } else {
                    targetResult = await context.executeStatement(selectStmt, executionOptions)
                }
                let outputs = await Promise.all((targetResult.rows as SimpleObject[] ).map( async (row) => {
                    let pkValue = row[ schemaPrimaryKeyFieldName ]
                    let record = await this.findOne({
                        //@ts-ignore
                        where: {[schemaPrimaryKeyPropName]: pkValue}
                    }).withOptions(executionOptions)
                    let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
                    if(isDelete){
                        await context.executeStatement( new Dataset().from(rootSource).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                    }
                    // {
                    //     ...(querySelectAfterMutation? {select: querySelectAfterMutation}: {}),
                    //     where: { [entityClass.schema.primaryKey.name]: pkValue} 
                    // })

                    return finalRecord
                }))

                return outputs
            } else {

                if (context.client().startsWith('mysql')) {
                    let result = await context.executeStatement(selectStmt, executionOptions)
                    pks = result[0].map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
                } else if (context.client().startsWith('sqlite')) {
                    let result = await context.executeStatement(selectStmt, executionOptions)
                    pks = result.map( (r: SimpleObject) => r[schemaPrimaryKeyFieldName])
                } else {
                    throw new Error('NYI.')
                }

                if(isOneOnly){
                    if(pks.length > 1){
                        throw new Error('More than one records were found.')
                    } else if(pks.length === 0){
                        return []
                    }
                }
    
                return await Promise.all(pks.flatMap( async (pkValue) => {
                    if (context.client().startsWith('mysql')) {
                        if(updateStmt){
                            let updateResult = await context.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), executionOptions)
                            let numUpdates: number
                            numUpdates = updateResult[0].affectedRows
                            if(numUpdates > 1){
                                throw new Error('Unexpected flow.')
                            } else if(numUpdates === 0){
                                return null
                            } 
                        }
                        let record = await this.findOne({
                            //@ts-ignore
                            where: {[schemaPrimaryKeyPropName]: pkValue}
                        }).withOptions(executionOptions)
                        let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
                        if(isDelete){
                            await context.executeStatement( new Dataset().from(schema.datasource('root')).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                        }
                        return finalRecord
                        
                    } else if (context.client().startsWith('sqlite')) {
                        if(updateStmt){
                            let updateResult = await context.executeStatement(updateStmt.clone().addNative( qb => qb.andWhereRaw('?? = ?', [schemaPrimaryKeyFieldName, pkValue]) ), executionOptions)
                            let found = await this.findOne({
                                //@ts-ignore
                                where: {[schemaPrimaryKeyPropName]: pkValue}
                            }).withOptions(executionOptions)
                            let data = input.entityData!
                            let unmatchedKey = Object.keys(data).filter( k => data[k] !== (found as {[key:string]: any})[k])
                            if( unmatchedKey.length > 0 ){
                                console.log('Unmatched prop values', unmatchedKey.map(k => `${k}: ${data[k]} != ${(found as {[key:string]: any})[k]}` ))
                                throw new Error(`The record cannot be updated. `)
                            }
                        }
                        let record = await this.findOne({
                            //@ts-ignore
                            where: {[schemaPrimaryKeyPropName]: pkValue}
                        }).withOptions(executionOptions)
                        let finalRecord = await this.afterMutation( undoExpandRecursively(record), schema, actionName, propValues, executionOptions)
                        if(isDelete){
                            await context.executeStatement( new Dataset().from(schema.datasource('root')).native( qb => qb.where( {[schemaPrimaryKeyFieldName]: pkValue} ).del() ), executionOptions)
                        }
                        return finalRecord
                    } else {
                        throw new Error('NYI.')
                    }
                }))
            }


        }, executionOptions.trx)

        return fns.filter(notEmpty)
    }

    deleteOne<F extends SingleSourceFilter<InstanceType<TT>>>(data: PartialMutationEntityPropertyKeyValues<InstanceType<TT>>, applyFilter?: F): DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>, InstanceType<TT>>{
        return new DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>, InstanceType<TT>>(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< InstanceType<TT> > > ) => {
                let result = await this._update(executionOptions, data, applyFilter??null, true, true, actionOptions)
                return result[0] ?? null
            }
        )
    }

    delete<F extends SingleSourceFilter<InstanceType<TT>>>(data: SimpleObject, applyFilter?: F): DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>[], InstanceType<TT> >{
        return new DatabaseQueryRunner< EntityWithOptionalProperty<InstanceType<TT>, {}>[], InstanceType<TT>>(
            async (executionOptions: ExecutionOptions, actionOptions: Partial<DatabaseActionOptions< InstanceType<TT> > > ) => {
                let result = await this._update(executionOptions, data, applyFilter??null, false, true, actionOptions)
                return result
            }
        )
    }

    private extractRealField<S extends TableSchema>(schema: S, fieldValues: SimpleObject): any {
        const context = this.#context
        return Object.keys(fieldValues).reduce( (acc, key) => {
            let prop = schema.properties.find(p => p.name === key)
            if(!prop){
                throw new Error('Unexpected')
            }
            if(prop instanceof FieldProperty){
                acc[prop.fieldName(context.orm)] = fieldValues[key]
            }
            return acc
        }, {} as SimpleObject)        
    }
}
