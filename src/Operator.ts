import {Scalar, makeRaw as raw, ExpressionResolver, Expression, Scalarable, Dataset} from './Builder'
import {Knex} from 'knex'
import { BooleanNotNullType } from './PropertyType'
import { thenResult, thenResultArray } from './util'


abstract class SQLFunction<Props, SourcePropMap> {
    resolver: ExpressionResolver<Props, SourcePropMap>
    constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
        this.resolver = resolver
    }
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<any>
}

export abstract class ConditionOperator<Props, SourcePropMap> {
    resolver: ExpressionResolver<Props, SourcePropMap>
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    constructor(resolver: ExpressionResolver<Props, SourcePropMap>){
        this.resolver = resolver
    }
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<BooleanNotNullType>
}

export abstract class AssertionOperator implements Scalarable<any>{

    // abstract toRaw(leftOperand: Scalar ): Knex.Raw
    // abstract toScalar(leftOperand: Scalar ): Scalar
    // abstract toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<BooleanNotNullType>
}

export class AndOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap> >
    // resolver: ExpressionResolver<Props, PropMap>
    constructor(resolver: ExpressionResolver<Props, PropMap>, ...args: Array<Expression<Props, PropMap> >){
        super(resolver)
        // this.resolver = resolver
        this.args = args
    }

    toScalar(): Scalar<BooleanNotNullType>{
        // const p = this.toRaw(context, resolver)
        // return thenResult(p, r => makeScalar(context, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
        return new Scalar((context): Knex.Raw | Promise<Knex.Raw> => {

            let items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
            return thenResultArray(items, items => raw(context, items.join(' AND ') ) )
   
            // return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(context,
            //     args.map(arg => {
            //         const resolved = this.resolver(arg)
            //         console.log('AND CASE HERE', resolved.toRaw(context).toString() )
            //         return `${ resolved.toRaw(context)}`

            //     }).join(' AND ')
            // ))
        }, new BooleanNotNullType())
    }
}

export class OrOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap>>
    
    constructor(resolver: ExpressionResolver<Props, PropMap>, ...args: Array<Expression<Props, PropMap>>){
        super(resolver)
        this.args = args
        // this.resolver = resolver
    }
    // toRaw(context: Entitycontext<any>,resolver: ExpressionResolver<Props, PropMap>): Knex.Raw | Promise<Knex.Raw>{
    //     return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(context,
    //         `(${args.map(arg => `${resolver(arg).toString()}`).join(' OR ')})`
    //     ))
    // }
    
    toScalar(): Scalar<BooleanNotNullType>{
        // const p = this.toRaw(context, resolver)
        // return thenResult(p, r => makeScalar(context, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
        return new Scalar((context): Knex.Raw | Promise<Knex.Raw> => {

            let items = this.args.map(arg =>  this.resolver(arg).toRaw(context) )
            return thenResultArray(items, items => raw(context, items.join(' OR ') ) )

            // return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(context,
            //     args.map(arg => {
            //         return thenResult(this.resolver(arg), resolved => `${ resolved.toRaw(context)}`)
            //     }).join(' OR ')
            // ))
        }, new BooleanNotNullType())
    }
}

export class NotOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    arg: Expression<Props, PropMap>
    constructor(resolver: ExpressionResolver<Props, PropMap>, arg: Expression<Props, PropMap> ){
        super(resolver)
        this.arg = arg
    }

    // toRaw(context: Entitycontext<any>, resolver: ExpressionResolver<Props, PropMap>): Knex.Raw | Promise<Knex.Raw>{
    //     return thenResult(this.arg, arg => raw(context, `NOT (${resolver(arg).toString()})`) )
    //     // return raw( `NOT (${resolver(this.arg).toString()})`)
    // }
    
    toScalar(): Scalar<BooleanNotNullType> {
        // const p = this.toRaw(context, resolver)
        // return thenResult(p, r => new Scalar(context, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())

        return new Scalar((context): Knex.Raw | Promise<Knex.Raw> => {
            return thenResult( this.resolver(this.arg).toRaw(context), k => raw(context, 
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

    // toRaw(context: Entitycontext<any>, resolver: ExpressionResolver<Props, PropMap>): Knex.Raw | Promise<Knex.Raw>{
    //     return thenResult(this.arg, arg => raw(context, `NOT (${resolver(arg).toString()})`) )
    //     // return raw( `NOT (${resolver(this.arg).toString()})`)
    // }
    
    toScalar(): Scalar<BooleanNotNullType> {
        // const p = this.toRaw(context, resolver)
        // return thenResult(p, r => new Scalar(context, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
        return new Scalar((context): Knex.Raw | Promise<Knex.Raw> => {
            // return thenResult(this.arg.toNativeBuilder(context), scalar => raw(context, 
            //     `EXISTS (${scalar.toString()})`) 
            // )
            return thenResult( this.arg.toNativeBuilder(context), k => raw(context, 
                `EXISTS (${k.toString()})`) 
            )

        },new BooleanNotNullType())
    }
}

export class ContainOperator extends AssertionOperator {
    rightOperands: Scalar<any>[]
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, ...rightOperands: Scalar<any>[]){
        super()
        this.rightOperands = rightOperands
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>): Knex.Raw | Promise<Knex.Raw>{
    //     // return  raw( `${leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
    //     return thenResultArray(this.rightOperands, rightOperands => raw(context, `${this.leftOperand} IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResultArray(this.rightOperands.map(s => s.toRaw(context) ), rights => {

                return thenResult(this.leftOperand.toRaw(context), left => {

                    return raw(context, `${left} IN (${rights.map(o => '?')})`, [...rights])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        },new BooleanNotNullType())
    }
}

export class NotContainOperator extends AssertionOperator {
    rightOperands: Scalar<any>[]
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, ...rightOperands: Scalar<any>[]){
        super()
        this.rightOperands = rightOperands
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>, leftOperand: Scalar){
    //     return  raw(context, `${leftOperand} NOT IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
    //     // return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} NOT IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResultArray(this.rightOperands.map(s => s.toRaw(context) ), rights => {

                return thenResult(this.leftOperand.toRaw(context), left => {

                    return raw(context, `${left} NOT IN (${rights.map(o => '?')})`, [...rights])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        },new BooleanNotNullType())
    }
}

export class LikeOperator extends AssertionOperator {
    rightOperand: Scalar<any>
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, rightOperand: Scalar<any>){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>, leftOperand: Scalar<any>){
    //     return raw(context, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResult(this.rightOperand.toRaw(context), right => {

                return thenResult(this.leftOperand.toRaw(context), left => {

                    return raw(context, `${left} LIKE ?`, [right])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        },new BooleanNotNullType())
    }
    
    // toScalar(): Scalar<BooleanType>{
    //     return new Scalar(new BooleanType(), (context) => {
    //         return raw(context, `${this.leftOperand} LIKE ?`, [this.rightOperand])
    //     })
    // }
}

export class NotLikeOperator extends AssertionOperator {
    rightOperand: Scalar<any>
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, rightOperand: Scalar<any>){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>, leftOperand: Scalar<any>){
    //     return raw(context, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResult(this.rightOperand.toRaw(context), right => {

                return thenResult(this.leftOperand.toRaw(context), left => {

                    return raw(context, `${left} NOT LIKE ?`, [right])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        },new BooleanNotNullType())
    }
    
    // toScalar(): Scalar<BooleanType>{
    //     return new Scalar(new BooleanType(), (context) => {
    //         return raw(context, `${this.leftOperand} NOT LIKE ?`, [this.rightOperand])
    //     })
    // }
}

export class EqualOperator extends AssertionOperator{
    rightOperand: Scalar<any> | any
    leftOperand: Scalar<any> | any

    constructor(leftOperand: Scalar<any> | any, rightOperand: Scalar<any> | any){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>, leftOperand: Scalar<any>){
    //     return raw(context, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResult( (this.rightOperand.toRaw && this.rightOperand.toRaw(context)) ?? this.rightOperand, right => {

                return thenResult( (this.leftOperand.toRaw && this.leftOperand.toRaw(context)) ?? this.leftOperand, left => {

                    return raw(context, `${left} = ?`, [right])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        },new BooleanNotNullType())
    }
}

export class NotEqualOperator extends AssertionOperator {
    rightOperand: Scalar<any> | any
    leftOperand: Scalar<any> | any

    constructor(leftOperand: Scalar<any> | any, rightOperand: Scalar<any> | any){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(context: Entitycontext<any>, leftOperand: Scalar<any>){
    //     return raw(context, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {

            return thenResult( (this.rightOperand.toRaw && this.rightOperand.toRaw(context)) ?? this.rightOperand, right => {

                return thenResult( (this.leftOperand.toRaw && this.leftOperand.toRaw(context)) ?? this.leftOperand, left => {

                    return raw(context, `${left} <> ?`, [right])

                })

            })
            // return raw(context, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        }, new BooleanNotNullType())
    }
}

export class IsNullOperator extends AssertionOperator {
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>){
        super()
        this.leftOperand = leftOperand
    }
    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {
            return thenResult(this.leftOperand.toRaw(context), left => {
                return raw(context, `${left} IS NULL`)
            })
        }, new BooleanNotNullType())
    }
}

export class IsNotNullOperator extends AssertionOperator {
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>){
        super()
        this.leftOperand = leftOperand
    }
    toScalar(): Scalar<BooleanNotNullType>{

        return new Scalar((context) => {
            return thenResult(this.leftOperand.toRaw(context), left => {
                return raw(context, `${left} IS NOT NULL`)
            })
        }, new BooleanNotNullType())
    }
}

//TODO: GreaterThan
//TODO: LessThan
//TODO: GreaterThanOrEqual
//TODO: LessThanOrEqual

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
