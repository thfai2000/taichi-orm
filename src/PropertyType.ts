import { Entity, config, SimpleObject, makeid, SQLString } from "."

export interface PropertyType {
    // isPrimitive: boolean
    create: () => Array<string>
    readTransform?: (query: SQLString, columns: Array<string>) => SQLString
    writeTransform?: (query: SQLString, columns: Array<string>) => SQLString
    parseRaw: (rawValue: any) => any
    parseProperty: (propertyvalue: any) => any
}

const client = () => config.knexConfig.client!.toString()
const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'
const autoIncrement = () => client().startsWith('sqlite')? 'AUTOINCREMENT': 'AUTO_INCREMENT'
const jsonArrayAgg = () => client().startsWith('sqlite')? 'json_group_array': 'JSON_ARRAYAGG'


export const Types = {
    PrimaryKey(): PropertyType{
        return {
            // isPrimitive: true,
            create: () => ['INTEGER', nullableText(false), 'PRIMARY KEY', autoIncrement()],
            parseRaw(rawValue): any{
                return parseInt(rawValue)
            },
            parseProperty(propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Number(nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: true,
            create: () => ['INTEGER', nullableText(nullable)],
            // readTransform: (sql) => {
            //     return `(${sql}) + 1`
            // },
            parseRaw(rawValue): any{
                return parseInt(rawValue)
            },
            parseProperty(propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    String(length: number, nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: true,
            create: () => [`VARCHAR(${length})`, nullableText(nullable) ],
            // transform: () => {
            //     throw new Error('Field Transformation is not allowed.')
            // },
            parseRaw(rawValue): any{
                return `${rawValue}`
            },
            parseProperty(propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Date(nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: true,
            create: () => ['DATETIME', nullableText(nullable)],
            parseRaw(rawValue): any{
                //FIXME: has to check if it is valid in locale
                return new Date(rawValue)
            },
            parseProperty(propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    NativeJSON(nullable: boolean = true): PropertyType {
        return {
            // isPrimitive: true,
            create: () => ['JSON', nullableText(nullable)],
            readTransform: () => {
                throw new Error('Field Transformation is not allowed.')
            },
            parseRaw(rawValue): any{
                //FIXME: has to check if it is valid in locale
                return new Date(rawValue)
            },
            parseProperty(propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Object<I extends Entity>(entityClass: typeof Entity & (new (...args: any[]) => I), nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: false,
            create: () => {
                throw new Error('Field creation is not allowed.')
            },
            readTransform: (query: SQLString, columns: Array<string>) => {
                let jsonify =  `SELECT JSON_OBJECT(${
                        columns.map(c => `'${c}', ${c}`).join(',')
                    }) FROM (${query.toString()}) AS \`${makeid(5)}\``
                return jsonify
            },
            parseRaw(rawValue: any): I{
                let parsed: SimpleObject
                if(typeof rawValue === 'string'){
                    parsed = JSON.parse(rawValue)
                } else if(typeof rawValue === 'object'){
                    parsed = rawValue
                } else {
                    throw new Error('It is not supported.')
                }
                return entityClass.parseRaw(rawValue)
            },
            parseProperty(propertyvalue: I): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Array<I extends Entity>(entityClass: typeof Entity & (new (...args: any[]) => I), nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: false,
            create: () => {
                throw new Error('Field creation is not allowed.')
            },
            readTransform: (query: SQLString, columns: Array<string>) => {
                let jsonify =  `SELECT IFNULL(${jsonArrayAgg()}(JSON_OBJECT(${
                        columns.map(c => `'${c}', ${c}`).join(',')
                    })), JSON_ARRAY()) FROM (${query.toString()}) AS \`${makeid(5)}\` `
                return jsonify
            },
            parseRaw(rawValue: any): Array<I>{
                let parsed: Array<SimpleObject>
                if(typeof rawValue === 'string'){
                    parsed = JSON.parse(rawValue)
                } else if(Array.isArray(rawValue)){
                    parsed = rawValue
                } else {
                    throw new Error('It is not supported.')
                }
                return parsed.map( raw => {
                    return entityClass.parseRaw(raw)
                })
            },
            parseProperty(propertyvalue: Array<I>): any {
                //TODO: implement
                return propertyvalue
            }
        }
    }
}