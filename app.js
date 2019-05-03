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

app.get('/', function(req, res) {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/us', function(req, res) {
    res.sendFile('/static/us.json', { root: __dirname });
});
//Trends Function
app.get('/get_cities', function(req, res) {
    T.get('trends/available', function (err, data, response)
    {
        let trends = data;
        let cities = [];
        for (let i = 0; i < trends.length - 1; i++)
        {
            let trend = trends[i];
            if (trend["country"] == "United States")
            {
                let place = trend["placeType"];
                if (place["name"] == "Town")
                {
                    cities.push({ "name": trend["name"], "woeid": trend["woeid"] });
                }
            }
        }
        let cityData = JSON.stringify(cities);
        fs.writeFile('cities.json', cityData, function(err)
        {
            console.log("Written Cities!");
        });
        res.send(trends);
    })

});

app.get('/get_coordinates', function(req, res) {

    let d = fs.readFileSync('cities.json');
    let cities = JSON.parse(d);

    for (let i = 0; i < cities.length; i++)
    {
        let city = cities[i];
        if(!city.hasOwnProperty("centroid"))
        {
            T.get('geo/search', { query: city["name"], granularity: "city", max_results: "1" }, function (err, data, response)
            {
                if (err)
                    console.log(err);
                else
                {
                    let obj = data.result.places[0];
                    city["centroid"] = obj["centroid"];
                    console.log(city["centroid"]);
                    cities[i] = city;
                    console.log(cities[i]);
                    let cityData = JSON.stringify(cities);
                    fs.writeFile('cities.json', cityData, function(err)
                    {
                        console.log("Wrote city");
                    });
                }
            })
        }
    }
    res.send("Filling cities");
});
// Testing for San Francisco
app.get('/get_trends_for_city', function(req, res) {
    let topTen = [];

    T.get('trends/place', { id: '2487956' }, function (err, data, response)
    {
        let obj = data[0];
        let trends = obj["trends"];

        for (let i = 0; i < 10; i++)
        {
            let trend = trends[i];
            topTen.push(trend);
        }
        console.log(topTen);
        res.send(topTen);
    })
});

app.get('/get_tweets_for_trend', function(req, res) {

    T.get('tweets/search', { q: "%23Putin" } , function (err, data, response)
    {
        res.send(data);
    })
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);

