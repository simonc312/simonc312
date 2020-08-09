require('dotenv').config();
const moment = require('moment');
const Mustache = require('mustache');
const fetch = require('node-fetch');

const fs = require('fs');
const util = require('util');

const MUSTACHE_MAIN_DIR = './main.mustache';

const FLICKR_API_KEY = process.env.FLICKR_API_KEY;
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
  photoStream: [{},{},{}] //default
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

/* async function setWeatherInformation() {
  await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=stockholm&appid=${process.env.OPEN_WEATHER_MAP_KEY}&units=metric`
  )
    .then(r => r.json())
    .then(r => {
      DATA.city_temperature = Math.round(r.main.temp);
      DATA.city_weather = r.weather[0].description;
      DATA.city_weather_icon = r.weather[0].icon;
      DATA.sun_rise = new Date(r.sys.sunrise * 1000).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Stockholm',
      });
      DATA.sun_set = new Date(r.sys.sunset * 1000).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Stockholm',
      });
    });
} */

async function generateReadMe() {
  await fs.readFile(MUSTACHE_MAIN_DIR, (err, data) => {
    if (err) throw err;
    const debuglog = util.debuglog('mustache');
    debuglog('generateReadme() DATA: ', DATA);
    const output = Mustache.render(data.toString(), DATA);
    fs.writeFileSync('README.md', output);
  });
}

async function main() {
  await setPhotoStream();
  await generateReadMe();

}

main();
