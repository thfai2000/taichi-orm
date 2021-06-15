import {Column, isColumn, makeColumn, makeRaw as raw} from './Builder'
import {Knex} from 'knex'
import { addBlanketIfNeeds, Selector, SimpleObject, thenResult, thenResultArray } from '.'
import { BooleanType } from './PropertyType'

abstract class ValueOperator {
    abstract toRaw(leftOperand: Column ): Knex.Raw | Promise<Knex.Raw>
    abstract toColumn(leftOperand: Column ): Column | Promise<Column>
}

class AndOperator {
    args: Array<Expression>
    constructor(...args: Array<Expression>){
        this.args = args
    }
    toRaw(resolver: ExpressionResolver): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression>) => raw( 
            args.length === 1? resolver(args[0]).toString(): args.map(arg => `${resolver(arg).toString()}`).join(' AND ')
        ))
    }
    toColumn(resolver: ExpressionResolver): Column | Promise<Column>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

class OrOperator{
    args: Array<Expression>
    constructor(...args: Array<Expression>){
        this.args = args
    }
    toRaw(resolver: ExpressionResolver): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression>) => raw(
            `(${args.length === 1? resolver(args[0]).toString(): args.map(arg => `${resolver(arg).toString()}`).join(' OR ')})`
        ))
    }
    toColumn(resolver: ExpressionResolver): Column | Promise<Column>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

class NotOperator {
    arg: Expression
    constructor(arg: Expression){
        this.arg = arg
    }

    toRaw(resolver: ExpressionResolver){
        return thenResult(this.arg, arg => raw( `NOT (${resolver(arg).toString()})`) )
    }
    
    toColumn(resolver: ExpressionResolver){
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
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

    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

class LikeOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any[]){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Column){
        return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    }
    
    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
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

    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
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

    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

class IsNullOperator extends ValueOperator {
    constructor(){
        super()
    }

    toRaw(leftOperand: Column): Knex.Raw {
        return raw(`${leftOperand} IS NULL`)
    }

    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

class IsNotNullOperator extends ValueOperator {
    constructor(){
        super()
    }

    toRaw(leftOperand: Column): Knex.Raw {
        return raw(`${leftOperand} IS NOT NULL`)
    }

    toColumn(leftOperand: Column){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeColumn(r, new BooleanType()))
    }
}

//TODO: GreaterThan
//TODO: LessThan
//TODO: GreaterThanOrEqual
//TODO: LessThanOrEqual

export type ExpressionResolver = (value: Expression) => Promise<Column> | Column
export type SelectorFunction = (selector: Selector) => Column
export type Expression = AndOperator | OrOperator | Column | Promise<Column> | SimpleObject | SelectorFunction | Array<Expression>

const And = (...condition: Array<Expression> ) => new AndOperator(...condition)
const Or = (...condition: Array<Expression>) => new OrOperator(...condition)
const Not = (condition: Expression) => new NotOperator(condition)
const Equal = (rightOperand: any) => new EqualOperator(rightOperand)
const NotEqual = (rightOperand: any) => new NotEqualOperator(rightOperand)
const Contain = (...rightOperands: Array<any>) => new ContainOperator(...rightOperands)
const Like = (rightOperand: any) => new LikeOperator(rightOperand)
const IsNull = () => new IsNullOperator()
const IsNotNull = () => new IsNotNullOperator()

export {And, Or, Not, Equal, NotEqual, Contain, Like, IsNull, IsNotNull, AndOperator, OrOperator, NotOperator, ValueOperator}