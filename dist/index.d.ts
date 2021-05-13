export class Entity {
    static get schema(): any;
    static get tableName(): any;
    static belongsTo(entityClass: any, propName: any): any;
    static hasMany(entityClass: any, propName: any): void;
    static produceNameMap(): any;
    static get(func: any): Promise<any>;
    static getOne(): void;
    static Array(): void;
}
export namespace More {
    const Null: string;
    const NotNull: string;
}
export class Schema {
    constructor(entityName: any);
    entityName: any;
    tableName: any;
    primaryKey: {
        name: string;
        defination: string[][];
        computed: boolean;
    };
    fields: {
        name: string;
        defination: string[][];
        computed: boolean;
    }[];
    createTableStmt(): string;
    prop(name: any, defination: any, options: any): void;
    computedProp(name: any, defination: any, options: any): void;
}
export namespace Types {
    const AutoIncrement: string[];
    function String(length: any, nullable: any): string[];
    const Number: string[];
    const Date: string[];
    function arrayOf(entity: any): void;
}
export function configure(newConfig: any): Promise<any>;
export function select(...args: any[]): any;
