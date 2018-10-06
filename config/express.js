var path = require('path');
var express = require('express');
var session = require('express-session');
var csrf = require('csurf');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var morgan = require('morgan');
var ejs    = require('ejs');
var flash = require('connect-flash');
var pkg = require('../package.json');
var config = require('./setup');
var logger = require('./logger');
var favicon = require('serve-favicon');
var helmet = require('helmet');

const env   = process.env.NODE_ENV || 'development';

/**
 * Expose
 */

module.exports = function (app, passport) {

  app.use(helmet());

  // Compression middleware (should be placed before express.static)
  app.use(compression({
    threshold: 512
  }));

  // Static files middleware
  app.use(express.static(path.join(__dirname, '/../public'))); //Expose /public

  app.use(favicon(path.join(__dirname, '/../public', 'favicon.ico')));
  
  // Use winston on production
  var log = config.logging.format || 'dev';

  // Don't log during tests
  // Logging middleware
  app.use(morgan(log, {
    skip: function (req, res) {
        return res.statusCode < 400
    }, stream: process.stderr
  }));

  app.use(morgan(log, {
    skip: function (req, res) {
        return res.statusCode >= 400
    }, stream: process.stdout
  }));

  // set views path, template engine and default layout
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '/../views'));

  // expose package.json to views
  app.use(function (req, res, next) {
    res.locals.pkg = pkg;
    res.locals.env = env;
    next();
  });

  // bodyParser should be above methodOverride
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      var method = req.body._method;
      delete req.body._method;
      return method;
    }
  }));

  // CookieParser should be above session
  app.use(cookieParser());
  app.use(cookieSession({ secret: config.secret }));
  app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: config.secret,
    name: 'sessionId',
	cookie: { httpOnly: true,
              secure: true }
  }));

  app.use(csrf());

  app.use(function(req, res, next) {
	  res.cookie("XSRF-TOKEN", req.csrfToken());
	  return next();
  });

  // error handler
  app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN')
		return next(err);

	logger.error('CSRF attempt detected: ' + err);
    // handle CSRF token errors here
    res.status(403);
	logger.warn('Returning HTTP 403 and redirecting to home page');
	req.logout();
	res.redirect('/');
  });

  // connect flash for flash messages - should be declared after sessions
  app.use(flash());

};
