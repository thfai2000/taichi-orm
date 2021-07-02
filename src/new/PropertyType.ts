// import { Knex } from "knex"
import { Entity, client, quote, SimpleObject, makeid, SQLString, FieldProperty, ExecutionContext } from "."

// export type PropertyDefinitionOptions = { compute?: ComputeFunction | null}
export interface PropertyDefinition {
    nullable: boolean
    transformFromMultipleRows: boolean
    transformIntoMultipleRows: boolean
    propertyValueIsArray: boolean

    queryTransform?(query: SQLString, columns: string[] | null, intoSingleColumn: string): SQLString
    
    parseRaw(rawValue: any, prop: string, context: ExecutionContext): any
    parseProperty(propertyvalue: any, prop: string, context: ExecutionContext):any
}


// export interface FieldPropertyDefinition extends PropertyDefinition {
//     create(propName: string, fieldName: string) : string[]
// }

export abstract class FieldPropertyDefinition {
    abstract create(propName: string, fieldName: string) : string[]
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

export class PrimaryKeyType extends FieldPropertyDefinition implements PropertyDefinition {
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false

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
export class NumberType extends FieldPropertyDefinition implements PropertyDefinition {
    protected options: NumberTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false
    
    constructor(options: Partial<NumberTypeOptions> ={}){
        super()
        this.options = { ...options }
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
    parseProperty(propertyvalue: any, propName: string) {
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
export class DecimalType extends FieldPropertyDefinition implements PropertyDefinition {

    protected options: DecimalTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false
    
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

    parseProperty(propertyvalue: any, propName: string): any {
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
export class BooleanType extends FieldPropertyDefinition implements PropertyDefinition {
    protected options: BooleanTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false

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
    parseProperty(propertyvalue: any, propName: string, ctx?: ExecutionContext): any {
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
export class StringType extends FieldPropertyDefinition implements PropertyDefinition{
    protected options: StringTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false

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

    parseProperty(propertyvalue: any, propName: string): any{
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
export class DateType extends FieldPropertyDefinition implements PropertyDefinition{
    protected options: DateTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false

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

    parseProperty(propertyvalue: any, propName: string): any {
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
export class DateTimeType extends FieldPropertyDefinition implements PropertyDefinition{
    protected options: DateTimeTypeOptions
    transformFromMultipleRows: boolean = false
    transformIntoMultipleRows: boolean = false
    propertyValueIsArray: boolean = false

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

    parseProperty(propertyvalue: any, propName: string): any {
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

type ObjectOfTypeOptions = { }
export class ObjectOfType implements PropertyDefinition{
    protected options: ObjectOfTypeOptions
    transformFromMultipleRows: boolean = true
    transformIntoMultipleRows: boolean = true
    propertyValueIsArray: boolean = false

    constructor(private entityClassName: string,
    options: Partial<ObjectOfTypeOptions> = {}
    ) {
        this.options = { ...options}
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
    
    parseRaw(rawValue: any, propName: string, context: ExecutionContext): Entity | null {
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
        const entityClass = context.models[this.entityClassName]
        return entityClass.parseRaw(parsed)
    }
    
    parseProperty(propertyvalue: Entity, propName: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        // return propertyvalue
        // throw new Error('NYI')
        return propertyvalue
    }
}

// type ArrayOfTypeOptions = {}
export class ArrayOfType<I = any> implements PropertyDefinition{
    
    // options: ArrayOfTypeOptions
    readonly type: PropertyDefinition
    readonly propertyValueIsArray: boolean = true
    
    constructor(type: PropertyDefinition) {
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
        let objectify = this.type.queryTransform? `(${this.type.queryTransform(query, columns, innerLevelColumnName)})`: `(${query})`

        if( !this.type.transformIntoMultipleRows ){
            let jsonify =  `SELECT coalesce(${jsonArrayAgg()}(${query}), ${emptyJsonArray()}) AS ${quote(intoSingleColumn)}`
            return jsonify
        } else {
            let jsonify =  `SELECT coalesce(${jsonArrayAgg()}(${quote(innerLevelColumnName)}), ${emptyJsonArray()}) AS ${quote(intoSingleColumn)} FROM ${objectify} AS ${quote(makeid(5))}`
            return jsonify
        }
    }

    parseRaw(rawValue: any, propName: string, context: ExecutionContext): I[]{
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
    parseProperty(propertyvalue: Array<I>, propName: string): any {
        // if(!prop.definition.computeFunc){
        //     throw new Error(`Property ${propName} is not a computed field. The data type is not allowed.`)
        // }
        // //TODO:
        return propertyvalue
    }
}


const types = {
    PrimaryKey: (...args: ConstructorParameters<typeof PrimaryKeyType>) => new PrimaryKeyType(...args),
    Number: (...args: ConstructorParameters<typeof NumberType>) => new NumberType(...args),
    Decimal: (...args: ConstructorParameters<typeof DecimalType>) => new DecimalType(...args),
    Boolean: (...args: ConstructorParameters<typeof BooleanType>) => new BooleanType(...args),
    String: (...args: ConstructorParameters<typeof StringType>) => new StringType(...args),
    StringNotNull: (...args: ConstructorParameters<typeof StringTypeNotNull>) => new StringTypeNotNull(...args),
    Date: (...args: ConstructorParameters<typeof DateType>) => new DateType(...args),
    DateTime: (...args: ConstructorParameters<typeof DateTimeType>) => new DateTimeType(...args),
    ObjectOf: (...args: ConstructorParameters<typeof ObjectOfType>) => new ObjectOfType(...args),
    ArrayOf: (...args: ConstructorParameters<typeof ArrayOfType>) => new ArrayOfType(...args)
}

export default types

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