// models/loginHistory.js
// load the things we need
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var logger   = require('../config/logger');

var loginhistorySchema = mongoose.Schema( {
	userId    : { type: Schema.Types.ObjectId, ref: 'User' },
	loginDate : { type: Date, required: true },
	success   : Boolean
});

loginhistorySchema.methods.newLogin = function(user, success) {
	this.userId    = user._id;
	this.loginDate = Date.now();
	this.success   = success;
	this.save(function(err) {
		if (err) {
			logger.error('LHN-Error while saving Login History for user ' + user.email);
		}
	});
	return;
};


// create the model for LoginHistory and expose it to our app
module.exports = mongoose.model('LoginHistory', loginhistorySchema);
