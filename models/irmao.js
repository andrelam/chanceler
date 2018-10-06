// models/brother.js
// load the things we need
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var logger   = require('../config/logger');

var brotherSchema = mongoose.Schema( {
	userId    : { type: Schema.Types.ObjectId, ref: 'User' },
	
	loginDate : { type: Date, required: true },
	success   : Boolean
});


// create the model for Brother and expose it to our app
module.exports = mongoose.model('Brother', brotherSchema);
