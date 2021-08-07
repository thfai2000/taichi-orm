import {Scalar, makeRaw as raw, ExpressionResolver, Expression, Scalarable} from './Builder'
import {Knex} from 'knex'
import { BooleanType } from './PropertyType'
import { thenResult, thenResultArray } from './util'
import { EntityRepository } from '.'


abstract class SQLFunction<Props, SourcePropMap> {
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar
    // abstract toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(resolver: ExpressionResolver<Props, SourcePropMap>): Scalar<any>
}

export abstract class ConditionOperator<Props, SourcePropMap> {
    // abstract toRaw(resolver: ExpressionResolver<Props>): Knex.Raw
    // abstract toScalar(resolver: ExpressionResolver<Props>): Scalar

    // abstract toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(resolver: ExpressionResolver<Props, SourcePropMap>): Scalar<BooleanType>
}

export abstract class AssertionOperator implements Scalarable<any>{
    // abstract toRaw(leftOperand: Scalar ): Knex.Raw
    // abstract toScalar(leftOperand: Scalar ): Scalar
    // abstract toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw>
    abstract toScalar(): Scalar<BooleanType>
}

export class AndOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap> >
    constructor(...args: Array<Expression<Props, PropMap> >){
        super()
        this.args = args
    }

    toScalar(resolver: ExpressionResolver<Props, PropMap>): Scalar<BooleanType>{
        // const p = this.toRaw(repository, resolver)
        // return thenResult(p, r => makeScalar(repository, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
        return new Scalar(new BooleanType(), (repository): Knex.Raw | Promise<Knex.Raw> => {
            return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(repository,
                args.map(arg => {
                    const resolved = resolver(arg)
                    return thenResult(resolved, resolved => `${ resolved.toRaw(repository)}`)
                }).join(' AND ')
            ))
        })
    }
}

export class OrOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    args: Array<Expression<Props, PropMap>>
    constructor(...args: Array<Expression<Props, PropMap>>){
        super()
        this.args = args
    }
    // toRaw(repository: EntityRepository<any>,resolver: ExpressionResolver<Props, PropMap>): Knex.Raw | Promise<Knex.Raw>{
    //     return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(repository,
    //         `(${args.map(arg => `${resolver(arg).toString()}`).join(' OR ')})`
    //     ))
    // }
    
    toScalar(resolver: ExpressionResolver<Props, PropMap>): Scalar<BooleanType>{
        // const p = this.toRaw(repository, resolver)
        // return thenResult(p, r => makeScalar(repository, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())
        return new Scalar(new BooleanType(), (repository): Knex.Raw | Promise<Knex.Raw> => {
            return thenResultArray(this.args, (args: Array<Expression<Props, PropMap> >) => raw(repository,
                args.map(arg => {
                    return thenResult(resolver(arg), resolved => `${ resolved.toRaw(repository)}`)
                }).join(' OR ')
            ))
        })
    }
}

export class NotOperator<Props, PropMap> extends ConditionOperator<Props, PropMap>{
    arg: Expression<Props, PropMap>
    constructor(arg: Expression<Props, PropMap> ){
        super()
        this.arg = arg
    }

    // toRaw(repository: EntityRepository<any>, resolver: ExpressionResolver<Props, PropMap>): Knex.Raw | Promise<Knex.Raw>{
    //     return thenResult(this.arg, arg => raw(repository, `NOT (${resolver(arg).toString()})`) )
    //     // return raw( `NOT (${resolver(this.arg).toString()})`)
    // }
    
    toScalar(resolver: ExpressionResolver<Props, PropMap>): Scalar<BooleanType> {
        // const p = this.toRaw(repository, resolver)
        // return thenResult(p, r => new Scalar(repository, r, new BooleanType()))
        // return makeScalar(p, new BooleanType())

        return new Scalar(new BooleanType(), (repository): Knex.Raw | Promise<Knex.Raw> => {
            return thenResult(resolver(this.arg), scalar => raw(repository, 
                `NOT (${scalar.toRaw(repository)})`) 
            )
        })
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

    // toRaw(repository: EntityRepository<any>): Knex.Raw | Promise<Knex.Raw>{
    //     // return  raw( `${leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
    //     return thenResultArray(this.rightOperands, rightOperands => raw(repository, `${this.leftOperand} IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResultArray(this.rightOperands.map(s => s.toRaw(repository) ), rights => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} IN (${rights.map(o => '?')})`, [...rights])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
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

    // toRaw(repository: EntityRepository<any>, leftOperand: Scalar){
    //     return  raw(repository, `${leftOperand} NOT IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
    //     // return thenResultArray(this.rightOperands, rightOperands => raw( `${leftOperand} NOT IN (${rightOperands.map(o => '?')})`, [...rightOperands]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResultArray(this.rightOperands.map(s => s.toRaw(repository) ), rights => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} NOT IN (${rights.map(o => '?')})`, [...rights])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
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

    // toRaw(repository: EntityRepository<any>, leftOperand: Scalar<any>){
    //     return raw(repository, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResult(this.rightOperand.toRaw(repository), right => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} LIKE ?`, [right])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
    }
    
    // toScalar(): Scalar<BooleanType>{
    //     return new Scalar(new BooleanType(), (repository) => {
    //         return raw(repository, `${this.leftOperand} LIKE ?`, [this.rightOperand])
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

    // toRaw(repository: EntityRepository<any>, leftOperand: Scalar<any>){
    //     return raw(repository, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResult(this.rightOperand.toRaw(repository), right => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} NOT LIKE ?`, [right])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
    }
    
    // toScalar(): Scalar<BooleanType>{
    //     return new Scalar(new BooleanType(), (repository) => {
    //         return raw(repository, `${this.leftOperand} NOT LIKE ?`, [this.rightOperand])
    //     })
    // }
}

export class EqualOperator extends AssertionOperator{
    rightOperand: Scalar<any>
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, rightOperand: Scalar<any>){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(repository: EntityRepository<any>, leftOperand: Scalar<any>){
    //     return raw(repository, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResult(this.rightOperand.toRaw(repository), right => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} = ?`, [right])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
    }
}

export class NotEqualOperator extends AssertionOperator {
    rightOperand: Scalar<any>
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>, rightOperand: Scalar<any>){
        super()
        this.rightOperand = rightOperand
        this.leftOperand = leftOperand
    }

    // toRaw(repository: EntityRepository<any>, leftOperand: Scalar<any>){
    //     return raw(repository, `${leftOperand} LIKE ?`, [this.rightOperand])
    //     // return thenResult(this.rightOperand, rightOperand => raw( `${leftOperand} LIKE ?`, [rightOperand]) )
    // }

    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {

            return thenResult(this.rightOperand.toRaw(repository), right => {

                return thenResult(this.leftOperand.toRaw(repository), left => {

                    return raw(repository, `${left} <> ?`, [right])

                })

            })
            // return raw(repository, `${this.leftOperand} IN (${this.rightOperands.map(o => '?')})`, [...this.rightOperands])
        })
    }
}

export class IsNullOperator extends AssertionOperator {
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>){
        super()
        this.leftOperand = leftOperand
    }
    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {
            return thenResult(this.leftOperand.toRaw(repository), left => {
                return raw(repository, `${left} IS NULL`)
            })
        })
    }
}

export class IsNotNullOperator extends AssertionOperator {
    leftOperand: Scalar<any>

    constructor(leftOperand: Scalar<any>){
        super()
        this.leftOperand = leftOperand
    }
    toScalar(): Scalar<BooleanType>{

        return new Scalar(new BooleanType(), (repository) => {
            return thenResult(this.leftOperand.toRaw(repository), left => {
                return raw(repository, `${left} IS NOT NULL`)
            })
        })
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
