# Getting Started



## Simple Example

First, you have to declare your Models. 
Here we declare a simple `FieldProperty` 'id' and a `ComputeProperty` 'products'.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{1-12} js{4-5}](./getting-started-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{1-12} ts{4-5}](./getting-started-example1.ts)

  </CodeGroupItem>
</CodeGroup>

::: tip
You can declare one Model in one single file and import them when you use them.
:::


Second, we configure our ORM by registering Models and setup sql connection.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{17-27} js](./getting-started-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{17-27} ts](./getting-started-example1.ts)

  </CodeGroupItem>
</CodeGroup>


Then, you can use the Model API for data insertion and query.
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code{29-44} js{9,15}](./getting-started-example1.js)

  </CodeGroupItem>
  <CodeGroupItem title="TS">

@[code{29-44} ts{9,15}](./getting-started-example1.ts)

  </CodeGroupItem>
</CodeGroup>



Full Code Here
<CodeGroup>
  <CodeGroupItem title="JS" active>

@[code js](./getting-started-example1.js)

  </CodeGroupItem>

  <CodeGroupItem title="TS">

@[code ts](./getting-started-example1.ts)

  </CodeGroupItem>
</CodeGroup>