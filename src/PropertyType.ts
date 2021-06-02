import { Entity, client, quote, SimpleObject, makeid, SQLString, NamedProperty } from "."

export interface PropertyType {
    // isPrimitive: boolean
    create(prop: NamedProperty) : string[]
    readTransform?(query: SQLString, columns: string[] | null): SQLString
    writeTransform?(query: SQLString, columns: string[]):SQLString
    parseRaw(rawValue: any, prop: NamedProperty): any
    parseProperty(propertyvalue: any, prop: NamedProperty):any
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

export class PrimaryKeyType implements PropertyType {

    parseRaw(rawValue: any, prop: NamedProperty): any {
        return rawValue === null? null : parseInt(rawValue)
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

export class NumberType implements PropertyType {
    
    constructor(private nullable: boolean = true, private options?: SimpleObject){}
        
    parseRaw(rawValue: any): any {
        if(rawValue === null)
            return null
        else if(Number.isInteger(rawValue)){
            return parseInt(rawValue)
        }
        throw new Error('Cannot parse Raw into Boolean')
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }
    create(prop: NamedProperty){
        return [
            [
                `${quote(prop.fieldName)}`, 
                'INTEGER', 
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class DecimalType implements PropertyType {

    constructor(private nullable: boolean = true, private precision?: number, private scale?: number, private options?: SimpleObject){}
  
    parseRaw(rawValue: any): any{
            return rawValue === null? null: parseFloat(rawValue)
        }
        parseProperty(propertyvalue: any, prop: NamedProperty): any {
            if(propertyvalue === null && !this.nullable){
                    throw new Error(`The Property '${prop.name}' cannot be null.`)
                }
                return propertyvalue
        }

        create(prop: NamedProperty){

            let c = [this.precision, this.scale].filter(v => v).join(',')

            return [
                [
                    `${quote(prop.fieldName)}`, 
                    `DECIMAL${c.length > 0?`(${c})`:''}`,
                    nullableText(this.nullable), 
                    (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
                ].join(' ')
            ]
        }
}

export class BooleanType implements PropertyType{

    constructor(private nullable: boolean = true, private options?: SimpleObject) {}

        parseRaw(rawValue: any): any {
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
            if(propertyvalue === null && !this.nullable){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue === null? null: (propertyvalue? '1': '0')
        }

        create(prop: NamedProperty){
            return [
            [
                `${quote(prop.fieldName)}`,
                ( client().startsWith('pg')?'SMALLINT':`TINYINT(1)`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }

}

export class StringType implements PropertyType{
    
    constructor(private nullable: boolean = true, private length?: number, private options?: SimpleObject) {}

    parseRaw(rawValue: any): any {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: `${rawValue}`
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any{
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty){
        let c = [this.length].filter(v => v).join(',')
        return [
            [
                `${quote(prop.fieldName)}`,
                `VARCHAR${c.length > 0?`(${c})`:''}`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class DateType implements PropertyType{

    constructor(private nullable: boolean = true, private options?: SimpleObject) {}

    parseRaw(rawValue: any): any {
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty){
        return [
            [
                `${quote(prop.fieldName)}`,
                `DATE`,
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class DateTimeType implements PropertyType{

    constructor(private nullable: boolean = true, private precision?: number, private options?: SimpleObject) {}

    parseRaw(rawValue: any): any{
        //TODO: warning if nullable is false but value is null
        return rawValue === null? null: new Date(rawValue)
    }
    parseProperty(propertyvalue: any, prop: NamedProperty): any {
        if(propertyvalue === null && !this.nullable){
            throw new Error(`The Property '${prop.name}' cannot be null.`)
        }
        return propertyvalue
    }

    create(prop: NamedProperty) {
        let c = [this.precision].filter(v => v).join(',')
        return [
            [
                `${quote(prop.fieldName)}`,
                (client().startsWith('pg')? `TIMESTAMP${c.length > 0?`(${c})`:''}`: `DATETIME${c.length > 0?`(${c})`:''}`),
                nullableText(this.nullable), 
                (this.options?.default !== undefined?`DEFAULT ${this.parseProperty(this.options?.default, prop)}`:'') 
            ].join(' ')
        ]
    }
}

export class ObjectOfType<I extends Entity> implements PropertyType{

    constructor(private entityClass: typeof Entity & (new (...args: any[]) => I), private nullable: boolean = true) {}
                
    readTransform(query: SQLString, columns: string[] | null){
        if(columns === null){
            throw new Error('Only Dataset can be the type of \'ObjectOf\'')
        }
        let jsonify =  `SELECT ${jsonObject()}(${
                columns.map(c => `'${c}', ${quote(c)}`).join(',')
            }) FROM (${query.toString()}) AS ${quote(makeid(5))}`
        return jsonify
    }
    
    parseRaw(rawValue: any): I | null {
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
        return this.entityClass.parseRaw(parsed)
    }
    
    parseProperty(propertyvalue: I, prop: NamedProperty): any {
        if(!prop.computedFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        //TODO:
        return propertyvalue
    }

    create(prop: NamedProperty) {
        if(!prop.computedFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        return []
    }
}

export class ArrayOfType<I extends Entity> implements PropertyType{
    
    constructor(private entityClass: typeof Entity & (new (...args: any[]) => I)) {}

    readTransform(query: SQLString, columns: string[] | null) {
        if(columns === null){
            throw new Error('Only Dataset can be the type of \'ArrayOf\'')
        }
        let jsonify =  `SELECT coalesce(${jsonArrayAgg()}(${jsonObject()}(${
                columns.map(c => `'${c}', ${quote(c)}`).join(',')
            })), ${emptyJsonArray()}) FROM (${query.toString()}) AS ${quote(makeid(5))} `
        return jsonify
    }

    parseRaw(rawValue: any): Array<I> {
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
            return this.entityClass.parseRaw(raw)
        })
    }
    parseProperty(propertyvalue: Array<I>, prop: NamedProperty): any {
        if(!prop.computedFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        //TODO:
        return propertyvalue
    }

    create(prop: NamedProperty){
        if(!prop.computedFunc){
            throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
        }
        return []
    }
}

export default {
    PrimaryKey: PrimaryKeyType,
    Number: NumberType,
    Decimal: DecimalType,
    Boolean: BooleanType,
    String: StringType,
    Date: DateType,
    DateTime: DateTimeType,
    ObjectOf: ObjectOfType,
    ArrayOf: ArrayOfType
}

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