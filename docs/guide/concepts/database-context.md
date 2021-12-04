# DatabaseContext

You can get your `DatabaseContext` from your `ORM` instance.

```js{4}
// Assume that the orm instance is defined in your 'orm.js'
const orm = require('./orm')

const context = orm.getContext()
```

It allow you to specific the 
```js
const context = orm.getContext({
    tablePrefix: 'store1_'
})
```

## Usage


### Get the `ModelRepository`

```js
const { ModelRepo1, ModelRepo2 } = context.models
```




## More Options

