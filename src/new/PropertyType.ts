// import { Knex } from "knex"
import { Entity, client, quote, SimpleObject, makeid, SQLString, NamedProperty, ExecutionContext } from "."

// export type PropertyDefinitionOptions = { compute?: ComputeFunction | null}
export interface PropertyDefinition {
    
    readonly transformFromMultipleRows: boolean
    readonly transformIntoMultipleRows: boolean
    readonly propertyValueIsArray: boolean

    create(prop: NamedProperty) : string[]
    queryTransform?(query: SQLString, columns: string[] | null, intoSingleColumn: string): SQLString
    
    parseRaw(rawValue: any, prop: NamedProperty, context: ExecutionContext): any
    parseProperty(propertyvalue: any, prop: NamedProperty, context: ExecutionContext):any
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

export class PrimaryKeyType implements PropertyDefinition {

    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false

    parseRaw(rawValue: any, prop: NamedProperty): number {
        if(rawValue === null){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return parseInt(rawValue)
    }

    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty): string[]{

        if( client().startsWith('pg') ){
            return [
                [
                    `${quote(prop.fieldName)}`,
                    'SERIAL', 
                    nullableText(false), 
                    'PRIMARY KEY',
                ].join(' ')
            ]
        } else {
            return [
                [
                    `${quote(prop.fieldName)}`,
                    'INTEGER', 
                    nullableText(false), 
                    'PRIMARY KEY', 
                    autoIncrement(),
                ].join(' ')
            ]
        }
    }
}

type NumberTypeOptions = {nullable: boolean, default?: number }
export class NumberType implements PropertyDefinition {
    readonly options: NumberTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false
    
    constructor(options: Partial<NumberTypeOptions> ={}){
        this.options = { nullable: true, ...(options instanceof Function?{}:options) }
    }
        
    parseRaw(rawValue: any): number | null {
        if(rawValue === null)
            return null
        else if(Number.isInteger(rawValue)){
            return parseInt(rawValue)
        }
        throw new Error('Cannot parse Raw into Boolean')
    }
    parseProperty(propertyvalue: any, prop: NamedProperty) {
        if(propertyvalue === null && !this.options.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }
    create(prop: NamedProperty){
        return [
            [
                `${quote(prop.fieldName)}`, 
                'INTEGER', 
                nullableText(this.options.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class NumberTypeNotNull extends NumberType {
    override parseRaw(rawValue: any): number {
        let r = super.parseRaw(rawValue)
        if(r === null){
            throw new Error('Unexpected')
        }
        return r
    }
}



type DecimalTypeOptions = { nullable: boolean, default?: number, precision?: number, scale?: number }
export class DecimalType implements PropertyDefinition {

    readonly options: DecimalTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false
    
    constructor(options: Partial<DecimalTypeOptions> = {}){
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
    }

    parseRaw(rawValue: any): number | null{
            return rawValue === null? null: parseFloat(rawValue)
        }
        parseProperty(propertyvalue: any, prop: NamedProperty): any {
            if(propertyvalue === null && !this.options.nullable){
                    throw new Error(`The Property '${prop.name}' cannot be null.`)
                }
                return propertyvalue
        }

        create(prop: NamedProperty){

            let c = [this.options.precision, this.options.scale].filter(v => v).join(',')

            return [
                [
                    `${quote(prop.fieldName)}`, 
                    `DECIMAL${c.length > 0?`(${c})`:''}`,
                    nullableText(this.options.nullable), 
                    (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
                ].join(' ')
            ]
        }
}

type BooleanTypeOptions = {nullable: boolean, default?: boolean }
export class BooleanType implements PropertyDefinition {
    readonly options: BooleanTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false

    constructor(options: ComputeFunction | Partial<BooleanTypeOptions> = {}){
        super(options instanceof Function ? options : options.compute)
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
    }

    parseRaw(rawValue: any): boolean | null {
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
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.options.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue === null? null: (propertyvalue? '1': '0')
    }

    create(prop: NamedProperty){
        return [
        [
            `${quote(prop.fieldName)}`,
            ( client().startsWith('pg')?'SMALLINT':`TINYINT(1)`),
            nullableText(this.options.nullable), 
            (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
        ].join(' ')
    ]
    }

}

type StringTypeOptions = {nullable: boolean, default?: string, length?: number }
export class StringType {
    
    readonly options: StringTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false

    constructor(options: Partial<StringTypeOptions> = {}){
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
    }

    parseRaw(rawValue: any): string | null {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: `${rawValue}`
    }

    parseProperty(propertyvalue: any, prop: NamedProperty): any{
        if(propertyvalue === null && !this.options.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty){
        let c = [this.options.length].filter(v => v).join(',')
        return [
            [
                `${quote(prop.fieldName)}`,
                `VARCHAR${c.length > 0?`(${c})`:''}`,
                nullableText(this.options.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class StringTypeNotNull extends StringType {
    override parseRaw(rawValue: any): string {
        let r = super.parseRaw(rawValue)
        if(r === null){
            throw new Error('Unexpected')
        }
        return r
    }
}


type DateTypeOptions = {nullable: boolean, default?: Date }
export class DateType implements PropertyDefinition{

    readonly options: DateTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false

    constructor(options: Partial<DateTypeOptions> = {}){
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
    }

    parseRaw(rawValue: any): Date | null {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.options.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty){
        return [
            [
                `${quote(prop.fieldName)}`,
                `DATE`,
                nullableText(this.options.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

type DateTimeTypeOptions = {nullable: boolean, default?: Date, precision?: number }
export class DateTimeType implements PropertyDefinition{

    readonly options: DateTimeTypeOptions
    readonly transformFromMultipleRows: boolean = false
    readonly transformIntoMultipleRows: boolean = false
    readonly propertyValueIsArray: boolean = false

    constructor(options: Partial<DateTimeTypeOptions> = {}){
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
    }

    parseRaw(rawValue: any): Date | null{
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.options.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty) {
        let c = [this.options.precision].filter(v => v).join(',')
        return [
            [
                `${quote(prop.fieldName)}`,
                (client().startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.options.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

type ObjectOfTypeOptions = {nullable: boolean }
export class ObjectOfType implements PropertyDefinition{

    readonly options: ObjectOfTypeOptions
    readonly transformFromMultipleRows: boolean = true
    readonly transformIntoMultipleRows: boolean = true
    readonly propertyValueIsArray: boolean = false

    constructor(private entityClassName: string,
    options: Partial<ObjectOfTypeOptions> = {}
    ) {
        this.options = { nullable: true, ...(options instanceof Function ? {} : options)}
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
    
    parseRaw(rawValue: any, prop: NamedProperty, context: ExecutionContext): Entity | null {
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
    
    parseProperty(propertyvalue: Entity, prop: NamedProperty): any {
        if(!prop.definition.computeFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        //TODO:
        return propertyvalue
    }

    create(prop: NamedProperty) {
        if(!prop.definition.computeFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        return []
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

    parseRaw(rawValue: any, prop: NamedProperty, context: ExecutionContext): I[]{
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
            return this.type.parseRaw(raw, prop, context)
        })
    }
    parseProperty(propertyvalue: Array<I>, prop: NamedProperty): any {
        if(!prop.definition.computeFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        //TODO:
        return propertyvalue
    }

    create(prop: NamedProperty){
        if(!prop.definition.computeFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        return []
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