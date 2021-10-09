// import { Knex } from "knex"
import { Knex } from "knex"
import { EntityRepository } from "."
import { Dataset, makeRaw } from "./Builder"
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
    parseRaw(rawValue: any, repository: EntityRepository<any>, prop?: string): I 
    parseProperty(propertyvalue: I, repository: EntityRepository<any>, prop?: string): any
}

export type Parsable<I> = {
    parseRaw(rawValue: any, repository: EntityRepository<any>, prop?: string): I 
    parseProperty(propertyvalue: I, repository: EntityRepository<any>, prop?: string): any
}

// export type PropertyDefinitionOptions = { compute?: ComputeFunction | null}
export abstract class PropertyTypeDefinition<I> implements ParsableTrait<I> {
    protected options = {}
    get nullable() {
        return true
    }

    constructor(options?: any){
        this.options = this.options ??options
    }

    parseRaw(rawValue: any, repository: EntityRepository<any>, prop: string): I {
        return rawValue
    }
    parseProperty(propertyvalue: I, repository: EntityRepository<any>, prop: string): any {
        return propertyvalue
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, repository: EntityRepository<any>, singleColumnName?: string): Knex.Raw<any> | Promise<Knex.Raw<any>> {
        if(rawOrDataset instanceof Dataset){
            if(rawOrDataset.selectItemsAlias().length === 1){
                return thenResult( rawOrDataset.toNativeBuilder(repository), query => makeRaw(repository, `(${query})`) )
            }
            throw new Error('Only Dataset with single column can be transformed.')
        }
        return rawOrDataset
    }
}

export abstract class FieldPropertyTypeDefinition<I> extends PropertyTypeDefinition<I> {
    abstract create(propName: string, fieldName: string, repository: EntityRepository<any>): string[]
}

// export abstract class ParsableFieldPropertyTypeDefinition<I> extends FieldPropertyTypeDefinition<I> implements ParsableTrait<I>{
//     abstract parseRaw(rawValue: any, repository: EntityRepository<any>, prop: string): I
//     abstract parseProperty(propertyvalue: I, repository: EntityRepository<any>, prop: string): any
// }

export abstract class ComputePropertyTypeDefinition<I> extends PropertyTypeDefinition<I> {
    // abstract parseRaw(rawValue: any, repository: EntityRepository<any>, prop: string): I
    // abstract parseProperty(propertyvalue: I, repository: EntityRepository<any>, prop: string): any
}

export class UnknownPropertyTypeDefinition extends PropertyTypeDefinition<any> {
}

export class PrimaryKeyType extends FieldPropertyTypeDefinition<number> {

    constructor(){
        super()
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

    create(propName: string, fieldName: string, repository: EntityRepository<any>): string[]{
        const client = repository.orm.client()
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
export class NumberType extends FieldPropertyTypeDefinition<number | null> {

    protected options: NumberTypeOptions
    
    constructor(options: Partial<NumberTypeOptions> ={}){
        super(options)
        this.options = options
    }

    get nullable() {
        return true
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
    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
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

export class NumberTypeNotNull extends FieldPropertyTypeDefinition<number> {

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
    // parseProperty(propertyvalue: number, propName: string, client: string) {
    //     if(propertyvalue === null && !this.options){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }
    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
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
export class DecimalType extends FieldPropertyTypeDefinition<number | null>  {

    protected options: DecimalTypeOptions
    
    constructor(options: Partial<DecimalTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    // parseRaw(rawValue: any): number | null{
    //         return rawValue === null? null: parseFloat(rawValue)
    // }

    // parseProperty(propertyvalue: number | null, propName: string): any {
    //     if(propertyvalue === null && !this.nullable){
    //         throw new Error(`The Property '${propName}' cannot be null.`)
    //     }
    //     return propertyvalue
    // }

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        let c = [this.options.precision, this.options.scale].filter(v => v).join(',')

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

export class DecimalTypeNotNull extends FieldPropertyTypeDefinition<number>  {

    protected options: DecimalTypeOptions
    
    constructor(options: Partial<DecimalTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return false
    }

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        let c = [this.options.precision, this.options.scale].filter(v => v).join(',')

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
export class BooleanType extends FieldPropertyTypeDefinition<boolean | null>  {
    protected options: BooleanTypeOptions

    constructor(options: Partial<BooleanTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any, repository: EntityRepository<any>,propName: string): boolean | null {
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
    override parseProperty(propertyvalue: boolean | null, repository: EntityRepository<any>,propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue === null? null: (propertyvalue? '1': '0')
    }

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        return [
            [
                `${quote(client, fieldName)}`,
                ( client.startsWith('pg')?'SMALLINT':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'') 
            ].join(' ')
        ]
    }
}

export class BooleanTypeNotNull extends FieldPropertyTypeDefinition<boolean>  {

    protected options: BooleanTypeOptions

    constructor(options: Partial<BooleanTypeOptions> = {}){
        super()
        this.options = { ...options}
    }

    get nullable() {
        return true
    }

    override parseRaw(rawValue: any, repository: EntityRepository<any>,propName: string): boolean {
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
    override parseProperty(propertyvalue: boolean, repository: EntityRepository<any>,propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue === null? null: (propertyvalue? '1': '0')
    }

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        return [
            [
                `${quote(client, fieldName)}`,
                ( client.startsWith('pg')?'SMALLINT':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.options?.default}`:'')
            ].join(' ')
        ]
    }
}

type StringTypeOptions = {default?: string, length?: number }
export class StringType extends FieldPropertyTypeDefinition<string | null> {

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

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        let c = [this.options.length].filter(v => v).join(',')
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

export class StringTypeNotNull extends FieldPropertyTypeDefinition<string> {

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

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        let c = [this.options.length].filter(v => v).join(',')
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
export class DateType extends FieldPropertyTypeDefinition<Date | null> {
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

    override parseProperty(propertyvalue: Date | null, repository: EntityRepository<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string, repository: EntityRepository<any>){
        const client = repository.orm.client()
        return [
            [
                `${quote(client, fieldName)}`,
                `DATE`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, repository)}`:'') 
            ].join(' ')
        ]
    }
}

type DateTimeTypeOptions = {default?: Date, precision?: number }
export class DateTimeType extends FieldPropertyTypeDefinition<Date | null> {
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

    override parseProperty(propertyvalue: Date | null, repository: EntityRepository<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

   create(propName: string, fieldName: string, repository: EntityRepository<any>){
       const client = repository.orm.client()
        let c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                (client.startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, repository, propName)}`:'') 
            ].join(' ')
        ]
    }
}

export class DateTimeTypeNotNull extends FieldPropertyTypeDefinition<Date> {
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

    override parseProperty(propertyvalue: Date, repository: EntityRepository<any>, propName?: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

   create(propName: string, fieldName: string, repository: EntityRepository<any>){
       const client = repository.orm.client()
        let c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(client, fieldName)}`,
                (client.startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, repository, propName)}`:'') 
            ].join(' ')
        ]
    }
}

// type ObjectOfTypeOptions = { }
export class ObjectType<E extends ParsableTrait<any> > extends ComputePropertyTypeDefinition<E | null>{
    // protected options: ObjectOfTypeOptions
    private parsable: E

    constructor(parsable: E) {
        super()
        this.parsable = parsable
        // this.options = { ...options}
    }

    get nullable() {
        return true
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, repository: EntityRepository<any>, singleColumnName?: string): Knex.Raw<any> | Promise<Knex.Raw<any>> {
        if(!(rawOrDataset instanceof Dataset)){
            throw new Error('Only Dataset can be the type of \'ObjectOfEntity\'')
        }
        return thenResult( rawOrDataset.toNativeBuilder(repository), query => {
            const client = repository.orm.client()
            const columns = rawOrDataset.selectItemsAlias()
            let jsonify =  `(SELECT ${jsonObject(client)}(${
                    columns.map(c => `'${c}', ${quote(client, c)}`).join(',')
                }) AS ${quote(client, singleColumnName ?? 'soleCol')} FROM (${query}) AS ${quote(client, makeid(5))})`
            return makeRaw(repository, jsonify)
        })
    }
 
    override parseRaw(rawValue: any, repository: EntityRepository<any>, propName?: string): E extends ParsableTrait<infer D>? D: any {
        let parsed: SimpleObject
        if( rawValue === null){
            //TODO: warning if nullable is false but value is null
            return rawValue
        } else if(typeof rawValue === 'string'){
            parsed = JSON.parse(rawValue)
        } else if(typeof rawValue === 'object'){
            parsed = rawValue
        } else {
            throw new Error('It is not supported.')
        }
        // const entityClass = context.models[this.entityClassName] as unknown as E
        return this.parsable.parseRaw(parsed, repository)
    }
    
    override parseProperty(propertyvalue: E extends ParsableTrait<infer D>? D: any, repository: EntityRepository<any>, propName?: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return this.parsable.parseProperty(propertyvalue, repository)
    }
}

// type ArrayOfTypeOptions = {}
// export class ArrayOfType<T extends PropertyTypeDefinition<any> > extends ComputePropertyTypeDefinition<any>{
    
//     // options: ArrayOfTypeOptions
//     readonly type: T
//     get propertyValueIsArray(): boolean{
//         return true
//     }
    
//     constructor(type: T) {
//         super()
//         this.type = type
//     }

//     get nullable() {
//         return true
//     }


//     transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, repository: EntityRepository<any>, singleColumnName?: string): Knex.Raw<any> {
//         if(!(rawOrDataset instanceof Dataset)){
//             throw new Error('Only Dataset can be the type of \'ObjectOfEntity\'')
//         }
//         const client = repository.orm.client()
//         let innerLevelColumnName = 'soleCol'
//         let objectify =  `${this.type.transformQuery(rawOrDataset, repository, innerLevelColumnName)}`
        
//         let jsonify =  `(SELECT coalesce(
//             ${jsonArrayAgg(client)}(
//                 ${quote(client, innerLevelColumnName)}), 
//                 ${jsonArray(client)}
//             ) AS ${quote(client, singleColumnName ?? 'soleCol')} FROM ${objectify} AS ${quote(client, makeid(5))})`

//         return makeRaw(repository, jsonify)
//     }

//     parseRaw(rawValue: any, repository: EntityRepository<any>, propName: string): any[] {
//         let parsed: Array<SimpleObject>
//         if( rawValue === null){
//             throw new Error('Null is not expected.')
//         } else if(typeof rawValue === 'string'){
//             parsed = JSON.parse(rawValue)
//         } else if(Array.isArray(rawValue)){
//             parsed = rawValue
//         } else {
//             throw new Error('It is not supported.')
//         }

//         if( this.type instanceof ParsableFieldPropertyTypeDefinition ||
//             this.type instanceof ComputePropertyTypeDefinition){
//             const d = this.type
//             return parsed.map(raw => {
//                 return d.parseRaw(raw, repository, propName)
//             })
//         } else {
//             return parsed as any[]
//         }
//     }
//     parseProperty(propertyvalue: any[], repository: EntityRepository<any>, propName: string): any {
//         // if(!prop.definition.computeFunc){
//         //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
//         // }
//         if( this.type instanceof ParsableFieldPropertyTypeDefinition){
//             const d = this.type
//             return propertyvalue.map(v => {
//                 return d.parseRaw(v, repository, propName)
//             })
//         } else {
//             return propertyvalue as any
//         }
//     }
// }

export class ArrayType<E extends ParsableTrait<any>> extends ComputePropertyTypeDefinition< Array<(E extends ParsableTrait<infer D>?D:any)> | null>{
    
    private parsable: E

    constructor(parsable: E) {
        super()
        this.parsable = parsable
        // this.options = { ...options}
    }

    get nullable() {
        return true
    }

    transformQuery(rawOrDataset: Knex.Raw<any> | Dataset<any, any, any>, repository: EntityRepository<any>, singleColumnName?: string): Knex.Raw | Promise<Knex.Raw> {

        if(!(rawOrDataset instanceof Dataset)){
            throw new Error('Only Dataset can be the type of \'ObjectOfEntity\'')
        }
        const client = repository.orm.client()
        const columns = rawOrDataset.selectItemsAlias()
        return thenResult( rawOrDataset.toNativeBuilder(repository), query => {
            let jsonify =  `SELECT ${jsonArray(client, [`${jsonArray(client, columns.map(col => `'${col}'`))}`, `coalesce(${jsonArrayAgg(client)}(${jsonArray(client, columns.map(col => quote(client, col)))}), ${jsonArray(client)})` ])} AS ${quote(client, 'data')} FROM (${query}) AS ${quote(client, makeid(5))}`
            return makeRaw(repository, `(${jsonify})`)
        })
    }

    parseRaw(rawValue: any, repository: EntityRepository<any>, propName: string): E extends ParsableTrait<infer D>? D[]: any {
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
            if(parsed){
                const [header, rowData] : [string[], Array<Array<any>>] = parsed
                const numCols = header.length
                const len = rowData.length
                const parsableEntity = this.parsable
                let records = new Array(len)
                for(let i=0; i <len;i++){
                    let record = {} as {[key:string]: any}
                    for(let j=0; j<numCols; j++){
                        record[header[j]] = rowData[i][j] 
                    }
                    records[i] = parsableEntity.parseRaw(record, repository)
                }

                return records as any
            }
        }
        throw new Error('It is not supported.')
    }
    
    parseProperty(propertyvalue: (E extends ParsableTrait<infer D>? D: any)[], repository: EntityRepository<any>, propName: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return this.parsable.parseProperty(propertyvalue, repository)
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