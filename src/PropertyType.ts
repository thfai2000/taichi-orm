// import { Knex } from "knex"
import { extend } from "lodash"
import { Entity, client, FieldProperty, ExecutionContext, ComputeFunction, Schema, Property } from "."
import { makeid, quote, SimpleObject, SQLString } from "./util"

export interface Parsable<D>{
    new (...args: any[]): D
    parseProperty(propertyvalue: D, propName: string, ctx: ExecutionContext): any
    parseRaw(rawValue: any, prop: string, context: ExecutionContext): D
}

// export type PropertyDefinitionOptions = { compute?: ComputeFunction | null}
export class PropertyTypeDefinition<I = any> {
    protected options = {}
    get nullable() {
        return true
    }
    get transformFromMultipleRows(): boolean {
        return false
    }
    get transformIntoMultipleRows(): boolean{
        return false
    }
    get propertyValueIsArray(): boolean{
        return false
    }
    constructor(options?: any){
        this.options = this.options ??options
    }
    parseRaw(rawValue: any, prop: string, context: ExecutionContext): I {
        return rawValue
    }
    parseProperty(propertyvalue: I, prop: string, context: ExecutionContext): any {
        return propertyvalue
    }
}

export class FieldPropertyTypeDefinition<I = any> extends PropertyTypeDefinition<I> {
    create(propName: string, fieldName: string) : string[] {
        throw new Error('It is not allowed')
    }
}

export class ComputePropertyTypeDefinition<I = any> extends PropertyTypeDefinition<I> {
    queryTransform(query: SQLString, columns: string[] | null, intoSingleColumn: string): SQLString {
        throw new Error('It is not allowed')
    }
    
}

const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'
const autoIncrement = () =>  client().startsWith('sqlite')? 'AUTOINCREMENT': 'AUTO_INCREMENT'
const jsonArrayAgg = () => {
    if( client().startsWith('sqlite') )
        return 'JSON_GROUP_ARRAY'
    else if (client().startsWith('mysql'))    
        return 'JSON_ARRAYAGG'
    else if (client().startsWith('pg'))
        return 'JSON_AGG'
    else
        throw new Error('NYI')
}
const jsonObject = () => {
    if( client().startsWith('sqlite') )
        return 'JSON_OBJECT'
    else if (client().startsWith('mysql'))    
        return 'JSON_OBJECT'
    else if (client().startsWith('pg'))
        return 'JSON_BUILD_OBJECT'
    else
        throw new Error('NYI')   
}

const emptyJsonArray = () => {
    if( client().startsWith('sqlite') )
        return 'JSON_ARRAY()'
    else if (client().startsWith('mysql'))    
        return 'JSON_ARRAY()'
    else if (client().startsWith('pg'))
        return "'[]'::json"
    else
        throw new Error('NYI')
}

export class PrimaryKeyType extends FieldPropertyTypeDefinition<number> {

    get nullable() {
        return false
    }

    parseRaw(rawValue: any, propName: string): number {
        if(rawValue === null){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return parseInt(rawValue)
    }

    parseProperty(propertyvalue: any, propName: string): any {
        if(propertyvalue === null){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(fieldName: string): string[]{

        if( client().startsWith('pg') ){
            return [
                [
                    `${quote(fieldName)}`,
                    'SERIAL', 
                    nullableText(false), 
                    'PRIMARY KEY',
                ].join(' ')
            ]
        } else {
            return [
                [
                    `${quote(fieldName)}`,
                    'INTEGER', 
                    nullableText(false), 
                    'PRIMARY KEY', 
                    autoIncrement(),
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
        
    parseRaw(rawValue: any): number | null {
        if(rawValue === null)
            return null
        else if(Number.isInteger(rawValue)){
            return parseInt(rawValue)
        }
        throw new Error('Cannot parse Raw into Boolean')
    }
    parseProperty(propertyvalue: number | null, propName: string) {
        if(propertyvalue === null && !this.options){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }
    create(propName: string, fieldName: string){
        return [
            [
                `${quote(fieldName)}`, 
                'INTEGER', 
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
            ].join(' ')
        ]
    }
}

export class NumberTypeNotNull extends NumberType {

    constructor(options: Partial<NumberTypeOptions> ={}){
        super(options)
    }
    get nullable() {
        return false
    }

    override parseRaw(rawValue: any): number {
        let r = super.parseRaw(rawValue)
        if(r === null){
            throw new Error('Unexpected')
        }
        return r
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

    parseRaw(rawValue: any): number | null{
            return rawValue === null? null: parseFloat(rawValue)
    }

    parseProperty(propertyvalue: number | null, propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string){

        let c = [this.options.precision, this.options.scale].filter(v => v).join(',')

        return [
            [
                `${quote(fieldName)}`, 
                `DECIMAL${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
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

    parseRaw(rawValue: any, propName: string, ctx?: ExecutionContext): boolean | null {
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
    parseProperty(propertyvalue: boolean | null, propName: string, ctx?: ExecutionContext): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue === null? null: (propertyvalue? '1': '0')
    }

    create(propName: string, fieldName: string){
        return [
            [
                `${quote(fieldName)}`,
                ( client().startsWith('pg')?'SMALLINT':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
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

    parseRaw(rawValue: any): string | null {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: `${rawValue}`
    }

    parseProperty(propertyvalue: string | null, propName: string): any{
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string){
        let c = [this.options.length].filter(v => v).join(',')
        return [
            [
                `${quote(fieldName)}`,
                `VARCHAR${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
            ].join(' ')
        ]
    }
}

export class StringTypeNotNull extends StringType {


    get nullable() {
        return false
    }

    override parseRaw(rawValue: any): string {
        let r = super.parseRaw(rawValue)
        if(r === null){
            throw new Error('Unexpected')
        }
        return r
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

    parseRaw(rawValue: any): Date | null {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }

    parseProperty(propertyvalue: Date | null, propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string){
        return [
            [
                `${quote(fieldName)}`,
                `DATE`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
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

    parseRaw(rawValue: any): Date | null{
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }

    parseProperty(propertyvalue: Date | null, propName: string): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${propName}' cannot be null.`)
        }
        return propertyvalue
    }

    create(propName: string, fieldName: string){
        let c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(fieldName)}`,
                (client().startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, propName)}`:'') 
            ].join(' ')
        ]
    }
}

// type ObjectOfTypeOptions = { }
export class ObjectOfType<E extends Parsable<any> > extends ComputePropertyTypeDefinition<E | null>{
    // protected options: ObjectOfTypeOptions

    constructor(private parsable: E
    // options: Partial<ObjectOfTypeOptions> = {}
    ) {
        super(parsable)
        // this.options = { ...options}
    }

    get nullable() {
        return true
    }
                
    queryTransform(query: SQLString, columns: string[] | null, intoSingleColumn: string){
        if(columns === null){
            throw new Error('Only Dataset can be the type of \'ObjectOf\'')
        }
        let jsonify =  `SELECT ${jsonObject()}(${
                columns.map(c => `'${c}', ${quote(c)}`).join(',')
            }) AS ${quote(intoSingleColumn)} FROM (${query.toString()}) AS ${quote(makeid(5))}`
        return jsonify
    }
    
    parseRaw(rawValue: any, propName: string, context: ExecutionContext): E extends Parsable<infer D>? D: any {
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
        return this.parsable.parseRaw(parsed, propName, context)
    }
    
    parseProperty(propertyvalue: E extends Parsable<infer D>? D: any, propName: string, ctx: ExecutionContext): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return this.parsable.parseProperty(propertyvalue, propName, ctx)
    }
}

// type ArrayOfTypeOptions = {}
export class ArrayOfType<T extends PropertyTypeDefinition<any> > extends ComputePropertyTypeDefinition<any>{
    
    // options: ArrayOfTypeOptions
    readonly type: T
    get propertyValueIsArray(): boolean{
        return true
    }
    
    constructor(type: T) {
        super()
        this.type = type
    }

    get nullable() {
        return true
    }

    get transformIntoMultipleRows(){
        return false
    }

    get transformFromMultipleRows(){
        return this.type.transformFromMultipleRows
    }

    queryTransform(query: SQLString, columns: string[] | null, intoSingleColumn: string) {

        if(!intoSingleColumn){
            throw new Error('Unexpected Flow.')
        }
        
        let innerLevelColumnName = 'column1'
        let objectify

        if(this.type instanceof ComputePropertyTypeDefinition && this.type.queryTransform){
            objectify =  `(${this.type.queryTransform(query, columns, innerLevelColumnName)})`
        } else {
            objectify =  `(${query})`
        }

        if( !this.type.transformIntoMultipleRows ){
            let jsonify =  `SELECT coalesce(${jsonArrayAgg()}(${query}), ${emptyJsonArray()}) AS ${quote(intoSingleColumn)}`
            return jsonify
        } else {
            let jsonify =  `SELECT coalesce(${jsonArrayAgg()}(${quote(innerLevelColumnName)}), ${emptyJsonArray()}) AS ${quote(intoSingleColumn)} FROM ${objectify} AS ${quote(makeid(5))}`
            return jsonify
        }
    }

    parseRaw(rawValue: any, propName: string, context: ExecutionContext): ReturnType<T["parseRaw"]>[] {
        let parsed: Array<SimpleObject>
        if( rawValue === null){
            throw new Error('Null is not expected.')
        } else if(typeof rawValue === 'string'){
            parsed = JSON.parse(rawValue)
        } else if(Array.isArray(rawValue)){
            parsed = rawValue
        } else {
            throw new Error('It is not supported.')
        }
        return parsed.map( raw => {
            return this.type.parseRaw(raw, propName, context)
        })
    }
    parseProperty(propertyvalue: Array<Parameters<T["parseProperty"]>[0]>, propName: string, ctx: ExecutionContext): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        return this.type.parseProperty(propertyvalue, propName, ctx)
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