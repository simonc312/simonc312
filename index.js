require('dotenv').config();
const moment = require('moment');
const Mustache = require('mustache');
const fetch = require('node-fetch');

const fs = require('fs');
const util = require('util');

const MUSTACHE_MAIN_DIR = './main.mustache';

const OPEN_WEATHER_API_KEY = process.env.OPEN_WEATHER_API_KEY;
const FLICKR_API_KEY = process.env.FLICKR_API_KEY;
if (FLICKR_API_KEY === undefined) throw Error("FLICKR_API_KEY env var required");
const FLICKR_BASE_URI = `https://www.flickr.com/services/rest/?format=json&nojsoncallback=1&api_key=${FLICKR_API_KEY}`;
const REFRESH_DATE = moment();

let DATA = {
  refresh_date: REFRESH_DATE.toDate().toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
    timeZone: 'America/Los_Angeles',
  }),
  photoStream: [{},{},{}], //default
  weather: {}
};

/*
https://www.flickr.com/services/api/flickr.photos.getSizes.html
*/
async function getPhotoUrls(photoId) {
   return await fetch(`${FLICKR_BASE_URI}&method=flickr.photos.getSizes&photo_id=${photoId}`)
    .then(r => r.json());;
}

/*
https://www.flickr.com/services/api/flickr.interestingness.getList.html
*/
async function setPhotoStream() {
    // no interesting photos available at start of current day
    const photoDate = REFRESH_DATE.subtract(1, 'day').format('YYYY-MM-DD');
    const pageSize = 3;
    const photoSize = 1; // 150x150 large square
    const debuglog = util.debuglog('flickr');
    const response = await fetch(
        `${FLICKR_BASE_URI}&method=flickr.interestingness.getList&date=${photoDate}&per_page=${pageSize}`,
    ).then(r => r.json());
    debuglog("setPhotoStream() response: ", response);
    if (response.stat == 'fail') throw new Error(response.message);
    const photoUrlResponses = await Promise.all(response.photos.photo.map((p)=> {
        debuglog("setPhotoStream() response photo: ", p);
        return getPhotoUrls(p.id);
    }));
    let photoStream = [];
    photoUrlResponses.forEach(p => {
        photoStream.push({
            source: p.sizes.size[photoSize].source,
            url:  p.sizes.size[photoSize].url,
        });
    });
    debuglog('setPhotoStream() photoStream: ', photoStream);
    DATA.photoStream = photoStream;
}

/*
https://openweathermap.org/weather-data
https://openweathermap.org/current
*/
async function setWeatherInformation() {
  const cityId = '5387428'; //Richmond, CA
  const weatherUnit = 'imperial';
  await fetch(
    `https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${OPEN_WEATHER_API_KEY}&units=${weatherUnit}`
  )
    .then(r => r.json())
    .then(r => {
      const debuglog = util.debuglog("openweather");
      debuglog("api response: ", r);
      let city = {};
      city.temp = `${Math.round(r.main.temp)}°F`;
      city.tempFeelsLike = `${Math.round(r.main.feels_like)}°F`;
      city.humidity = `${r.main.humidity}%`;
      city.windSpeed = `${r.wind.speed}mph`;
      city.description = r.weather[0].description;
      city.icon = r.weather[0].icon;
      city.sunRise = new Date(r.sys.sunrise * 1000).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      });
      city.sunSet = new Date(r.sys.sunset * 1000).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      });
      DATA.weather = city;
    });
}

async function generateReadMe() {
  const weatherPartial = fs.readFileSync('./weather.mustache');  
  const debuglog = util.debuglog('mustache');
  //debuglog('generateReadme() weatherPartial: ', weatherPartial.toString());
  await fs.readFile(MUSTACHE_MAIN_DIR, (err, template) => {
    if (err) throw err;
    debuglog('generateReadme() DATA: ', DATA);
    const partials = {
        weather: weatherPartial.toString()
    };
    //debuglog('generateReadme() template: ', template.toString())
    const output = Mustache.render(template.toString(), DATA, partials);
    fs.writeFileSync('README.md', output);
  });
}

async function main() {
  try {
    await setPhotoStream();
    await setWeatherInformation();
    await generateReadMe();
  } catch (err) {
    console.error(err);
  }
}

main();
