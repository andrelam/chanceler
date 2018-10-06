var config = require('./setup');

const winston = require("winston");

var level = process.env.LOG_LEVEL || config.logging.level || 'debug';

var logger = new winston.Logger({
	transports: [
		new winston.transports.Console({
			level: level,
			timestamp: function () {
				return (new Date()).toISOString();
			}
		})
	]
});

module.exports = logger;
