const express = require('express');
const { connections } = require('mongoose');
const app = express();
const mongoose = require('mongoose');
const response = require('./utils/response');

// Load all routes first
require('./routes/sneaks.routes.js')(app);
require('./routes/news.routes.js')(app);
require('./routes/shop.routes.js')(app);

require('dotenv').config();
const SneaksAPI = require('./controllers/sneaks.controllers.js');

// 404 handler for undefined routes (must be after all route definitions)
app.use((req, res) => {
  return response.notFound(res, `Route ${req.path} not found`);
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return response.serverError(res, 'An unexpected error occurred', err.message);
});

var port = process.env.PORT || 8080;
mongoose.Promise = global.Promise;
/*Sneaker.deleteMany({ }, function (err) {
  if(err) console.log(err);
  console.log("Successful deletion");
});*/

// Connecting to the database
//mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sneakers');

app.listen(port, function () {
  console.log(`Sneaks app listening on port `, port);
});

module.exports = app;
module.exports = SneaksAPI;