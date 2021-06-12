import {Column, isColumn, makeRaw as raw} from './Builder'
import {Knex} from 'knex'
import { Selector, SimpleObject, thenResult, thenResultArray } from '.'

abstract class ValueOperator {
    abstract toRaw(leftOperand: Column ): Knex.Raw | Promise<Knex.Raw>
}

 class AndOperator {
    args: Array<ConditionExpression>
    constructor(...args: Array<ConditionExpression>){
        this.args = args
    }
    toRaw(resolver: ConditionExpressionResolver): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<ConditionExpression>) => raw( args.map(arg => `(${resolver(arg).toString()})`).join(' AND ')) )
    }
}

class OrOperator{
    args: Array<ConditionExpression>
    constructor(...args: Array<ConditionExpression>){
        this.args = args
    }
    toRaw(resolver: ConditionExpressionResolver): Knex.Raw | Promise<Knex.Raw> {
        return thenResultArray(this.args, (args: Array<ConditionExpression>) => raw( args.map(arg => `(${resolver(arg).toString()})`).join(' OR ')) )
    }
}

class ContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Column){
        return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
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