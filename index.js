const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const keys = require('./config/keys');

const client = new MongoClient(keys.mongoURI, { useNewUrlParser: true });
client.connect(err => {

  client.close();
})

const app = express();

require('./routes/routes')(app);

const PORT = process.env.PORT || 5000;
app.listen(PORT);
