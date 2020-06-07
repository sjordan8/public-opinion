const express = require('express');
const fs = require('fs');
const path = require('path');
const language = require('@google-cloud/language');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Twit = require('twit');
require('dotenv').config();


const City = require('./models/city');
const Tweet = require('./models/tweet');

function connectToDbWithLog() {
    // Example URL for localhost: (mongodb://localhost/opinion)
    const mongoURL = process.env.MONGODB_URL || 'mongodb://localhost';
    mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });

    const db = mongoose.connection;
    db.once('open', () => {
        console.log('Server connected to mongoDB');
    });
    db.on('error', (err) => {
        console.error(err);
    });
};

function newAppWithMiddleware() {
    const app = express();
    app.use(express.static('static'));

    // Pug middleware
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');

    // Body Parse Middleware
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    return app;
};

function newGoogleApi() {
    return new language.LanguageServiceClient();
};

function newTwitApi() {
    return new Twit({
        consumer_key:         process.env.CONSUMER_KEY,
        consumer_secret:      process.env.CONSUMER_SECRET,
        access_token:         process.env.ACCESS_TOKEN,
        access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
    });
};

async function getAllCities() {
    return await City.find();
};

function isTrendInUnitedStates(trend) {
    return trend.country == "United States" && trend.placeType.name == "Town";
};

async function createNewCityInDb(citiesAdded, trend) {
    const cities = await getCitiesByName(trend.name);

    if (cities.length === 0) {
        let city = new City();
        city.name = trend.name;
        city.woeid = trend.woeid;
        city.save();
        
        return citiesAdded + 1;
    }

    return citiesAdded;
};

async function getCitiesByName(cityName) {
    return await City.find({ name: cityName });
};

async function getCitiesWithNoCoordinates() {
    return await City.find({ centroid: [] });
};

async function setCityCoordinates(city) {
    await TwitApi.get('geo/search', { 
        query: city.name,
        granularity: "city",
        max_results: "1"
    }, (err, data, response) => {
        if (!err) {
            const locationObject = data.result.places[0]; 
            city.centroid = locationObject.centroid;
            city.save();

            return;
        }

        console.log(err);
        return;
    });
};

async function getCitiesByWoeid(id) {
    return await City.find({ woeid: id });
};

async function setCityTrends(city) {
    await TwitApi.get('trends/place', { id: city.woeid }, (err, data, response) => {
        if (!err) {
            const trendsContainer = data[0];
            city.trends = trendsContainer.trends;
            city.save();

            return; 
        }

        console.log(err);
        return;
    });
};



connectToDbWithLog();
const GoogleApi = newGoogleApi();
console.log("created new google API");
const TwitApi = newTwitApi();
console.log("created new twit API");
const app = newAppWithMiddleware();
console.log("created new app with middleware");



app.get('/', async (req, res) => {
    res.render('index', {
        cities: await getAllCities()
    });
});

app.get('/get_cities', (req, res) => {
    TwitApi.get('trends/available', async (err, trends, response) => {
        const trendsInUS = trends.filter(isTrendInUnitedStates);
        const numberOfCitiesAdded = await trendsInUS.reduce(createNewCityInDb, 0);
        console.log("Number of cities added: ", numberOfCitiesAdded);
        res.redirect('back');
        return;
    });
});

app.get('/get_coordinates', async (req, res) => {
    let cities = await getCitiesWithNoCoordinates();
    console.log("Number of cities with no coordinates: ", cities.length);
    cities.forEach(setCityCoordinates);
    res.redirect('back');
});

app.get('/get_trends/:woeid', async (req, res) => {
    const cities = await getCitiesByWoeid(req.params.woeid);
    await setCityTrends(cities[0]);
    res.redirect('back');
});

app.get('/get_tweets/:woeid/:query', (req, res) => {
    City.find({ woeid: req.params.woeid }, (err, cities) => {
        let city = cities[0];
        let latitude = city.centroid[1];
        let longitude = city.centroid[0];
        let r = "5mi";
        let geo = [ latitude, longitude, r ];
        TwitApi.get('search/tweets', { q: req.params.query, geocode: geo, count: "100" } , (err, data, response) => {
            if (err) {
                console.log(err);
            } else {
                let tweets = data.statuses;
                for (let i = 0; i < tweets.length; i++) {
                    let t = tweets[i];
                    Tweet.find({ id: t.id }, (err, tweets) => {
                        if (tweets.length == 0) {
                            let tweet = new Tweet();
                            tweet.created_at = t.created_at;
                            tweet.text = t.text;
                            tweet.id = t.id;
                            tweet.woeid = req.params.woeid;
                            tweet.trend = req.params.query;
                            tweet.save((err) => {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        }
                    });
                }
                console.log("Added around " + tweets.length + " tweets to the DB");
                res.redirect('back');
            }
        })     
    });

    return;
});

app.get('/analyze_tweets', (req, res) => {
    Tweet.find({ sentiment: null }, (err, tweets) => {
        for (let i = 0; i < tweets.length; i++) {
            let tweet = tweets[i];
            let text = tweet.text;
            const document = {
                content: text,
                type: 'PLAIN_TEXT',
                language: 'en',
            };
        
            // Detects the sentiment of the text
            GoogleApi.analyzeSentiment({document: document})
            .then(results => {
                const sentiment = results[0].documentSentiment;
                tweet.sentiment = sentiment.score; 
                tweet.save((err) => {
                    if (err) {
                        console.log(err);
                    }
                });
            })
            .catch(err => {
                console.error('ERROR:', err);
            });
        }
    });
    
    res.redirect('back');
    return;
});

app.get('/create_graph/:woeid/:query', (req,res) => {
    Tweet.find({ woeid: req.params.woeid, trend: req.params.query, sentiment: { $exists: true }  }, (err, tweets) => {
        let scores = [];
        for (let i = 0; i < tweets.length; i++) {
            let tweet = tweets[i];
            scores.push(tweet["sentiment"]);
        }
        console.log(scores);
        for (let i = 0; i < scores.length; i++) {
            let negative = 0;
            let positive = 0;
            let neutral = 0;

            if (scores[i] > 0.3)
                positive++;
            else if(scores[i] > -0.3)
                neutral++;
            else
                negative++;
        }
        res.redirect('back');
    });
    return;
});

app.get('/remove_duplicates', async (req, res) => {
    const allCities = await getAllCities() 
    allCities
    /*
    City.find({}, (err, cities) => {
        for (let i = 0; i < cities.length; i++) {
            if (i != cities.length - 1) {
                let cur = cities[i];
                let next = cities[i+1];
                if (cur["name"] == next["name"] ) {
                    City.deleteOne({ name: cur["name"] }, (err) => {
                        if (err)
                            console.log(err);
                    });
                }
            }
        }
    });
    */
    console.log('Deleted duplicates');
    res.redirect('back');
});

console.log("Now listening on port 5000");

const PORT = process.env.PORT || 5000;
app.listen(PORT);

