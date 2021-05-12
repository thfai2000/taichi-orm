import knex from "knex"

export class Entity{
    name: string

    constructor(name: string){
        this.name = name
    }

    createStatement(){
        return knex(this.name)
    }

}