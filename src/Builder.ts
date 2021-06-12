import { Knex}  from "knex"
import { metaFieldAlias, Entity, getKnexInstance, Selector, SQLString, NamedProperty, quote, Types, PropertyType, makeid } from "."
import { BooleanType, DateTimeType, DateType, DecimalType, NumberType, PropertyDefinition, StringType } from "./PropertyType"

// type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn;

// type Dataset<TRecord = any, TResult = any> = {
//     [Property in keyof Knex.QueryBuilder<TRecord, TResult>]: 
//         Knex.QueryBuilder<TRecord, TResult>[Property] extends (...a: any) => Knex.QueryBuilder<TRecord, TResult> ? 
//             ReplaceReturnType< Knex.QueryBuilder<TRecord, TResult>[Property], Dataset> : ( Knex.QueryBuilder<TRecord, TResult>[Property] extends Knex.QueryBuilder<TRecord, TResult> ?  Dataset : Knex.QueryBuilder<TRecord, TResult>[Property]  )
// }

declare module "knex" {
    export namespace Knex {
        interface QueryBuilder {
            __type: 'Row'
            __mainSelector?: Selector | null
            __selectItems: SelectItem[]
            __realSelect: Function
            __realClearSelect: Function
            __realClone: Function //TODO: override the clone function
        }

        interface Raw {
            clone: Function
            __type: 'Raw' | 'Column' | 'Source' | 'Row'
        }
    }
}

type SelectItem = {
    value: any,
    actualAlias: string
}

export interface NamedColumn<T = any> extends Column<T> {
    // __fieldName: string
    __actualAlias: string
    clone(): NamedColumn<T>
}
export interface Column<T = any> extends Knex.Raw {
    __type: 'Column'
    // __selector: Selector | null
    // __namedProperty: NamedProperty
    __definition: PropertyDefinition | null
    __expression: Knex.QueryBuilder | Knex.Raw
    count(): Column<NumberType> 
    exists(): Column<BooleanType> 
    is(operator: string, value: any): Column<BooleanType> 
    toColumn(): Column<T>
    clone(): Column<T>
    as(propName: string): NamedColumn<T>         //TODO: implement rename
}

export interface Source extends Knex.Raw {
    __type: 'Source'
    __selector: Selector
    __raw: string
    innerJoin(source: Source, leftColumn: NamedColumn, operator: string, rightColumn: NamedColumn): Source
    leftJoin(source: Source, leftColumn: NamedColumn, operator: string, rightColumn: NamedColumn): Source
    rightJoin(source: Source, leftColumn: NamedColumn, operator: string, rightColumn: NamedColumn): Source
    clone(): Source
}

// const castAsRow = (builder: any) : Row => {
//     //@ts-ignore
//     if(builder.__type === 'Row' ){
//         return builder as Row
//     }
//     throw new Error('Cannot cast into QueryBuilder. Please use the modified version of QueryBuilder.')
// }

export const isRaw = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Raw' ){
        return true
    }
    return false
}

export const isRow = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Row' ){
        return true
    }
    return false
}

export const isNamedColumn = (builder: any) : boolean => {
    //@ts-ignore
    if( isColumn(builder) && builder.__actualAlias){
        return true
    }
    return false
}

export const isColumn = (builder: any) : boolean => {
    //@ts-ignore
    if(builder.__type === 'Column' ){
        return true
    }
    return false
}

export const makeBuilder = function(mainSelector?: Selector | null, from?: Knex.QueryBuilder) : Knex.QueryBuilder {
    let sealBuilder: Knex.QueryBuilder
    if(from){
        if(!isRow(from)){
            throw new Error('Unexpected Flow.')
        }
        sealBuilder = from.__realClone()
        sealBuilder.__selectItems = from.__selectItems.map(item => {
            return {
                actualAlias: item.actualAlias,
                value: isColumn(item)? (item as unknown as Column).clone() : (isRow(item)? (item as unknown as Knex.QueryBuilder).clone(): item.toString() )
            }
        })
    } else {
        sealBuilder = getKnexInstance().clearSelect()
        sealBuilder.__selectItems = []
    }

    // @ts-ignore
    sealBuilder.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    sealBuilder.__type = 'Row'
    sealBuilder.__realSelect = sealBuilder.select
    sealBuilder.__mainSelector = mainSelector
    // override the select methods
    sealBuilder.select = function(...args: any[]){

        let converted: SelectItem[] = args.flatMap( item => {

            if(item instanceof Promise){
                console.log('\x1b[33m%s\x1b[0m', 'Maybe you called any computed Property that is an Async Function but you haven\'t \'await\' it before placing it into the QueryBuilder.')
                throw new Error('Invalid Select Item.')
            } else if(item === '*'){
                throw new Error("Currently it doesn't support using '*'. Please use Selector.all")
            } else if(Array.isArray(item) && item.find( subitem => isNamedColumn(subitem) )){
                throw new Error("Detected that array of 'Column' is placed into select expression. Please use ES6 spread syntax to place the columns.")
            } else if(isNamedColumn(item) ){
                let casted = item as NamedColumn<any>
                let expression = casted.__expression
                let definition = casted.__definition
                let alias = casted.__actualAlias

                let finalExpr: string
                if(definition && definition.queryTransform){

                    if(isRow(expression)){
                        let castedExpression = expression as Knex.QueryBuilder
                        let extractedColumnNames = extractColumns(castedExpression)
                        if(extractedColumnNames.length === 0){
                            throw new Error(`There is no selected column to be transformed as Computed Field '${casted.__actualAlias}'. Please check your sql builder.`)
                        }
                        finalExpr = definition.queryTransform(castedExpression, extractedColumnNames, 'column1').toString()
                    
                    } else if(isColumn(expression)){
                        finalExpr = definition.queryTransform(expression, null, 'column1').toString()
                    } else {
                        throw new Error('QueryBuilders which are not created through TaiChi are not supported.')
                    }

                } else {
                    finalExpr = expression.toSQL().sql
                }


                let text = finalExpr.toString().trim()

                if(text.includes(' ') && !( text.startsWith('(') && text.endsWith(')') ) ){
                    text = `(${text})`
                }
                return [{
                    value: makeRaw(`${text} AS ${quote(alias)}`),
                    actualAlias: alias
                }]
            }

            return [{
                value: item,
                actualAlias: parseName(item)
            }]
        })

        //check exists in columns before
        let pool = this.__selectItems.map(item => item.value.toString())
        let duplicated = converted.filter(item => pool.includes( item.value.toString() ))
        if( duplicated.length > 0 ){
            throw new Error(`Duplicated Columns '${duplicated.map(d => d.actualAlias).join(',')}' are detected.`)
        }

        this.__selectItems = this.__selectItems.concat(converted)

        let values = converted.map(c => c.value)
        return this.__realSelect(...values)
    }

    sealBuilder.__realClearSelect = sealBuilder.clearSelect
    sealBuilder.clearSelect = function(){
        sealBuilder.__selectItems = []
        return sealBuilder.__realClearSelect()
    }

    sealBuilder.__realClone = sealBuilder.clone
    sealBuilder.clone = function(){
        return makeBuilder(null, sealBuilder)
    }

    //after the select is override, add default 'all'
    if(mainSelector){
        sealBuilder = sealBuilder.select(...mainSelector.all).from(mainSelector.source)
    }

    return sealBuilder
}

export const makeRaw = (first: any, ...args: any[]) => {
    let r = getKnexInstance().raw(first, ...args)
    // @ts-ignore
    r.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    r.clone = () => {
        return makeRaw(r.toString())
    }
    r.__type = 'Raw'
    return r
}

export const makeColumn = <T = any>(expression: Knex.QueryBuilder | Knex.Raw, definition: PropertyDefinition | null = null): Column<T> => {

    let text = expression.toString().trim()

    if(text.includes(' ') && !( text.startsWith('(') && text.endsWith(')') ) ){
        text = `(${text})`
    }
    let column: Column<any> = makeRaw(text) as Column<any>
    column.__type = 'Column'
    column.__expression = expression.clone()
    // column.__fieldName = fieldName
    column.__definition = definition
    // column.__selector = selector

    column.count = (): Column<NumberType> => {
        if(!expression){
            throw new Error('Only Dataset can apply count')
        }
        let definition = new NumberType()
        let expr = makeBuilder().count().from(makeRaw(`(${expression.toString()}) AS ${quote(makeid(5))}`))

        return makeColumn<NumberType>(expr, definition)
    }

    column.exists = (): Column<BooleanType> => {
        if(!expression){
            throw new Error('Only Dataset can apply exists')
        }

        return makeColumn<BooleanType>(makeRaw(`EXISTS (${expression.toString()})`), new Types.Boolean())
    }

    column.is = (operator: string, value: any): Column<BooleanType> => {
        if(!expression){
            throw new Error('Only Dataset can apply count')
        }

        return makeColumn<BooleanType>(makeRaw(`(${expression.toString()}) ${operator} ?`, [value]), new Types.Boolean())
    }

    column.clone = () =>{
        return makeColumn<T>(expression, definition)
    }
    
    return column
}

export const makeNamedColumn = <T = any>(alias: string, col: Column<T>) : NamedColumn<T> => {
    let column = col.clone() as NamedColumn<T>
    column.__actualAlias = alias
    column.clone = () =>{
        return makeNamedColumn<T>(alias, col)
    }
    return column
}

export const makeSource = (joinText: string | null, selector: Selector, ...items: Array<NamedColumn | string>): Source => {
    let t = `${quote(selector.schema.tableName)} AS ${quote(selector.tableAlias)}`

    joinText  = (joinText ?? '').trim()

    let raw = `${joinText} ${t}${joinText.length === 0?'':` ON ${items.join(' ')}`}`

    let target = makeRaw(raw) as Source
    target.__type = 'Source'
    target.__selector = selector
    target.__raw = raw
    
    target.innerJoin = (source: Source, ...items: Array<NamedColumn | string>) => {
        let s = makeSource(`${target.__raw} INNER JOIN`, source.__selector, ...items)
        return s
    }

    target.leftJoin = (source: Source, ...items: Array<NamedColumn | string>) => {
        let s = makeSource(`${target.__raw} LEFT JOIN`, source.__selector, ...items)
        return s
    }

    target.rightJoin = (source: Source, ...items: Array<NamedColumn | string>) => {
        let s = makeSource(`${target.__raw} RIGHT JOIN`, source.__selector, ...items)
        return s
    }
    return target
}

export const extractColumns = (builder: Knex.QueryBuilder): string[] => {
    
    // let ourBuilder = castAsRow(builderOrRaw)
    return builder.__selectItems.map(item => {
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

// function makeSelectItem(selector: Selector, prop: NamedProperty): SelectItem {
//     let tableAlias = quote(selector.tableAlias)
//     let fieldName: string = quote(prop.fieldName)
//     let a = metaFieldAlias(prop)
//     let raw = `${tableAlias}.${fieldName} AS ${quote(a)}`
//     return {
//         raw: makeRaw(raw),
//         actualAlias: a
//     }
// }


// const wrap = (col: Column | Promise<Column>) => {

//     let w = {}
//     w.count = () => {
//         // if(!expression){
//         //     throw new Error('only computedProp can use count()')
//         // }
//         // if(prop === '*'){
//         //     throw new Error('only computedProp can use count()')
//         // }

//         let p = (col: Column) => makeColumn(null, new NamedProperty(`${prop.name}`, new Types.Number, null), 
//             makeBuilder().count().from(makeRaw(expression)) )

//         if(col instanceof Promise){
//             return new Promise( (resolve, reject) => {
//                 col.then(column => {
//                     resolve(p(column))
//                 })
//             })
//         }else{
//             return p(col)
//         }
        
        
//     }

//     return w
// }

    

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


