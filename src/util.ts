import { Knex } from "knex"
import { client, FieldProperty, Schema } from "."


export type SimpleObject = { [key:string]: any}
export const SimpleObjectClass = ({} as {[key:string]: any}).constructor
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

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

export function addBlanketIfNeeds(text: string) {
    text = text.trim()
    let need = true
    if(/^[a-zA-Z0-9\_\$\.`'"]+$/.test(text)){
        need = false
    }
    if (need) {
        text = `(${text})`
    }
    return text
}

export const quote = (name: string) => {
    let c = client()
    if(c.startsWith('sqlite') || c.startsWith('mysql') ){
        return `\`${name.replace(/\`/g, '``')}\``
    } else if (c.startsWith('pg')){
        return `"${name.replace(/\"/g, '""')}"`
    }
    throw new Error('Unsupport client')
}


export const META_FIELD_DELIMITER = '___'
const map1 = new Map<FieldProperty, string>()
const map2 = new Map<string, FieldProperty>()

export const registerGlobalNamedProperty = function(d: FieldProperty): string{
    let r = map1.get(d)
    if(!r){
        let key = makeid(5)
        map1.set(d, key)
        map2.set(key, d)
        r = key
    }
    return r
}

export const findGlobalNamedProperty = function(propAlias: string): FieldProperty{
    let r = map2.get(propAlias)
    if(!r){
        throw new Error(`Cannot find the Property by '${propAlias}'. Make sure it is registered before.`)
    }
    return r
}

export const metaTableAlias = function(schema: Schema): string{
    return schema.entityName + META_FIELD_DELIMITER + makeid(5)
}


export const metaFieldAlias = function(p: Property): string{
    let propAlias = registerGlobalNamedProperty(p)
    return `${p.name}${META_FIELD_DELIMITER}${propAlias}`
}

export const breakdownMetaFieldAlias = function(metaAlias: string){
    metaAlias = metaAlias.replace(/[\`\'\"]/g, '')
    if(metaAlias.includes(META_FIELD_DELIMITER)){
        let [propName, propAlias] = metaAlias.split(META_FIELD_DELIMITER)
        let namedProperty = findGlobalNamedProperty(propAlias)
        return {propName, namedProperty}
    } else {
        return null
    }
}

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



