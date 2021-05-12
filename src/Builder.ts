import knex from "knex"

export class Builder{

    stmt: any

    constructor(tablename: string){
        this.stmt = knex(tablename)
    }

    select(...args: any[]){
        this.stmt.select(...args)
        return this
    }

    where(...args: any[]){
        this.stmt.where(...args)
        return this
    }
}

