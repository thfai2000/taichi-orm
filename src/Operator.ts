import {Column, isColumn, makeRaw as raw} from './Builder'
import {Knex} from 'knex'
import { Selector, SimpleObject, thenResult } from '.'

abstract class ValueOperator {
    abstract toRaw(leftOperand: Column ): Knex.Raw | Promise<Knex.Raw>
}

 class AndOperator {
    args: Array<ConditionExpression>
    constructor(...args: Array<ConditionExpression>){
        this.args = args
    }
    toRaw(resolver: ConditionExpressionResolver): Knex.Raw | Promise<Knex.Raw>{
        const logic = (args: Array<ConditionExpression>) => raw( args.map(arg => `(${resolver(arg).toString()})`).join(' AND ')) 
        if( this.args.some( x => x instanceof Promise) ){
            return Promise.all(this.args).then(args => logic(args))
        }
        return logic(this.args)
    }
}

class OrOperator{
    args: Array<ConditionExpression>
    constructor(...args: Array<ConditionExpression>){
        this.args = args
    }
    toRaw(resolver: ConditionExpressionResolver): Knex.Raw | Promise<Knex.Raw> {
        const logic = (args: Array<ConditionExpression>) => raw( args.map(arg => `(${resolver(arg).toString()})`).join(' OR ')) 
        if( this.args.some( x => x instanceof Promise) ){
            return Promise.all(this.args).then(args => logic(args))
        }
        return logic(this.args)
    }
}

class ContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Column){
        //TODO: must cater promise..
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
        return thenResult(this.rightOperand, (value: any) => {
            if(isColumn(value)){
                return raw( `${leftOperand} = ??`, [value.toString()])
            }
            else return raw( `${leftOperand} = ?`, [value])
        })
    }
}
class NotEqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Column): Knex.Raw | Promise<Knex.Raw> {
        return thenResult(this.rightOperand, (value: any) => {
            if(isColumn(value)){
                return raw( `${leftOperand} <> ??`, [value.toString()])
            }
            else return raw( `${leftOperand} <> ?`, [value])
        })
    }
}

export type ConditionExpressionResolver = (value: ConditionExpression) => Promise<Knex.Raw> | Knex.Raw
export type SelectorFunction = (selector: Selector) => Column
export type ConditionExpression = Knex.Raw | Promise<Knex.Raw> | SimpleObject | SelectorFunction | Array<ConditionExpression>

const And = (...condition: Array<ConditionExpression> ) => new AndOperator(...condition)
const Or = (...condition: Array<ConditionExpression>) => new OrOperator(...condition)
const Equal = (rightOperand: any) => new EqualOperator(rightOperand)
const NotEqual = (rightOperand: any) => new NotEqualOperator(rightOperand)
const Contain = (...rightOperands: Array<any>) => new ContainOperator(...rightOperands)

export {And, Or, Equal, NotEqual, Contain, AndOperator, OrOperator, ValueOperator}