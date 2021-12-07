# PropertyType

There are various kinds of PropertyType that represent different SQL data-type
| Class Name        | Description           | FieldProperty applicable? | ComputeProperty applicable? | Options
| :------------- |:-------------|:-----------|:-----------|:-----------|
| PrimaryKeyType         | Primary Key with Auto Increment | Yes | No | |
| NumberType             | Nullable Integer     | Yes | Yes|{default?: number }|
| NumberNotNullType      | Non-nullable Integer | Yes | Yes|{default?: number }|
| DecimalType             | Nullable Decimal     | Yes | Yes|{ default?: number, precision?: number, scale?: number }|
| DecimalNotNullType      | Non-nullable Decimal | Yes | Yes|{ default?: number, precision?: number, scale?: number }|
| BooleanType             | Nullable Boolean     | Yes | Yes|{default?: boolean }|
| BooleanNotNullType      | Non-nullable Boolean | Yes | Yes|{default?: boolean }|
| StringType             | Nullable Varchar     | Yes | Yes|{default?: string, length?: number }|
| StringNotNullType      | Non-nullable Varchar | Yes | Yes|{default?: string, length?: number }|   
| DateType             | Nullable Date     | Yes | Yes|{ default?: Date }|
| DateNotNullType      | Non-nullable Date | Yes | Yes|{ default?: Date }|
| DateTimeType             | Nullable Datetime     | Yes | Yes|{default?: Date, precision?: number }|
| DateTimeNotNullType      | Non-nullable Datetime | Yes | Yes|{default?: Date, precision?: number }|
| ObjectType      | Nullable Object | No | Yes| n/a|
| ArrayType      | Nullable Array of Object | No | Yes| n/a|

## Usage

Define a data-type for a `FieldProperty`

Example:
```js
class MyModel extends Model {
    //define a non-nullable varchar type data
    prop1 = this.field(StringNotNullType)

    //define a non-nullable varchar type data
    // with max length 50
    prop2 = this.field(new StringNotNullType({length: 50}) )
}
```

Define a data-type for a `Scalar`

Example:
```js
// make a SQL value with type NumberNotNullType
const scalar = context.scalar('5 + 10 + ?', [15], NumberNotNullType)
```