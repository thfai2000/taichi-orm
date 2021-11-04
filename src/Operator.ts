import {Scalar, ExpressionResolver, Expression, Dataset} from './Builder'
import {Knex} from 'knex'
import { BooleanNotNullType } from './PropertyType'
import { thenResult, thenResultArray } from './util'
import { DatabaseContext, Scalarable } from '.'

abstract class SQLFunction<Props, SourcePropMap> {
    resolver: ExpressionResolver<Props, SourcePropMap>
    constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
        this.resolver = resolver
    }
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<any, any>
}

export abstract class ConditionOperator<Props, SourcePropMap> {
    resolver: ExpressionResolver<Props, SourcePropMap>
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
        this.resolver = resolver
    }
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<BooleanNotNullType, any>
}

export abstract class AssertionOperator implements Scalarable<any, any>{

    abstract toScalar(): Scalar<BooleanNotNullType, any>
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
            let items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
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
            let items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
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

export class ContainOperator extends LeftAndRightAssertionOperator {
    leftAndRightToRaw(context: DatabaseContext<any>, left: any, ...rights: any[] | Knex.Raw<any>[]): Knex.Raw<any> {
        return context.raw(`${left} IN (${rights.map(o => '?')})`, [...rights])
    }
}

export class NotContainOperator extends LeftAndRightAssertionOperator {
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

// export type ConditionOperatorCall<Props> = (...condition: Array<Expression<Props> > ) => ConditionOperator<Props>
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

// export {And, Or, Not, Equal, NotEqual, Contain, NotContain, Like, NotLike, IsNull, IsNotNull, AndOperator, OrOperator, NotOperator}
