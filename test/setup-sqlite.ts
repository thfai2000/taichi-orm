import { Knex } from "knex"

let connection: Knex.Sqlite3ConnectionConfig = {
  filename: ':memory:'
}

process.env.ENVIRONMENT = JSON.stringify({
  client: 'sqlite3',
  connection
})