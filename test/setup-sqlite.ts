import { Knex } from "knex"

// let connection: Knex.Sqlite3ConnectionConfig = {
//   filename: ':memory:'
// }

let connection: Knex.Sqlite3ConnectionConfig = {
  filename: "file:memDb1?mode=memory&cache=shared",
  flags: ['OPEN_URI', 'OPEN_SHAREDCACHE']
}

process.env.ENVIRONMENT = JSON.stringify({
  client: 'sqlite3',
  connection
})