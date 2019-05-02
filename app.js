const express = require('express');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const Twit = require('twit');
const keys = require('./config/keys');

const client = new MongoClient(keys.mongoURI, { useNewUrlParser: true });
client.connect(err => {

  client.close();
})

const T = new Twit({
  consumer_key:         keys.consumer_key,
  consumer_secret:      keys.consumer_secret,
  access_token:         keys.access_token,
  access_token_secret:  keys.access_token_secret,
})

const app = express();

app.use(express.static('static'));

app.get('/', function(req, res) {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/us', function(req, res) {
    res.sendFile('/static/us.json', { root: __dirname });
});
//Trends Function
app.get('/get_cities', function(req, res) {
    T.get('trends/available', function (err, data, response) {
        var trends = data;
        var cities = [];
        for (var i = 0; i < trends.length - 1; i++) {
            var trend = trends[i];

            //console.log(trend['country']);
            if (trend["country"] == "United States") {
                var place = trend["placeType"];
                if (place["name"] == "Town") {
                    cities.push({ "name": trend["name"], "woeid": trend["woeid"] });
                }
            }
        }
        var cityData = JSON.stringify(cities);
        fs.writeFile('cities.json', cityData, function(err) {
            console.log("Written Cities!");
        });
        res.send(trends);
    })
    
   /* 
    T.get('trends/place', { id: '2487956' }, function (err, data, response) {
        res.send(data);
    })*/
});

app.get('/get_coordinates', function(req, res) {
    var d = fs.readFileSync('cities.json');
    var cities = JSON.parse(d);
    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        T.get('geo/search', { query: city["name"], granularity: "city", max_results: "1" }, function (err, data, response) {
            if (err) {
                console.log("Hit the limit, probably");
            }
            else {
                var obj = result.places[0];
                city["centroid"] = obj["centroid"];
                cities[i] = city;
            }
        })
    }
    var cityData = JSON.stringify(cities);
    fs.writeFile('cities_coordinates.json', cityData, function(err) {
        console.log("Wrote to the new file!");
    });
    res.send(cities);
});

        //console.log(data.result['places']);
const PORT = process.env.PORT || 5000;
app.listen(PORT);

