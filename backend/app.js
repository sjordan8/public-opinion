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

const connectToDbWithLog = () => {
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

const newAppWithMiddleware = () => {
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

const newGoogleApi = () => {
    return new language.LanguageServiceClient();
};

const newTwitApi = () => {
    return new Twit({
        consumer_key:         process.env.CONSUMER_KEY,
        consumer_secret:      process.env.CONSUMER_SECRET,
        access_token:         process.env.ACCESS_TOKEN,
        access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
    });
};

const getAllCities = async () => {
    return await City.find();
};

const isTrendInUnitedStates = (trend) => {
    return trend.country == "United States" && trend.placeType.name == "Town";
};

const createNewCities = async (arrayOfTrends) => {
    let citiesCreated = 0;

    for (let i = 0; i < arrayOfTrends.length; i++) {
        let success = await createNewCity(arrayOfTrends[i]);

        if (success) {
            citiesCreated++;
        }
    }

    return citiesCreated;
};

const createNewCity = async (trend) => {
    const cities = await getCitiesByName(trend.name);

    if (cities.length === 0) {
        const city = new City();
        city.name = trend.name;
        city.woeid = trend.woeid;
        city.save();
        
        return true;
    }

    return false;
};

const getCitiesByName = async (cityName) => {
    return await City.find({ name: cityName });
};

const getCitiesWithNoCoordinates = async () => {
    return await City.find({ centroid: [] });
};

const setCityCoordinates = (city) => {
    TwitApi.get('geo/search', { 
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

const getCitiesByWoeid = async (id) => {
    return await City.find({ woeid: id });
};

const createGeocode = (city) => {
    const latitude = city.centroid[1];
    const longitude = city.centroid[0];
    const radius = "5mi";
    return [ latitude, longitude, radius ];
};

const createTweets = async (tweets, woeid, trend) => {
    let tweetsCreated = 0;
    let success;

    for (let i = 0; i < tweets.length; i++) {
        success = await createTweet(tweets[i], woeid, trend);

        if (success)
            tweetsCreated++;
    }

    return tweetsCreated;
};

const createTweet = async (tweet, woeid, trend) => {
    const tweetsWithSameId = await getTweetsById(tweet.id);

    if (tweetsWithSameId.length == 0) {
        const currentTweet = new Tweet();
        currentTweet.created_at = tweet.created_at;
        currentTweet.text = tweet.text;
        currentTweet.id = tweet.id;
        currentTweet.woeid = woeid;
        currentTweet.trend = trend;
        currentTweet.save();

        return true;
    }

    return false;
};

const getTweetsById = async (tweetId) => {
    return await Tweet.find({ id: tweetId });
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
        const citiesCreated = await createNewCities(trendsInUS);
        console.log("Number of cities added: ", citiesCreated);
        res.redirect('back');
        return;
    });
});

app.get('/get_coordinates', async (req, res) => {
    const cities = await getCitiesWithNoCoordinates();
    console.log("Number of cities with no coordinates: ", cities.length);
    cities.forEach(setCityCoordinates);
    res.redirect('back');
});

app.get('/get_trends/:woeid', async (req, res) => {
    const [ city ] = await getCitiesByWoeid(req.params.woeid);

    TwitApi.get('trends/place', { id: city.woeid }, (err, data, response) => {
        if (!err) {
            const trendsContainer = data[0];
            city.trends = trendsContainer.trends;
            city.save();
            res.redirect('back');
            return; 
        }
        
        console.log(err);
        res.redirect('back');
    });
});

app.get('/get_tweets/:woeid/:query', async (req, res) => {
    const cities = await getCitiesByWoeid(req.params.woeid);
    const geocode = createGeocode(cities[0]);

    TwitApi.get('search/tweets', { q: req.params.query, geocode: geocode, count: "100" } , async (err, data, response) => {
        if (!err) {
            const tweets = data.statuses;
            const tweetsAdded = await createTweets(tweets, req.params.woeid, req.params.query);

            console.log("Added " + tweetsAdded.length + " tweets to the database");
            res.redirect('back');
            return;
        }

        console.log(err);
        res.redirect('back');
    })     
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
});

console.log("Now listening on port 5000");

const PORT = process.env.PORT || 5000;
app.listen(PORT);

