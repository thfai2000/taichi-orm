require('sqlite3');
const Knex = require('knex');

const knexSqlite = Knex({
  client: 'sqlite',
  connection: ':memory:',
});


(async function run() {
  await knexSqlite.schema.createTable('test', (t) => {
    t.increments('id').primary();
    t.string('data');
  });

  await knexSqlite('test').insert([{ data: 'foo' }, { data: 'bar' }]);

  console.log('test table data:', await knexSqlite('test'));

})();
