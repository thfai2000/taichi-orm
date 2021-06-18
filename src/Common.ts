import { makeBuilder } from "./Builder"
import { Entity, Selector, QueryFunction, ApplyNextQueryFunction, ComputeArguments, ComputeFunction, MutateFunction, ExecutionContext, NamedProperty} from "."
import { NotContain } from "./Operator"

export const ComputeFn = {
    // (SQL template) create a basic belongsTo prepared statement 
    relatedFrom: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return function relatedFromFn(rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = entityClass.newSelector()
            let stmt = makeBuilder(relatedSelector).whereRaw("?? = ??", [rootSelector.pk, relatedSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    },

    relatesThrough: (entityClass: typeof Entity, throughEntity: typeof Entity, relationPropName: string, ownerPropName: string, customFilter?: QueryFunction) => {
        return function relatesThroughFn(rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = entityClass.newSelector()
            let throughSelector = throughEntity.newSelector()

            // let stmt = makeBuilder().select(relatedSelector.all).from(relatedSelector.source)
            //     .joinRaw(`INNER JOIN ${throughSelector.sourceRaw} ON ${throughSelector._[relationPropName]} = ${relatedSelector._.id}`)
            //     .whereRaw("?? = ??", [rootSelector._.id, throughSelector._[ownerPropName]])

            let stmt = makeBuilder().select(...relatedSelector.all).from(
                    relatedSelector.source.innerJoin(
                        throughSelector.source, 
                        throughSelector._[relationPropName],
                        '=',
                        relatedSelector.pk
                    )
                ).whereRaw("?? = ??", [rootSelector.pk, throughSelector._[ownerPropName]])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector, throughSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector, throughSelector), relatedSelector, throughSelector)
            }
        }
    },

    relatesTo: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return function relatesToFn(rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction){
            let relatedSelector = entityClass.newSelector()
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

    mutateOwned: (entityClass: typeof Entity, propName: string) => {
        return async function(this: typeof NamedProperty, actionName: string, data: any, rootValue: Entity, existingContext: ExecutionContext) {
            
            const prop = this
            const rootClass = rootValue.entityClass

            if(!Array.isArray(data)){
                throw new Error('data must be array')
            }

            const pkName = entityClass.schema.primaryKey.name
            const pkNameForRoot = rootClass.schema.primaryKey.name

            if(actionName === 'create'){

                let created = entityClass.createEach(data.map(d => ({
                    ...d,
                    [propName]: rootValue[pkNameForRoot]
                }))).usingContext(existingContext)
                return created

            } else if(actionName === 'update') {

                let dataWithIds = data.filter(d => d[pkName])
                let dataWithoutIds = data.filter(d => !d[pkName])

                let records = await Promise.all(dataWithIds.map( async(d) => {
                    return await entityClass.updateOne(d, {
                        [pkName]: d[pkName]
                    }).usingContext(existingContext)
                }))

                let created = await entityClass.createEach(dataWithoutIds.map(d => ({
                    ...d,
                    [propName]: rootValue.pk
                }))).usingContext(existingContext)

                const result = [...records, ...created]

                await entityClass.delete({}, {
                    [pkName]: NotContain( result.map(c =>  c[pkName]) ),
                    [propName]: rootValue[pkNameForRoot]
                }).usingContext(existingContext)

                return result
            } else if (actionName === 'delete') {

                return await entityClass.delete({}, {
                    [propName]: rootValue[pkNameForRoot]
                }).usingContext(existingContext)

            } else {
                throw new Error(`Unexpected Action Name '${actionName}'`)
            }
        }
    },
    mutateLinkage: (entityClass: typeof Entity, propName: string) => {

    }
}