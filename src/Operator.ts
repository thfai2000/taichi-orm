import {Column, makeRaw as raw} from './Builder'
import {Knex} from 'knex'

abstract class ValueOperator {
    abstract toRaw(leftOperand: Column ): Knex.Raw
}

 class AndOperator {
    args: any[]
    constructor(...args: any[]){
        this.args = args
    }
    toRaw(): Knex.Raw | Promise<Knex.Raw>{
        if( this.args.some( x => x instanceof Promise) ){
            return Promise.all(this.args).then(args => raw( args.map(arg => `(${arg.toString()})`).join(' AND ')) )
        }
        return raw( this.args.map(arg => `(${arg.toString()})`).join(' AND ') )
    }
}

class OrOperator{
    args: any[]
    constructor(...args: any[]){
        this.args = args
    }
    toRaw(): Knex.Raw | Promise<Knex.Raw> {
        if( this.args.some( x => x instanceof Promise) ){
            return Promise.all(this.args).then(args => raw( args.map(arg => `(${arg.toString()})`).join(' OR ')) )
        }
        return raw( this.args.map(arg => `(${arg.toString()})`).join(' OR ') )
    }
}

class ContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Column){
        return raw( `${leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
    }
}

class EqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Column){
        return raw( `${leftOperand} = ?`, [this.rightOperand])
    }
}
class NotEqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Column) {
        return raw( `${leftOperand} <> ?`, [this.rightOperand])
    }
}

const And = (...condition: Array<Knex.Raw | Promise<Knex.Raw>>) => new AndOperator(...condition)
const Or = (...condition: Array<Knex.Raw | Promise<Knex.Raw>>) => new OrOperator(...condition)
const Equal = (rightOperand: Knex.Raw | Promise<Knex.Raw>) => new EqualOperator(rightOperand)
const NotEqual = (rightOperand: Knex.Raw | Promise<Knex.Raw>) => new NotEqualOperator(rightOperand)
const Contain = (...rightOperands: Array<Knex.Raw | Promise<Knex.Raw>>) => new ContainOperator(...rightOperands)

export {And, Or, Equal, NotEqual, Contain, AndOperator, OrOperator, ValueOperator}