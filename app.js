const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const Twit = require('twit');
const keys = require('./config/keys');

const client = new MongoClient(keys.mongoURI, { useNewUrlParser: true });
client.connect(err => {

  client.close();
})

const T = new Twit({
  consumer_key:         keys.twitterAPIkey,
  consumer_secret:      keys.twitterAPIsecret,
  access_token:         keys.twitterAccessToken,
  access_token_secret:  keys.twitterAccessTokenSecret,
})

const app = express();

app.use(express.static('static'));

app.get('/', function(req, res) {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/us', function(req, res) {
    res.sendFile('/static/us.json', { root: __dirname });
});

app.get('/trends', function(req, res) {
    T.get('trends/place', { id: '2487956' }, function (err, data, response) {
        res.send(data);
    })
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
