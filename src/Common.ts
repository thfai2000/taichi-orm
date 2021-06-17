import { Knex } from "knex"
import { makeBuilder } from "./Builder"
import { Entity, Selector, QueryFunction, ApplyNextQueryFunction, ComputeArguments, ComputeFunction, ExecutionContext} from "."
import { MutateFunction } from "./PropertyType"

export const ComputeFn = {
    // (SQL template) create a basic belongsTo prepared statement 
    relatedFrom: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction) => {
            let relatedSelector = entityClass.newSelector()
            let stmt = makeBuilder(relatedSelector).whereRaw("?? = ??", [rootSelector._.id, relatedSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    },

    relatesThrough: (entityClass: typeof Entity, throughEntity: typeof Entity, relationPropName: string, ownerPropName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction) => {
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
                        relatedSelector._.id
                    )
                ).whereRaw("?? = ??", [rootSelector._.id, throughSelector._[ownerPropName]])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector, throughSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector, throughSelector), relatedSelector, throughSelector)
            }
        }
    },

    relatesTo: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, args: ComputeArguments, applyFilter: ApplyNextQueryFunction) => {
            let relatedSelector = entityClass.newSelector()
            let stmt = makeBuilder(relatedSelector).whereRaw("?? = ??", [relatedSelector._.id, rootSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    }
}


// export const MutateFn : {[key:string]:  (...args: any[]) => MutateFunction} = {

//     hasCollection: (entityClass: typeof Entity, propName: string) => {
//         return (actionName: string, data: any, rootValue: Entity, existingContext: ExecutionContext) => {

//             if(!Array.isArray(data)){
//                 throw new Error('data must be array')
//             }

//             if( ['default', 'replace'].includes(actionName) ){

//                 entityClass.delete().usingContext(existingContext)

//                 let created = entityClass.createEach(data.map(d => ({
//                     ...d,
//                     [propName]: rootValue.id
//                 }))).usingContext(existingContext)

//                 return created
//             }
//         }
//     }


// }