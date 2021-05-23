// import { QueryBuilder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs'
import { PropertyType, Types } from './PropertyType'
export { PropertyType, Types }
// import { v4 as uuidv4 } from 'uuid'
const sqlParser = require('js-sql-parser')


export type Config = {
    knexConfig: Knex.Config,
    models: {[key:string]: typeof Entity}
    createModels?: boolean,
    modelsPath?: string,
    outputSchemaPath?: string,
    entityNameToTableName?: (params:string) => string,
    // tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    // fieldNameToPropName?: (params:string) => string,
    suppressErrorOnPropertyNotFound?: string,
    // guidColumnName?: string
}

// the new orm config
export const config: Config = {
    createModels: false,
    models: {},
    knexConfig: {client: 'mysql2'},
}

// const guidColumnName = () => config.guidColumnName ?? '__guid__'

// a global knex instance
export const getKnexInstance = () => {
    // multipleStatements must be true
    let newKnexConfig = Object.assign( {}, config.knexConfig)
    if(newKnexConfig.connection){
        newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, {multipleStatements: true})
    }
    
    return knex(newKnexConfig)
}

const sealRaw = (first:any, ...args: any[]) => {
    let sealRaw = getKnexInstance().raw(first, ...args)
    // @ts-ignore
    sealRaw.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    return sealRaw
}

export const raw = sealRaw


const startTransaction = async(func: (trx: Knex.Transaction) => any, existingTrx?: Knex.Transaction ): Promise<any> => {
    let knex = getKnexInstance()
    return await new Promise((resolve, reject)=> {
        const useTrx = (trx: Knex.Transaction) => {
            try{
                const AsyncFunction = (async () => {}).constructor;
                if(func instanceof AsyncFunction){
                    func(trx).then(
                        (result: any) => {
                            trx.commit()
                            resolve(result)
                        },
                        (error: any) => {
                            trx.rollback()
                            reject(error)
                        }
                    )
                }else{
                    let result = func(trx)
                    trx.commit()
                    resolve(result)
                }
            }catch(error){
                trx.rollback()
                reject(error)
            }
        }

        if(existingTrx){
            // use existing
            useTrx(existingTrx)
        } else {
            // use new 
            knex.transaction( (trx) => {
                useTrx(trx)
            })
        }
    })
}

let schemas: {
    [key: string]: Schema
} = {}

export class Schema {

    tableName: string
    entityName: string
    namedProperties: NamedProperty[]
    primaryKey: NamedProperty
    // guid: NamedProperty

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = new NamedProperty(
            'id',
            Types.PrimaryKey(),
            null
        )
        this.namedProperties = [this.primaryKey]
    }

    createTableStmt(){
        if(this.tableName.length > 0){
            return `CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (\n${this.namedProperties.filter(f => !f.computedFunc).map(f => `\`${f.fieldName}\` ${f.definition.create().join(' ')}`).join(',\n')}\n)`;
        }
        return ''
    }

    prop(name:string, definition: any, options?: any){
        this.namedProperties.push(new NamedProperty(
            name,
            definition,
            null,
            options
        ))
    }

    computedProp(name:string, definition: any, computedFunc: ComputedFunction, options?: any){
        this.namedProperties.push(new NamedProperty(
            name,
            definition,
            computedFunc,
            options
        ))
    }
}

export function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * 
 charactersLength)));
   }
   return result.join('');
}

export interface SQLString{
    toString(): string
}

export type ComputedFunction = (selector: Selector, queryFunction: QueryFunction, ...args: any[]) => SQLString

export type NamedPropertyOptions = {
    skipFieldNameConvertion?: boolean
}

export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: PropertyType,
        public computedFunc: ComputedFunction | null,
        public options?: NamedPropertyOptions){
            this.name = name
            this.definition = definition
            this.computedFunc = computedFunc
            this.options = options

            if( /[\.`' ]/.test(name) || name.includes('___') || name.startsWith('_')){
                throw new Error('The name of the NamedProperty is invalid')
            }
        }

    get fieldName(){
        if(this.options?.skipFieldNameConvertion){
            return this.name
        } else {
            return config.propNameTofieldName ? config.propNameTofieldName(this.name) : this.name
        }
    }

    compileAs_(rootSelector: Selector){
        if(this.computedFunc){
            throw new Error('Computed Property cannot be compiled as normal field.')
        } 
        let namedProperty = this
        let tableAlias = rootSelector.tableAlias
        let fieldName = this.fieldName
        let fieldAlias = metaFieldAlias(namedProperty)

        return sealRaw(`(SELECT ${tableAlias}.${fieldName} AS ${fieldAlias})`)
    }

    compileAs$(rootSelector: Selector, withTransform: boolean){
        if(!this.computedFunc){
            throw new Error('Normal Property cannot be compiled as computed field.')
        }
        let computedFunc = this.computedFunc
        let namedProperty = this
        let fieldAlias = metaFieldAlias(namedProperty)

        const makeFn = (withTransform: boolean) => (queryFunction?: QueryFunction, ...args: any[]) => {
            const applyFilterFunc: QueryFunction = (stmt, selector) => {
                if(queryFunction && !(queryFunction instanceof Function)){
                    throw new Error('Likely that your ComputedProperty are not called in the select query.')
                }
                const x = (queryFunction && queryFunction(stmt, selector) ) || stmt
                return x
            }
            let subquery: SQLString | Promise<SQLString> = computedFunc(rootSelector, applyFilterFunc, ...args)


            let process = (subquery: SQLString): Knex.Raw => {
                let subqueryString = subquery.toString()
                // // determine the column list
                let mainNode = sqlParser.parse(subqueryString)
                let ast = mainNode.value

                let columnsToBeTransformed: string[] = []
                if( ast.type === 'Select'){
                    let selectItems = ast.selectItems
                    if(selectItems.type !== 'SelectExpr'){
                        throw new Error('Unsupported')
                    }

                    // then handle select items... expand columns
                    // let items: Array<SimpleObject> = selectItems.value
                    selectItems.value = selectItems.value.flatMap( (item: SimpleObject) => {
                        
                        if(item.type === 'Identifier' && item.value.includes('*')){
                            // if it is *... expand the columns..
                            return Database._resolveStar(item, ast.from)
                        } else {
                            return item
                        }
                    })

                    columnsToBeTransformed = selectItems.value.map( (f: SimpleObject) => {
                        if(!f.alias && f.type === 'SubQuery' && f.value.selectItems.value.length === 1){
                            return Database._santilize(f.value.selectItems.value[0])
                        }
                        return Database._santilize(f) 
                    }) as string[]
                
                    subqueryString = sqlParser.stringify(mainNode)
                }

                let definition = namedProperty.definition

                if(withTransform && definition.readTransform){
                    let transformedSql = definition.readTransform(subqueryString, columnsToBeTransformed)
                    return sealRaw(`(SELECT (${transformedSql.toString()}) AS ${fieldAlias})`)
                } else {

                    return sealRaw(`(SELECT (${subqueryString}) AS ${fieldAlias})`)
                }

                // const santilize = (item: any): string => {
                //     let v = item.alias ?? item.value ?? makeid(5)
                //     v = v.replace(/[`']/g, '')
                //     let p = v.split('.')
                //     let name = p[p.length - 1]
                //     return name
                // }

                // let columns: string[] = ast.value.selectItems.value.map( (v:any) => santilize(v) )

                // columns = columns.filter(c => c !== '*')
                
                // // HERE: columns can contains metaAlias (computedProps only) and normal fieldName

                // // Important: more than one table has *
                // if(columns.includes('*')){

                //     if(ast.value.from.type !== 'TableReferences'){
                //         throw new Error('Unexpected flow is reached.')
                //     }
                //     let info: Array<any> = ast.value.from.value.map( (obj: ASTObject ) => {
                //         if(obj.type === 'TableReference'){
                //             if(obj.value.type === 'TableFactor'){
                //                 // determine the from table
                //                 if( obj.value.value.type === 'Identifier'){
                //                     return {type: 'table', value: santilize(obj.value.value) }
                //                 }
                //             } else if( obj.value.value.type === 'SubQuery'){
                //                 let selectItems = obj.value.value.value.selectItems
                //                 if(selectItems.type === 'SelectExpr'){
                //                     // determine any fields from derived table
                //                     return selectItems.value.map( (item: any) => {
                //                         if( item.type === 'Identifier'){
                //                             return {type: 'field', value: santilize(item) }
                //                         }
                //                     })
                //                 } else throw new Error('Unexpected flow is reached.')
                //             } else throw new Error('Unexpected flow is reached.')
                //         } else throw new Error('Unexpected flow is reached.')
                //     })
                    
                    
                //     let tables: Array<string> = info.filter( (i: any) => i.type === 'table').map(i => i.value)
                //     if(tables.length > 0){
                //         let schemaArr = Object.keys(schemas).map(k => schemas[k])
                //         let selectedSchemas = tables.map(t => {
                //             let s = schemaArr.find(s => s.tableName === t) 
                //                 if(!s)
                //                 throw new Error(`Table [${t}] is not found.`)
                //             return s
                //         })
                //         let all = selectedSchemas.map(schema => schema.namedProperties.filter(p => !p.computedFunc).map(p => p.fieldName) ).flat()
                //         columns = columns.concat(all)
                //     }
                    
                //     columns.concat( info.filter( (i:any) => i.type === 'field').map(i => i.value) )
                    
                //     //determine the distinct set of columns
                //     columns = columns.filter(n => n !== '*')
                //     let fullSet = new Set(columns)
                //     columns = [...fullSet]
                
                    
                //     // going to replace star into all column names
                //     if( ast.value.selectItems.type !== 'SelectExpr'){
                //         throw new Error('Unexpected flow is reached.')
                //     } else {
                //         //remove * element
                //         let retain = ast.value.selectItems.value.filter( (v:any) => v.value !== '*' )
                        
                //         let newlyAdd = columns.filter( c => !retain.find( (v:any) => santilize(v) === c ) )

                //         //add columns element
                //         ast.value.selectItems.value = [...retain, ...newlyAdd.map(name => {
                //             return {
                //                 type: "Identifier",
                //                 value: name,
                //                 alias: null,
                //                 hasAs: null
                //             }
                //         })]
                //     }

                //     subqueryString = sqlParser.stringify(ast)
                // }

                // return sealRaw(`(SELECT (${subqueryString}) AS ${fieldAlias})`)
            }

            if(subquery instanceof Promise){
                return new Promise<Knex.Raw>( (resolve, reject)=> {
                    if(subquery instanceof Promise){
                        subquery.then((query: SQLString)=>{
                            resolve(process(query))
                        },reject)
                    } else {
                        throw new Error('Unexpected flow. Subquery is updated.')
                    }
                })
            } else {
                return process(subquery)
            }
        }

        return makeFn(withTransform)
    }
    

}

export const configure = async function(newConfig: Partial<Config>){
    Object.assign(config, newConfig)
    let tables: Schema[] = []

    const registerEntity = (entityName: string, entityClass: any) => {
        let s = new Schema(entityName);
        if(entityClass.register){
            entityClass.register(s)
            schemas[entityName] = s
            tables.push(s)
        }
        config.models[entityName] = entityClass
    }
    
    //register special Entity Dual
    registerEntity(Dual.name, Dual)
    //register models by path
    if(config.modelsPath){
        let files = fs.readdirSync(config.modelsPath)
        await Promise.all(files.map( async(file) => {
            if(file.endsWith('.js')){
                let path = config.modelsPath + '/' + file
                path = path.replace(/\.js$/,'')
                console.debug('load model file:', path)
                let p = path.split('/')
                let entityName = p[p.length - 1]
                let entityClass = require(path)
                registerEntity(entityName, entityClass.default);
            }
        }))
    }
    //register models 
    if(config.models){
        let models = config.models
        Object.keys(models).forEach(key => {
            registerEntity(key, models[key]);
        })
    }

    let sqlStmt = tables.map(t => t.createTableStmt()).filter(t => t).join(";\n") + ';'

    //write schemas into sql file
    if(config.outputSchemaPath){
        let path = config.outputSchemaPath
        fs.writeFileSync(path, sqlStmt )
        console.debug('schemas files:', Object.keys(schemas))
    }

    //create tables
    if(config.createModels){
        await getKnexInstance().raw(sqlStmt)
    }
}

const sealSelect = function(...args: Array<any>) : Knex.QueryBuilder {
    let sealSelect = getKnexInstance().select(...args)
    // @ts-ignore
    sealSelect.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    return sealSelect
}
export const select = sealSelect

// export type FunctionSelector = {
//     [key: string] : CompiledFunction
// }

// export type FieldSelector = {
//     [key: string] : string
// }

// export class CompiledNamedPropertyWithSubQuery{
//     compiledNamedProperty: CompiledNamedProperty
//     subquery: string
//     constructor(compiledNamedProperty: CompiledNamedProperty, subquery: string){
//         this.compiledNamedProperty = compiledNamedProperty
//         this.subquery = subquery
//     }
// }
// export class CompiledNamedPropertyGetter{
//     compiledNamedProperty: CompiledNamedProperty
//     constructor(compiledNamedProperty: CompiledNamedProperty){
//         this.compiledNamedProperty = compiledNamedProperty
//     }
//     get(){
//         return this.compiledNamedProperty
//     }
// }

// export class CompiledNamedProperty{
//     namedProperty: NamedProperty
//     rootSelector: Selector<typeof Entity>
//     tableAlias?: string | null
//     fieldName?: string | null
//     fieldAlias?: string | null
//     compiled: string | CompiledNamedPropertyFunction

//     constructor(rootSelector: Selector<typeof Entity>, prop: NamedProperty) {
//         this.namedProperty = prop
//         this.rootSelector = rootSelector
        
//     }
// }

export type SimpleObject = { [key:string]: any}


// export type SelectorBasic<T extends typeof Entity> = {
//     entityClass: T,
//     schema: Schema,
//     '_': FieldSelector,
//     '$': ComputedSelector,       
//     'table': string,            // "table"
//     'tableAlias': string,       // "abc"
//     'source': string,           // "table AS abc"
//     'all': string,              // "abc.*"
//     'id': string                // "abc.id"
// }

const map1 = new Map<PropertyType, string>()
const map2 = new Map<string, PropertyType>()
const registerPropertyType = function(d: PropertyType): string{
    let r = map1.get(d)
    if(!r){
        let key = makeid(5)
        map1.set(d, key)
        map2.set(key, d)
        r = key
    }
    return r
}

const findPropertyType = function(typeAlias: string): PropertyType{
    let r = map2.get(typeAlias)
    if(!r){
        throw new Error(`Cannot find the PropertyType by [${typeAlias}]. Make sure it is registered before.`)
    }
    return r
}


const metaTableAlias = function(schema: Schema): string{
    return schema.entityName + '___' + makeid(5)
}

const breakdownMetaTableAlias = function(metaAlias: string) {
    metaAlias = metaAlias.replace(/[\`\']/g, '')
    if(/^[^\_]*\_\_\_[^\_]*$/.test(metaAlias)){
        let [entityName, randomNumber] = metaAlias.split('___')
        let found = schemas[entityName]
        return found
    } else {
        return null
    }
}

const metaFieldAlias = function(p: NamedProperty): string{
    let typeAlias = registerPropertyType(p.definition)
    return `${p.name}___${typeAlias}`
}

const breakdownMetaFieldAlias = function(metaAlias: string){
    metaAlias = metaAlias.replace(/[\`\']/g, '')
    if( /^[^\_]*\_\_\_[^\_]*$/.test(metaAlias) ){
        let [propName, typeAlias] = metaAlias.split('___')
        let definition = findPropertyType(typeAlias)
        return {propName, definition}
    } else {
        return null
    }
}

type ASTObject = {
    type: string,
    value: any
}

export class Selector{

    entityClass: typeof Entity
    schema: Schema
    derivedProps: Array<NamedProperty> = []
    _: {[key: string] : Knex.Raw}
    $: {[key: string] : CompiledFunction}
    // $$: {[key: string] : CompiledFunction}
    prop: (value: any) => any
    [key: string]: any
    tableAlias: string

    // stored any compiled property
    // compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor(entityClass: typeof Entity, schema: Schema){
        this.schema = schema
        this.tableAlias = metaTableAlias(schema)
        this.entityClass = entityClass
        let selector = this
        
        this._ = new Proxy( {} ,{
            get: (oTarget, sKey: string) => {
                return selector.getNormalCompiled(sKey)
            }
        }) as {[key: string] : Knex.Raw}

        this.$ = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledFunction => {
                return selector.getComputedCompiled(sKey)
            }
        }) as {[key: string] : CompiledFunction}

        // this.$$ = new Proxy( {} ,{
        //     get: (oTarget, sKey: string): CompiledFunction => {
        //         let prop = this.getProperties().find( (prop) => prop.name === sKey)
        //         this.checkDollar(prop, sKey)
        //         return prop!.compileAs$(selector, false)
        //     }
        // }) as {[key: string] : CompiledFunction}

        this.prop = (value: any) => {
            if(typeof value === 'string'){
                return selector.getNormalCompiled(value)
            } else if(value.constructor === Object){

                let sqlArgs: string[] = []
                let accSqls: string[] = []
            
                Object.keys(value).forEach( (key) => {
                    let prop = selector.getProperties().find((prop) => prop.name === key)
                    if(prop && !prop.computedFunc){
                        let converted = selector.getNormalCompiled(key).toString()
                        accSqls.push(`${converted} = ?`)
                        sqlArgs.push(value[key])
                    }
                })
                return sealRaw( accSqls.join(' AND '), sqlArgs)
            } else if(Array.isArray(value)){
                return value.map( v => this.getNormalCompiled(v) )
            } else return value
        }
    }

    getComputedCompiled(sKey: string) {
        let selector = this
        let withTransform = true
        if (sKey.startsWith('_')) {
            withTransform = false
            sKey = sKey.slice(1)
        }
        let prop = selector.getProperties().find((prop) => prop.name === sKey)
        selector.checkDollar(prop, sKey)
        return prop!.compileAs$(selector, withTransform)
    }

    getNormalCompiled(value: string) {
        let selector = this
        let prop = this.getProperties().find((prop) => prop.name === value)
        this.checkDash(prop, value)
        return prop!.compileAs_(selector)
    }

    private checkDollar(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property ${sKey}`)
        } else if (!prop.computedFunc) {
            throw new Error(`Property ${sKey} is NormalProperty. Accessing through $ is not allowed.`)
        }
    }

    private checkDash(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property ${sKey}`)
        } else if (prop.computedFunc) {
            throw new Error(`Property ${sKey} is ComputedProperty. Accessing through _ is not allowed.`)
        }
    }

    // "table AS abc"
    get source(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
        }
        return `${this.schema.tableName} AS ${this.tableAlias}`
    }

    // "abc.*"
    get all(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return `${this.tableAlias}.*`
    }

    get id(): Knex.Raw{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._.id
    }

    getProperties(){
        // derived Props has higher priority. I can override the schema property
        return [...this.derivedProps, ...this.schema.namedProperties]
    }

    register(namedProperty: NamedProperty){
        this.derivedProps.push(namedProperty)
    }
    // init(){
    //     // the lifecycle should be 
    //     this.schema.namedProperties.forEach( (prop) => {
    //         this.compileNamedProperty(prop)
    //     })
    // }

     // (SQL template) create a basic belongsTo prepared statement 
    hasMany(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): SQLString{
        let selector = entityClass.newSelector()
        let stmt = sealSelect().from(selector.source).whereRaw("?? = ??", [this._.id, selector._[propName] ])
        return applyFilter(stmt, selector)
    }

    // (SQL template) create a basic belongsTo prepared statement 
    belongsTo(entityClass: typeof Entity, propName: string, applyFilter: QueryFunction): SQLString{
        let selector = entityClass.newSelector()
        let stmt = sealSelect().from(selector.source).whereRaw("?? = ??", [selector._.id, this._[propName] ])
        return applyFilter(stmt, selector)
    }

    /**
     * Create and compile a new ComputedProperty
     * It is similar to compileNamedProperty but it return the selector of this new property
     * @param namedProperty A `NamedProperty` instance
     * @returns the selector of this new property
     */
    // derivedProp(namedProperty: NamedProperty){
    //     if(!namedProperty.computedFunc){
    //         throw new Error('derivedProp only allows ComputedProperty.')
    //     }
    //     return this.compileNamedProperty(namedProperty).compiled
    // }

    /**
     * Create and compile a new NamedProperty
     * NamedProperty can be compiled into CompiledNamedProperty for actual SQL query
     * The compilation is:
     *  - embedding a runtime entity's selector into the 'computed function'
     *  - or translate the field into something like 'tableAlias.fieldName'
     * @param namedProperty A `NamedProperty` instance
     * @returns CompiledNamedProperty 
     */
    // compileNamedProperty(prop: NamedProperty) {
    //     let rootSelector = this
    //     prop.compile(rootSelector)
    // }
}

export type CompiledFunction = (queryFunction?: QueryFunction, ...args: any[]) => Knex.Raw | Promise<Knex.Raw>

export type QueryFunction = (stmt: Knex.QueryBuilder, selector: Selector) => SQLString


type ExecutionContextAction<I> =  (stmt: SQLString, trx?: Knex.Transaction) => Promise<I>
type PrepareSQLStatementAction = () => Promise<SQLString>


export class ExecutionContext<I> implements PromiseLike<I>{
    prepareStmt: PrepareSQLStatementAction
    trx?: Knex.Transaction
    action: ExecutionContextAction<I>

    constructor(prepareStmt: PrepareSQLStatementAction, action: ExecutionContextAction<I>){
        this.prepareStmt = prepareStmt
        this.action = action
    }
    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: I) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            if(onfulfilled){
                let result = await this.action(await this.prepareStmt(), this.trx)
                return onfulfilled(result)
            }
        }catch(error){
            if(onrejected){
                return onrejected(error)
            }
        }

        return this.then(onfulfilled, onrejected)
    }

    usingConnection(trx: Knex.Transaction): ExecutionContext<I>{
        this.trx = trx
        return this
    }

    async toSQLString(): Promise<SQLString> {
        return this.prepareStmt()
    }
}
export class Database{

    static run(...args: Array<typeof Entity | ((...args: Array<Selector>) => Knex.QueryBuilder )> ) : ExecutionContext<Dual[]> {
        return new ExecutionContext<Dual[]>(
            async() => {
                if(args.length < 1){
                    throw new Error('At least one selector callback should be given.')
                }
            
                let callback = args[args.length -1] as (...args: Array<Selector>) => Knex.QueryBuilder
                let entities = args.slice(0, args.length -1) as Array<typeof Dual>
                let selectors = entities.map(entity => entity.selector())
                let stmt = callback(...selectors)

                let dualSelector = Dual.newSelector()
                let prop = new NamedProperty(
                    'data',
                    Types.Array(Dual),
                    (dualSelector): SQLString => {
                        return stmt
                    }
                )
                dualSelector.register(prop)

                return Database.transpile(await dualSelector.$.data())
            },
            async(stmt: SQLString, trx?: Knex.Transaction) => {
                console.debug("======== run ========")
                console.debug(stmt.toString())
                console.debug("=====================")
                let resultData = await Database.executeStatement(stmt, trx)
                let tmp = resultData[0][0]
                let dualInstance = Database.parseRaw(Dual, tmp)
                let str = "data" as keyof Dual
                let rows = dualInstance[str]
                return rows
            })
    }

    static transpile(stmt: SQLString): SQLString {

        let sql = stmt.toString()

        if(sql.startsWith('(') && sql.endsWith(')')){
            sql = sql.slice(1, sql.length - 1)
        }

        // map2.set('Qq8j9', Types.Number() )
        // map2.set('dasf4', Types.Number() )
        // map2.set('odjde', Types.Number() )
        // sql = 'select (SELECT (SELECT 1 as `abc___Qq8j9` ) as `Shop___dasf4`) as `data___odjde`'

        console.debug('==== before transpile ===')
        console.debug(sql)
        console.debug('=========================')

        let ast = sqlParser.parse(sql)
        ast = this._transpileAst(ast, false)
        return sqlParser.stringify(ast)
    }

    static _transpileAst(ast: SimpleObject, withAlias: boolean): SimpleObject{
        if(!ast){
            return ast
        }
        if( Array.isArray(ast)){
            ast = ast.map(item => this._transpileAst(item, withAlias))
            return ast
        }
        if( ast.type === 'SubQuery'){
            let astValue = ast.value
            if(astValue.type === 'Select'){
                let selectItems = astValue.selectItems
                if(selectItems.type !== 'SelectExpr'){
                    throw new Error('Unsupported')
                }

                // handle where first, no dependences
                if (astValue.where) {
                    astValue.where = this._transpileAst(astValue.where, false)
                }
    
                // must handle the 'from' before 'selectitem'... because of dependencies
                if (astValue.from) {
                    astValue.from = this._transpileAst(astValue.from, false)
                }
                
                // let rand = makeid(5)
                // console.debug('-> subquery', rand, ast.alias, astValue.selectItems.value.length, astValue.from)
                
                astValue.selectItems.value = astValue.selectItems.value.map( (item: SimpleObject) => this._transpileAst(item, true) )

                // console.debug('<-- subquery', rand, ast.alias, astValue.selectItems.value.length, astValue.from)
                // remove double nested sql
                
                if(astValue.selectItems.value.length === 1){
                    let item = astValue.selectItems.value[0]
                    if(item.type === 'SubQuery'){
                        if(!withAlias){
                            item.hasAs = null
                            item.alias = null
                        }
                        return item
                    } else if(item.type === 'Identifier'){

                        if(!withAlias){
                            item.hasAs = null
                            item.alias = null
                        }
                        return item
                    }


                }
            }

            return ast
        } else if ( (ast as SimpleObject) instanceof Object){
            let newReturn = Object.keys(ast).reduce((acc, key)=>{
                acc[key] = this._transpileAst(ast[key], withAlias)
                return acc
            },{} as SimpleObject)
            return newReturn
        }

        return ast
    }

    static _santilize(item: any): string | null {
        let v = item.alias ?? item.value
        if(typeof v === 'string'){
            v = v.replace(/[`']/g, '')
            let p = v.split('.')
            let name = p[p.length - 1]
            return name
        }
        return null
    }

    static _resolveStar(ast: SimpleObject, from: SimpleObject): any {

        let targetTable: string | null = null
        let v = ast.value
        v = v.replace(/[`']/g, '')
        if(v.includes('.*') ){
            targetTable = v.split('.')[0]
        }

        if(from.type !== 'TableReferences'){
            throw new Error('Unexpected flow is reached.')
        }
        return from.value.flatMap( (obj: ASTObject ) => {
            if(obj.type === 'TableReference'){
                if(obj.value.type === 'TableFactor'){
                    if( obj.value.value.type === 'Identifier'){
                        
                        let tableName = obj.value.alias?.value ?? obj.value.value?.value

                        if(targetTable === null || targetTable === tableName){
                            // find all fields from schema
                            let schema = breakdownMetaTableAlias(tableName)
                            if(!schema)
                                throw new Error(`Entity [${tableName}] is not found.`)
                                
                            let all = schema.namedProperties.filter(p => !p.computedFunc).map(p => {
                                let alias = metaFieldAlias(p)
                                return {
                                    type: "Identifier",
                                    value: `${tableName}.${p.fieldName}`,
                                    alias: alias,
                                    hasAs: true
                                }
                            })
                            return all
                        }
                        return []
                    } else if( obj.value.value.type === 'SubQuery'){

                        let tableName = obj.value.alias.value

                        let selectItems = obj.value.value.value.selectItems
                        if(targetTable === null || targetTable === tableName){
                            if(selectItems.type === 'SelectExpr'){
                                // determine any fields from derived table
                                return selectItems.value.map( (item: any) => {
                                    if( item.type === 'Identifier'){
                                        let fieldName = this._santilize(item)
                                        return {
                                            type: "Identifier",
                                            value: `${tableName}.${fieldName}`,
                                            alias: null,
                                            hasAs: null
                                        } 
                                    }
                                })
                            } else throw new Error('Unexpected flow is reached.')
                        }
                        return []
                    } else throw new Error('Unexpected flow is reached.')
                }  else throw new Error('Unexpected flow is reached.')
            } else throw new Error('Unexpected flow is reached.')
        })

    }

    static createOne<T extends typeof Entity>(entityClass: T, data: SimpleObject): ExecutionContext< InstanceType<T> >{
        return new ExecutionContext< InstanceType<T> >(
            async() => {
                const schema = entityClass.schema
                const knex = getKnexInstance()
                // let guid = uuidv4()
                data = Object.keys(data).reduce((acc, propName)=>{
                    let prop = schema.namedProperties.find(p => {
                        return p.name === propName
                    })
                    if(!prop){
                        throw new Error(`The Property [${propName}] doesn't exist`)
                    }
                    acc[prop.fieldName] = data[prop.name]
                    return acc
                }, {} as SimpleObject)
                // Object.assign({},data,{[guidColumnName()]: guid})
                let stmt = knex(schema.tableName).insert(data)
                return Database.transpile(stmt)
            },
            async (stmt: SQLString, existingTrx?: Knex.Transaction) => {
                console.debug('======== INSERT =======')
                console.debug(stmt.toString())
                console.debug('========================')
                let result = await startTransaction( async (trx) => {
                    // await stmt //execute sql
                    // return this.findOne( (stmt, t) => stmt.where({[guidColumnName()]: guid})).usingConnection(trx)
                    let insertedId = await this.executeStatement( stmt.toString() + '; SELECT LAST_INSERT_ID() AS id ', trx)
                    let actualId = insertedId[0][1][0].id
                    let records = await this.find(entityClass, (stmt, t) => stmt.where(t._.id, '=', actualId)).usingConnection(trx)
                    return records[0]

                }, existingTrx)
                return result
            })
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
     static findOne<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): ExecutionContext<  InstanceType<T> >{
         return new ExecutionContext< InstanceType<T> >(
            async() => {
                return await Database._prepareFind(entityClass, applyFilter)
            },
            async (stmt: SQLString, existingTrx?: Knex.Transaction
            ) => {
                let rows = await Database._find<T>(entityClass, stmt, existingTrx)
            return rows[0]
        })
     }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): ExecutionContext<  Array<InstanceType<T>> >{
        return new ExecutionContext< Array<InstanceType<T>> >(
            async() => {
                return await Database._prepareFind(entityClass, applyFilter)
            },
            async (stmt: SQLString, existingTrx?: Knex.Transaction
            ) => {
                let rows = await Database._find<T>(entityClass, stmt, existingTrx)
            return rows
        })
    }

    private static async _prepareFind<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): Promise<SQLString>{
        let dualSelector = Dual.newSelector()
        let prop = new NamedProperty(
            'data',
            Types.Array(entityClass),
            (dualSelector): SQLString => {
                let currentEntitySelector = entityClass.selector()
                let stmt: Knex.QueryBuilder = sealSelect().from(currentEntitySelector.source)
                let result: SQLString = stmt
                if (applyFilter) {
                    result = applyFilter(stmt, currentEntitySelector)
                }
                return result
            }
        )
        dualSelector.register(prop)
        return Database.transpile(await dualSelector.$.data())
    }


    private static async _find<T extends typeof Entity>(entityClass: T, stmt: SQLString, existingTrx?: Knex.Transaction<any, any[]>) {
       
        console.debug("========== FIND ================")
        console.debug(stmt.toString())
        console.debug("================================")
        let resultData: any = await Database.executeStatement(stmt, existingTrx)
       
        let dualInstance = this.parseRaw(Dual, resultData[0][0] as SimpleObject)
        let str = "data" as keyof Dual
        let rows = dualInstance[str] as Array<InstanceType<T>>
        return rows
    }

    static async executeStatement(stmt: SQLString, existingTrx?: Knex.Transaction): Promise<any> {
        let KnexStmt = getKnexInstance().raw(stmt.toString())
        if (existingTrx) {
            KnexStmt.transacting(existingTrx)
        }
        return await KnexStmt
    }

    static parseRaw<T extends typeof Entity>(entityClass: T, row: SimpleObject): InstanceType<T>{
        // let entityClass = (entityConstructor as unknown as typeof Entity)
        // let entityClass = this
        let entityInstance = Object.keys(row).reduce( (entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
            let metaInfo = breakdownMetaFieldAlias(fieldName)
            let propName = null
            let definition = null
            if(metaInfo){
                propName = metaInfo.propName
                definition = metaInfo.definition
            } else{
                
                let prop = entityClass.schema.namedProperties.find(p => {
                    return p.fieldName === fieldName
                })

                if(!prop){
                    if(!config.suppressErrorOnPropertyNotFound){
                        throw new Error(`Result contain property/column [${fieldName}] which is not found in schema.`)
                    }
                }else{
                    propName = prop.name
                    definition = prop.definition
                }
            }
            /**
             * it can be boolean, string, number, Object, Array of Object (class)
             * Depends on the props..
             */
            let propValue = definition!.parseRaw(row[fieldName])
            
            Object.defineProperty(entityInstance, propName!, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: propValue
            })
            return entityInstance
        }, new entityClass() as InstanceType<T>)
        return entityInstance
    }
}

export class Entity {
    [key: string]: any

    constructor(){
    }

    static get schema(): Schema{
        return schemas[this.name]
    }

    static get tableName() {
        return this.schema.tableName
    }

    /**
     * Can be overridden by inheritance Class
     * @param schema
     */
    static register(schema: Schema) : void{
    }

    /**
     * alias of produceSelector
     * @returns Selector
     */
    static selector(): Selector {
        return this.newSelector()
    }

    /**
     * Selector is used for locating the table name / field names / computed functions
     * field pointers
     * @returns 
     */
    static newSelector<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I) ): Selector{
        let selector = new Selector(this, schemas[this.name])

        selector = new Proxy(selector, {
            get: (oTarget, sKey): any => {
                if(typeof sKey === 'string'){
                    // if (sKey.length > 2) {
                    //     if( /^\$\$[^$_]/.test(sKey) ){
                    //         return oTarget.$$[sKey.slice(2)]
                    //     } 
                    // }
                    if (sKey.length > 1){
                        if( /^\_/.test(sKey) ){
                            return oTarget._[sKey.slice(1)]
                        } else if( /^\$/.test(sKey) ){
                            return oTarget.$[sKey.slice(1)]
                        }
                    } 
                }
                if(sKey in oTarget)
                    return oTarget[sKey.toString()]
                else throw new Error(`Cannot find property ${sKey.toString()} of selector`)
            }
        })


        return selector
    }

    static createOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: SimpleObject): ExecutionContext<I>{
        // let tester = new this()
        // let entityClass = config.models[tester.constructor.name]
        // if (!entityClass) {
        //     throw new Error(`Cannot find the class ${tester.constructor.name}`)
        // }
        return Database.createOne(this, data)
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<I>{
        // let tester = new this()
        // let entityClass = config.models[tester.constructor.name]
        // if (!entityClass) {
        //     throw new Error(`Cannot find the class ${tester.constructor.name}`)
        // }
        return Database.findOne(this, applyFilter)
        // return r[0] as I
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<Array<I>>{
        // let tester = new this()
        // let entityClass = config.models[tester.constructor.name]
        // if (!entityClass) {
        //     throw new Error(`Cannot find the class ${tester.constructor.name}`)
        // }
        return Database.find(this, applyFilter)
        // return records as Array<I>
    }

    static parseRaw<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), row: SimpleObject): I{
        // let tester = new this()
        // let entityClass = config.models[tester.constructor.name]
        // if (!entityClass) {
            
        //     throw new Error(`Cannot find the class ${tester.constructor.name}`)
        // }
        let r = Database.parseRaw(this, row)
        return r as I
    }
}


// it is a special Entity or table. Just like the Dual in SQL Server
export class Dual extends Entity {

    static register(schema: Schema) : void{
        //override the tableName into empty
        schema.tableName = ''
    }
}


export const run = Database.run

/**
 * 
 * 
 *  Below is for experiment code... exploring tricks for cache
 * 
 */

// export const select = function(...args: any[]){

//     let alias: string[] = args.map(s => /\[\[(.*)\]\]/g.exec(s)?.[1] || '' ).filter(s => s.length > 0)
    
//     let info = alias.map(a => {
//         let parts = a.split('|')
//         return {
//             fullName: `[[${a}]]`,
//             tableName: parts[0],
//             aliasName: parts[1],
//             fieldName: parts[2]
//         }
//     })

//     let distinctNames: string[] = [...new Set(info.map(i => `${i.tableName} as ${i.aliasName}`))]
//     // let [firstName, ...otherNames] = distinctNames

//     let stmt = getKnexInstance().select(...args)
//     if(distinctNames.length === 1){
//         stmt = stmt.from(distinctNames[0])
//     }

//     // stmt = distinctNames.reduce((acc, name) => acc.from(name, {only:false}), stmt)
//     console.log(stmt.toSQL())
//     return stmt
// }

// select('[[SKU|t1|name]].name', '[[SKU|t1|abc]].abc')



// type d<Type> = {
//     [key in keyof Type as `$${string}`] : boolean
// }
