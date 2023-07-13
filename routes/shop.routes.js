const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 8001
const app = express()
const SneaksAPI = require('../controllers/sneaks.controllers.js');

const sneaks = new SneaksAPI();
module.exports = (app) => {
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    // Define the endpoint to retrieve sneaker stores in a city
    app.get('/stores/:city', async(req, res) => {
        try {
            const city = req.params.city;
            const releases = []
            const url = `https://www.yellowpages.com/search?search_terms=sneaker+stores&geo_location_terms=${city}`;

            axios(url)
                .then(response => {
                    const html = response.data
                    const $ = cheerio.load(html)
                    $('.v-card', html).each(function() {
                        const name = [$(this).find('.business-name').text().trim()]
                        const address = [$(this).find('.adr').text().trim()]
                        const phone = [$(this).find('.phones').text().trim()]
                        releases.push({
                            name,
                            address,
                            phone
                        })
                    })
                    res.send(releases)
                }).catch(err => console.log(err))


            /*
                const city = req.params.city;
                    const url = `https://www.yellowpages.com/search?search_terms=sneaker+stores&geo_location_terms=${city}`;

                    const response = await axios.get(url);
                    const $ = cheerio.load(response.data);


                    const stores = [];

                    $('.v-card').each((_, element) => {
                        const name = $(element).find('.business-name').text().trim();
                        const address = $(element).find('.adr').text().trim();
                        const phone = $(element).find('.phones').text().trim();

                        stores.push({ name, address, phone });
                    });

                    res.json(stores);
            */
        } catch (error) {
            res.status(500).json({ error: 'An error occurred while fetching stores.' });
            console.error(error);
        }
    });

}