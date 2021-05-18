import knex, { Knex } from "knex"
import { getKnexInstance, SQLString, CompiledNamedProperty, CompiledNamedPropertyWithSubQuery } from "."

export type QueryBuilderAccessableField = string | Function | CompiledNamedProperty | CompiledNamedPropertyWithSubQuery

// export const raw = (rawSql: string, args: any[]) => {
    
// }

const resolveItem = (a: any, withoutAs: boolean = false) => {
    if(a instanceof CompiledNamedPropertyWithSubQuery){
        // it should be computedProp
        let compiledNamedProperty = a.compiledNamedProperty
        let derivedContent = a.subquery

        if(withoutAs){
            return `${derivedContent}`
        } else {
            return `${derivedContent} AS ${compiledNamedProperty.fieldAlias}`
        }
    } else if (a instanceof Function){
        // it should be normal field prop
        let compiledNamedProperty = a() as CompiledNamedProperty
        return `${compiledNamedProperty.tableAlias}.${compiledNamedProperty.fieldName}`

    } else if (a instanceof CompiledNamedProperty){
        return `${a.tableAlias}.${a.fieldName}`
    } else {
        return a
    }
}

export class QueryBuilder implements SQLString{

    selectItems: Array<string> = new Array<string>()
    fromItems: Array<string> = new Array<string>()
    whereItems: Array<string> = new Array<string>()
    limitValue: number | null = null
    offsetValue: number | null = null

    constructor(){
    }

    select(...args: Array<QueryBuilderAccessableField>){
        let selectItems = args.map(a => {
            let resolved = resolveItem(a)
            if (typeof resolved === 'string'){
                //typeof a === 'boolean' || typeof a === 'number' || a instanceof Date
                return resolved
            } else {
                throw new Error('Not supported Select Item.')
            }
        })
        this.selectItems = selectItems
        return this
    }

    from(...args: string[]){
        this.fromItems = args
        return this
    }

    whereRaw(rawSql: string, args: any[]){
        let r = getKnexInstance().raw(rawSql, args.map(a => resolveItem(a, true)))
        this.whereItems = this.whereItems.concat([r.toString()])
        return this
    }

    where(...args: any[]){
        args = args.map(a => resolveItem(a, true))
        if(args.length === 1 && args[0] instanceof Object){
            let map = args[0] as {[key:string]:any}
            let items = Object.keys(map).map( (key) => `?? = ?`)
            let values = Object.keys(map).reduce( (params, key) => {
                let arr = [key, map[key]]
                return params.concat(arr)
            }, [] as any[])

            let raw = getKnexInstance().raw( items.join(' AND '), values)

            this.whereItems = this.whereItems.concat([raw.toString()])

        } else if(args.length === 1 && typeof args[0] === 'string'){
            this.whereItems = this.whereItems.concat([args[0]])
        } else {
            this.whereItems = this.whereItems.concat([args.join(' ')])
        }
        return this
    }

    limit(value: number){
        this.limitValue = value
        return this
    }

    offset(value: number){
        this.offsetValue = value
        return this
    }

    toString(): string{
        let selectItem = this.selectItems
        if(this.fromItems.length > 0 && selectItem.length === 0){
            selectItem = selectItem.concat('*')
        }
        // throw new Error('NYI')
        return `SELECT ${selectItem.join(', ')}${
            this.fromItems.length > 0?' FROM ':''}${
            this.fromItems.join(', ')}${
            this.whereItems.length > 0?' WHERE ':''}${
            this.whereItems.join(', ')}${
            this.offsetValue === null?'':` OFFSET ${this.offsetValue} `}${
            this.limitValue === null?'':` LIMIT ${this.limitValue} `
        }`
    }
}

export class MutationBuilder implements SQLString{

    stmt: any

    constructor(){
    }

    update(...args: any[]){
        return this
    }

    from(...args: any[]){
        return this
    }

    where(...args: any[]){
        return this
    }

    toString(): string{
        throw new Error('NYI')
    }
}


