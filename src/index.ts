// import { Builder } from './Builder'
import knex, { Knex } from 'knex'
import * as fs from 'fs';

type Config = {
    modelsPath: string,
    dbSchemaPath: string,
    entityNameToTableName?: (params:string) => string,
    tableNameToEntityName?: (params:string) => string,
    propNameTofieldName?: (params:string) => string,
    fieldNameToPropName?: (params:string) => string,
    knexConfig: object
}

// the new orm config
let config: Config = {
    modelsPath: 'models/',
    dbSchemaPath: 'db-schema.sql',
    knexConfig: {client: 'mysql2'}
}

// a global knex instance
const getKnexInstance = () => knex(config.knexConfig)


const types = {
    AutoIncrement: ['bigint', 'NOT NULL', 'AUTO_INCREMENT', 'PRIMARY KEY'],
    String: (length: number, nullable: boolean) => [`varchar(${length})`],
    Number: ['integer'],
    Date: ['datetime'],
    arrayOf: function(entity: { new(): Entity }){
        //TODO
    }
}

export const Types = types

export const More = {
    Null: 'NULL',
    NotNull: "NOT NULL"
}

let schemas: any = {}
export class Schema {

    tableName: string
    entityName: string
    fields: Field[]
    primaryKey: Field

    constructor(entityName: string){
        this.entityName = entityName
        this.tableName = config.entityNameToTableName?config.entityNameToTableName(entityName):entityName
        this.primaryKey = {
            name: 'id',
            defination: [Types.AutoIncrement],
            computed: false
        }
        this.fields = [this.primaryKey]
    }

    createTableStmt(){
        return `CREATE TABLE \`${this.tableName}\` (\n${this.fields.filter(f => !f.computed).map(f => `\`${f.name}\` ${f.defination.flat().join(' ')}`).join(',\n')}\n)`;
    }


    prop(name:string, defination: any, options?: any){
        this.fields.push({
            name,
            defination,
            ...options,
            computed: false
        })
    }

    computedProp(name:string, defination: any, options?: any){
        this.fields.push({
            name,
            defination,
            ...options,
            computed: true
        })
    }

}


function makeid(length: number) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * 
 charactersLength)));
   }
   return result.join('');
}


type Field = {
    name: string,
    defination: any,
    options?: any,
    computed: boolean
}

export const configure = async function(newConfig: Config){
    config = newConfig

    let files = fs.readdirSync(config.modelsPath)
    let tables: Schema[] = []
    
    await Promise.all(files.map( async(file) => {
        if(file.endsWith('.js')){
            let path = config.modelsPath + '/' + file
            path = path.replace(/\.js$/,'')
            console.log('load model file:', path)
            let p = path.split('/')
            let entityName = p[p.length - 1]
            let entityClass = require(path)
            if(entityClass.default.register){
                let s = new Schema(entityName)
                tables.push(s)
                entityClass.default.register(s)
                schemas[entityName] = s
            }
        }
    }))
    // let schemaFilename = new Date().getTime() + '.sql'
    let path = config.dbSchemaPath //+ '/' + schemaFilename
    fs.writeFileSync(path, tables.map(t => t.createTableStmt()).join(";\n") + ';' )
    console.log('schemas:', Object.keys(schemas))
}


export const select = function(...args: any[]){

    let alias: string[] = args.map(s => /\[\[(.*)\]\]/g.exec(s)?.[1] || '' ).filter(s => s.length > 0)
    
    let info = alias.map(a => {
        let parts = a.split('|')
        return {
            fullName: `[[${a}]]`,
            tableName: parts[0],
            aliasName: parts[1],
            fieldName: parts[2]
        }
    })

    let distinctNames: string[] = [...new Set(info.map(i => `${i.tableName} as ${i.aliasName}`))]
    // let [firstName, ...otherNames] = distinctNames

    let stmt = getKnexInstance().select(...args)
    if(distinctNames.length === 1){
        stmt = stmt.from(distinctNames[0])
    }

    // stmt = distinctNames.reduce((acc, name) => acc.from(name, {only:false}), stmt)
    console.log(stmt.toSQL())
    return stmt
}

select('[[SKU|t1|name]].name', '[[SKU|t1|abc]].abc')

type QueryBuilder = (stmt: Knex.QueryBuilder, map: object) => Knex.QueryBuilder
export class Entity {
    constructor(){
    }

    static get schema(): Schema{
        return schemas[this.name]
    }

    static get tableName() {
        return this.schema.tableName
    }

    static belongsTo(entityClass: typeof Entity, propName: string){
        let map = this.produceNameMap()
        return getKnexInstance().from(`\`${entityClass.tableName}\` AS xxxx`).where(getKnexInstance().raw("?? = ??", [propName, entityClass.schema.primaryKey.name]))
    }

    static hasMany(entityClass: typeof Entity, propName: string){

    }

    static produceNameMap(): object {
        let randomName = makeid(5)
        return this.schema.fields.reduce( (acc: any, f) => {
            acc[f.name] = `${randomName}.${f.name}`
            return acc
        }, {
            '_': `${this.schema.tableName} As ${randomName}`,
            'all': `${randomName}.*`
        })
    }

    static async get(func: QueryBuilder ){
        let map: any = this.produceNameMap()
        let stmt = getKnexInstance().from(map._)
        stmt = func(stmt, map)
        return stmt.toString()
    }

    static getOne(){

    }

    // it is a parser
    static Array(){

    }
}