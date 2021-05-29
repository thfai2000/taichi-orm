import { Entity, config, SimpleObject, makeid, SQLString, NamedProperty } from "."

export interface PropertyType {
    // isPrimitive: boolean
    create: (prop: NamedProperty) => Array<string>
    readTransform?: (query: SQLString, columns: Array<string>) => SQLString
    writeTransform?: (query: SQLString, columns: Array<string>) => SQLString
    parseRaw: (rawValue: any, prop: NamedProperty) => any
    parseProperty: (propertyvalue: any, prop: NamedProperty) => any
}

const client = () => config.knexConfig.client.toString()
const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'
const autoIncrement = () => client().startsWith('sqlite')? 'AUTOINCREMENT': 'AUTO_INCREMENT'
const jsonArrayAgg = () => client().startsWith('sqlite')? 'json_group_array': 'JSON_ARRAYAGG'


export const Types = {
    PrimaryKey(): PropertyType{

        const parseRaw = (rawValue: any): any => {
            return rawValue === null? null : parseInt(rawValue)
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue
        }
        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            'INTEGER', 
            nullableText(false), 
            'PRIMARY KEY', 
            autoIncrement(),
            ].join(' ')
        ]

        return {create, parseRaw, parseProperty}
    },
    Number(nullable: boolean = true, options?: SimpleObject): PropertyType{
        
        const parseRaw = (rawValue: any): any => {
            return rawValue === null? null : parseInt(rawValue)
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null && !nullable){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue
        }
        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            'INTEGER', 
            nullableText(nullable), 
            (options?.default !== undefined?`DEFAULT ${parseProperty(options?.default, prop)}`:'') 
            ].join(' ')
        ]

        return {create, parseRaw, parseProperty}
    },
    Decimal(precision: number, scale: number, nullable: boolean = true, options?: SimpleObject): PropertyType{
  
        const parseRaw = (rawValue: any): any => {
            return rawValue === null? null: parseFloat(rawValue)
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null && !nullable){
                    throw new Error(`The Property '${prop.name}' cannot be null.`)
                }
                return propertyvalue
        }

        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            `DECIMAL(${precision},${scale})`,
            nullableText(nullable), 
            (options?.default !== undefined?`DEFAULT ${parseProperty(options?.default, prop)}`:'') 
            ].join(' ')
        ]

        return {create, parseRaw, parseProperty}
    },
    Boolean(nullable: boolean = true, options?: SimpleObject): PropertyType{

        const parseRaw = (rawValue: any): any => {
            //TODO: warning if nullable is false but value is null
            return rawValue === null? null: parseInt(rawValue) > 0
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null && !nullable){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue
        }

        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            `TINYINT(1)`,
            nullableText(nullable), 
            (options?.default !== undefined?`DEFAULT ${parseProperty(options?.default, prop)}`:'') 
            ].join(' ')
        ]

        return {create, parseRaw, parseProperty}
    },
    String(length: number, nullable: boolean = true, options?: SimpleObject): PropertyType{
        
        const parseRaw = (rawValue: any): any => {
            //TODO: warning if nullable is false but value is null
            return rawValue === null? null: `${rawValue}`
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null && !nullable){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue
        }

        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            `VARCHAR(${length})`,
            nullableText(nullable), 
            (options?.default !== undefined?`DEFAULT ${parseProperty(options?.default, prop)}`:'') 
            ].join(' ')
        ]

        return {create, parseRaw, parseProperty}
    },
    Date(nullable: boolean = true, options?: SimpleObject): PropertyType{

        const parseRaw = (rawValue: any): any => {
            //TODO: warning if nullable is false but value is null
            return rawValue === null? null: new Date(rawValue)
        }
        const parseProperty = (propertyvalue: any, prop: NamedProperty): any => {
            if(propertyvalue === null && !nullable){
                throw new Error(`The Property '${prop.name}' cannot be null.`)
            }
            return propertyvalue
        }

        const create = (prop: NamedProperty) => [
            [`\`${prop.fieldName}\``, 
            `DATETIME`,
            nullableText(nullable), 
            (options?.default !== undefined?`DEFAULT ${parseProperty(options?.default, prop)}`:'') 
            ].join(' ')
        ]
        return {create, parseRaw, parseProperty}

    },
    Object<I extends Entity>(entityClass: typeof Entity & (new (...args: any[]) => I), nullable: boolean = true): PropertyType{
                
        const readTransform = (query: SQLString, columns: Array<string>) => {
            let jsonify =  `SELECT JSON_OBJECT(${
                    columns.map(c => `'${c}', ${c}`).join(',')
                }) FROM (${query.toString()}) AS \`${makeid(5)}\``
            return jsonify
        }
        
        const parseRaw = (rawValue: any): I | null => {
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
            return entityClass.parseRaw(parsed)
        }
        
        const parseProperty = (propertyvalue: I, prop: NamedProperty): any => {
            if(!prop.computedFunc){
                throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
            }
            //TODO:
            return propertyvalue
        }

        const create = (prop: NamedProperty) => {
            if(!prop.computedFunc){
                throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
            }
            return []
        }

        return {create, readTransform, parseRaw, parseProperty}
    },
    Array<I extends Entity>(entityClass: typeof Entity & (new (...args: any[]) => I)): PropertyType{
    
        const readTransform = (query: SQLString, columns: Array<string>) => {
            let jsonify =  `SELECT IFNULL(${jsonArrayAgg()}(JSON_OBJECT(${
                    columns.map(c => `'${c}', ${c}`).join(',')
                })), JSON_ARRAY()) FROM (${query.toString()}) AS \`${makeid(5)}\` `
            return jsonify
        }
        const parseRaw = (rawValue: any): Array<I> => {
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
                return entityClass.parseRaw(raw)
            })
        }
        const parseProperty = (propertyvalue: Array<I>, prop: NamedProperty): any => {
            if(!prop.computedFunc){
                throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
            }
            //TODO:
            return propertyvalue
        }

        const create = (prop: NamedProperty) => {
            if(!prop.computedFunc){
                throw new Error(`Property ${prop.name} is not a computed field. The data type is not allowed.`)
            }
            return []
        }
        
        return {create, readTransform, parseRaw, parseProperty}
    }
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