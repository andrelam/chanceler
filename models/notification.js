// models/notification.js
// load the things we need
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var logger   = require('../config/logger');

var notificationSchema = mongoose.Schema( {
	userId      : { type: Schema.Types.ObjectId, ref: 'User', required: true },
	messageDate : { type: Date, required: true },
	messageText : { type: String, required: true },
	read        : { type: Boolean },
	replied     : { type: Boolean },
	reply       : { type: String, required: false },
	repliedBy   : { type: Schema.Types.ObjectId, ref: 'User', required: false }
});

notificationSchema.methods.newNotification = function(user, text) {
	this.userId      = user._id;
	this.messageDate = Date.now();
	this.messageText = text;
	this.read        = false;
	this.replied     = false;
	this.save(function(err) {
		if (err)
			logger.error('NNN-Error while saving Notification from user ' + user.email);
	});
	return;
};

notificationSchema.methods.replyNotification = function(user, text) {
	this.replied     = true;
	this.reply       = text;
	this.repliedBy   = user._id,
	this.save(function(err) {
		if (err)
			logger.error('NRN-Error while saving reply for Notification from user ' + user.email);
	});
	return;
};


 notificationSchema.statics.countNotifications = function() {
	this.count({ replied: false }, function(err, conta) {
		if (err)
			return (0);
		return (conta);
	});
};

// create the model for Notification and expose it to our app
module.exports = mongoose.model('Notification', notificationSchema);
