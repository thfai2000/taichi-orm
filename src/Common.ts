import { makeBuilder } from "./Builder"
import { Entity, Selector, QueryFunction, ApplyNextQueryFunction, ComputeArguments, ComputeFunction, MutateFunction, ExecutionContext, NamedProperty, Types} from "."
import { NotContain } from "./Operator"
import { PropertyDefinition } from "./PropertyType"

export const ComputeFn = {
    // (SQL template) create a basic belongsTo prepared statement 
    relatedFrom: (entityClass: string, propName: string, customFilter?: QueryFunction): ComputeFunction => {
        return function relatedFromFn(rootSelector: Selector, args: ComputeArguments, context: ExecutionContext, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = context.models[entityClass].selector()
            let stmt = makeBuilder(relatedSelector).whereRaw("?? = ??", [rootSelector.pk, relatedSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    },

    relatesThrough: (entityClass: string, throughEntity: string, throughPropNameAsRelated: string, throughPropNameAsTarget: string, customFilter?: QueryFunction): ComputeFunction => {
        return function relatesThroughFn(rootSelector: Selector, args: ComputeArguments, context: ExecutionContext, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = context.models[entityClass].selector()
            let throughSelector = context.models[throughEntity].selector()

            // let stmt = makeBuilder().select(relatedSelector.all).from(relatedSelector.source)
            //     .joinRaw(`INNER JOIN ${throughSelector.sourceRaw} ON ${throughSelector._[relationPropName]} = ${relatedSelector._.id}`)
            //     .whereRaw("?? = ??", [rootSelector._.id, throughSelector._[ownerPropName]])

            let stmt = makeBuilder().select(...relatedSelector.all).from(
                    relatedSelector.source.innerJoin(
                        throughSelector.source, 
                        throughSelector._[throughPropNameAsRelated],
                        '=',
                        relatedSelector.pk
                    )
                ).whereRaw("?? = ??", [rootSelector.pk, throughSelector._[throughPropNameAsTarget]])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector, throughSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector, throughSelector), relatedSelector, throughSelector)
            }
        }
    },

    relatesTo: (entityClass: string, propName: string, customFilter?: QueryFunction): ComputeFunction => {
        return function relatesToFn(rootSelector: Selector, args: ComputeArguments, context: ExecutionContext, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = context.models[entityClass].selector()
            let stmt = makeBuilder(relatedSelector).whereRaw("?? = ??", [relatedSelector.pk, rootSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    }
}

export const MutateFn = {

    mutateOwned: (entityClassName: string, propName: string) => {
        return async function(this: PropertyDefinition, actionName: string, data: any, rootValue: Entity, context: ExecutionContext) {
            
            const entityClass = context.models[entityClassName]
            const rootClass = rootValue.entityClass

            if( !Array.isArray(data) && this.propertyValueIsArray ){
                throw new Error('data must be an array')
            }

            let inputData: any[]
            if(!this.propertyValueIsArray){
                inputData = [data]
            }else{
                inputData = data
            }

            const pkNameOfOwned = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(actionName === 'create'){

                let created = entityClass.createEach(inputData.map(d => ({
                    ...d,
                    [propName]: pkValueOfRoot
                }))).usingContext(context)
                return created

            } else if(actionName === 'update') {

                let dataWithIds = inputData.filter(d => d[pkNameOfOwned])
                let dataWithoutIds = inputData.filter(d => !d[pkNameOfOwned])

                let records = await Promise.all(dataWithIds.map( async(d) => {
                    return await entityClass.updateOne(d, {
                        [pkNameOfOwned]: d[pkNameOfOwned]
                    }).usingContext(context)
                }))

                let created = await entityClass.createEach(dataWithoutIds.map(d => ({
                    ...d,
                    [propName]: pkValueOfRoot
                }))).usingContext(context)

                const result = [...records, ...created]

                await entityClass.delete({}, {
                    [pkNameOfOwned]: NotContain( result.map(c =>  c[pkNameOfOwned]) ),
                    [propName]: pkValueOfRoot
                }).usingContext(context)

                return result
            } else if (actionName === 'delete') {

                return await entityClass.delete({}, {
                    [propName]: pkValueOfRoot
                }).usingContext(context)

            } else {
                throw new Error(`Unexpected Action Name '${actionName}'`)
            }
        }
    },

    mutateRelatedFrom: (entityClassName: string, propName: string) => {
        return async function(this: PropertyDefinition, actionName: string, data: any, rootValue: Entity, context: ExecutionContext) {
            
            const entityClass = context.models[entityClassName]
            const rootClass = rootValue.entityClass

            if( !Array.isArray(data) && this.propertyValueIsArray ){
                throw new Error('data must be an array')
            }

            let inputData: any[]
            if(!this.propertyValueIsArray){
                inputData = [data]
            }else{
                inputData = data
            }

            const pkNameOfRelatedFrom = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(actionName === 'create' || actionName === 'update') {

                let dataWithIds = inputData.filter(d => d[pkNameOfRelatedFrom])
                let dataWithoutIds = inputData.filter(d => !d[pkNameOfRelatedFrom])
                if(dataWithoutIds.length > 0){
                    throw new Error('Not allow.')
                }
                
                // remove all existing related
                await entityClass.update({
                    [propName]: null
                }, {
                    [propName]: pkValueOfRoot,
                    [pkNameOfRelatedFrom]: NotContain(dataWithIds)
                }).usingContext(context)

                // add new related
                let records = await Promise.all(dataWithIds.map( async(d) => {
                    return await entityClass.updateOne({
                        [propName]: pkValueOfRoot
                    }, {
                        [pkNameOfRelatedFrom]: d[pkNameOfRelatedFrom]
                    }).usingContext(context)
                }))

                return records
            } else if (actionName === 'delete') {

                // remove all existing related
                await entityClass.update({
                    [propName]: null
                }, {
                    [propName]: pkValueOfRoot
                }).usingContext(context)

                return []
            } else {
                throw new Error(`Unexpected Action Name '${actionName}'`)
            }
        }
    },

    mutateRelatedTo: (entityClassName: string, propName: string) => {
        return async function(this: PropertyDefinition, actionName: string, data: any, rootValue: Entity, context: ExecutionContext) {
            const entityClass = context.models[entityClassName]
            const rootClass = rootValue.entityClass

            if( !Array.isArray(data) && this.propertyValueIsArray ){
                throw new Error('data must be an array')
            }

            if(this.propertyValueIsArray){
                throw new Error('Unexpected')
            }

            const pkNameOfRelatedTo = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(actionName === 'create' || actionName === 'update'){

                await rootClass.updateOne({[propName]: data[pkNameOfRelatedTo]}, {
                    [pkNameOfRoot]: pkValueOfRoot
                }).usingContext(context)

                return await entityClass.findOne({[pkNameOfRelatedTo]: data[pkNameOfRelatedTo]}).usingContext(context)

            } else if (actionName === 'delete') {
                //remove relation
                await rootClass.updateOne({[propName]: null}, {
                    [pkNameOfRoot]: pkValueOfRoot
                }).usingContext(context)

                return null
            } else {
                throw new Error(`Unexpected Action Name '${actionName}'`)
            }
        }
    }
}

export const ClassicRelation = {

    ownMany: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
        return new Types.ArrayOf(new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter),
            mutate: MutateFn.mutateOwned(entityClass, relatedByPropName)
        }))
    },

    ownOne: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
        return new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter),
            mutate: MutateFn.mutateOwned(entityClass, relatedByPropName)
        })
    },
    
    hasMany: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
        return new Types.ArrayOf(new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter),
            mutate: MutateFn.mutateRelatedFrom(entityClass, relatedByPropName)
        }))
    },

    hasOne: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
        return new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter),
            mutate: MutateFn.mutateRelatedFrom(entityClass, relatedByPropName)
        })
    },

    belongsTo: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
        return new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatesTo(entityClass, relatedByPropName, customFilter),
            mutate: MutateFn.mutateRelatedTo(entityClass, relatedByPropName)
        })
    },

    hasManyThrough: (entityClass: string, throughEntity: string, throughPropNameAsRelated: string, throughPropNameAsTarget: string, customFilter?: QueryFunction) => {
        return new Types.ArrayOf(new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatesThrough(entityClass, throughEntity, throughPropNameAsRelated, throughPropNameAsTarget, customFilter)
        }))
    },

    hasOneThrough: (entityClass: string, throughEntity: string, throughPropNameAsRelated: string, throughPropNameAsTarget: string, customFilter?: QueryFunction) => {
        return new Types.ObjectOf(entityClass, {
            compute: ComputeFn.relatesThrough(entityClass, throughEntity, throughPropNameAsRelated, throughPropNameAsTarget, customFilter)
        })
    }
}