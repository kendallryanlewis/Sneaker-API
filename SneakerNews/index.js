const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
const app = express()

const url = 'https://www.nike.com/launch?s=upcoming'
const PORT = process.env.PORT || 8081;
server.setTimeout(500000); // In milliseconds

app.get('/', (req, res) => {
    const releases = []
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
})

app.listen(PORT, () => {
    console.log(`App is listening at http://localhost:${PORT}`)
})