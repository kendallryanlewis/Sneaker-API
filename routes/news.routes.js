const PORT = process.env.PORT || 8001
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
const app = express()
const SneaksAPI = require('../controllers/sneaks.controllers.js');

const sneaks = new SneaksAPI();
module.exports = (app) => {
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.get('/snkrs/releases', (req, res) => {
        const releases = []
        const url = 'https://www.nike.com/launch?s=upcoming'
        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)
                $('.product-card', html).each(function() {
                    const title = [$(this).find('.headline-5').text(), $(this).find('.headline-3').text()]
                    const realeaseDate = [$(this).find('.headline-4').text(), $(this).find('.headline-1').text()]
                    const image = $(this).find('img').attr('src')
                    const url = $(this).find('a').attr('href')
                    releases.push({
                        title,
                        realeaseDate,
                        image,
                        url
                    })
                })
                res.send(releases)
            }).catch(err => console.log(err))
    });
    app.get('/solecollector/featured', (req, res) => {
        const releases2 = []
        const url = 'https://solecollector.com/'
        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)
                $('.clg-news__item--big', html).each(function() {
                    const title = $(this).find('.clg-item__title').text()
                    const image = $(this).find('a').find('img').attr('src')
                    const url = "https://solecollector.com" + $(this).find('a').attr('href')
                    releases2.push({
                        title,
                        image,
                        url
                    })
                })
                $('.clg-item--16x9', html).each(function() {
                    const title = $(this).find('.clg-item__title').text()
                    const image = $(this).find('a').find('img').attr('src')
                    const url = $(this).find('a').attr('href')
                    releases2.push({
                        title,
                        image,
                        url
                    })
                })
                res.send(releases2)
            }).catch(err => console.log(err))
    });
    app.get('/sneakernews/popular', (req, res) => {
        const releases3 = []
        const url = 'https://sneakernews.com/'
        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)
                $('.single_popular_posts', html).each(function() {
                    const title = $(this).find('.post-title').text()
                    const image = $(this).find('a').find('img').attr('src')
                    const url = $(this).find('a').attr('href')

                    releases3.push({
                        title,
                        image,
                        url
                    })
                })
                res.send(releases3)
            }).catch(err => console.log(err))
    });
    app.get('/sneakernews/latest-news', (req, res) => {
        const releases3 = []
        const url = 'https://sneakernews.com/'
        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)
                $('.post-box', html).each(function() {
                    const title = $(this).find('.post-content').find('h4').find('a').text().trim()
                    const image = $(this).find('a').find('img').attr('src')
                    const url = $(this).find('a').attr('href')

                    releases3.push({
                        title,
                        image,
                        url
                    })
                })
                res.send(releases3)
            }).catch(err => console.log(err))
    });
    app.get('/kicksonfire', (req, res) => {
        const releases3 = []
        const base_url = 'https://www.kicksonfire.com/'
        for (let index = 1; index < 3; index++) {
            const url = base_url + index
            axios(url)
                .then(response => {
                    const html = response.data
                    const $ = cheerio.load(html)
                    res.send(url)
                    res.send(html)
                    $('.td-block-span4', html).each(function() {
                        const title = $(this).find('.entry-title').find('a').text().trim()
                        const image = $(this).find('.td-module-thumb').find('img').attr('src')
                        const url = $(this).find('.td-module-thumb').find('a').attr('href')
                        const date = $(this).find('time').text().trim()

                        releases3.push({
                            title,
                            image,
                            url,
                            date
                        })
                    })
                }).catch(err => console.log(err))
        }
        res.send(releases3)
    });
    app.get('/release-dates', (req, res) => {
        const releases3 = []
        const url = 'https://www.nicekicks.com/sneaker-release-dates/?nk=upcoming'
        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)

                $('.post-summary', html).each(function() {
                    const title = $(this).find('.post-summary__title').find('a').text()
                    const image = $(this).find('.post-summary__image').find('img').attr('src')
                    const url = $(this).find('.post-summary__image').find('a').attr('href')
                    const mdate = $(this).find('.rdate__m').text().trim()
                    const ddate = $(this).find('.rdate__d').text().trim()
                    const details = $(this).find('.block-release-info').find('p').text()

                    releases3.push({
                        title,
                        image,
                        url,
                        mdate,
                        ddate,
                        details
                    })
                })
                res.send(releases3)
            }).catch(err => console.log(err))
    });
}