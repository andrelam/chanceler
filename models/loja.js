// models/user.js
// load the things we need
var mongoose = require('mongoose');

var config     = require('../config/setup.js');

var lojaSchema = mongoose.Schema( {
	nome       : { type: String, required: true, unique: true },
	numero     : String,
	simbolica  : { type: Boolean, default: true },
	filosofica : { type: Boolean, default: false }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Loja', lojaSchema);
