/*!
 * chanceler
 * Copyright(c) 2016 Andre Luis Arantes Monteiro <dev@andrelam.com.com>
 * MIT Licensed
 */
/**
 * Module dependencies
 */

var fs = require('fs');
var express = require('express');
var app = express();
var mongoose = require('mongoose');
var passport = require('passport');
var config = require('./config/setup.js');
var logger = require('./config/logger');

var port = process.env.PORT || 2000;

// configuration ===============================================================
mongoose.Promise = global.Promise;
mongoose.connect(config.dbUrl)
.then(() => {
	logger.info('MongoDB connected');
}).catch((err) => {
	logger.error('MongoDB could not connect: ' + err);
}); // connect to our database

var db = mongoose.connection;

const connectWithRetry = () => {
	logger.info('MongoDB connection with retry');
	return mongoose.connect(config.dbUrl);
};

db.on('error', err => {
	logger.error('MongoDB could not connect: ' + err);
	setTimeout(connectWithRetry, 1000);
});

db.on('connected', () => {
	logger.info('MongoDB connected');
});

// Bootstrap application settings
require('./config/express')(app);

require('./config/passport')(passport); // pass passport for configuration

// required for passport
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// routes ======================================================================
require('./config/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

app.listen(port);
logger.info('Express app started on port ' + port);

/**
 * Expose
 */

module.exports = app;
