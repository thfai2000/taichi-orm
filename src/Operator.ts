import {Scalar, isScalar, makeScalar, makeRaw as raw} from './Builder'
import {Knex} from 'knex'
import { Expression, QueryFilterResolver, Selector, SimpleObject, thenResult, thenResultArray } from '.'
import { BooleanType } from './PropertyType'


export abstract class ConditionOperator {
    abstract toRaw(resolver: QueryFilterResolver): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(resolver: QueryFilterResolver): Scalar | Promise<Scalar>
}

export abstract class ValueOperator {
    abstract toRaw(leftOperand: Scalar ): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(leftOperand: Scalar ): Scalar | Promise<Scalar>
}

class AndOperator extends ConditionOperator{
    args: Array<Expression>
    constructor(...args: Array<Expression>){
        super()
        this.args = args
    }
    toRaw(resolver: QueryFilterResolver): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression>) => raw( 
            args.map(arg => `${resolver(arg).toString()}`).join(' AND ')
        ))
    }
    toScalar(resolver: QueryFilterResolver): Scalar | Promise<Scalar>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class OrOperator extends ConditionOperator{
    args: Array<Expression>
    constructor(...args: Array<Expression>){
        super()
        this.args = args
    }
    toRaw(resolver: QueryFilterResolver): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression>) => raw(
            `(${args.map(arg => `${resolver(arg).toString()}`).join(' OR ')})`
        ))
    }
    toScalar(resolver: QueryFilterResolver): Scalar | Promise<Scalar>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class NotOperator extends ConditionOperator{
    arg: Expression
    constructor(arg: Expression){
        super()
        this.arg = arg
    }

    toRaw(resolver: QueryFilterResolver){
        return thenResult(this.arg, arg => raw( `NOT (${resolver(arg).toString()})`) )
    }
    
    toScalar(resolver: QueryFilterResolver){
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class ContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Scalar){
        return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class NotContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Scalar){
        return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} NOT IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class LikeOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any[]){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    }
    
    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class NotLikeOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any[]){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} NOT LIKE ?`, [rightOperand]) )
    }
    
    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class EqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        return thenResult(this.rightOperand, (value: any) => {
            if(isScalar(value)){
                return raw( `${leftOperand} = ??`, [value.toString()])
            }
            else return raw( `${leftOperand} = ?`, [value])
        })
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}
class NotEqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar): Knex.Raw | Promise<Knex.Raw> {
        return thenResult(this.rightOperand, (value: any) => {
            if(isScalar(value)){
                return raw( `${leftOperand} <> ??`, [value.toString()])
            }
            else return raw( `${leftOperand} <> ?`, [value])
        })
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class IsNullOperator extends ValueOperator {
    constructor(){
        super()
    }

    toRaw(leftOperand: Scalar): Knex.Raw {
        return raw(`${leftOperand} IS NULL`)
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

class IsNotNullOperator extends ValueOperator {
    constructor(){
        super()
    }

    toRaw(leftOperand: Scalar): Knex.Raw {
        return raw(`${leftOperand} IS NOT NULL`)
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
    }
}

//TODO: GreaterThan
//TODO: LessThan
//TODO: GreaterThanOrEqual
//TODO: LessThanOrEqual


const And = (...condition: Array<Expression> ) => new AndOperator(...condition)
const Or = (...condition: Array<Expression>) => new OrOperator(...condition)
const Not = (condition: Expression) => new NotOperator(condition)
const Equal = (rightOperand: any) => new EqualOperator(rightOperand)
const NotEqual = (rightOperand: any) => new NotEqualOperator(rightOperand)
const Contain = (...rightOperands: Array<any>) => new ContainOperator(...rightOperands)
const NotContain = (...rightOperands: Array<any>) => new NotContainOperator(...rightOperands)
const Like = (rightOperand: any) => new LikeOperator(rightOperand)
const NotLike = (rightOperand: any) => new NotLikeOperator(rightOperand)
const IsNull = () => new IsNullOperator()
const IsNotNull = () => new IsNotNullOperator()

export {And, Or, Not, Equal, NotEqual, Contain, NotContain, Like, NotLike, IsNull, IsNotNull, AndOperator, OrOperator, NotOperator}