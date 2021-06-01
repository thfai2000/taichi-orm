process.env.ENVIRONMENT = JSON.stringify({
  client: 'pg',
  connection: {
      host : '127.0.0.1',
      user : 'example',
      password : 'example',
      database : 'example',
      port: 5432
  },
  searchPath: ['knex', 'public'],
})