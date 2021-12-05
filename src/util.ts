import { ComputeFunction } from ".";
import { Dataset, Prefixed, Scalar } from "./builder";
import { Model } from "./model";
import { FieldPropertyType, PrimaryKeyType, PropertyType } from "./types";
import { ComputeProperty, FieldProperty, ScalarProperty, Schema, TableSchema } from "./schema";

export type Undetermined = 'undetermined'

export type NoArg = { it_is_a_unique_field_indicates_no_arg: null}

// expands object types one level deep
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// expands object types recursively
export type ExpandRecursively<T> = 
    T extends Date ? Date: 
    T extends object ? (T extends infer O ? { [K in keyof O]: ExpandRecursively<O[K]> } : never):
    T;

export function undoExpandRecursively<T>(o: ExpandRecursively<T>): T {
    return o as any
}

export function expandRecursively<T>(o: T): ExpandRecursively<T>{
    return o as any
}

export function expand<T>(o: T): Expand<T>{
    return o as any
}

// export function undoExpandRecursively<T>(o: T): T {
//     return o as any
// }

// export function expandRecursively<T>(o: T): T {
//     return o as any
// }

export type ScalarDictToValueTypeDict<SelectedScalars> = {[key in keyof SelectedScalars]: SelectedScalars[key] extends Scalar<PropertyType<infer D>, any>? D: never}


export type SimpleObject = { [key:string]: any}
export const SimpleObjectClass = ({} as {[key:string]: any}).constructor
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}
export type ExtractValueTypeDictFromDataset<D extends Dataset<any>> = ExtractValueTypeDictFromSchema<D extends Dataset<infer S>?S:never>
export type AnyDataset = Dataset<Schema<{[key:string]: ScalarProperty<any>}>>

export type UnionToIntersection<T> = 
  (T extends any ? (x: T) => any : never) extends 
  (x: infer R) => any ? R : never


export type ExtractSchemaFieldOnlyFromSchema<CurrentSchema extends Schema<any>> = Schema<ExtractFieldPropDictFromSchema<CurrentSchema> >

export type ConstructMutationFromValueTypeDict<D> = {
    [key in keyof D]: 
            D[key] | Scalar<PropertyType<D[key]>, any>
}


export type ExtractValueTypeFromProperty<T> = 
    T extends FieldProperty<FieldPropertyType<infer Primitive>>? Primitive:
        (
            T extends ComputeProperty<ComputeFunction<any, any, Scalar<PropertyType<infer X>, any> >>? X: 
                        (
                    T extends ScalarProperty<Scalar<PropertyType<infer Primitive>, any>>? Primitive:
                    T
                )
        )

export type ExtractValueTypeDictFromPropertyDict<E> = {
    [key in keyof E]: 
            E[key] extends Prefixed<any, any, infer C>? 
                ExtractValueTypeFromProperty<C>: 
                ExtractValueTypeFromProperty<E[key]>
}

export type ExtractPropDictFromPrefixedPropertyDict<E> = {
    [key in keyof E]: 
            E[key] extends Prefixed<any, any, infer C>? 
                C:
                E[key]
}

export type ExtractValueTypeDictFromSchema<S extends Schema<any>> = ExtractValueTypeDictFromPropertyDict< S extends Schema<infer Dict>?Dict:never>

export type ExtractValueTypeDictFromSchema_FieldsOnly<S extends Schema<any>> = ExtractValueTypeDictFromPropertyDict< ExtractFieldPropDictFromSchema<S>> 


export type ExtractSchemaFromModel<M> = TableSchema< FilterPropDictFromDict<M> & {id: FieldProperty<PrimaryKeyType>}>
export type ExtractSchemaFromModelType<MT extends typeof Model> = ExtractSchemaFromModel<InstanceType<MT>>


export type ExtractFieldPropDictFromModel<M> = ExtractFieldPropDictFromSchema< ExtractSchemaFromModel<M> >
export type ExtractFieldPropDictFromModelType<MT extends typeof Model> = ExtractFieldPropDictFromSchema< ExtractSchemaFromModelType<MT> >


export type ExtractFieldPropNameFromModelType<MT extends typeof Model> = ExtractFieldPropNameFromSchema< ExtractSchemaFromModelType<MT> >
export type ExtractFieldPropNameFromSchema<S extends Schema<any>> = S extends Schema<infer P>? (keyof ExtractFieldPropDictFromDict<P>) & string: never


export type ExtractPropDictFromModel<M extends Model> = ExtractPropDictFromSchema< ExtractSchemaFromModel<M> >

export type ExtractPropDictFromModelType<MT extends typeof Model> = ExtractPropDictFromSchema< ExtractSchemaFromModelType<MT> >

export type ExtractFieldPropDictFromSchema<S extends Schema<any>> = ExtractFieldPropDictFromDict<
    S extends Schema<infer PropertyDict>? PropertyDict: never
>

export type ExtractPropDictFromSchema<S extends Schema<any>> = FilterPropDictFromDict<
    S extends Schema<infer PropertyDict>? PropertyDict: never
>

export type ExtractComputePropDictFromSchema<S extends Schema<any>> = ExtractComputePropDictFromDict<
    S extends Schema<infer PropertyDict>? PropertyDict: never
>

export type ExtractComputePropWithArgDictFromSchema<S extends Schema<any>> = ExtractComputePropWithArgDictFromDict<
    S extends Schema<infer PropertyDict>? PropertyDict: never
>

export type FilterPropDictFromDict<E> = 
Pick<E, ({
    [key in keyof E]: 
                    E[key] extends ComputeProperty<any>? key:
                    E[key] extends FieldProperty<any>? key:
                    E[key] extends ScalarProperty<any>? key:
                    never
})[keyof E]>

export type ExtractFieldPropDictFromDict<E> = 
Pick<E, ({
    [key in keyof E]: E[key] extends FieldProperty<any>? key:
                    never
})[keyof E]> 


export type ExtractComputePropDictFromDict<E> = 
Pick<E, ({
    [key in keyof E]: E[key] extends ComputeProperty<any>? key:
                    never
})[keyof E]> 

export type ExtractComputePropWithArgDictFromDict<E> = 
Pick<E, ({
    [key in keyof E]: E[key] extends ComputeProperty<ComputeFunction<any, infer Arg, any>>? 
            (Arg extends NoArg? never: key)
                : never
})[keyof E]>

// export type PartialIfNull<Dict> = {
//     [key in keyof Dict]: Dict[key] extends null? (Dict[key] | undefined) : Dict[key]
// } 

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
    const c = client
    if(c.startsWith('sqlite') || c.startsWith('mysql') ){
        return `\`${name.replace(/`/g, '``')}\``
    } else if (c.startsWith('pg')){
        return `"${name.replace(/"/g, '""')}"`
    }
    throw new Error('Unsupport client')
}

export function camelize(str: string) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}

// export const META_FIELD_DELIMITER = '___'
// const map1 = new Map<PropertyType, string>()
// const map2 = new Map<string, PropertyType>()

// export const registerGlobalPropertyTypeDefinition = function(d: PropertyType): string{
//     let r = map1.get(d)
//     if(!r){
//         let key = makeid(3)
//         map1.set(d, key)
//         map2.set(key, d)
//         r = key
//     }
//     return r
// }

// export const findGlobalPropertyTypeDefinition = function(propAlias: string): PropertyType {
//     let r = map2.get(propAlias)
//     if(!r){
//         throw new Error(`Cannot find the Property by '${propAlias}'. Make sure it is registered before.`)
//     }
//     return r
// }

// export const metaFieldAlias = function(name: string, p: PropertyType): string{
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
    const result           = [];
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
   }
   return result.join('');
}

export interface SQLString{
    toString(): string
}


export const parseName = (item: any) => {
    const text = item.toString().trim()

    const e = /((?<![\\])[`'"])((?:.(?!(?<![\\])\1))*.?)\1/g
    let r = e.exec(text)
    if(r){
        let last = r[0]
        while( (r = e.exec(text) )){
            last = r[0]
        }
        return last
    } else {
        const e = /\b[. ]+([a-zA-Z0-9_$]*)$/
        const r = e.exec(text)
        if(r && r[1]){
            return r[1]
        }else {
            return text
        }
    }
}


export function isFunction(funcOrClass: any): funcOrClass is ((...args: any[]) => any) {
  const propertyNames = Object.getOwnPropertyNames(funcOrClass);
  return (!propertyNames.includes('prototype') || propertyNames.includes('arguments'));
}

export function isArrayOfStrings(arr: any[]): arr is string[] {
    return arr.every(item => typeof item === 'string')
}

export function isScalarMap(obj: any): obj is { [key: string]: Scalar<any, any> } {
    if(typeof obj === 'object'){
        const keys = Object.keys(obj)
        for (const key in keys) {
            if( (obj[keys[key]] instanceof Scalar)){
                return true
            }
        }
    }
    return false
}