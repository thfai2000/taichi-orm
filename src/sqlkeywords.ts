import {Scalar, ExpressionResolver, Expression, Dataset, resolveValueIntoScalar} from './builder'
import {Knex} from 'knex'
import { BooleanNotNullType, PropertyType } from './types'
import { thenResult, thenResultArray } from './util'
import { DatabaseContext, DateNotNullType, DateTimeNotNullType } from '.'

// abstract class SQLFunction<Props, SourcePropMap> {
//     resolver: ExpressionResolver<Props, SourcePropMap>
//     constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
//         this.resolver = resolver
//     }
//     // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
//     // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
//     // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
//     abstract toScalar(): Scalar<any, any>
// }

export abstract class ConditionOperator<Props, SourcePropMap> {
    resolver: ExpressionResolver<Props, SourcePropMap>
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
        this.resolver = resolver
    }
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<BooleanNotNullType, any>

    toString(){
        return this.toScalar().toRaw().toString()
    }
}

export abstract class AssertionOperator{

    abstract toScalar(): Scalar<BooleanNotNullType, any>

    toString(){
        return this.toScalar().toRaw().toString()
    }
}

export abstract class LeftAndRightAssertionOperator extends AssertionOperator{
    rightOperands: Scalar<any, any>[]
    leftOperand: Scalar<any, any> | any

    constructor(leftOperand: Scalar<any, any> | any, ...rightOperands: Scalar<any, any>[] | any[]){
        super()
        this.rightOperands = rightOperands
        this.leftOperand = leftOperand
    }

    abstract leftAndRightToRaw(context: DatabaseContext<any>, left: Knex.Raw | any, ...rights: Knex.Raw[] | any[]): Knex.Raw

    toScalar(): Scalar<BooleanNotNullType, any>{

        return new Scalar((context: DatabaseContext<any>) => {
            
            return thenResultArray(this.rightOperands.map(s => (s.toRaw && s.toRaw(context)) ?? s), rights => {

                return thenResult( (this.leftOperand.toRaw && this.leftOperand.toRaw(context)) ?? this.leftOperand, left => {

                    return this.leftAndRightToRaw(context, left, ...rights)

                })
            })
        }, new BooleanNotNullType())
    }

}


export class AndOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap> >
    constructor(resolver: ExpressionResolver<Props, PropMap>, ...args: Array<Expression<Props, PropMap> >){
        super(resolver)
        this.args = args
    }

    toScalar(): Scalar<BooleanNotNullType, any>{
        return new Scalar((context: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> => {

            if(this.args.length === 0){
                return context.raw('1')
            }
            const items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
            return thenResultArray(items, items => context.raw(items.join(' AND ') ) )
        }, new BooleanNotNullType())
    }
}

export class OrOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap>>
    
    constructor(resolver: ExpressionResolver<Props, PropMap>, ...args: Array<Expression<Props, PropMap>>){
        super(resolver)
        this.args = args
    }
    toScalar(): Scalar<BooleanNotNullType, any>{
        return new Scalar((context: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> => {

            if(this.args.length === 0){
                return context.raw('1')
            }
            const items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
            return thenResultArray(items, items => context.raw(items.join(' OR ') ) )
        }, new BooleanNotNullType())
    }
}

export class NotOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    arg: Expression<Props, PropMap>
    constructor(resolver: ExpressionResolver<Props, PropMap>, arg: Expression<Props, PropMap> ){
        super(resolver)
        this.arg = arg
    }
    toScalar(): Scalar<BooleanNotNullType, any> {
        return new Scalar((context: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> => {
            return thenResult( this.resolver(this.arg).toRaw(context), k => context.raw( 
                `NOT (${k.toString()})`) 
            )
        },new BooleanNotNullType())
    }
}

export class ExistsOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    arg: Dataset<any, any, any>
    constructor(resolver: ExpressionResolver<Props, PropMap>, arg: Dataset<any, any, any> ){
        super(resolver)
        this.arg = arg
    }
    toScalar(): Scalar<BooleanNotNullType, any> {
        return new Scalar((context: DatabaseContext<any>): Knex.Raw | Promise<Knex.Raw> => {
            return thenResult( this.arg.toNativeBuilder(context), k => context.raw( 
                `EXISTS (${k.toString()})`) 
            )

        },new BooleanNotNullType())
    }
}

export class InOperator extends LeftAndRightAssertionOperator {
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} IN (${rights.map(o => '?')})`, [...rights])
    }
}

export class NotInOperator extends LeftAndRightAssertionOperator {
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} NOT IN (${rights.map(o => '?')})`, [...rights])
    }
}

export class LikeOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }

    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} LIKE ?`, [rights[0]])
    }
}

export class NotLikeOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }

    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} NOT LIKE ?`, [rights[0]])
    }
}

export class EqualOperator extends LeftAndRightAssertionOperator{
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} = ?`, [rights[0]])
    }
}

export class NotEqualOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} <> ?`, [rights[0]])
    }
}

export class IsNullOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>){
        super(leftOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any): Knex.Raw<any> {
        return context.raw(`${left} IS NULL`)
    }
}

export class IsNotNullOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>){
        super(leftOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any): Knex.Raw<any> {
        return context.raw(`${left} IS NOT NULL`)
    }
}

export class GreaterThanOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} > ?`, [rights[0]])
    }
}

export class LessThanOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} < ?`, [rights[0]])
    }
}

export class GreaterThanOrEqualsOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} >= ?`, [rights[0]])
    }
}

export class LessThanOrEqualsOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>, rightOperand: Scalar<any, any>){
        super(leftOperand, rightOperand)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} <= ?`, [rights[0]])
    }
}

export class BetweenOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>,  rightOperand1: Scalar<any, any>, rightOperand2: Scalar<any, any>){
        super(leftOperand, rightOperand1, rightOperand2)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} BETWEEN ? AND ?`, [rights[0], rights[1]])
    }
}
export class NotBetweenOperator extends LeftAndRightAssertionOperator {
    constructor(leftOperand: Scalar<any, any>,  rightOperand1: Scalar<any, any>, rightOperand2: Scalar<any, any>){
        super(leftOperand, rightOperand1, rightOperand2)
    }
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} NOT BETWEEN ? AND ?`, [rights[0], rights[1]])
    }
}

export class AssertionOperatorWrapper {
    #func: (left: Scalar<any, any>) => AssertionOperator
    constructor(func: (left: Scalar<any, any>) => AssertionOperator){
        this.#func = func
    }

    toScalar(left: Scalar<any, any>){
        return this.#func(left).toScalar()
    }
}

export type SQLKeywords<Props, PropMap> = {
    And: (...condition: Array<Expression<Props, PropMap> > ) => Scalar<BooleanNotNullType, any>,
    Or: (...condition: Array<Expression<Props, PropMap> > ) => Scalar<BooleanNotNullType, any>,
    Not: (condition: Expression<Props, PropMap>) => Scalar<BooleanNotNullType, any>,
    Exists: (dataset: Dataset<any, any, any>) => Scalar<BooleanNotNullType, any>,
    Like: (right: Scalar<any, any> | string) => AssertionOperatorWrapper,
    NotLike: (right: Scalar<any, any> | string) => AssertionOperatorWrapper,
    Now: () => Scalar<DateTimeNotNullType, any>,
    Case: (target: Expression<Props, PropMap>, whenThens: WhenCase<Props, PropMap>[], elseValue: Expression<Props, PropMap>) => Scalar<any, any>,
    If: (matchingCondition: Expression<Props, PropMap>, thenValue: Expression<Props, PropMap>, elseValue: Expression<Props, PropMap> ) => Scalar<any, any>
}

export type WhenCase<X, Y> = {when: Expression<X, Y>, then: Expression<X, Y>}

export function constructSqlKeywords<X, Y>(resolver: ExpressionResolver<X, Y>) {
    const sqlkeywords: SQLKeywords<X, Y> = {
        And: (...conditions: Expression<X, Y>[]) => new AndOperator(resolver, ...conditions).toScalar(),
        Or: (...conditions: Expression<X, Y>[]) => new OrOperator(resolver, ...conditions).toScalar(),
        Not: (condition: Expression<X, Y>) => new NotOperator(resolver, condition).toScalar(),
        Exists: (dataset: Dataset<any, any, any>) => new ExistsOperator(resolver, dataset).toScalar(),
        Like: (right: Scalar<any, any> | string) => new AssertionOperatorWrapper( ( (left) => new LikeOperator(left, resolveValueIntoScalar(right) ) ) ),
        NotLike: (right: Scalar<any, any> | string) => new AssertionOperatorWrapper( ( (left) => new NotLikeOperator(left, resolveValueIntoScalar(right) ) ) ),
        Now: () => new Scalar( (context) => {
            
            const client = context.client()
            if( client.startsWith('sqlite') ){
                return {sql: `strftime('%s','now')`}
            } else {
                return {sql: 'NOW()'} 
            }
        }, DateTimeNotNullType),
        Case: (target: Expression<X, Y>, whenThens: WhenCase<X, Y>[], elseValue: Expression<X, Y>) => new Scalar( ()=> {

            if(whenThens.length === 0){
                throw new Error('There must be at least one When case')
            }

            return {
                sql: ` CASE ?? ${whenThens.map(w => `WHEN ?? THEN ??`).join(' ')} ELSE ?? END `,
                args: [ resolver(target), ...whenThens.flatMap(w => [resolver(w.when), resolver(w.then)]), resolver(elseValue) ]
            }
        }),
        If: ( onCondition: Expression<X, Y>, thenValue: Expression<X, Y>, elseValue: Expression<X, Y> ) => new Scalar( (context)=> {

            return context.$.Case(onCondition, 
                [
                    {when: true, then: thenValue}
                ],
                elseValue
                )
            
        })
    }
    return sqlkeywords
}