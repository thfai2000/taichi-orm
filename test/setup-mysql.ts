process.env.ENVIRONMENT = JSON.stringify({
  client: 'mysql2',
  connection: {
      host : '127.0.0.1',
      user : 'example',
      password : 'example',
      database : 'example',
      port: 3306
  }
})