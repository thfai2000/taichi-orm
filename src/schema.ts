import { Knex } from "knex"
import { ComputeValueGetter, ComputeValueGetterDefinition, DatabaseContext, Hook, ORM, PropertyValueGetters, ComputeValueGetterDefinitionDynamicReturn, ExtractGetValueTypeDictFromDataset, ComputeValueSetterDefinition } from "."
import { Dataset, Scalar } from "./builder"
import { FieldPropertyType, ParsableObjectTrait, PrimaryKeyType, PropertyType } from "./types"
import { ExtractGetValueTypeDictFromPropertyDict, isFunction, makeid, quote } from "./util"


export abstract class Property {
    #name?: string

    register(
        name: string){
            if( /[.`' ]/.test(name) || name.startsWith('_') || name.endsWith('_') ){
                throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "'" or startsWith/endsWith '_'.`)
            }
            this.#name = name
            
        }

    get name(){
        if(!this.#name){
            throw new Error('Property not yet registered')
        }
        return this.#name
    }

    abstract prepareForParsing(context: DatabaseContext<any>): Promise<void>

}

export class ComputeProperty<
        Getter extends (ComputeValueGetterDefinition<any, any, any> | ComputeValueGetterDefinitionDynamicReturn<any, any>),
        Setter extends (ComputeValueSetterDefinition<any, any> | undefined)

    > extends Property {

    // type: 'ComputeProperty' = 'ComputeProperty'
    computeValueGetterDefinition: Getter
    computeValueSetterDefinition?: Setter

    constructor(computeValueGetterDefinition: Getter, computeValueSetterDefinition: Setter){
            super()
            this.computeValueGetterDefinition = computeValueGetterDefinition
            this.computeValueSetterDefinition = computeValueSetterDefinition
        }
    
    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        //none
    }
}

export class FieldProperty<D extends FieldPropertyType<any>> extends Property {

    // type: 'FieldProperty' = 'FieldProperty'
    private _fieldName?: string
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
            if(this.#definitionConstructor instanceof PropertyType){
                definition = this.#definitionConstructor
            } else if( isFunction(this.#definitionConstructor) ){
                definition = (this.#definitionConstructor as () => D)()
            } else if(this.#definitionConstructor instanceof Function){
                const c = (this.#definitionConstructor as (new () => D ))
                definition = new c()
            }
    
            if(definition instanceof PropertyType){
                this.#definition = definition
            }
            else throw new Error('Invalid parameters')
        }

        return this.#definition
    }

    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        await this.definition.prepareForParsing(context)
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

export class ScalarProperty<S extends Scalar<any, any>> extends Property {
    readonly scalar: S

    constructor(
        scalar: S){
            super()
            this.scalar = scalar
        }

    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        await (await this.scalar.getDefinition()).prepareForParsing(context)
    }
}

export class Schema<PropertyDict extends {[key:string]: Property}> implements ParsableObjectTrait<ExtractGetValueTypeDictFromPropertyDict<PropertyDict>>{

    // properties: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyType<any> >)[] = []
    // propertiesMap: {[key:string]: (ComputeProperty<any> 
    //     | FieldProperty<FieldPropertyTypeDefinition<any>> | Property<PropertyType<any> >)} = {}

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

    columnsForParsing(): string[] {
        return this.properties.map(prop => prop.name)
    }
    
    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        await Promise.all(this.properties.map( async(prop) => {
            await prop.prepareForParsing(context)
        }))
    }

    parseRaw(rawValue: any, context: DatabaseContext<any>, prop?: string): ExtractGetValueTypeDictFromPropertyDict<PropertyDict> {
        return this.parseDataBySchema(rawValue, context)
    }
    parseProperty(propertyvalue: ExtractGetValueTypeDictFromPropertyDict<PropertyDict>, context: DatabaseContext<any>, prop?: string) {
        return propertyvalue
    }

    parseDataBySchema(row: any, context: DatabaseContext<any>): ExtractGetValueTypeDictFromPropertyDict<PropertyDict> {
        const schema = this
        const output = {}
        for (const propName in row) {
            const p = schema.propertiesMap[propName]
            if(p){
                if( p instanceof ScalarProperty){

                    const propType = p.scalar.definitionForParsing()
                    // console.log('propType', propName, propType)
                    /**
                     * it can be boolean, string, number, Object, Array of Object (class)
                     * Depends on the props..
                     */
                    // let start = null
                    // if(metaInfo.propName === 'products'){
                    //     start = new Date()
                    // }
                    const propValue = propType.parseRaw ? propType.parseRaw(row[propName], context, propName) : row[propName]
                    
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

export class DerivedTableSchema<D extends Dataset<Schema<PropDict>>, PropDict extends {[key:string]: ScalarProperty<any>} > extends Schema<PropDict> {

    readonly dataset: D

    constructor(dataset: D){
        
        const selectItems = dataset.selectItems()
        if(!selectItems){
            throw new Error('No selectItems for a schema')
        }
        const propertyMap =  Object.keys(selectItems).reduce((acc, key) => {
            //@ts-ignore
            acc[key] = new ScalarProperty(selectItems[key])
            return acc
        }, {} as PropDict)
        super(propertyMap)
        this.dataset = dataset
    }

    datasource<Name extends string>(name: Name) : DerivedDatasource<D, Name>{
        const source = new DerivedDatasource(this.dataset, name)
        return source
    }
}


export class TableSchema<PropertyDict extends {[key:string]: Property}> extends Schema<PropertyDict> {

    context: DatabaseContext<any>
    hooks: Hook[] = []
    // entityClass?: E
    #entityName: string
    overridedTableName?: string

    id: FieldProperty<PrimaryKeyType>

    constructor(context: DatabaseContext<any>, entityName: string, props: PropertyDict, id: FieldProperty<PrimaryKeyType>){
        super(props)
        this.context = context
        this.#entityName = entityName
        this.id = id
    }

    tableName(options?: TableOptions){
        if(this.overridedTableName){
            return this.overridedTableName
        } else {
            let name = this.#entityName
            if( this.context.orm.ormConfig.entityNameToTableName) {
                name = this.context.orm.ormConfig.entityNameToTableName(name)
            }
            if(options?.tablePrefix){
                name = options.tablePrefix + name
            } else if( this.context.config?.tablePrefix){
                name = this.context.config?.tablePrefix + name
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
        const tableName = this.tableName(options)

        const props = this.properties.filter(p => p instanceof FieldProperty) as FieldProperty<FieldPropertyType<any>>[]
        
        return `CREATE TABLE IF NOT EXISTS ${quote(client, tableName)} (\n${
            props.map( prop => {
                const f = prop.definition
                if(f instanceof FieldPropertyType){
                    return `${f.create(prop.name, prop.fieldName(context.orm), context)}`  
                }
                return ``
            }).join(',\n')}\n)`;
    }

    datasource<T extends TableSchema<any>, Name extends string>(this: T, name: Name, options?: TableOptions) : TableDatasource<T, Name>{
        const source = new TableDatasource(this.context, this, name, options)
        return source
    }
}



export type TableOptions = {
    tablePrefix?: string
}


export interface Datasource<E extends Schema<any>, alias extends string> {
    sourceAlias: alias
    schema(): E
    $: PropertyValueGetters<E>

    toRaw(): Knex.Raw | Promise<Knex.Raw>
    realSource(): string | Promise<string>
    
    // getProperty: <Name extends string, T extends PropertyType<any> >(name: Name) => Column<Name, T>
    getAllFieldProperty: () => { [key: string]: Scalar<PropertyType<any>, any>}
    getFieldProperty: <Name extends string>(name: Name) => Scalar<PropertyType<any>, any>
    getScalarProperty: <Name extends string>(name: Name) => Scalar<PropertyType<any>, any> 
    getComputeProperty: <Name extends string, ARG, S extends Scalar<PropertyType<any>, any> >(name: Name) => ComputeValueGetter<ARG, S>
}

abstract class DatasourceBase<E extends Schema<any>, Name extends string> implements Datasource<E, Name> {

    protected context: DatabaseContext<any>
    protected _schema: E
    readonly sourceAlias: Name
    readonly sourceAliasAndSalt: string
    readonly $: PropertyValueGetters<E>

    constructor(context: DatabaseContext<any>, schema: E, sourceAlias: Name){
        if( !Number.isInteger(sourceAlias.charAt(0)) && sourceAlias.charAt(0).toUpperCase() === sourceAlias.charAt(0) ){
            throw new Error('alias cannot start with Uppercase letter')
        }

        this.context = context
        this._schema = schema
        this.sourceAlias = sourceAlias
        this.sourceAliasAndSalt = makeid(5)// this.sourceAlias + '___' + 

        const datasource = this
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.$ = new Proxy( datasource, {
            get: (oTarget: typeof datasource, sKey: string) => {
                if(typeof sKey === 'string'){
                    if(sKey === '$allFields'){
                        return datasource.getAllFieldProperty()
                    } else {
                        const prop = oTarget._schema.propertiesMap[sKey]
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
        }) as PropertyValueGetters<E>
    }
    abstract realSource(): string | Promise<string>

    schema(): E {
        return this._schema
    }

    getAllFieldProperty(): { [key: string]: Scalar<PropertyType<any>, any>} {
        return Object.keys(this._schema.propertiesMap)
        .reduce( (acc, key) => {
             if(this._schema.propertiesMap[key] instanceof FieldProperty){
                acc[key] = this.getFieldProperty(key)
             }
             return acc

            }, {} as { [key: string]: Scalar<PropertyType<any>, any>}
        )
    }

    getFieldProperty<Name extends string>(name: Name): Scalar<PropertyType<any>, any> {
        const prop = this._schema.propertiesMap[name]
        if( !(prop instanceof FieldProperty)){
            throw new Error(`it is not field property ${name}`)
        } else {
            const fieldProp = prop
            return this.context.scalar((context: DatabaseContext<any>) => {
                const orm = context.orm
                const client = context.client()
                const rawTxt = `${quote(client, this.sourceAliasAndSalt)}.${quote(client, fieldProp.fieldName(orm))}`
                return context.raw(rawTxt)
            }, fieldProp.definition)
        }
    }

    getComputeProperty<Name extends string, ARG, S extends Scalar<any,any> >(name: Name): ComputeValueGetter<ARG, S>{
        const prop = this._schema.propertiesMap[name]
        if( !(prop instanceof ComputeProperty)){
            throw new Error(`Not field property ${name}`)
        }else{
            const cProp = prop
            const c = (args?: ARG) => {
                const subquery: S = cProp.computeValueGetterDefinition.fn.call(cProp, this, args, this.context)
                return subquery
            }
            return c
        }
    }

    getScalarProperty<Name extends string>(name: Name): Scalar<PropertyType<any>, any> {
        const prop = this._schema.propertiesMap[name]
        if( !(prop instanceof ScalarProperty)){
            throw new Error(`it is not field property ${name}`)
        } else {
            const fieldProp = prop
            return new Scalar(this.context, fieldProp.scalar, null)
        }
    }
    
    async toRaw(){
        const client = this.context.client()
        const sql = await this.realSource()
        return this.context.raw(`${sql} AS ${quote(client, this.sourceAliasAndSalt)}`)
    }

}

export class TableDatasource<E extends TableSchema<any>, Name extends string> extends DatasourceBase<E, Name> {

    readonly options?: TableOptions

    constructor(context: DatabaseContext<any>, schema: E, sourceAlias: Name, options?: TableOptions){
        super(context, schema, sourceAlias)
        this.options = options
    }

    getContext() {
        return this.context
    }

    schema(): E {
        return this._schema
    }

    realSource(){
        const finalOptions = Object.assign({}, {tablePrefix: this.context.tablePrefix}, this.options ?? {})

        const tableName = this.schema().tableName(finalOptions)
        if(!tableName){
            throw new Error('Not yet registered')
        }
        return quote(this.context.client(), tableName)
    }
}

export class DerivedDatasource<D extends Dataset<any, any, any, any>, Name extends string> extends DatasourceBase< Schema<any>, Name> {

    readonly dataset: D
    constructor(dataset: D, sourceAlias: Name){
        super(dataset.getContext(), dataset.schema(), sourceAlias)
        this.dataset = dataset
    }

    async realSource(){
        return `(${(await this.dataset.toNativeBuilder())})`
    }
}
