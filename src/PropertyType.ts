import { Entity, Selector, SimpleObject, makeid, SQLString } from "."

export interface PropertyType {
    // isPrimitive: boolean
    create: () => Array<string>
    readTransform?: (query: SQLString, columns: Array<string>) => SQLString
    writeTransform?: (query: SQLString, columns: Array<string>) => SQLString
    parseRaw: (rawValue: any) => any
    parseProperty: (propertyvalue: any) => any
}

const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'

// export type ColumnInfo = {
//     keyName: string,
//     valueName: string
// }

export const Types = {
    PrimaryKey(): PropertyType{
        return {
            // isPrimitive: true,
            create: () => ['BIGINT', nullableText(false), 'AUTO_INCREMENT', 'PRIMARY KEY'],
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
    Object<T extends typeof Entity>(entityClass: T, nullable: boolean = true): PropertyType{
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
            parseRaw(rawValue: SimpleObject): InstanceType<T>{
                return entityClass.parseRaw(rawValue)
            },
            parseProperty(propertyvalue: InstanceType<T>): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Array<T extends typeof Entity>(entityClass: T, nullable: boolean = true): PropertyType{
        return {
            // isPrimitive: false,
            create: () => {
                throw new Error('Field creation is not allowed.')
            },
            readTransform: (query: SQLString, columns: Array<string>) => {
                let jsonify =  `SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT(${
                        columns.map(c => `'${c}', ${c}`).join(',')
                    })), JSON_ARRAY()) FROM (${query.toString()}) AS \`${makeid(5)}\``
                return jsonify
            },
            parseRaw(rawValue: Array<SimpleObject>): Array<InstanceType<T>>{
                return rawValue.map( raw => {
                    return entityClass.parseRaw(raw)
                })
            },
            parseProperty(propertyvalue: Array<InstanceType<T>>): any {
                //TODO: implement
                return propertyvalue
            }
        }
    }
}