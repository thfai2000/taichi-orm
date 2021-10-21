
import { Knex } from "knex"
import { CompiledComputeFunction, ComputeFunction, DatabaseContext, ExtractValueTypeDictFromPropertyDict, Hook, ORM, Scalarable, SelectorMap } from "."
import { Column, Dataset, makeRaw, Scalar } from "./Builder"
import { FieldPropertyTypeDefinition, ParsableTrait, PrimaryKeyType, PropertyTypeDefinition, StringNotNullType } from "./PropertyType"
import { isFunction, makeid, notEmpty, quote, SQLString, thenResult } from "./util"


export abstract class Property {
    #name?: string
    // #definitionConstructor: D | (new () => D ) | (() => D)
    // #definition: D | null = null

    constructor(
        // definition: D | (new () => D ) | (() => D)
    ){
        // this.#definitionConstructor = definition
    }

    register(
        name: string){
            if( /[\.`' ]/.test(name) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "'" or startsWith/endsWith '_'.`)
            }
            this.#name = name
            
        }

    // get definition(): D{

    //     if(!this.#definition){
    //         let definition: D | null = null
    //         if(this.#definitionConstructor instanceof PropertyTypeDefinition){
    //             definition = this.#definitionConstructor
    //         } else if( isFunction(this.#definitionConstructor) ){
    //             definition = (this.#definitionConstructor as () => D)()
    //         } else if(this.#definitionConstructor instanceof Function){
    //             const c = (this.#definitionConstructor as (new () => D ))
    //             definition = new c()
    //         }
    
    //         if(definition instanceof PropertyTypeDefinition){
    //             this.#definition = definition
    //         }
    //         else throw new Error('Invalid parameters')
    //     }

    //     return this.#definition
    // }

    get name(){
        if(!this.#name){
            throw new Error('Property not yet registered')
        }
        return this.#name
    }

}

export class StrictTypeProperty<D extends PropertyTypeDefinition<any>> extends Property {
    #definitionConstructor: D | (new () => D ) | (() => D)
    #definition: D | null = null

     constructor(
        definition: D | (new () => D ) | (() => D)){
            super()
            this.#definitionConstructor = definition
        }

    get definition(): D{

        if(!this.#definition){
            let definition: D | null = null
            if(this.#definitionConstructor instanceof PropertyTypeDefinition){
                definition = this.#definitionConstructor
            } else if( isFunction(this.#definitionConstructor) ){
                definition = (this.#definitionConstructor as () => D)()
            } else if(this.#definitionConstructor instanceof Function){
                const c = (this.#definitionConstructor as (new () => D ))
                definition = new c()
            }
    
            if(definition instanceof PropertyTypeDefinition){
                this.#definition = definition
            }
            else throw new Error('Invalid parameters')
        }

        return this.#definition
    }
}

export class ComputeProperty<F extends ComputeFunction<any, any, any> > extends Property {

    // type: 'ComputeProperty' = 'ComputeProperty'
    compute: F

    constructor(
        // definition: (F extends ComputeFunction<any, infer P>?P:never) |
        // (new () => (F extends ComputeFunction<any, infer P>?P:never)) |
        // ( () => (F extends ComputeFunction<any, infer P>?P:never))
        // ,
        compute:  F){
            super()
            this.compute = compute
        }
}

export class FieldProperty<D extends FieldPropertyTypeDefinition<any>> extends StrictTypeProperty<D> {

    // type: 'FieldProperty' = 'FieldProperty'
    private _fieldName?: string


    constructor(
        definition: D | (new () => D ) | (() => D)){
            super(definition)
        }

    convertFieldName(propName: string, orm: ORM<any>){
        const c = orm.ormConfig.propNameTofieldName
        return c? c(propName) : propName
    }

    fieldName(orm: ORM<any>){
        // if(!this._fieldName){
        //     throw new Error('Property not yet registered')
        // }
        if(this._fieldName){
            return this._fieldName
        }
        return this.convertFieldName(this.name, orm)
    }

    setFieldName(value: string){
        this._fieldName = value
        return this
    }
}

export class ScalarProperty<D extends PropertyTypeDefinition<any>> extends Property {
    readonly scalar: Scalar<D>

    constructor(
        scalar: Scalar<D>){
            super()
            this.scalar = scalar
        }
}

export class Schema<PropertyDict extends {[key:string]: Property}> implements ParsableTrait<ExtractValueTypeDictFromPropertyDict<PropertyDict>>{

    // properties: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)[] = []
    // propertiesMap: {[key:string]: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyTypeDefinition<any> >)} = {}

    // properties: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> )[] = []
    // propertiesMap: {[key:string]: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> )} = {}
    
    properties: (Property)[] = []
    propertiesMap: PropertyDict

    constructor(props: PropertyDict){
        this.propertiesMap = {} as PropertyDict
        Object.keys(props).forEach( (key: keyof PropertyDict) => {
            const prop = props[key]
            if (prop instanceof Property) {
                prop.register(key as string);
                this.propertiesMap[key] = prop
                this.properties.push(prop)
            } else {
                throw new Error('Not expected')
            }
        })
    }

    parseRaw(rawValue: any, context: DatabaseContext<any>, prop?: string): ExtractValueTypeDictFromPropertyDict<PropertyDict> {
        return this.parseDataBySchema(rawValue, context)
    }
    parseProperty(propertyvalue: ExtractValueTypeDictFromPropertyDict<PropertyDict>, context: DatabaseContext<any>, prop?: string) {
        return propertyvalue
    }

    parseDataBySchema(row: any, context: DatabaseContext<any>): ExtractValueTypeDictFromPropertyDict<PropertyDict> {
        const schema = this
        let output = {}
        for (const propName in row) {
            const p = schema.propertiesMap[propName]
            if(p){
                if( p instanceof ScalarProperty){

                    const propType = p.scalar.definitionForParsing()
                    /**
                     * it can be boolean, string, number, Object, Array of Object (class)
                     * Depends on the props..
                     */
                    // let start = null
                    // if(metaInfo.propName === 'products'){
                    //     start = new Date()
                    // }
                    let propValue = propType.parseRaw(row[propName], context, propName) ?? row[propName]
                    
                    // if(metaInfo.propName === 'products'){
                    //     //@ts-ignore
                    //     console.log('parseDataBySchema',  new Date() - start )
                    // }
        
                    Object.defineProperty(output, propName, {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: propValue
                    })
                }
            }
        }

        // entityInstance = Object.keys(row).reduce((entityInstance, fieldName) => {
            // let prop = this.compiledNamedPropertyMap.get(fieldName)
        // }, entityInstance)
        
        return output as any
    }

}


export class TableSchema<PropertyDict extends {[key:string]: Property}> extends Schema<PropertyDict> {

    hooks: Hook[] = []
    // entityClass?: E
    #entityName: string
    overridedTableName?: string

    id: FieldProperty<PrimaryKeyType>
    uuid?: FieldProperty<StringNotNullType> = undefined

    constructor(entityName: string, props: PropertyDict, id: FieldProperty<PrimaryKeyType>, uuid?: FieldProperty<StringNotNullType>){
        super(props)
        this.#entityName = entityName
        this.id = id
        this.uuid = uuid
    }

    tableName(context: DatabaseContext<any>, options?: TableOptions){
        if(this.overridedTableName){
            return this.overridedTableName
        } else {
            let name = this.#entityName
            if( context.orm.ormConfig.entityNameToTableName) {
                name = context.orm.ormConfig.entityNameToTableName(name)
            }
            if(options?.tablePrefix){
                name = options.tablePrefix + name
            }
            return name
        }
    }

    setTableName(name: string) {
        this.overridedTableName = name
        return this
    }

    createTableStmt(context: DatabaseContext<any>, options?: TableOptions){
        const client = context.client()
        const tableName = this.tableName(context, options)

        let props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty<FieldPropertyTypeDefinition<any>>[]
        
        return `CREATE TABLE IF NOT EXISTS ${quote(client, tableName)} (\n${
            props.map( prop => {
                let f = prop.definition
                if(f instanceof FieldPropertyTypeDefinition){
                    return `${f.create(prop.name, prop.fieldName(context.orm), context)}`  
                }
                return ``
            }).flat().join(',\n')}\n)`;
    }

    datasource<T extends TableSchema<any>, Name extends string>(this: T, name: Name, options?: TableOptions) : TableDatasource<T, Name>{
        const source = new TableDatasource(this, name, options)
        return source
    }
}



export type TableOptions = {
    tablePrefix?: string
}


export interface Datasource<E extends Schema<any>, alias extends string> {
    sourceAlias: alias
    schema: E
    selectorMap(): SelectorMap<E>

    toRaw(context: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw>
    realSource(context: DatabaseContext<any>): SQLString | Promise<SQLString>
    
    // getProperty: <Name extends string, T extends PropertyTypeDefinition<any> >(name: Name) => Column<Name, T>
    getAllFieldProperty: ()  => Column<string, PropertyTypeDefinition<any>>[]
    getFieldProperty: <Name extends string>(name: Name) => Column<Name, PropertyTypeDefinition<any>>
    getScalarProperty: <Name extends string>(name: Name) => Column<Name, PropertyTypeDefinition<any>> 
    getComputeProperty: <Name extends string, ARG extends any, R extends PropertyTypeDefinition<any>>(name: Name) => CompiledComputeFunction<Name, ARG, R>
    // getAysncComputeProperty: <Name extends string, ARG extends any[], R>(name: string) => CompiledComputeFunctionPromise<Name, ARG, R>
    // tableAlias: {
    //     [key in keyof [alias] as alias]: string 
    // }
}

abstract class DatasourceBase<E extends Schema<any>, Name extends string> implements Datasource<E, Name> {

    readonly schema: E
    readonly sourceAlias: Name
    readonly sourceAliasAndSalt: string

    constructor(schema: E, sourceAlias: Name){
        if( !Number.isInteger(sourceAlias.charAt(0)) && sourceAlias.charAt(0).toUpperCase() === sourceAlias.charAt(0) ){
            throw new Error('alias cannot start with Uppercase letter')
        }

        this.schema = schema
        this.sourceAlias = sourceAlias
        this.sourceAliasAndSalt = makeid(5)// this.sourceAlias + '___' + 
    }
    abstract realSource(context: DatabaseContext<any>): SQLString | Promise<SQLString>

    selectorMap(): SelectorMap<E>{
        const datasource = this
        //@ts-ignore
        const map = new Proxy( datasource, {
            get: (oTarget: typeof datasource, sKey: string) => {
                if(typeof sKey === 'string'){
                    if(sKey === '$allFields'){
                        let props = datasource.getAllFieldProperty()
                        return props.reduce( (acc, item) => {
                            acc = Object.assign(acc, item.value())
                            return acc
                        }, {} as {[key:string]: Column<any, any>} )
                    } else {
                        let prop = oTarget.schema.propertiesMap[sKey]
                        if(prop instanceof FieldProperty){
                            return datasource.getFieldProperty(sKey)
                        }
                        if(prop instanceof ComputeProperty){
                            return datasource.getComputeProperty(sKey)
                        }
                        if(prop instanceof ScalarProperty){
                            return datasource.getScalarProperty(sKey)
                        }
                    }
                }
            }
        }) as SelectorMap<E>
        return map
    }

    // getProperty<Name extends string, T extends PropertyTypeDefinition<any>>(name: Name) : Column<Name, T> {
    //     let prop = this.schema.propertiesMap[name]
    //     if( !(prop instanceof Property)){
    //         throw new Error('it is not property')
    //     } else {
    //         const derivedProp = prop
    //         return new Column(name, derivedProp.definition, (entityRepository) => {
    //             const orm = entityRepository.orm
    //             const client = orm.client()
    //             let rawTxt = `${quote(client, this.sourceAlias)}.${quote(client, derivedProp.name)}`
    //             return makeRaw(entityRepository, rawTxt)
    //         })
    //     }
    // }

    getAllFieldProperty(): Column<string, PropertyTypeDefinition<any>>[] {
        return Object.keys(this.schema.propertiesMap)
        .map(key => (this.schema.propertiesMap[key] instanceof FieldProperty)? this.getFieldProperty(key) :null )
        .filter(notEmpty)
    }

    getFieldProperty<Name extends string>(name: Name): Column<Name, PropertyTypeDefinition<any>> {
        let prop = this.schema.propertiesMap[name]
        if( !(prop instanceof FieldProperty)){
            throw new Error(`it is not field property ${name}`)
        } else {
            const fieldProp = prop
            return new Column(name, (context) => {
                const orm = context.orm
                const client = context.client()
                let rawTxt = `${quote(client, this.sourceAliasAndSalt)}.${quote(client, fieldProp.fieldName(orm))}`
                return makeRaw(context, rawTxt)
            }, fieldProp.definition)
        }
    }


    getComputeProperty<Name extends string, ARG extends any, R extends PropertyTypeDefinition<any>>(name: Name): CompiledComputeFunction<Name, ARG, R>{
        let prop = this.schema.propertiesMap[name]
        if( !(prop instanceof ComputeProperty)){
            throw new Error(`Not field property ${name}`)
        }else{
            const cProp = prop
            return (args?: ARG) => {
            
                let col = new Column<Name, R>(name, (context) => {
                    const subquery: Scalarable<any> | Promise<Scalarable<any> > = cProp.compute.call(cProp, context, this, args)
                    let r = thenResult( subquery, scalarable => scalarable.toScalar() )
                    return r
                }, null)

                return col
            }
        }
    }

   getScalarProperty<Name extends string>(name: Name): Column<Name, PropertyTypeDefinition<any>> {
        let prop = this.schema.propertiesMap[name]
        if( !(prop instanceof ScalarProperty)){
            throw new Error(`it is not field property ${name}`)
        } else {
            const fieldProp = prop
            return new Column(name, fieldProp.scalar, null)
        }
    }
    
    async toRaw(context: DatabaseContext<any>){
        const client = context.client()
        const sql = await this.realSource(context)
        return makeRaw(context, `${sql} AS ${quote(client, this.sourceAliasAndSalt)}`)
    }

}

export class TableDatasource<E extends TableSchema<any>, Name extends string> extends DatasourceBase<E, Name> {

    readonly options?: TableOptions

    constructor(schema: E, sourceAlias: Name, options?: TableOptions){
        super(schema, sourceAlias)
        this.options = options
    }

    realSource(context: DatabaseContext<any>){
        const finalOptions = Object.assign({}, {tablePrefix: context.tablePrefix}, this.options ?? {})

        let tableName = this.schema.tableName(context, finalOptions)
        if(!tableName){
            throw new Error('Not yet registered')
        }
        return quote(context.client(), tableName)
    }
}

export class DerivedDatasource<D extends Dataset<any>, Name extends string> extends DatasourceBase< Schema<any>, Name> {

    readonly dataset: D
    constructor(dataset: D, sourceAlias: Name){
        super( dataset.schema(), sourceAlias)
        this.dataset = dataset
    }

    async realSource(context: DatabaseContext<any>){
        return `(${(await this.dataset.toNativeBuilder(context))})`
    }
}
