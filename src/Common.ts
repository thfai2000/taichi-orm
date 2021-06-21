import { makeBuilder } from "./Builder"
import { Schema, Selector, QueryFunction, ApplyNextQueryFunction, ComputeArguments, ComputeFunction, ExecutionContext, NamedProperty, Types, HookAction, Hook, HookInfo, HookName} from "."
import { NotContain } from "./Operator"

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

    mutateOwned: (schema: Schema, propName: string, entityClassName: string, relatedByPropName: string) => {

        schema.hook(new Hook('afterMutation', async (context: ExecutionContext, rootValue: any, info: HookInfo) => {
            const {rootClassName, propertyName, propertyValue, propertyDefinition, mutationName} = info

            const entityClass = context.models[entityClassName]
            const rootClass = context.models[rootClassName]

            if(propertyName === null || propertyValue === null || propertyDefinition === null){
                throw new Error('Unexpected')
            }

            if( !Array.isArray(propertyValue) && propertyDefinition.propertyValueIsArray ){
                throw new Error('[Hook] data must be an array')
            }

            let inputData: any[]
            if(!propertyDefinition.propertyValueIsArray){
                inputData = [propertyValue]
            }else{
                inputData = propertyValue
            }

            const pkNameOfOwned = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(mutationName === 'create'){

                let created = await entityClass.createEach(inputData.map(d => ({
                    ...d,
                    [relatedByPropName]: pkValueOfRoot
                }))).usingContext(context)

                rootValue[propertyName] = created
                return rootValue

            } else if(mutationName === 'update') {

                let dataWithIds = inputData.filter(d => d[pkNameOfOwned])
                let dataWithoutIds = inputData.filter(d => !d[pkNameOfOwned])

                let records = await Promise.all(dataWithIds.map( async(d) => {
                    return await entityClass.updateOne(d, {
                        [pkNameOfOwned]: d[pkNameOfOwned]
                    }).usingContext(context)
                }))

                let created = await entityClass.createEach(dataWithoutIds.map(d => ({
                    ...d,
                    [relatedByPropName]: pkValueOfRoot
                }))).usingContext(context)

                const result = [...records, ...created]

                await entityClass.delete({}, {
                    [pkNameOfOwned]: NotContain( result.map(c =>  c[pkNameOfOwned]) ),
                    [relatedByPropName]: pkValueOfRoot
                }).usingContext(context)

                rootValue[propertyName] = result

                return rootValue

            } else if (mutationName === 'delete') {

                let result = await entityClass.delete({}, {
                    [relatedByPropName]: pkValueOfRoot
                }).usingContext(context)

                rootValue[propertyName] = []
                return rootValue

            } else {
                throw new Error(`Unexpected Action Name '${mutationName}'`)
            }
                        
        }).onPropertyChange(propName))
    },

    mutateRelatedFrom: (schema: Schema, propName: string, entityClassName: string, relatedByPropName: string) => {
        return schema.hook(new Hook('afterMutation', async (context: ExecutionContext, rootValue: any, info: HookInfo) => {
            const {rootClassName, propertyName, propertyValue, propertyDefinition, mutationName} = info

            // console.log('ssssssssss', mutationName, schema.entityName, propertyName, entityClassName, relatedByPropName)

            const entityClass = context.models[entityClassName]
            const rootClass = context.models[rootClassName]

            if(propertyName === null || propertyValue === null || propertyDefinition === null){
                throw new Error('Unexpected')
            }

            if( !Array.isArray(propertyValue) && propertyDefinition.propertyValueIsArray ){
                throw new Error('data must be an array')
            }
            // console.log('yyyyyy', propertyValue, propertyDefinition)
            let inputData: any[]
            if(!propertyDefinition.propertyValueIsArray){
                inputData = [propertyValue]
            }else{
                inputData = propertyValue
            }

            const pkNameOfRelatedFrom = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(mutationName === 'create' || mutationName === 'update') {

                // console.log('zzzzzz', inputData, propertyDefinition, schema.entityName, propName, entityClassName, relatedByPropName)

                let dataWithPks = inputData.filter(d => d[pkNameOfRelatedFrom])
                let dataWithoutPks = inputData.filter(d => !d[pkNameOfRelatedFrom])
                if(dataWithoutPks.length > 0){
                    throw new Error('Not allow.')
                }
                // console.log('ccccc', propertyName, relatedByPropName, pkValueOfRoot, pkNameOfRelatedFrom)
                // remove all existing related
                await entityClass.update({
                    [relatedByPropName]: null
                }, {
                    [relatedByPropName]: pkValueOfRoot,
                    [pkNameOfRelatedFrom]: NotContain(dataWithPks.map(d => d[pkNameOfRelatedFrom]))
                }).usingContext(context)

                // add new related
                let records = await Promise.all(dataWithPks.map( async(d) => {
                    return await entityClass.updateOne({
                        [relatedByPropName]: pkValueOfRoot
                    }, {
                        [pkNameOfRelatedFrom]: d[pkNameOfRelatedFrom]
                    }).usingContext(context)
                }))
                rootValue[propertyName] = records
                return rootValue
            } else if (mutationName === 'delete') {

                // remove all existing related
                let records = await entityClass.update({
                    [relatedByPropName]: null
                }, {
                    [relatedByPropName]: pkValueOfRoot
                }).usingContext(context)

                rootValue[propertyName] = []
                return rootValue

            } else {
                throw new Error(`Unexpected Action Name '${mutationName}'`)
            }
        }).onPropertyChange(propName))
    },

    mutateRelatedTo: (schema: Schema, propName: string, entityClassName: string, relatedByPropName: string) => {
        schema.hook(new Hook('beforeMutation', async (context: ExecutionContext, rootValue: any, info: HookInfo) => {
            const {rootClassName, propertyName, propertyValue, propertyDefinition, mutationName} = info

            const entityClass = context.models[entityClassName]
            const rootClass = context.models[rootClassName]

            if(propertyName === null || propertyValue === null || propertyDefinition === null){
                throw new Error('Unexpected')
            }

            if( !Array.isArray(propertyValue) && propertyDefinition.propertyValueIsArray ){
                throw new Error('[Hook] data must be an array')
            }

            if(propertyDefinition.propertyValueIsArray){
                throw new Error('Unexpected')
            }

            const pkNameOfRelatedTo = entityClass.schema.primaryKey.name
            const pkNameOfRoot = rootClass.schema.primaryKey.name
            const pkValueOfRoot = rootValue[pkNameOfRoot]

            if(mutationName === 'create' || mutationName === 'update'){

                let f = await entityClass.findOne({[pkNameOfRelatedTo]: rootValue[relatedByPropName] ?? rootValue[propertyName][pkNameOfRelatedTo] }).usingContext(context)
                if(!f){
                    throw new Error('[Hook] Cannot find the related entity.')
                }
                rootValue[relatedByPropName] = f[pkNameOfRelatedTo]
                rootValue[propertyName] = f

                // console.log('xxxxx', propertyName, f)

                return rootValue

            } else if (mutationName === 'delete') {

                rootValue[relatedByPropName] = null
                rootValue[propertyName] = null

                return rootValue
            } else {
                throw new Error(`[Hook] Unexpected Action Name '${mutationName}'`)
            }
        }).onPropertyChange(propName))
    }
}

export const relationProp = function(schema: Schema, propName: string){

    return {

        ownMany: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ArrayOf(new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter)
            })))

            MutateFn.mutateOwned(schema, propName, entityClass, relatedByPropName)
        },

        ownOne: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter)
            }))

            MutateFn.mutateOwned(schema, propName, entityClass, relatedByPropName)
        },
        
        hasMany: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ArrayOf(new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter)
            })))

            MutateFn.mutateRelatedFrom(schema, propName, entityClass, relatedByPropName)
        },

        hasOne: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatedFrom(entityClass, relatedByPropName, customFilter)
            }))

            MutateFn.mutateRelatedFrom(schema, propName, entityClass, relatedByPropName)
        },

        belongsTo: (entityClass: string, relatedByPropName: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatesTo(entityClass, relatedByPropName, customFilter)
            }))

            MutateFn.mutateRelatedTo(schema, propName, entityClass, relatedByPropName)
        },

        hasManyThrough: (entityClass: string, throughEntity: string, throughPropNameAsRelated: string, throughPropNameAsTarget: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ArrayOf(new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatesThrough(entityClass, throughEntity, throughPropNameAsRelated, throughPropNameAsTarget, customFilter)
            })))
        },

        hasOneThrough: (entityClass: string, throughEntity: string, throughPropNameAsRelated: string, throughPropNameAsTarget: string, customFilter?: QueryFunction) => {
            schema.prop(propName, new Types.ObjectOf(entityClass, {
                compute: ComputeFn.relatesThrough(entityClass, throughEntity, throughPropNameAsRelated, throughPropNameAsTarget, customFilter)
            }))
        }
    }

}  
