import { Entity } from "."

export interface PropertyType {
    create: Array<string>
    parseRaw: (rawValue: any) => any
    parseProperty: (propertyvalue: any) => any
}

const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'

export const Types = {
    PrimaryKey(): PropertyType{
        return {
            create: ['BIGINT', nullableText(false), 'AUTO_INCREMENT', 'PRIMARY KEY'],
            parseRaw(rawValue): any{
                return rawValue
            },
            parseProperty(propertyvalue): any {
                return propertyvalue
            }
        }
    },
    String(length: number, nullable: boolean = true): PropertyType{
        return {
            create: [`VARCHAR(${length})`, nullableText(nullable) ],
            parseRaw(rawValue): any{
                return rawValue
            },
            parseProperty(propertyvalue): any {
                return propertyvalue
            }
        }
    },
    Number(nullable: boolean = true): PropertyType{
        return {
            create: ['INTEGER', nullableText(nullable)],
            parseRaw(rawValue): any{
                return rawValue
            },
            parseProperty(propertyvalue): any {
                return propertyvalue
            }
        }
    },
    Date(nullable: boolean = true): PropertyType{
        return {
            create: ['DATETIME', nullableText(nullable)],
            parseRaw(rawValue): any{
                return rawValue
            },
            parseProperty(propertyvalue): any {
                return propertyvalue
            }
        }
    },
    Object<T extends typeof Entity>(entity: T, nullable: boolean = true): PropertyType{
        return {
            create: ['JSON', nullableText(nullable)],
            parseRaw(rawValue): T{
                return rawValue
            },
            parseProperty(propertyvalue: T): any {
                return propertyvalue
            }
        }
    },
    Array<T extends typeof Entity>(entity: T, nullable: boolean = true): PropertyType{
        return {
            create: ['JSON', nullableText(nullable)],
            parseRaw(rawValue): Array<T>{
                return rawValue
            },
            parseProperty(propertyvalue: Array<T>): any {
                return propertyvalue
            }
        }
    }
}