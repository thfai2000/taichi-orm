import { ComputeProperty, FieldProperty, Property, ScalarProperty, StrictTypeProperty} from "."
import { Scalar } from "./Builder";
import { PropertyTypeDefinition } from "./PropertyType";

// expands object types one level deep
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// expands object types recursively
export type ExpandRecursively<T> = T extends object
  ? (T extends infer O ? { [K in keyof O]: ExpandRecursively<O[K]> } : never)
  : T;


export function undoExpandRecursively<T>(o: ExpandRecursively<T>): T {
    return o as any
}

export function expandRecursively<T>(o: T): ExpandRecursively<T>{
    return o as any
}

// export function undoExpandRecursively<T>(o: T): T {
//     return o as any
// }

// export function expandRecursively<T>(o: T): T {
//     return o as any
// }

export type ScalarMapToKeyValueMap<SelectedScalars> = {[key in keyof SelectedScalars]: SelectedScalars[key] extends Scalar<PropertyTypeDefinition<infer D>>? D: never}


export type SimpleObject = { [key:string]: any}
export const SimpleObjectClass = ({} as {[key:string]: any}).constructor
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export type UnionToIntersection<T> = 
  (T extends any ? (x: T) => any : never) extends 
  (x: infer R) => any ? R : never



export type ExtractProps<E> = 
Pick<E, ({
    [key in keyof E]: 
                    E[key] extends ComputeProperty<any>? key:
                    E[key] extends FieldProperty<any>? key:
                    E[key] extends ScalarProperty<any>? key:
                    never
})[keyof E]> 

export type ExtractFieldProps<E> = 
Pick<E, ({
    [key in keyof E]: E[key] extends FieldProperty<any>? key:
                    never
})[keyof E]> 


export type ExtractComputeProps<E> = 
Pick<E, ({
    [key in keyof E]: E[key] extends ComputeProperty<any>? key:
                    never
})[keyof E]> 


// export type ExtractSynComputeProps<E> = 
// Pick<E, ({
//     [key in keyof E]: E[key] extends ComputeProperty<any, any, any, any, infer R>? (
//             Exclude<R, Promise<Scalarable> > extends Scalarable? key: key
//         ):
//         key
// })[keyof E]> 


export function thenResultArray<T, R>(
    value: Array<T | Promise<T>>, 
    fn: (value: Array<T>) => (R | Promise<R>),
    errorFn?: (error: Error) => (R | Promise<R>)
):  (R | Promise<R>) {
    if(!Array.isArray(value)){
        throw new Error('It is not an array')
    }
    if(value.some(v => v instanceof Promise)){
        return Promise.all(value).then(fn, errorFn)
    }
    return fn(value as Array<T>)
}

export function thenResult<T, R>(value: T | Promise<T>, fn: (value: T) => (R | Promise<R>), errorFn?: (error: Error) => (R | Promise<R>) ):  (R | Promise<R>) {
    if(value instanceof Promise){
        return value.then(fn, errorFn)
    }
    return fn(value)
}

// export function addBlanketIfNeeds(text: string) {
//     text = text.trim()
//     let need = true
//     if(/^[a-zA-Z0-9\_\$\.`'"]+$/.test(text)){
//         need = false
//     }
//     if (need) {
//         text = `(${text})`
//     }
//     return text
// }

export const quote = (client: string, name: string) => {
    let c = client
    if(c.startsWith('sqlite') || c.startsWith('mysql') ){
        return `\`${name.replace(/\`/g, '``')}\``
    } else if (c.startsWith('pg')){
        return `"${name.replace(/\"/g, '""')}"`
    }
    throw new Error('Unsupport client')
}


// export const META_FIELD_DELIMITER = '___'
// const map1 = new Map<PropertyTypeDefinition, string>()
// const map2 = new Map<string, PropertyTypeDefinition>()

// export const registerGlobalPropertyTypeDefinition = function(d: PropertyTypeDefinition): string{
//     let r = map1.get(d)
//     if(!r){
//         let key = makeid(3)
//         map1.set(d, key)
//         map2.set(key, d)
//         r = key
//     }
//     return r
// }

// export const findGlobalPropertyTypeDefinition = function(propAlias: string): PropertyTypeDefinition {
//     let r = map2.get(propAlias)
//     if(!r){
//         throw new Error(`Cannot find the Property by '${propAlias}'. Make sure it is registered before.`)
//     }
//     return r
// }

// export const metaFieldAlias = function(name: string, p: PropertyTypeDefinition): string{
//     let propAlias = registerGlobalPropertyTypeDefinition(p)
//     return `${name}${META_FIELD_DELIMITER}${propAlias}`
// }

// export const breakdownMetaFieldAlias = function(metaAlias: string){
//     metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
//     if(metaAlias.includes(META_FIELD_DELIMITER)){
//         let [propName, propAlias] = metaAlias.split(META_FIELD_DELIMITER)
//         let propType = findGlobalPropertyTypeDefinition(propAlias)
//         return {propName, propType}
//     } else {
//         return {propName: metaAlias, propType: null }
//     }
// }

// const breakdownMetaTableAlias = function(metaAlias: string) {
//     metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
    
//     if(metaAlias.includes(META_FIELD_DELIMITER)){
//         let [entityName, randomNumber] = metaAlias.split(META_FIELD_DELIMITER)
//         let found = schemas[entityName]
//         return found
//     } else {
//         return null
//     }
// }

// export const metaTableAlias = function(schema: TableSchema, name: string): string{
//     return schema.entityClass?.entityName + META_FIELD_DELIMITER + name
// }

export function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
   }
   return result.join('');
}

export interface SQLString{
    toString(): string
}


export const parseName = (item: any) => {
    let text = item.toString().trim()

    let e = /((?<![\\])[`'"])((?:.(?!(?<![\\])\1))*.?)\1/g
    let r = e.exec(text)
    if(r){
        let last = r[0]
        while( (r = e.exec(text) )){
            last = r[0]
        }
        return last
    } else {
        let e = /\b[\. ]+([a-zA-Z0-9\_\$]*)$/
        let r = e.exec(text)
        if(r && r[1]){
            return r[1]
        }else {
            return text
        }
    }
}


export function isFunction(funcOrClass: any) {
  const propertyNames = Object.getOwnPropertyNames(funcOrClass);
  return (!propertyNames.includes('prototype') || propertyNames.includes('arguments'));
}