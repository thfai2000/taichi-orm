import {Scalar, isScalar, makeScalar, makeRaw as raw, ExpressionResolver} from './Builder'
import {Knex} from 'knex'
import { BooleanType } from './PropertyType'
import { Expression } from './Relation'
import { thenResult, thenResultArray } from './util'


abstract class SQLFunction<Props> {
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(resolver: ExpressionResolver<Props>): Scalar | Promise<Scalar>
}

export abstract class ConditionOperator<Props> {
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar

    abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(resolver: ExpressionResolver<Props>): Scalar | Promise<Scalar>
}

export abstract class ValueOperator {
    // abstract toRaw(leftOperand: Scalar ): Knex.Raw
    // abstract toScalar(leftOperand: Scalar ): Scalar
    abstract toRaw(leftOperand: Scalar ): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(leftOperand: Scalar ): Scalar | Promise<Scalar>
}

class AndOperator<Props, PropMap> extends ConditionOperator<Props>{
    args: Array<Expression<Props, PropMap> >
    constructor(...args: Array<Expression<Props, PropMap> >){
        super()
        this.args = args
    }
    toRaw(resolver: ExpressionResolver<Props>): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw( 
            args.map(arg => `${resolver(arg).toString()}`).join(' AND ')
        ))
        // return raw( 
        //     this.args.map(arg => `${resolver(arg).toString()}`).join(' AND ')
        // )
    }
    toScalar(resolver: ExpressionResolver<Props>): Scalar | Promise<Scalar>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
    }
}

class OrOperator<Props> extends ConditionOperator<Props>{
    args: Array<Expression<Props>>
    constructor(...args: Array<Expression<Props>>){
        super()
        this.args = args
    }
    toRaw(resolver: ExpressionResolver<Props>): Knex.Raw | Promise<Knex.Raw>{
        return thenResultArray(this.args, (args: Array<Expression<Props> >) => raw(
            `(${args.map(arg => `${resolver(arg).toString()}`).join(' OR ')})`
        ))
        // return raw( 
        //     this.args.map(arg => `${resolver(arg).toString()}`).join(' OR ')
        // )
    }
    
    toScalar(resolver: ExpressionResolver<Props>): Scalar | Promise<Scalar>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
    }
}

class NotOperator<Props> extends ConditionOperator<Props>{
    arg: Expression<Props>
    constructor(arg: Expression<Props> ){
        super()
        this.arg = arg
    }

    toRaw(resolver: ExpressionResolver<Props>): Knex.Raw | Promise<Knex.Raw>{
        return thenResult(this.arg, arg => raw( `NOT (${resolver(arg).toString()})`) )
        // return raw( `NOT (${resolver(this.arg).toString()})`)
    }
    
    toScalar(resolver: ExpressionResolver<Props>): Scalar | Promise<Scalar>{
        const p = this.toRaw(resolver)
        return thenResult(p, r => makeScalar(r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
    }
}

class ContainOperator extends ValueOperator {
    rightOperands: any[]
    constructor(...rightOperands: any[]){
        super()
        this.rightOperands = rightOperands
    }

    toRaw(leftOperand: Scalar): Knex.Raw | Promise<Knex.Raw>{
        // return  raw( `${leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    }

    toScalar(leftOperand: Scalar): Scalar | Promise<Scalar>{
        const p = this.toRaw(leftOperand)
        // return makeScalar(p, new BooleanType())
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
        return  raw( `${leftOperand} NOT IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        // return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} NOT IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return makeScalar(p, new BooleanType())
    }
}

class LikeOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any[]){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        return raw( `${leftOperand} LIKE ?`, [this.rightOperand])
        // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    }
    
    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return makeScalar(p, new BooleanType())
    }
}

class NotLikeOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any[]){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        return raw( `${leftOperand} NOT LIKE ?`, [this.rightOperand])
        // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} NOT LIKE ?`, [rightOperand]) )
    }
    
    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return makeScalar(p, new BooleanType())
    }
}

class EqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar){
        // return thenResult(this.rightOperand, (value: any) => {
        //     if(isScalar(value)){
        //         return raw( `${leftOperand} = ??`, [value.toString()])
        //     }
        //     else return raw( `${leftOperand} = ?`, [value])
        // })
        
        if(isScalar(this.rightOperand)){
            return raw( `${leftOperand} = ??`, [this.rightOperand.toString()])
        }
        else return raw( `${leftOperand} = ?`, [this.rightOperand])
    
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return makeScalar(p, new BooleanType())
    }
}

class NotEqualOperator extends ValueOperator {
    rightOperand: any
    constructor(rightOperand: any){
        super()
        this.rightOperand = rightOperand
    }

    toRaw(leftOperand: Scalar): Knex.Raw {
        // return thenResult(this.rightOperand, (value: any) => {
        //     if(isScalar(value)){
        //         return raw( `${leftOperand} <> ??`, [value.toString()])
        //     }
        //     else return raw( `${leftOperand} <> ?`, [value])
        // })
        if(isScalar(this.rightOperand)){
            return raw( `${leftOperand} <> ??`, [this.rightOperand.toString()])
        }
        else return raw( `${leftOperand} <> ?`, [this.rightOperand])
    }

    toScalar(leftOperand: Scalar){
        const p = this.toRaw(leftOperand)
        return makeScalar(p, new BooleanType())
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
        return makeScalar(p, new BooleanType())
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
        return makeScalar(p, new BooleanType())
    }
}

//TODO: GreaterThan
//TODO: LessThan
//TODO: GreaterThanOrEqual
//TODO: LessThanOrEqual

// export type ConditionOperatorCall<Props> = (...condition: Array<Expression<Props> > ) => ConditionOperator<Props>


export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => AndOperator<Props, PropMap>
}

// const Or = (...condition: Array<Expression<any>>) => new OrOperator<any>(...condition)
// const Not = (condition: Expression<any>) => new NotOperator<any>(condition)
// const Equal = (rightOperand: any) => new EqualOperator(rightOperand)
// const NotEqual = (rightOperand: any) => new NotEqualOperator(rightOperand)
// const Contain = (...rightOperands: Array<any>) => new ContainOperator(...rightOperands)
// const NotContain = (...rightOperands: Array<any>) => new NotContainOperator(...rightOperands)
// const Like = (rightOperand: any) => new LikeOperator(rightOperand)
// const NotLike = (rightOperand: any) => new NotLikeOperator(rightOperand)
// const IsNull = () => new IsNullOperator()
// const IsNotNull = () => new IsNotNullOperator()

export {And, Or, Not, Equal, NotEqual, Contain, NotContain, Like, NotLike, IsNull, IsNotNull, AndOperator, OrOperator, NotOperator}


// let s = builder().props({
//     dd: await 
// }).from( Product.datasource("c") ).filter(And(
//     {'c.eeee': 5}
// )).toDatasource("a")

// builder().from(
//     s.asfromClause().innerJoin(t2)
// ).filter({
//     "a.id": 5
// })