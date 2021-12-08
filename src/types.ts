// import { Knex } from "knex"
import { Knex } from "knex"
import { DatabaseContext } from "."
import { Dataset } from "./builder"
import { makeid, quote, SimpleObject, SQLString, thenResult } from "./util"


const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'
const autoIncrement = (client: string) =>  client.startsWith('sqlite')? 'AUTOINCREMENT': 'AUTO_INCREMENT'
const jsonArrayAgg = (client: string) => {
    if( client.startsWith('sqlite') )
        return 'JSON_GROUP_ARRAY'
    else if (client.startsWith('mysql'))    
        return 'JSON_ARRAYAGG'
    else if (client.startsWith('pg'))
        return 'JSON_AGG'
    else
        throw new Error('NYI')
}
const jsonObject = (client: string) => {
    if( client.startsWith('sqlite') )
        return 'JSON_OBJECT'
    else if (client.startsWith('mysql'))    
        return 'JSON_OBJECT'
    else if (client.startsWith('pg'))
        return 'JSON_BUILD_OBJECT'
    else
        throw new Error('NYI')   
}

const jsonArray = (client: string, arrayOfColNames: Array<any> = []) => {

    // const items = isFieldName? arrayOfColNames.map(col =>  quote(client, col)) : arrayOfColNames.map(col => `'${col}'`)

    if( client.startsWith('sqlite') ){
        return `JSON_ARRAY(${arrayOfColNames.join(',')})`
    } else if (client.startsWith('mysql')){
        return `JSON_ARRAY(${arrayOfColNames.join(',')})`
    } else if (client.startsWith('pg')) {
        return `JSON_BUILD_ARRAY(${arrayOfColNames.join(',')})`
    } else
        throw new Error('NYI')
}

export interface ParsableTrait<I> {
    parseRaw(rawValue: any, context: DatabaseContext<any>, prop?: string): I 
    parseProperty(propertyvalue: I, context: DatabaseContext<any>, prop?: string): any
    prepareForParsing(context: DatabaseContext<any>): Promise<void>
}

export interface ParsableObjectTrait<I> extends ParsableTrait<I> {
    columnsForParsing(): string[]
}

// export type Parsable<I> = {
//     parseRaw(rawValue: any, context: DatabaseContext<any>, prop?: string): I 
//     parseProperty(propertyvalue: I, context: DatabaseContext<any>, prop?: string): any
// }

// export type PropertyDefinitionOptions = { compute?: ComputeFunction | null}
export class PropertyType<I> implements ParsableTrait<I> {
    protected options = {}
    get nullable() {
        return true
    }

    constructor(options?: any){
        this.options = this.options ??options
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
    }

    parseRaw(rawValue: any, context: DatabaseContext<any>, prop: string): I {
        return rawValue
    }
    parseProperty(propertyvalue: I, context: DatabaseContext<any>, prop: string): any {
        return propertyvalue
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, context: DatabaseContext<any>, singleColumnName?: string): Knex.Raw<any> | Promise<Knex.Raw<any>> {
        if(rawOrDataset instanceof Dataset){
            if(rawOrDataset.selectItemsAlias().length === 1){
                return thenResult( rawOrDataset.toNativeBuilder(context), query => context.raw(`(${query})`) )
            }
            throw new Error('Only Dataset with single column can be transformed.')
        }
        return rawOrDataset
    }
}

export abstract class FieldPropertyType<I> extends PropertyType<I> {

    constructor(options?: any){
        super(options)
    }
    abstract create(propName: string, fieldName: string, context: DatabaseContext<any>): string[]
}

// export abstract class ParsableFieldPropertyTypeDefinition<I> extends FieldPropertyTypeDefinition<I> implements ParsableTrait<I>{
//     abstract parseRaw(rawValue: any, context: Entitycontext<any>, prop: string): I
//     abstract parseProperty(propertyvalue: I, context: Entitycontext<any>, prop: string): any
// }

export abstract class ParsablePropertyTypeDefinition<I> extends PropertyType<I> {

    constructor(options?: any){
        super(options)
    }
    // abstract parseRaw(rawValue: any, context: Entitycontext<any>, prop: string): I
    // abstract parseProperty(propertyvalue: I, context: Entitycontext<any>, prop: string): any
}

// export class UnknownPropertyTypeDefinition extends PropertyType<any> {
//     constructor(options?: any){
//         super(options)
//     }
// }

export class PrimaryKeyType extends FieldPropertyType<number> {

    constructor(options?: any){
        super(options)
    }

    get nullable() {
        return false
    }

    // parseRaw(rawValue: any, propName: string, client: string): number {
    //     if(rawValue === null){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return parseInt(rawValue)
    // }

    // parseProperty(propertyvalue: any, propName: string, client: string): number {
    //     if(propertyvalue === null){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }

    create(propName: string, fieldName: string, context: DatabaseContext<any>): string[]{
        const client = context.client()
        if( client.startsWith('pg') ){
            return [
                [
                    `${quote(client, fieldName)}`,
                    'SERIAL', 
                    nullableText(false), 
                    'PRIMARY KEY',
                ].join(' ')
            ]
        } else {
            return [
                [
                    `${quote(client, fieldName)}`,
                    'INTEGER', 
                    nullableText(false), 
                    'PRIMARY KEY', 
                    autoIncrement(client),
                ].join(' ')
            ]
        }
    }    
}

type NumberTypeOptions = {default?: number }
export class NumberType extends FieldPropertyType<number | null> {

    protected options: NumberTypeOptions
    
    constructor(options: Partial<NumberTypeOptions> ={}){
        super(options)
        this.options = options
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any): number | null{
        if(rawValue === null)
            return null
        return parseInt(rawValue)
    }
        
    // parseRaw(rawValue: any, prop: string, client: string): number | null {
    //     if(rawValue === null)
    //         return null
    //     else if(Number.isInteger(rawValue)){
    //         return parseInt(rawValue)
    //     }
    //     throw new Error('Cannot parse Raw into Boolean')
    // }
    // parseProperty(propertyvalue: number | null, propName: string, client: string) {
    //     if(propertyvalue === null && !this.options){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }
    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`, 
                'INTEGER', 
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

export class NumberNotNullType extends FieldPropertyType<number> {

    protected options: NumberTypeOptions
    
    constructor(options: Partial<NumberTypeOptions> ={}){
        super(options)
        this.options = options
    }

    get nullable() {
        return false
    }
        
    // parseRaw(rawValue: any, prop: string, client: string): number {
    //     if(rawValue === null)
    //         throw new Error('Cannot null')
    //     else if(Number.isInteger(rawValue)){
    //         return parseInt(rawValue)
    //     }
    //     throw new Error('Cannot parse Raw into Boolean')
    // }

    override parseRaw(rawValue: any): number {
        if(rawValue === null)
            throw new Error('Cannot null')
        return parseInt(rawValue)
    }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`, 
                'INTEGER', 
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

type DecimalTypeOptions = { default?: number, precision?: number, scale?: number }
export class DecimalType extends FieldPropertyType<number | null>  {

    protected options: DecimalTypeOptions
    
    constructor(options: Partial<DecimalTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any): number | null{
        return rawValue === null? null: parseFloat(rawValue)
    }

    // parseProperty(propertyvalue: number | null, propName: string): any {
    //     if(propertyvalue === null && !this.nullable){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        const c = [this.options.precision, this.options.scale].filter(v => v).join(',')

        return [
            [
                `${quote(client, fieldName)}`, 
                `DECIMAL${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

export class DecimalNotNullType extends FieldPropertyType<number>  {

    protected options: DecimalTypeOptions
    
    constructor(options: Partial<DecimalTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return false
    }

    override parseRaw(rawValue: any): number {

        if(rawValue === null){
            throw new Error('value should not be null')
        }
        
        return parseFloat(rawValue)
    }
    
    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        const c = [this.options.precision, this.options.scale].filter(v => v).join(',')

        return [
            [
                `${quote(client, fieldName)}`, 
                `DECIMAL${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

type BooleanTypeOptions = {default?: boolean }
export class BooleanType extends FieldPropertyType<boolean | null>  {
    protected options: BooleanTypeOptions

    constructor(options: Partial<BooleanTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any, context: DatabaseContext<any>, propName: string): boolean | null {
        //TODO: warning if nullable is false but value is null
        if(rawValue === null)
            return null
        else if(rawValue === true)
            return true
        else if(rawValue === false)
            return false
        else if(Number.isInteger(rawValue)){
            return parseInt(rawValue) > 0
        }
        throw new Error('Cannot parse Raw into Boolean')
    }
    override parseProperty(propertyvalue: boolean | null, context: DatabaseContext<any>,propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        if(context.client().startsWith('pg')){
            return propertyvalue === null? null: !!propertyvalue
        } else {
            return propertyvalue === null? null: (propertyvalue? '1': '0')
        }
    }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`,
                ( client.startsWith('pg')?'BOOLEAN':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

export class BooleanNotNullType extends FieldPropertyType<boolean>  {

    protected options: BooleanTypeOptions

    constructor(options: Partial<BooleanTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any, context: DatabaseContext<any>,propName: string): boolean {
        if(rawValue === null)
            throw new Error('Not expected null')
        else if(rawValue === true)
            return true
        else if(rawValue === false)
            return false
        else if(Number.isInteger(rawValue)){
            return parseInt(rawValue) > 0
        }
        throw new Error('Cannot parse Raw into Boolean')
    }
    override parseProperty(propertyvalue: boolean, context: DatabaseContext<any>,propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        if(context.client().startsWith('pg')){
            return propertyvalue === null? null: !!propertyvalue
        } else {
            return propertyvalue === null? null: (propertyvalue? '1': '0')
        }
    }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`,
                ( client.startsWith('pg')?'BOOLEAN':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'')
            ].join(' ')
        ]
    }
}

type StringTypeOptions = {default?: string, length?: number }
export class StringType extends FieldPropertyType<string | null> {

    protected options: StringTypeOptions

    constructor(options: Partial<StringTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    // parseRaw(rawValue: any): string | null {
    //     //TODO: warning if nullable is false but value is null
    //     return rawValue === null? null: `${rawValue}`
    // }

    // parseProperty(propertyvalue: string | null, propName: string): any{
    //     if(propertyvalue === null && !this.nullable){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        const c = [this.options.length].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                `VARCHAR${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'')
            ].join(' ')
        ]
    }

}

export class StringNotNullType extends FieldPropertyType<string> {

    protected options: StringTypeOptions

    constructor(options: Partial<StringTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return false
    }

    // parseRaw(rawValue: any): string {
    //     if(rawValue === null && !this.nullable){
    //         throw new Error(`The Property '${rawValue}' cannot be null.`)
    //     }
    //     return `${rawValue}`
    // }

    // parseProperty(propertyvalue: string | null, propName: string): any{
    //     if(propertyvalue === null && !this.nullable){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        const c = [this.options.length].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                `VARCHAR${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

type DateTypeOptions = { default?: Date }
export class DateType extends FieldPropertyType<Date | null> {
    protected options: DateTypeOptions

    constructor(options: Partial<DateTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any): Date | null {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }

    override parseProperty(propertyvalue: Date | null, context: DatabaseContext<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`,
                `DATE`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, context)}`:'') 
            ].join(' ')
        ]
    }
}

export class DateNotNullType extends FieldPropertyType<Date> {
    protected options: DateTypeOptions

    constructor(options: Partial<DateTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return false
    }

    override parseRaw(rawValue: any): Date {
        if(rawValue === null){
            throw new Error('Unexpected null value')
        }
        return new Date(rawValue)
    }

    override parseProperty(propertyvalue: Date, context: DatabaseContext<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string, context: DatabaseContext<any>){
        const client = context.client()
        return [
            [
                `${quote(client, fieldName)}`,
                `DATE`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, context)}`:'') 
            ].join(' ')
        ]
    }
}

type DateTimeTypeOptions = {default?: Date, precision?: number }
export class DateTimeType extends FieldPropertyType<Date | null> {
    protected options: DateTimeTypeOptions

    constructor(options: Partial<DateTimeTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any): Date | null{
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }

    override parseProperty(propertyvalue: Date | null, context: DatabaseContext<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

   create(propName: string, fieldName: string, context: DatabaseContext<any>){
       const client = context.client()
        const c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                (client.startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, context, propName)}`:'') 
            ].join(' ')
        ]
    }
}

export class DateTimeNotNullType extends FieldPropertyType<Date> {
    protected options: DateTimeTypeOptions

    constructor(options: Partial<DateTimeTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return false
    }

    override parseRaw(rawValue: any): Date {
        //TODO: warning if nullable is false but value is null
        return new Date(rawValue)
    }

    override parseProperty(propertyvalue: Date, context: DatabaseContext<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

   create(propName: string, fieldName: string, context: DatabaseContext<any>){
       const client = context.client()
        const c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                (client.startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, context, propName)}`:'') 
            ].join(' ')
        ]
    }
}

export class ObjectType<T extends ParsableObjectTrait<any> > extends ParsablePropertyTypeDefinition< (T extends ParsableObjectTrait<infer I>? I:never)>{
    // protected options: ObjectOfTypeOptions
    private parsable: T

    constructor(parsable: T) {
        super()
        this.parsable = parsable
        // this.options = { ...options}
    }

    get nullable() {
        return true
    }

    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        await super.prepareForParsing(context)
        await this.parsable.prepareForParsing(context)
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, context: DatabaseContext<any>, singleColumnName?: string): Knex.Raw<any> | Promise<Knex.Raw<any>> {
        if(!(rawOrDataset instanceof Dataset)){
            throw new Error('Only Dataset can be the type of \'ObjectOfEntity\'')
        }
        const selectedColumns = rawOrDataset.selectItemsAlias()
        const columns = this.parsable.columnsForParsing()

        if( columns.some(col => !selectedColumns.includes(col)) ){
            throw new Error('Dataset selected column cannot be parsed. Missing Selected Items.')
        }

        return thenResult( rawOrDataset.toNativeBuilder(context), query => {
            const client = context.client()
            const jsonify =  `SELECT ${jsonArray(client, columns.map(col => quote(client, col)))} AS ${quote(client, 'data')} FROM (${query}) AS ${quote(client, makeid(5))}`
            return context.raw(`(${jsonify})`)
        })
    }
 
    override parseRaw(rawValue: any, context: DatabaseContext<any>, propName?: string): (T extends ParsableObjectTrait<infer I>? I:never) {
        if( rawValue === null){
            //TODO: warning if nullable is false but value is null
            return rawValue
        } else {
            let parsed = null
            if(typeof rawValue === 'string'){
                parsed = JSON.parse(rawValue)
            } else if(Array.isArray(rawValue)){
                parsed = rawValue
            } 
            if(Array.isArray(parsed)){
                const header = this.parsable.columnsForParsing()
                const rowData = parsed
                const numCols = header.length
                const parsableEntity = this.parsable
                
                const record = {} as {[key:string]: any}
                for(let j=0; j<numCols; j++){
                    record[header[j]] = rowData[j] 
                }
                return parsableEntity.parseRaw(record, context)
            }
        }
        throw new Error('It is not supported.')
    }
    
    override parseProperty(propertyvalue: (T extends ParsableObjectTrait<infer I>? I:never), context: DatabaseContext<any>, propName?: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return this.parsable.parseProperty(propertyvalue, context)
    }
}

export class ArrayType<T extends ParsableObjectTrait<any> > extends ParsablePropertyTypeDefinition< (T extends ParsableObjectTrait<infer I>? I[]:never)>{
    
    private parsable: ParsableObjectTrait<any>

    constructor(parsable: ParsableObjectTrait<any>) {
        super()
        this.parsable = parsable
        // this.options = { ...options}
    }

    get nullable() {
        return true
    }

    async prepareForParsing(context: DatabaseContext<any>): Promise<void> {
        await super.prepareForParsing(context)
        await this.parsable.prepareForParsing(context)
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, context: DatabaseContext<any>, singleColumnName?: string): Knex.Raw | Promise<Knex.Raw> {

        if(!(rawOrDataset instanceof Dataset)){
            throw new Error('Only Dataset can be the type of \'ObjectOfEntity\'')
        }
        const selectedColumns = rawOrDataset.selectItemsAlias()
        const columns = this.parsable.columnsForParsing()

        if( columns.some(col => !selectedColumns.includes(col)) ){
            throw new Error('Dataset selected column cannot be parsed. Missing Selected Items.')
        }

        return thenResult( rawOrDataset.toNativeBuilder(context), query => {
            const client = context.client()
            const jsonify =  `SELECT coalesce(${jsonArrayAgg(client)}(${jsonArray(client, columns.map(col => quote(client, col)))}), ${jsonArray(client)}) AS ${quote(client, 'data')} FROM (${query}) AS ${quote(client, makeid(5))}`
            return context.raw(`(${jsonify})`)
        })
    }

    parseRaw(rawValue: any, context: DatabaseContext<any>, propName: string): (T extends ParsableObjectTrait<infer I>? I[]:never) {
        // let parsed: SimpleObject
        if( rawValue === null){
            //TODO: warning if nullable is false but value is null
            return rawValue
        } else {
            let parsed = null
            if(typeof rawValue === 'string'){
                parsed = JSON.parse(rawValue)
            } else if(Array.isArray(rawValue)){
                parsed = rawValue
            } 
            if(Array.isArray(parsed)){
                const header = this.parsable.columnsForParsing()
                const rowData = parsed
                // const [header, rowData] : [string[], Array<Array<any>>] = parsed
                const numCols = header.length
                const len = rowData.length
                const parsableEntity = this.parsable
                const records = new Array(len)
                for(let i=0; i <len;i++){
                    const record = {} as {[key:string]: any}
                    for(let j=0; j<numCols; j++){
                        record[header[j]] = rowData[i][j] 
                    }
                    records[i] = parsableEntity.parseRaw(record, context)
                }

                return records as any
            }
        }
        throw new Error('It is not supported.')
    }
    
    parseProperty(propertyvalue: (T extends ParsableObjectTrait<infer I>? I[]:never), context: DatabaseContext<any>, propName: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return this.parsable.parseProperty(propertyvalue, context)
    }
}


// const types = {
//     PrimaryKey: (...args: ConstructorParameters<typeof PrimaryKeyType>) => new FieldProperty( new PrimaryKeyType(...args) ),
//     Number: (...args: ConstructorParameters<typeof NumberType>) => new FieldProperty( new NumberType(...args) ),
//     Decimal: (...args: ConstructorParameters<typeof DecimalType>) => new FieldProperty( new DecimalType(...args) ),
//     Boolean: (...args: ConstructorParameters<typeof BooleanType>) => new FieldProperty( new BooleanType(...args) ),
//     String: (...args: ConstructorParameters<typeof StringType>) => new FieldProperty( new StringType(...args) ),
//     StringNotNull: (...args: ConstructorParameters<typeof StringTypeNotNull>) => new FieldProperty( new StringTypeNotNull(...args) ),
//     Date: (...args: ConstructorParameters<typeof DateType>) => new FieldProperty( new DateType(...args) ),
//     DateTime: (...args: ConstructorParameters<typeof DateTimeType>) => new FieldProperty( new DateTimeType(...args) ),
//     ObjectOf: (...args: ConstructorParameters<typeof ObjectOfType>) => new FieldProperty( new ObjectOfType(...args) ),
//     ArrayOf: (...args: ConstructorParameters<typeof ArrayOfType>) => new FieldProperty( new ArrayOfType(...args) )
// }





// export default types




// NativeJSON(nullable: boolean = true): PropertyType {
    //     return {
    //         // isPrimitive: true,
    //         create: () => ['JSON', nullableText(nullable)],
    //         readTransform: () => {
    //             throw new Error('Field Transformation is not allowed.')
    //         },
    //         parseRaw(rawValue): any{
    //             //FIXME: has to check if it is valid in locale
    //             return new Date(rawValue)
    //         },
    //         parseProperty(propertyvalue): any {
    //             //TODO: implement
    //             return propertyvalue
    //         }
    //     }
    // },

// TODO: Foreign Key allow ON Delete... 
// It is wrong design...
// ForeignKey(foreignEntity: typeof Entity, nullable: boolean = true): PropertyType{
//     return {
//         create: (fieldName) => {
//             if(client().startsWith('sqlite')){
//                 return [
//                     [`\`${fieldName}\``, 'INTEGER', nullableText(nullable)].join(' '),
//                     [`FOREIGN KEY (\`${fieldName}\`) REFERENCES`, `\`${foreignEntity.tableName}\`(\`${config.primaryKeyName}\`)`].join(' ')
//                 ]
//             }
//             return [
//                 [`\`${fieldName}\``, 'INTEGER', nullableText(nullable), 'FOREIGN KEY REFERENCES', `\`${foreignEntity.tableName}\`(\`${config.primaryKeyName}\`)`].join(' ')
//             ]
//         },
//         parseRaw(rawValue): any{
//             return parseInt(rawValue)
//         },
//         parseProperty(propertyvalue): any {
//             return propertyvalue
//         }
//     }
// },