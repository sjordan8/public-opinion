const express = require('express');
const fs = require('fs');
const path = require('path');
const language = require('@google-cloud/language');
const mongoose = require('mongoose');
const Twit = require('twit');
const keys = require('./config/keys');

let City = require('./models/city');

mongoose.connect('mongodb://localhost/opinion');

let db = mongoose.connection;

db.once('open', function() {
    console.log('Server connected to mongoDB');
});

db.on('error', function(err) {
    console.log(err);
});

const T = new Twit({
  consumer_key:         keys.consumer_key,
  consumer_secret:      keys.consumer_secret,
  access_token:         keys.access_token,
  access_token_secret:  keys.access_token_secret,
})

const app = express();

app.use(express.static('static'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get('/', function(req, res) {
    City.find({}, function(err, cities){
        if(err){
            console.log(err);
        } else {
            res.render('index', {
                cities: cities
            });
        }
    });
});

app.get('/us', function(req, res) {
    res.sendFile('/static/us.json', { root: __dirname });
});

//Trends Function
app.get('/get_cities', function(req, res) {
    T.get('trends/available', function (err, data, response)
    {
        let trends = data;
        let d = fs.readFileSync('cities.json');
        let cities = JSON.parse(d);
        for (let i = 0; i < trends.length - 1; i++)
        {
            let trend = trends[i];
            if (trend["country"] == "United States")
            {
                let place = trend["placeType"];
                if (place["name"] == "Town")
                {
                    let insert = true;
                    for (let j = 0; j < cities.length; j++)
                    {
                        let city = cities[j];
                        if (city["name"] == trend["name"])
                            insert = false;
                    }
                    if (insert)
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
    let d = fs.readFileSync('cities.json');
    let cities = JSON.parse(d);
    let city = cities[0];
    let topTen = [];
    let j;

    for (j = 0; j < cities.length; j++)
    {
        city = cities[j];
        if(city["woeid"] == "2487956")
            break;
    }

    if(city.hasOwnProperty("trends"))
        topTen = city["trends"];    

    T.get('trends/place', { id: "2487956" }, function (err, data, response)
    {
        let obj = data[0];
        let trends = obj["trends"];

        for (let i = 0; i < 10; i++)
        {
            let trend = trends[i];
            let insert = true;
            console.log(trend["name"]);
            for (let k = 0; k < topTen.length; k++)
            {
                let cur = topTen[k];
                if (trend["name"] == cur["name"])
                    insert = false;
            }
            if (insert)
                topTen.push(trend);
        }
        console.log(topTen);
        city["trends"] = topTen;
        cities[j] = city;
        let cityData = JSON.stringify(cities);
        fs.writeFile('cities.json', cityData, function(err)
        {
            console.log("Wrote city with topTen trends");
        });
        console.log(cities[j]);
        res.send(topTen);

    })
});

app.get('/get_tweets_for_trend', function(req, res) {

    T.get('search/tweets', { q: "%23Putin" } , function (err, data, response)
    {
        res.send(data);
    })
});

app.get('/analyze_tweet', function(req, res) {
    // Creates a client
    const client = new language.LanguageServiceClient();

    const text = 'Your text to analyze, e.g. Hello, world!';

    // Prepares a document, representing the provided text
    const document = {
        content: text,
        type: 'PLAIN_TEXT',
    };

    // Detects entities in the document
    // const [result] = await client.analyzeEntities({document});
    const [result] = client.analyzeEntities({document});

    const entities = result.entities;

    console.log('Entities:');
    entities.forEach(entity => {
        console.log(entity.name);
        console.log(` - Type: ${entity.type}, Salience: ${entity.salience}`);
        if (entity.metadata && entity.metadata.wikipedia_url) {
            console.log(` - Wikipedia URL: ${entity.metadata.wikipedia_url}$`);
        }
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);

