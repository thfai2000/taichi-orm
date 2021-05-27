import { Entity, Selector, QueryFunction, sealSelect, SQLString} from "."

export const Relations = {
    // (SQL template) create a basic belongsTo prepared statement 
    hasMany: (entityClass: typeof Entity, propName: string) => {
        return (rootSelector: Selector, applyFilter: QueryFunction): SQLString => {
            let relatedSelector = entityClass.newSelector()
            let stmt = sealSelect().from(relatedSelector.source).whereRaw("?? = ??", [rootSelector._.id, relatedSelector._[propName] ])
            return applyFilter(stmt, relatedSelector)
        }
    },

    // (SQL template) create a basic belongsTo prepared statement 
    belongsTo: (entityClass: typeof Entity, propName: string) => {
        return (rootSelector: Selector, applyFilter: QueryFunction): SQLString => {
            let relatedSelector = entityClass.newSelector()
            let stmt = sealSelect().from(relatedSelector.source).whereRaw("?? = ??", [relatedSelector._.id, rootSelector._[propName] ])
            return applyFilter(stmt, relatedSelector)
        }
    }
}