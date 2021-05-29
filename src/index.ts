// import { QueryBuilder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs'
import { PropertyType, Types } from './PropertyType'
export { PropertyType, Types }
import { Relations } from './Relations'
export { Relations }
import { v4 as uuidv4 } from 'uuid'
// const sqlParser = require('js-sql-parser')
import { AST, Column, Parser } from 'node-sql-parser'
const sqlParser = new Parser();

export type Config = {
    knexConfig: Omit<Knex.Config, "client" | "connection"> & {
        client: string
        connection?: Knex.StaticConnectionConfig | Knex.ConnectionConfigProvider
    },
    models: {[key:string]: typeof Entity}
    createModels?: boolean,
    modelsPath?: string,
    outputSchemaPath?: string,
    // waitUtilDatabaseReady?: boolean,
    entityNameToTableName?: (params:string) => string,
    // tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    // fieldNameToPropName?: (params:string) => string,
    suppressErrorOnPropertyNotFound?: string,
    useNullAsDefault?: boolean
    primaryKeyName: string
    enableUuid: boolean
    uuidColumnName: string
}

// the new orm config
export const config: Config = {
    primaryKeyName: 'id',
    enableUuid: false,
    uuidColumnName: 'uuid',
    createModels: false,
    models: {},
    knexConfig: {
        client: 'mysql' //default mysql
    }
}

const META_FIELD_DELIMITER = '___'

let _globalKnexInstance: Knex | null = null

// a global knex instance
export const getKnexInstance = (): Knex => {
    if(_globalKnexInstance){
        return _globalKnexInstance
    }

    // multipleStatements must be true
    // let newKnexConfig: Partial<Config> = {
    //     client: config.client,
    //     connection: config.connection,
    //     useNullAsDefault: true,
    // }

    // if(config.pool){
    //     newKnexConfig.pool = config.pool
    // }

    let newKnexConfig = Object.assign({
        useNullAsDefault: true
    }, config.knexConfig)

    if(typeof newKnexConfig.connection !== 'object'){
        throw new Error('Configuration connection only accept object.')
    }

    if(typeof newKnexConfig.client !== 'string'){
        throw new Error('Configuration client only accept string')
    }

    newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, {multipleStatements: true})
    
    
    // console.log('newKnexConfig', newKnexConfig)
    _globalKnexInstance = knex(newKnexConfig)
    return _globalKnexInstance
}

const sealRaw = (first:any, ...args: any[]) => {
    let sealRaw = getKnexInstance().raw(first, ...args)
    // @ts-ignore
    sealRaw.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    return sealRaw
}

export const raw = sealRaw


const startTransaction = async<T>(func: (trx: Knex.Transaction) => Promise<T>, existingTrx?: Knex.Transaction ): Promise<T> => {
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

let registeredModels: {
    [key: string]: typeof Entity
} = {}

export class Schema {

    tableName: string
    entityName: string
    namedProperties: NamedProperty[]
    primaryKey: NamedProperty
    uuid: NamedProperty | null

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = new NamedProperty(
            config.primaryKeyName,
            Types.PrimaryKey(),
            null
        )
        if(config.enableUuid){
            this.uuid = new NamedProperty(
                config.uuidColumnName,
                Types.String(255, false, {unique: true}),
                null
            )
            this.namedProperties = [this.primaryKey, this.uuid]
        } else {
            this.uuid = null
            this.namedProperties = [this.primaryKey]
        }
        
    }

    createTableStmt(){
        if(this.tableName.length > 0){
            return `CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (\n${
                this.namedProperties.filter(f => !f.computedFunc).map(f => {
                    return `${f.definition.create(f)}`  
                }).flat().join(',\n')}\n)`;
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

export type ComputedFunction = (selector: Selector, queryFunction: ApplyNextQueryFunction, ...args: any[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export type NamedPropertyOptions = {
    skipFieldNameConvertion?: boolean
}

export class NamedProperty {
    
    constructor(
        public name: string,
        public definition: PropertyType,
        public computedFunc?: ComputedFunction | null,
        public options?: NamedPropertyOptions){
            this.name = name
            this.definition = definition
            this.computedFunc = computedFunc
            this.options = options

            if( /[\.`' ]/.test(name) || name.includes(META_FIELD_DELIMITER) || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "${META_FIELD_DELIMITER}", "'" or endsWith '_'.`)
            }
        }

    get fieldName(){
        if(this.options?.skipFieldNameConvertion){
            return this.name
        } else {
            return config.propNameTofieldName ? config.propNameTofieldName(this.name) : this.name
        }
    }

    compileAs_(rootSelector: SelectorImpl){
        if(this.computedFunc){
            throw new Error('Computed Property cannot be compiled as normal field.')
        } 
        let namedProperty = this
        let tableAlias = rootSelector.tableAlias
        let fieldName = this.fieldName
        let fieldAlias = metaFieldAlias(namedProperty)

        return sealRaw(`(SELECT \`${tableAlias}\`.\`${fieldName}\` AS \`${fieldAlias}\`)`)
    }

    compileAs$(rootSelector: SelectorImpl, withTransform: boolean): CompiledFunction{
        if(!this.computedFunc){
            throw new Error('Normal Property cannot be compiled as computed field.')
        }
        let computedFunc = this.computedFunc
        let namedProperty = this
        let fieldAlias = metaFieldAlias(namedProperty)

        const makeFn = (withTransform: boolean) => {
            
            let callable: CompiledFunction = (queryFunction?: QueryFunction, ...args: any[]) => {
                const applyFilterFunc: ApplyNextQueryFunction = (stmt, selector) => {
                    let process = (stmt: Knex.QueryBuilder) => {
                        // console.log('stmt', stmt.toString())

                        // If the function object placed into the QueryBuilder, 
                        // QueryBuilder will call it and pass itself as the parameter
                        // That's why we can say likely our compiled function didn't be called.
                        if(queryFunction && !(queryFunction instanceof Function)){
                            console.log('\x1b[33m%s\x1b[0m', 'Likely that your ComputedProperty are not called before placing into QueryBuilder.')
                            throw new Error('The QueryFunction is not instanceof Function.')
                        }
                        const x = (queryFunction && queryFunction(stmt, selector) ) || stmt
                        return x
                    }

                    if(stmt instanceof Promise){
                        return new Promise<Knex.QueryBuilder>( (resolve, reject)=> {
                            if(stmt instanceof Promise){
                                stmt.then((query: Knex.QueryBuilder)=>{
                                    resolve(process(query))
                                },reject)
                            } else {
                                throw new Error('Unexpected flow. Subquery is updated.')
                            }
                        })
                    } else {
                        return process(stmt)
                    }     
                }
                let subquery: SQLString | Promise<SQLString> = computedFunc(rootSelector.interface!, applyFilterFunc, ...args)


                let process = (subquery: SQLString): Knex.Raw => {
                    let subqueryString = subquery.toString()
                    // // determine the column list
                    let ast!: AST
                    try{
                        ast = sqlParser.astify(subqueryString) as AST
                    }catch(err){
                        console.log('')
                        console.log('\x1b[33m%s\x1b[0m', 'The constructed SQL is in invalid format that cannot be parsed.')
                        console.log('')
                        console.log('\x1b[33m%s\x1b[0m', 'Possible reasons:')
                        console.log('')
                        console.log('\x1b[33m%s\x1b[0m', '1. Maybe you called any computed Property that is an Async Function but you haven\'t \'await\' it before placing it into the QueryBuilder.')
                        console.log('')
                        console.log('\x1b[33m%s\x1b[0m', '2. Maybe you placed any invalid Raw SQL \'Knex.Raw\' in the QueryBuilder. You can use \'QueryBuilder.toString()\' to inspect the constructed SQL.')
                        console.log('')
                        console.log(subqueryString)
                        throw err
                    }
                    // let ast = mainNode.value

                    let columnsToBeTransformed: string[] = []
                    if( ast.type === 'select'){
                        let selectAst = ast
                        let columns = ast.columns
                        
                        // then handle select items... expand columns

                        const handleColumns = (from: any[] | null, columns: any[] | Column[] | '*'): any[] | Column[] => {
                            if(columns === '*'){
                                columns = [{
                                    expr: {
                                        type: 'column_ref',
                                        table: null,
                                        column: '*'
                                    },
                                    as: null
                                }]
                            }

                            return columns.flatMap( (col: Column) => {
                                if(col.expr.type === 'column_ref' && ( col.expr.column.includes('*') || col.expr.column.includes('$star') ) ){
                                    // if it is *... expand the columns..
                                    let moreColumns = Database._resolveStar(col, from)
                                    return moreColumns
                                    // @ts-ignore
                                } else if(!col.as && col.expr.type === 'select' && col.expr.columns.length === 1){
                                    // @ts-ignore
                                    col.as = col.expr.columns[0].as
                                    if(!col.as){
                                        throw new Error('Unexpected Flow.')
                                    }
                                    return col
                                } else {

                                    if(!col.as){
                                        col.as = makeid(5)
                                    }
                                    return col
                                }
                            })
                            
                        }

                        let processedColumns = handleColumns(selectAst.from, columns) as Column[]

                        //eliminate duplicated columns

                        processedColumns = processedColumns.reduce( (acc: any[], item: SimpleObject) => {
                            if( !acc.find( (x:any) => item.as === x.as ) ){
                                acc.push(item)
                            }
                            return acc
                        },[] as any[])

                        columnsToBeTransformed = processedColumns.flatMap( (col: any) => {
                            return Database._extractColumnAlias(col) 
                        }) as string[]
                    
                        ast.columns = processedColumns
                        subqueryString = sqlParser.sqlify(ast)
                    } else {
                        throw new Error('Computed property must be started with Select')
                    }

                    let definition = namedProperty.definition

                    if(withTransform && definition.readTransform){
                        let transformedSql = definition.readTransform(subqueryString, columnsToBeTransformed)
                        return sealRaw(`(SELECT (${transformedSql.toString()}) AS ${fieldAlias})`)
                    } else {

                        return sealRaw(`(SELECT (${subqueryString}) AS ${fieldAlias})`)
                    }
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

            // TODO: add some information for debug
            // callable.namedProperty =

            return callable
        }

        return makeFn(withTransform)
    }
    

}

export const configure = async function(newConfig: Partial<Config>){
    Object.assign(config, newConfig)


    // if(config.waitUtilDatabaseReady){
        
    //     while(){
    //         try{
    //             await getKnexInstance().raw('SELECT 1')
    //         }catch(error){
    
    //         }
    //     }

    // }

    let tables: Schema[] = []

    const registerEntity = (entityName: string, entityClass: any) => {
        let s = new Schema(entityName);
        if(entityClass.register){
            entityClass.register(s)
            schemas[entityName] = s
            tables.push(s)
        }
        registeredModels[entityName] = entityClass
    }
    
    //register special Entity Dual
    registerEntity(Dual.name, Dual)

    //register models 
    if(config.models){
        let models = config.models
        Object.keys(models).forEach(key => {
            registerEntity(key, models[key]);
        })
    }
    //register models by path
    if(config.modelsPath){
        let files = fs.readdirSync(config.modelsPath)
        await Promise.all(files.map( async(file) => {
            if(file.endsWith('.js')){
                let path = config.modelsPath + '/' + file
                path = path.replace(/\.js$/,'')
                // console.debug('load model file:', path)
                let p = path.split('/')
                let entityName = p[p.length - 1]
                let entityClass = require(path)
                registerEntity(entityName, entityClass.default);
            }
        }))
    }


    let sqlStmts: string[] = tables.map(t => t.createTableStmt()).filter(t => t)

    //write schemas into sql file
    if(config.outputSchemaPath){
        let path = config.outputSchemaPath
        fs.writeFileSync(path, sqlStmts.join(";\n") + ';')
        // console.debug('schemas files:', Object.keys(schemas))
    }

    //create tables
    // important: sqllite3 doesn't accept multiple statements
    if(config.createModels){
        await Promise.all( sqlStmts.map( async(sql) => {
            await getKnexInstance().raw(sql)
        }) )
    }

    return sqlStmts
}

export const sealSelect = function(...args: Array<any>) : Knex.QueryBuilder {
    let sealSelect = getKnexInstance().select(...args)
    // @ts-ignore
    sealSelect.then = 'It is overridden. Then function is removed to prevent execution when it is passing accross the async functions'
    return sealSelect
}
export const select = sealSelect

export type SimpleObject = { [key:string]: any}

const map1 = new Map<NamedProperty, string>()
const map2 = new Map<string, NamedProperty>()
const registerGlobalNamedProperty = function(d: NamedProperty): string{
    let r = map1.get(d)
    if(!r){
        let key = makeid(5)
        map1.set(d, key)
        map2.set(key, d)
        r = key
    }
    return r
}

const findGlobalNamedProperty = function(propAlias: string): NamedProperty{
    let r = map2.get(propAlias)
    if(!r){
        throw new Error(`Cannot find the Property by '${propAlias}'. Make sure it is registered before.`)
    }
    return r
}


const metaTableAlias = function(schema: Schema): string{
    return schema.entityName + META_FIELD_DELIMITER + makeid(5)
}

const breakdownMetaTableAlias = function(metaAlias: string) {
    metaAlias = metaAlias.replace(/[\`\']/g, '')
    
    if(metaAlias.includes(META_FIELD_DELIMITER)){
        let [entityName, randomNumber] = metaAlias.split(META_FIELD_DELIMITER)
        let found = schemas[entityName]
        return found
    } else {
        return null
    }
}

const metaFieldAlias = function(p: NamedProperty): string{
    let propAlias = registerGlobalNamedProperty(p)
    return `${p.name}${META_FIELD_DELIMITER}${propAlias}`
}

const breakdownMetaFieldAlias = function(metaAlias: string){
    metaAlias = metaAlias.replace(/[\`\']/g, '')
    if(metaAlias.includes(META_FIELD_DELIMITER)){
        let [propName, propAlias] = metaAlias.split(META_FIELD_DELIMITER)
        let namedProperty = findGlobalNamedProperty(propAlias)
        return {propName, namedProperty}
    } else {
        return null
    }
}

export interface Selector {
    (value: any): any
    impl: SelectorImpl
    entityClass: typeof Entity
    schema: Schema
    derivedProps: Array<NamedProperty>
    _: {[key: string] : Knex.Raw}
    $: {[key: string] : CompiledFunction}
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    all: string
    source: string
    sourceRaw: string
    pk: Knex.Raw
    uuid: Knex.Raw | null
    // [key: string]: any
    tableAlias: string
    registerProp(namedProperty: NamedProperty): CompiledFunction
    getProperties(): NamedProperty[]
}


export class SelectorImpl{
    interface: Selector | null | undefined
    entityClass: typeof Entity
    schema: Schema
    derivedProps: Array<NamedProperty> = []
    _: {[key: string] : Knex.Raw}
    $: {[key: string] : CompiledFunction}
    // $$: {[key: string] : CompiledFunction}
    // prop: (value: any) => any
    [key: string]: any
    tableAlias: string

    // stored any compiled property
    // compiledNamedPropertyMap: Map<string, CompiledNamedProperty> = new Map<string, CompiledNamedProperty>()
   
    constructor(entityClass: typeof Entity, schema: Schema){
        let selector = this
        this.schema = schema
        this.tableAlias = metaTableAlias(schema)
        this.entityClass = entityClass
        
        this._ = new Proxy( {} ,{
            get: (oTarget, sKey: string) => {
                return selector.getNormalCompiled(sKey)
            }
        }) as {[key: string] : Knex.Raw}

        this.$ = new Proxy( {} ,{
            get: (oTarget, sKey: string): CompiledFunction | Knex.Raw => {
                return selector.getComputedCompiled(sKey)
            }
        }) 
    }

    getComputedCompiled(sKey: string) {
        let selector = this
        if(!selector){
            throw new Error('Unexpected')
        }
        let withTransform = true
        if (sKey.startsWith('_')) {
            withTransform = false
            sKey = sKey.slice(1)
        }
        let prop = selector.getProperties().find((prop) => prop.name === sKey)
        selector.checkDollar(prop, sKey)
        return prop!.compileAs$(selector, withTransform)
    }

    getNormalCompiled(sKey: string) {
        let selector = this
        if(!selector){
            throw new Error('Unexpected')
        }
        // let withEscape = false
        // if (sKey.startsWith('_')) {
        //     withEscape = true
        //     sKey = sKey.slice(1)
        // }
        let prop = this.getProperties().find((prop) => prop.name === sKey)
        this.checkDash(prop, sKey)
        return prop!.compileAs_(selector)
    }

    private checkDollar(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}'`)
        } else if (!prop.computedFunc) {
            throw new Error(`Property '${sKey}' is NormalProperty. Accessing through $ is not allowed.`)
        }
    }

    private checkDash(prop: NamedProperty | undefined, sKey: string) {
        if (!prop) {
            throw new Error(`Cannot find property '${sKey}'`)
        } else if (prop.computedFunc) {
            throw new Error(`Property '${sKey}' is ComputedProperty. Accessing through _ is not allowed.`)
        }
    }

    // "table AS abc"
    get source(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
        }
        return `${this.schema.tableName} AS ${this.tableAlias}`
    }

    get sourceRaw(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [source] for selection.`)
        }
        return `\`${this.schema.tableName}\` AS \`${this.tableAlias}\``
    }

    // "abc.*"
    get all(): string{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return `${this.tableAlias}.$star`
    }

    get pk(): Knex.Raw{
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.primaryKey.name]
    }

    get uuid(): Knex.Raw | null {
        if(this.schema.tableName.length === 0){
            throw new Error(`Entity ${this.schema.entityName} is a virtual table. It have no [all] for selection.`)
        }
        return this._[this.schema.uuid?.name ?? '']
    }

    getProperties(): NamedProperty[]{
        // derived Props has higher priority. I can override the schema property
        return [...this.derivedProps, ...this.schema.namedProperties]
    }

    registerProp(namedProperty: NamedProperty): CompiledFunction{
        this.derivedProps.push(namedProperty)
        if(!namedProperty.computedFunc){
            throw new Error('Only the Computed Property can be registered after the schema is created.')
        } else {
            return this.getComputedCompiled(namedProperty.fieldName)
        }
    }
}

export type CompiledFunction = (queryFunction?: QueryFunction, ...args: any[]) => Knex.Raw | Promise<Knex.Raw>

export type QueryFunction = (stmt: Knex.QueryBuilder, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

export type ApplyNextQueryFunction = (stmt: Knex.QueryBuilder | Promise<Knex.QueryBuilder>, ...selectors: Selector[]) => Knex.QueryBuilder | Promise<Knex.QueryBuilder>

type ExecutionContextAction<I> =  (beforeExecutionOutput: BeforeExecutionOutput, trx?: Knex.Transaction) => Promise<I>
type BeforeExecutionAction = () => Promise<BeforeExecutionOutput>
type BeforeExecutionOutput = Array<{
    sqlString: SQLString,
    uuid: string | null
}>

export class ExecutionContext<I> implements PromiseLike<I>{
    beforeAction: BeforeExecutionAction
    trx?: Knex.Transaction
    action: ExecutionContextAction<I>

    constructor(beforeAction: BeforeExecutionAction, action: ExecutionContextAction<I>){
        this.beforeAction = beforeAction
        this.action = action
    }
    async then<TResult1, TResult2 = never>(
        onfulfilled: ((value: I) => TResult1 | PromiseLike<TResult1>) | null, 
        onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null)
        : Promise<TResult1 | TResult2> {

        try{
            if(onfulfilled){
                let result = await this.action(await this.beforeAction(), this.trx)
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

    async toSQLString(): Promise<SQLString[]> {
        return (await this.beforeAction()).map( ({sqlString}) => sqlString )
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
                    (dualSelector): Knex.QueryBuilder => {
                        return stmt
                    }
                )
                dualSelector.registerProp(prop)

                return [{
                    sqlString: Database.transpile(await dualSelector.$.data()),
                    uuid: null
                }]
            },
            async(input: BeforeExecutionOutput, trx?: Knex.Transaction) => {
                // console.debug("======== run ========")
                // console.debug(stmt.toString())
                // console.debug("=====================")
                if(input.length > 1){
                    throw new Error('Unexpected Flow.')
                }
                let resultData = await Database.executeStatement(input[0].sqlString, trx)
                let tmp = resultData[0]
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

        // console.debug('==== before transpile ===')
        // console.debug(sql)
        // console.debug('=========================')

        let ast: any = sqlParser.astify(sql)

        // console.log('aaaaa', JSON.stringify(ast) )

        ast = this._transpileAst(ast, true)

        // console.log('zzzzzzz', JSON.stringify(ast) )

        let a = sqlParser.sqlify(ast)
        return a
    }

    static _transpileAst(ast: SimpleObject, withAlias: boolean): SimpleObject{
        if(!ast){
            return ast
        }
        if(typeof ast === 'string'){
            return ast
        } else if( Array.isArray(ast)){
            ast = ast.map(item => this._transpileAst(item, withAlias))
            return ast
        } else if( ast.expr && ast.expr.type === 'select'){
            let expr = ast.expr
            // handle where first, no dependences
            
            if (expr.where) {
                expr.where = this._transpileAst(expr.where, false)
            }

            // must handle the 'from' before 'selectitem'... because of dependencies
            if (expr.from) {
                // console.log('bbbbbbbb', expr.from[0].expr.ast)
                expr.from = this._transpileAst(expr.from, true)
            }
            
            // let rand = makeid(5)
            // console.debug('-> subquery', rand, ast.alias, astValue.selectItems.value.length, astValue.from)
            
            expr.columns = expr.columns.map( (item: SimpleObject) => this._transpileAst(item, true) )

            // console.debug('<-- subquery', rand, ast.alias, astValue.selectItems.value.length, astValue.from)
            // remove double nested sql
            
            if(expr.columns.length === 1){
                let item = expr.columns[0]
                if(item.expr.type === 'select'){
                    if(!withAlias){
                        item.as = null
                    }
                    return item
                } else if(item.expr.type === 'column_ref'){

                    if(!withAlias){
                        item.as = null
                    }
                    return item
                }

            }

            return ast
            
        } else if( !withAlias && ast.type === 'select' ) {

            if (ast.where) {
                ast.where = this._transpileAst(ast.where, false)
            }

            // must handle the 'from' before 'selectitem'... because of dependencies
            if (ast.from) {
                ast.from = this._transpileAst(ast.from, true)
            }

            ast.columns = ast.columns.map( (item: SimpleObject) => this._transpileAst(item, true) )

            if(ast.columns.length === 1){
                let item = ast.columns[0]
                if(item.expr.type === 'select'){
                    return item.expr
                } else if(item.expr.type === 'column_ref'){
                    return item.expr
                }
            }
            
            return ast
            
        } else if ( (ast as SimpleObject) instanceof Object){
            let newReturn = Object.keys(ast).reduce((acc, key)=>{

                if(['ast', 'columns', 'column', 'where', 'from', 'on', 'expr', 'left', 'right'].includes(key)){

                    if(key === 'left' || key === 'right'){
                        withAlias = false
                    }
                    acc[key] = this._transpileAst(ast[key], withAlias)
                }
                else {
                    acc[key] = ast[key]
                }

                return acc
            },{} as SimpleObject)
            return newReturn
        }

        return ast
    }

    static _extractColumnAlias(col: Column | '*'): string | null {
        let found = this._extractColumnName(col)
        if(found){
            return found[0]
        }
        return null
    }

    static _extractColumnName(col: Column | '*'): Array<string | null> {
        if(col === '*'){
            return ['*']
        }
        let v = col.as
        if(v){
            return [v]
        } else if(!v && col.expr.type === 'column_ref'){
            v = col.expr.column
            return [v, col.expr.table || null]
        }
        return []
    }

    static _resolveStar(ast: Column | '*', from: any[] | null): any {

        let [name, targetTable] = this._extractColumnName(ast)

        if(from === null){
            throw new Error('Not expected')
        }

        return from.flatMap( (obj: SimpleObject ) => {

            let tableNameOrTableAlias = obj.as

            
            if(tableNameOrTableAlias){

                //if there is no target table refered or the target table matched the name
                if(!targetTable || targetTable === tableNameOrTableAlias){

                    if(obj.table){
                        let schema = breakdownMetaTableAlias(tableNameOrTableAlias)
                        if(!schema)
                            throw new Error(`Schema is not found.`)
                            
                        let all = schema.namedProperties.filter(p => !p.computedFunc).map(p => {
                            let alias = metaFieldAlias(p)
                            return {
                                expr: {
                                    type: "column_ref",
                                    table: tableNameOrTableAlias,
                                    column: p.fieldName
                                },
                                as: alias
                            }
                        })
                        return all
                    }else {
                        let ast: AST = obj.expr.ast
                        if(ast.type === 'select'){
                            let selectAst = ast
                            if( selectAst.columns === '*'){
                                throw new Error('Unexpected flow is reached.') 
                            } else {
                                return selectAst.columns.map( (c: SimpleObject) => ({
                                    expr: {
                                        type: "column_ref",
                                        table: tableNameOrTableAlias,
                                        column: c.as ?? c.column
                                    },
                                    as: c.as
                                }))
                            }
                        }
                        else throw new Error('Unexpected flow is reached.')
                    }

                }

                return []
            } else throw new Error('Unexpected flow is reached.')
        })

    }

    static createOne<T extends typeof Entity>(entityClass: T, data: SimpleObject ): ExecutionContext< InstanceType<T> >{
        return new ExecutionContext< InstanceType<T> >(
            async() => {
                let addUuid: boolean = !!config.enableUuid
                if (config.knexConfig.client.startsWith('sqlite')) {
                    if (!config.enableUuid ){
                        throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
                    }
                }
                let prepared = Database._prepareCreate<T>(entityClass, data, addUuid)
                return [prepared]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction) => {
                let result = await Database._create<T>(input, entityClass, existingTrx)
                if(!result[0]){
                    throw new Error('Unexpected Error. Cannot find the entity after creation.')
                }
                return result[0]
            }
        )
    }

    static create<T extends typeof Entity>(entityClass: T, arrayOfData: SimpleObject[] ): ExecutionContext< InstanceType<T>[] >{
        return new ExecutionContext< InstanceType<T>[] >(
            async() => {
                let addUUID: boolean = !!config.enableUuid
                if (config.knexConfig.client.startsWith('sqlite')) {
                    if (!config.enableUuid ){
                        throw new Error('Entity creation in sqlite environment requires \'enableUuid = true\'')
                    }
                }
                return arrayOfData.map( (data) => {
                    return Database._prepareCreate<T>(entityClass, data, addUUID)
                })
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction) => {
                let result = await Database._create<T>(input, entityClass, existingTrx)
                return result.map( data => {
                    if(data === null){
                        throw new Error('Unexpected Flow.')
                    }
                    return data
                })
            })
    }

    private static async _create<T extends typeof Entity>(inputs: BeforeExecutionOutput, entityClass: T, existingTrx: Knex.Transaction<any, any[]> | undefined) {
        return await startTransaction< (InstanceType<T> | null)[]>(async (trx) => {
            let allResults = await Promise.all(inputs.map(async ( input) => {
                let insertedId: number
                // console.debug('======== INSERT =======')
                // console.debug(stmt.toString())
                // console.debug('========================')
                if (config.knexConfig.client.startsWith('mysql')) {
                    const r = await this.executeStatement(input.sqlString.toString() + '; SELECT LAST_INSERT_ID() AS id ', trx)
                    insertedId = r[1][0].id
                    let records = await this.find(entityClass, (stmt, t) => stmt.whereRaw('?? = ?', [t._.id, insertedId])).usingConnection(trx)
                    return records[0] ?? null

                } else if (config.knexConfig.client.startsWith('sqlite')) {
                    const r = await this.executeStatement(input.sqlString.toString(), trx)
                    
                    if(config.enableUuid){
                        if(input.uuid === null){
                            throw new Error('Unexpected Flow.')
                        } else {
                            let uuid = input.uuid
                            let records = await this.find(entityClass, (stmt, t) => stmt.whereRaw('?? = ?', [t.uuid, uuid])).usingConnection(trx)
                            return records[0] ?? null
                        }
                    } else {
                        return null
                    }

                } else {
                    throw new Error('NYI')
                }
                
            }))
            return allResults

        }, existingTrx)
    }

    private static _prepareCreate<T extends typeof Entity>(entityClass: T, data: SimpleObject, useUuid: boolean) {
        const schema = entityClass.schema
        let newUuid = uuidv4()
        let newData = Object.keys(data).reduce((acc, propName) => {
            let prop = schema.namedProperties.find(p => {
                return p.name === propName
            })
            if (!prop) {
                throw new Error(`The Property [${propName}] doesn't exist`)
            }
            acc[prop.fieldName] = prop.definition.parseProperty(data[prop.name], prop)
            return acc
        }, {} as SimpleObject)

        if(useUuid){
            newData[config.uuidColumnName] = newUuid
        }
        let stmt = getKnexInstance()(schema.tableName).insert(newData)
        return {
            sqlString: Database.transpile(stmt),
            uuid: newUuid
        }
    }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
     static findOne<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): ExecutionContext<  InstanceType<T> >{
         return new ExecutionContext< InstanceType<T> >(
            async() => {
                return [{
                    sqlString: await Database._prepareFind(entityClass, applyFilter),
                    uuid: null
                }]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction
            ) => {
                if(input.length > 1){
                    throw new Error('Unexpected Flow.')
                }
                let rows = await Database._find<T>(entityClass, input[0].sqlString, existingTrx)
            return rows[0] ?? null
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
                return [{
                    sqlString: await Database._prepareFind(entityClass, applyFilter),
                    uuid: null
                }]
            },
            async (input: BeforeExecutionOutput, existingTrx?: Knex.Transaction
            ) => {
                let rows = await Database._find<T>(entityClass, input[0].sqlString, existingTrx)
            return rows
        })
    }

    private static async _prepareFind<T extends typeof Entity>(entityClass: T, applyFilter?: QueryFunction): Promise<SQLString>{
        let dualSelector = Dual.newSelector()
        let prop = new NamedProperty(
            'data',
            Types.Array(entityClass),
            () => {
                let currentEntitySelector = entityClass.selector()
                let stmt: Knex.QueryBuilder = sealSelect().from(currentEntitySelector.source)
                let result = stmt
                if (applyFilter) {
                    return applyFilter(stmt, currentEntitySelector)
                } else{
                    return result
                }
            }
        )
        dualSelector.registerProp(prop)
        return Database.transpile(await dualSelector.$.data())
    }

    private static async _find<T extends typeof Entity>(entityClass: T, stmt: SQLString, existingTrx?: Knex.Transaction<any, any[]>) {
       
        // console.debug("========== FIND ================")
        // console.debug(stmt.toString())
        // console.debug("================================")
        let resultData: any = await Database.executeStatement(stmt, existingTrx)

        let dualInstance = this.parseRaw(Dual, resultData[0] as SimpleObject)
        let str = "data" as keyof Dual
        let rows = dualInstance[str] as Array<InstanceType<T>>
        return rows
    }

    static async executeStatement(stmt: SQLString, existingTrx?: Knex.Transaction): Promise<any> {

        let KnexStmt = getKnexInstance().raw(stmt.toString())
        if (existingTrx) {
            KnexStmt.transacting(existingTrx)
        }
        let result = await KnexStmt

        if(config.knexConfig.client.startsWith('mysql')){
            return result[0]
        } else if(config.knexConfig.client.startsWith('sqlite')){
            return result
        }
    }

    static parseRaw<T extends typeof Entity>(entityClass: T, row: SimpleObject): InstanceType<T>{
        // let entityClass = (entityConstructor as unknown as typeof Entity)
        // let entityClass = this
        let entityInstance = Object.keys(row).reduce( (entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
            let metaInfo = breakdownMetaFieldAlias(fieldName)
            // let propName = null
            let namedProperty = null
            if(metaInfo){
                // propName = metaInfo.propName
                namedProperty = metaInfo.namedProperty
            } else{
                
                let prop = entityClass.schema.namedProperties.find(p => {
                    return p.fieldName === fieldName
                })

                if(!prop){
                    if(!config.suppressErrorOnPropertyNotFound){
                        throw new Error(`Result contain property/column [${fieldName}] which is not found in schema.`)
                    }
                }else{
                    namedProperty = prop
                    // propName = prop.name
                    // definition = prop.definition
                }
            }
            /**
             * it can be boolean, string, number, Object, Array of Object (class)
             * Depends on the props..
             */
            let propValue = namedProperty?.definition!.parseRaw(row[fieldName], namedProperty)
            
            Object.defineProperty(entityInstance, namedProperty?.name!, {
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
        let selectorImpl = new SelectorImpl(this, schemas[this.name])
        // let entityClass = this

        let selector = function(value: any){
            if(typeof value === 'string'){
                return selectorImpl.getNormalCompiled(value)
            } else if(value.constructor === Object){

                let sqlArgs: string[] = []
                let accSqls: string[] = []
            
                Object.keys(value).forEach( (key) => {
                    let prop = selectorImpl.getProperties().find((prop) => prop.name === key)
                    if(prop && !prop.computedFunc){
                        let converted = selectorImpl.getNormalCompiled(key).toString()
                        accSqls.push(`${converted} = ?`)
                        sqlArgs.push(value[key])
                    }
                })
                return sealRaw( accSqls.join(' AND '), sqlArgs)
            } else if(Array.isArray(value)){
                return value.map( v => selectorImpl.getNormalCompiled(v) )
            } else return value
        } as Selector

        // selector._ = selectorImpl._
        // selector.$ = selectorImpl.$
        // selector.schema = selectorImpl.schema
        // selector.entityClass = selectorImpl.entityClass
        // selector.tableAlias = selectorImpl.tableAlias
        // selector.getProperties = selectorImpl.getProperties
        
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
                            return selectorImpl._[sKey.slice(1)]
                        } else if( /^\$/.test(sKey) ){
                            return selectorImpl.$[sKey.slice(1)]
                        }
                    } 
                }
                if(sKey in selectorImpl){
                    return selectorImpl[sKey.toString()]
                }
                else throw new Error(`Cannot find property '${sKey.toString()}' of selector`)
            }
        })

        selectorImpl.interface = selector
        selector.impl = selectorImpl
        return selector
    }

    static create<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), arrayOfData: SimpleObject[]): ExecutionContext<I[]>{
        return Database.create(this, arrayOfData)
    }

    static createOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: SimpleObject): ExecutionContext<I>{
        return Database.createOne(this, data)
    }

    // static createOneOnly<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), data: SimpleObject): ExecutionContext<void>{
    //     return Database.createOneOnly(this, data)
    // }

    /**
     * find one record
     * @param applyFilter 
     * @returns the found record
     */
    static findOne<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<I>{
        return Database.findOne(this, applyFilter)
    }

    /**
     * find array of records
     * @param applyFilter 
     * @returns the found record
     */
    static find<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), applyFilter?: QueryFunction): ExecutionContext<Array<I>>{
        return Database.find(this, applyFilter)
    }

    static parseRaw<I extends Entity>(this: typeof Entity & (new (...args: any[]) => I), row: SimpleObject): I{
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
export const models = registeredModels

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
