import { Knex } from "knex"
import { Entity, Selector, QueryFunction, ApplyNextQueryFunction ,sealSelect} from "."

export const Relations = {
    // (SQL template) create a basic belongsTo prepared statement 
    has: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, applyFilter: ApplyNextQueryFunction) => {
            let relatedSelector = entityClass.newSelector()
            let stmt = sealSelect().from(relatedSelector.source).whereRaw("?? = ??", [rootSelector._.id, relatedSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    },

    relateThrough: (entityClass: typeof Entity, throughEntity: typeof Entity, relationPropName: string, ownerPropName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, applyFilter: ApplyNextQueryFunction) => {
            let relatedSelector = entityClass.newSelector()
            let throughSelector = throughEntity.newSelector()

            let stmt = sealSelect().from(relatedSelector.source)
                .joinRaw(`LEFT JOIN ${throughSelector.source} ON ${throughSelector._[relationPropName]} = ${relatedSelector._.id}`)
                .whereRaw("?? = ??", [rootSelector._.id, throughSelector._[ownerPropName]])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector, throughSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector, throughSelector), relatedSelector, throughSelector)
            }
        }
    },

    // (SQL template) create a basic belongsTo prepared statement 
    belongsTo: (entityClass: typeof Entity, propName: string, customFilter?: QueryFunction) => {
        return (rootSelector: Selector, applyFilter: ApplyNextQueryFunction) => {
            let relatedSelector = entityClass.newSelector()
            let stmt = sealSelect().from(relatedSelector.source).whereRaw("?? = ??", [relatedSelector._.id, rootSelector._[propName] ])

            if(!customFilter){
                return applyFilter(stmt, relatedSelector)
            } else{
                return applyFilter(customFilter(stmt, relatedSelector), relatedSelector)
            }
        }
    }
}