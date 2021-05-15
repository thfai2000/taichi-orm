import { Entity, Selector, SimpleObject } from "."

export interface PropertyType {
    isPrimitive: boolean
    create: Array<string>
    parseRaw: (selector: Selector<any>, rawValue: any) => any
    parseProperty: (selector: Selector<any>, propertyvalue: any) => any
}

const nullableText = (nullable: boolean) => nullable? 'NULL': 'NOT NULL'

export const Types = {
    PrimaryKey(): PropertyType{
        return {
            isPrimitive: true,
            create: ['BIGINT', nullableText(false), 'AUTO_INCREMENT', 'PRIMARY KEY'],
            parseRaw(selector: Selector<any>, rawValue): any{
                return parseInt(rawValue)
            },
            parseProperty(selector: Selector<any>, propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Number(nullable: boolean = true): PropertyType{
        return {
            isPrimitive: true,
            create: ['INTEGER', nullableText(nullable)],
            parseRaw(selector: Selector<any>, rawValue): any{
                return parseInt(rawValue)
            },
            parseProperty(selector: Selector<any>, propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    String(length: number, nullable: boolean = true): PropertyType{
        return {
            isPrimitive: true,
            create: [`VARCHAR(${length})`, nullableText(nullable) ],
            parseRaw(selector: Selector<any>, rawValue): any{
                return `${rawValue}`
            },
            parseProperty(selector: Selector<any>, propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Date(nullable: boolean = true): PropertyType{
        return {
            isPrimitive: true,
            create: ['DATETIME', nullableText(nullable)],
            parseRaw(selector: Selector<any>, rawValue): any{
                //FIXME: has to check if it is valid in locale
                return new Date(rawValue)
            },
            parseProperty(selector: Selector<any>, propertyvalue): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Object<T extends typeof Entity>(entityClass: T, nullable: boolean = true): PropertyType{
        return {
            isPrimitive: false,
            create: ['JSON', nullableText(nullable)],
            parseRaw(selector: Selector<T>, rawValue: SimpleObject): InstanceType<T>{
                return selector.parseRaw(entityClass, rawValue)
            },
            parseProperty(selector: Selector<T>, propertyvalue: InstanceType<T>): any {
                //TODO: implement
                return propertyvalue
            }
        }
    },
    Array<T extends typeof Entity>(entityClass: T, nullable: boolean = true): PropertyType{
        return {
            isPrimitive: false,
            create: ['JSON', nullableText(nullable)],
            parseRaw(selector: Selector<T>, rawValue: Array<SimpleObject>): Array<InstanceType<T>>{
                return rawValue.map( raw => {
                    return selector.parseRaw(entityClass, raw)
                })
            },
            parseProperty(selector: Selector<T>, propertyvalue: Array<InstanceType<T>>): any {
                //TODO: implement
                return propertyvalue
            }
        }
    }
}