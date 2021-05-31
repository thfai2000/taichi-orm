import { Knex}  from "knex"
import { metaFieldAlias, Entity, getKnexInstance, Selector, SQLString, NamedProperty, quote } from "."


type SelectItem = {
    raw: Knex.Raw | any,
    actualAlias: string
}

export interface QueryBuilder extends Knex.QueryBuilder{
    __type: 'QueryBuilder'
    __selectItems: SelectItem[]
    __realSelect: Function
}

export interface Column extends Knex.Raw {
    __type: 'Column'
    __selector: Selector
    __namedProperty: NamedProperty | '*'
    __expression: Knex.QueryBuilder | undefined | null
}

export interface Source extends Knex.Raw {
    __type: 'Source'
    __selector: Selector
    __raw: string
    innerJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
    leftJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
    rightJoin(source: Source, leftColumn: Column, operator: string, rightColumn: Column): Source
}

const castAsQueryBuilder = (builder: Knex.QueryBuilder) : QueryBuilder => {
    //@ts-ignore
    if(builder.__type === 'QueryBuilder' ){
        return builder as QueryBuilder
    }
    throw new Error('Cannot cast into QueryBuilder. Please use the modified version of QueryBuilder.')
}

export const makeBuilder = function(mainSelector?: Selector) : QueryBuilder {
    let sealBuilder: QueryBuilder = getKnexInstance().clearSelect() as QueryBuilder
    
    // @ts-ignore
    sealBuilder.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    sealBuilder.__type = 'QueryBuilder'
    sealBuilder.__selectItems = []
    sealBuilder.__realSelect = sealBuilder.select
    // override the select methods
    sealBuilder.select = function(...args: any[]){

        let converted: SelectItem[] = args.flatMap( item => {

            if(item instanceof Promise){
                console.log('\x1b[33m%s\x1b[0m', 'Maybe you called any computed Property that is an Async Function but you haven\'t \'await\' it before placing it into the QueryBuilder.')
                throw new Error('Invalid Select Item.')
            } else if(item === '*'){
                throw new Error("Currently it doesn't support using '*'. Please use Selector.star")
            } else if(item.__type === 'Column' ){
                let casted = item as Column
                let selector = casted.__selector
                let prop = casted.__namedProperty
                let expression = casted.__expression

                if(expression){
                    if(prop === '*'){
                        throw new Error('Unexpected Flow.')
                    } else {
                        let definition = prop.definition
                        let finalExpr: string
                        if(definition.readTransform){
                            finalExpr = definition.readTransform(expression, extractColumns(expression)).toString()
                        } else {
                            finalExpr = expression.toSQL().sql
                        }
                        let a = metaFieldAlias(prop)
                        let raw = `(${finalExpr}) AS ${quote(a) }`
                         return [{
                            raw: makeRaw(raw),
                            actualAlias: a
                        }]
                    }
                }{
                    if(prop === '*'){
                        return selector.all.map( col => {
                            if(col.__namedProperty === '*'){
                                throw new Error('Unexpected Flow.')
                            }
                            return makeSelectItem(selector, col.__namedProperty)
                        })
                    } else {
                        return [makeSelectItem(selector, prop)]
                    }
                }
            }

            return [{
                raw: item,
                actualAlias: parseName(item)
            }]
        })

        this.__selectItems = this.__selectItems.concat(converted)

        return this.__realSelect(...converted.map(c => c.raw))
    }

    sealBuilder.clearSelect = function(){
        this.__selectItems = []
        return this.clearSelect()
    }

    //after the select is override, add default 'all'
    if(mainSelector){
        sealBuilder = sealBuilder.select(mainSelector.all) as QueryBuilder
    }

    return sealBuilder
}

export const makeRaw = (first: any, ...args: any[]) => {
    let r = getKnexInstance().raw(first, ...args)
    // @ts-ignore
    r.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    return r
}

export const makeColumn = (selector: Selector, prop: NamedProperty | '*', expression?: Knex.QueryBuilder): Column => {

    let tableAlias = quote(selector.tableAlias)
    let fieldName: string = prop === '*'? prop : quote(prop.fieldName)
    
    let raw: string
    if(expression){
        raw = `(${expression})`
    }{
        raw = `${tableAlias}.${fieldName}`
    }

    let column: Column = makeRaw(raw) as Column
    column.__type = 'Column'
    column.__expression = expression
    column.__namedProperty = prop
    column.__selector = selector
    return column
}

export const makeSource = (joinText: string | null, selector: Selector, leftColumn?: Column, operator?: string, rightColumn?: Column): Source => {
    let t = `${quote(selector.schema.tableName)} AS ${quote(selector.tableAlias)}`

    joinText  = (joinText ?? '').trim()

    let raw = `${joinText} ${t}${joinText.length === 0?'':` ON ${leftColumn} ${operator} ${rightColumn}`}`

    let target = makeRaw(raw) as Source
    target.__type = 'Source'
    target.__selector = selector
    target.__raw = raw
    
    target.innerJoin = (source: Source, leftColumn: Column, operator: string, rightColumn: Column) => {
        let s = makeSource(`${target.__raw} INNER JOIN`, source.__selector, leftColumn, operator, rightColumn)
        return s
    }

    target.leftJoin = (source: Source, leftColumn: Column, operator: string, rightColumn: Column) => {
        let s = makeSource(`${target.__raw} LEFT JOIN`, source.__selector, leftColumn, operator, rightColumn)
        return s
    }

    target.rightJoin = (source: Source, leftColumn: Column, operator: string, rightColumn: Column) => {
        let s = makeSource(`${target.__raw} RIGHT JOIN`, source.__selector, leftColumn, operator, rightColumn)
        return s
    }
    return target
}

export const extractColumns = (builder: Knex.QueryBuilder): string[] => {

    let ourBuilder = castAsQueryBuilder(builder)

    return ourBuilder.__selectItems.map(item => {
        return item.actualAlias
    })
}

const parseName = (item: any) => {
    let text = item.toString().trim()

    let e = /((?<![\\])[`'"])((?:.(?!(?<![\\])\1))*.?)\1/g
    let r = e.exec(text)
    if(r){
        let last = r[0]
        while( (r = e.exec(text) )){
            last = r[0]
        }
        return last
    } else {
        let e = /\b[\. ]+([a-zA-Z0-9\_\$]*)$/
        let r = e.exec(text)
        if(r && r[1]){
            return r[1]
        }else {
            return text
        }
    }
}

function makeSelectItem(selector: Selector, prop: NamedProperty): SelectItem {
    let tableAlias = quote(selector.tableAlias)
    let fieldName: string = quote(prop.fieldName)
    let a = metaFieldAlias(prop)
    let raw = `${tableAlias}.${fieldName} AS ${quote(a)}`
    return {
        raw: makeRaw(raw),
        actualAlias: a
    }
}
// const extractColumnName = () => {

//     let columnsToBeTransformed: string[] = []
//     if( ast.type === 'select'){
//         let selectAst = ast
//         let columns = ast.columns
        
//         // then handle select items... expand columns

//         const handleColumns = (from: any[] | null, columns: any[] | Column[] | '*'): any[] | Column[] => {
//             if(columns === '*'){
//                 columns = [{
//                     expr: {
//                         type: 'column_ref',
//                         table: null,
//                         column: '*'
//                     },
//                     as: null
//                 }]
//             }

//             return columns.flatMap( (col: Column) => {
//                 if(col.expr.type === 'column_ref' && ( col.expr.column.includes('*') || col.expr.column.includes('$star') ) ){
//                     // if it is *... expand the columns..
//                     let moreColumns = Database._resolveStar(col, from)
//                     return moreColumns
//                     // @ts-ignore
//                 } else if(!col.as && col.expr.type === 'select' && col.expr.columns.length === 1){
//                     // @ts-ignore
//                     col.as = col.expr.columns[0].as
//                     if(!col.as){
//                         throw new Error('Unexpected Flow.')
//                     }
//                     return col
//                 } else {

//                     if(!col.as){
//                         col.as = makeid(5)
//                     }
//                     return col
//                 }
//             })
            
//         }

//         let processedColumns = handleColumns(selectAst.from, columns) as Column[]

//         //eliminate duplicated columns

//         processedColumns = processedColumns.reduce( (acc: any[], item: SimpleObject) => {
//             if( !acc.find( (x:any) => item.as === x.as ) ){
//                 acc.push(item)
//             }
//             return acc
//         },[] as any[])

//         columnsToBeTransformed = processedColumns.flatMap( (col: any) => {
//             return Database._extractColumnAlias(col) 
//         }) as string[]
    
//         ast.columns = processedColumns
//         subqueryString = getSqlParser().sqlify(ast)
//     } else {
//         throw new Error('Computed property must be started with Select')
//     }


// }

// export type QueryBuilderAccessableField = string | CompiledNamedPropertyGetter | CompiledNamedProperty | CompiledNamedPropertyWithSubQuery

// const resolveItem = (a: any, withoutAs: boolean = false) => {
//     if(a instanceof CompiledNamedPropertyWithSubQuery){
//         // it should be computedProp
//         let compiledNamedProperty = a.compiledNamedProperty
//         let derivedContent = a.subquery

//         if(withoutAs){
//             return `${derivedContent}`
//         } else {
//             return `${derivedContent} AS ${compiledNamedProperty.fieldAlias}`
//         }
//     } else if (a instanceof CompiledNamedPropertyGetter){
//         // it should be normal field prop
//         let compiledNamedProperty = a.get() as CompiledNamedProperty
//         return `${compiledNamedProperty.tableAlias}.${compiledNamedProperty.fieldName}`

//     } else if (a instanceof CompiledNamedProperty){
//         return `${a.tableAlias}.${a.fieldName}`
//     } else {
//         return a
//     }
// }

// export class QueryBuilder {

//     selectItems: Array<string> = new Array<string>()
//     fromItems: Array<string> = new Array<string>()
//     whereItems: Array<string> = new Array<string>()
//     limitValue: number | null = null
//     offsetValue: number | null = null

//     constructor(){
//     }

//     select(...args: Array<QueryBuilderAccessableField>){
//         let selectItems = args.map(a => {
//             let resolved = resolveItem(a)
//             if (typeof resolved === 'string'){
//                 //typeof a === 'boolean' || typeof a === 'number' || a instanceof Date
//                 return resolved
//             } else {
//                 throw new Error('Not supported Select Item.')
//             }
//         })
//         this.selectItems = selectItems
//         return this
//     }

//     from(...args: string[]){
//         this.fromItems = args
//         return this
//     }

//     whereRaw(rawSql: string, args: any[]){
//         let r = getKnexInstance().raw(rawSql, args.map(a => resolveItem(a, true)))
//         this.whereItems = this.whereItems.concat([r.toString()])
//         return this
//     }

//     where(...args: any[]){
//         args = args.map(a => resolveItem(a, true))
//         if(args.length === 1 && args[0] instanceof Object){
//             let map = args[0] as {[key:string]:any}
//             let items = Object.keys(map).map( (key) => `?? = ?`)
//             let values = Object.keys(map).reduce( (params, key) => {
//                 let arr = [key, map[key]]
//                 return params.concat(arr)
//             }, [] as any[])

//             let raw = getKnexInstance().raw( items.join(' AND '), values)

//             this.whereItems = this.whereItems.concat([raw.toString()])

//         } else if(args.length === 1 && typeof args[0] === 'string'){
//             this.whereItems = this.whereItems.concat([args[0]])
//         } else {
//             this.whereItems = this.whereItems.concat([args.join(' ')])
//         }
//         return this
//     }

//     limit(value: number){
//         this.limitValue = value
//         return this
//     }

//     offset(value: number){
//         this.offsetValue = value
//         return this
//     }

//     toString(): string{
//         let selectItem = this.selectItems
//         if(this.fromItems.length > 0 && selectItem.length === 0){
//             selectItem = selectItem.concat('*')
//         }
//         // throw new Error('NYI')
//         return `SELECT ${selectItem.join(', ')}${
//             this.fromItems.length > 0?' FROM ':''}${
//             this.fromItems.join(', ')}${
//             this.whereItems.length > 0?' WHERE ':''}${
//             this.whereItems.join(', ')}${
//             this.offsetValue === null?'':` OFFSET ${this.offsetValue} `}${
//             this.limitValue === null?'':` LIMIT ${this.limitValue} `
//         }`
//     }
// }

// export class MutationBuilder implements SQLString{

//     stmt: any

//     constructor(){
//     }

//     update(...args: any[]){
//         return this
//     }

//     from(...args: any[]){
//         return this
//     }

//     where(...args: any[]){
//         return this
//     }

//     toString(): string{
//         throw new Error('NYI')
//     }
// }


