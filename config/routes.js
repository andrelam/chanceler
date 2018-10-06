//Routes

var logic        = require('./logic');
var User         = require('../models/user');
var Notification = require('../models/notification');
var crypto       = require('crypto');
var logger       = require('./logger');
var { check, validationResult } = require('express-validator/check');
var { matchedData, sanitize } = require('express-validator/filter');

module.exports = function(app, passport) {

	app.all('/', function(req, res) {
		if (req.isAuthenticated()) {
		// if they aren't redirect them to the home page
			res.redirect('/relatorio');
		} else {
			res.render('index.ejs', { message: req.flash('validationMessage'), user: req.user });
		}
	});

	// =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/acessar', function(req, res) {
		// render the page and pass in any flash data if it exists
		var dados = { email: '' };
		res.render('login.ejs', { message: req.flash('loginMessage'), user: req.user, _csrf: req.csrfToken(), dados: dados, errors: [] }); 
    });

    // process the login form
	app.post('/acessar', [
		check('email').isEmail().withMessage('Informar um endereço de email válido').trim(),
		check('password').isLength({ min: 1 }).withMessage('Informar a senha')
	], (req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			var dados = { email: req.body.email.toLowerCase() };
			res.render('login.ejs', { message: req.flash('loginMessage'), user: req.user, _csrf: req.csrfToken(), dados: dados, errors: errors.array() });
			return;
		}
		check('email').normalizeEmail();
		passport.authenticate('local-login', {
			successRedirect : '/mapa',
			failureRedirect : '/acessar',
			failureFlash    : true })(req,res,next);
	});

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/registro', function(req, res) {
		var dados = { nome: '',
					  email: '',
					  data: '' };
        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', { message: req.flash('signupMessage'), _csrf: req.csrfToken(), dados: dados, errors: [] });
    });

	app.post('/registro', [
		check('nome').isLength({ min: 1 }).withMessage('Favor informar o seu nome').trim(),
		check('email').isEmail().withMessage('Favor informar um endereço de email válido').trim(),
		check('password').isLength({ min: 8 }).withMessage('A senha deve possuir pelo menos 8 caracteres'),
		check('cfm_pwd', 'A senha de confirmação deve ser igual à senha informada').exists().custom((value, { req }) => value === req.body.password),
		check('data', 'A data de nascimento deve ser uma data válida').custom((value) => logic.validateDate(value))
	], (req, res, next) => {

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			var dados = { nome: req.body.nome,
			              email: req.body.email.toLowerCase(),
						  data: req.body.data };
			res.render('signup.ejs', { message: req.flash('signupMessage'), _csrf: req.csrfToken(), dados: dados, errors: errors.array() });
			return;
		}
		check('email').normalizeEmail();
		passport.authenticate('local-signup', {
			successRedirect : '/', // redirect to the secure profile section
			failureRedirect : '/', // redirect back to the signup page if there is an error
			failureFlash : true })(req,res,next);
	});

	app.get('/esqueci', function(req, res) {
		res.render('forgot.ejs', { message: req.flash('forgotMessage'), _csrf: req.csrfToken(), errors: [], email: '' });
	});

	app.post('/esqueci', [
		check('email').isEmail().withMessage('Informar um endereço de email válido').trim()
	], (req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.render('forgot.ejs', { message: req.flash('forgotMessage'), _csrf: req.csrfToken(), errors: errors.array(), email: req.body.email });
			return;
		}
		check('email').normalizeEmail();
		User.findOne({ email: req.body.email }, function(err, user) {
			if (err) {
				logger.error('RPE-Error while searching user ' + req.body.email + ': ' + err);
				req.flash('forgotMessage', 'Erro interno ao buscar Email');
				return res.redirect('/esqueci');
			}
			if (!user) {
				logger.info('RPE-User not found: ' + req.body.email);
				req.flash('forgotMessage', 'Email não cadastrado');
				return res.redirect('/esqueci');
			}
			user.resetToken = randomValueBase64(32);
			user.resetValid = Date.now() + 3600000;
			user.save(function(err) {
				if (err) {
					logger.error('RPE-Error while saving user ' + user.email + ': ' + err);
					req.flash('forgotMessage', 'Erro interno ao definir novo token. Favor entrar em contato com ciclosdavida@coldfire.com.br');
					return res.redirect('/esqueci');
				}
				logger.info('RPE-Defined new reset token for user ' + user.email);
				user.sendMail(true);
				req.flash('forgotMessage', 'Um email de confirmação foi enviado para ' + user.email);
				return res.redirect('/esqueci');
			});
		});
    });
	
	app.get('/confirma/:token', function(req, res) {
		User.findOne({ resetToken: req.params.token }, function(err, user) {
			if (err) {
				logger.error('RGCT-Error while searching token ' + req.params.token + ': ' + err);
				req.flash('validationMessage', 'Erro ao localizar Token de validação. Favor entrar em contato com ciclosdavida@coldfire.com.br');
				return res.redirect('/');
			}
			if (!user) {
				logger.info('RGCT-Token not found: ' + req.params.token);
				req.flash('validationMessage', 'Token de validação inválido');
				return res.redirect('/');
			}
			if (user.validated) { // user was already validated. Password reset requested
				logger.verbose('RGCT-User ' + user.email + ' already validated. Forwarding to password reset form');
				if (user.resetValid < Date.now()) {
					logger.warn('RGCT-User ' + user.email + ' using expired token ' + user.resetToken);
					req.flash('validationMessage', 'Token para reset da senha expirado');
					return res.redirect('/');
				}
				res.render('reset.ejs', { message: req.flash('validationMessage'), token: user.resetToken, _csrf: req.csrfToken(), errors: [] });
			} else { // New user
				user.resetToken = undefined;
				user.resetValid = undefined;
				user.validated  = true;
				user.save(function(err) {
					if (err) {
						logger.error('RGCT-Error while validating ' + req.params.token + ' for user ' + user.email + ': ' + err);
						req.flash('validationMessage', 'Erro interno ao validar token. Favor entrar em contato com ciclosdavida@coldfire.com.br');
						return res.redirect('/');
					}
					logger.info('RGCT-Token ' + req.params.token + ' validated for user ' + user.email);
					req.flash('validationMessage', 'Token validado com sucesso. Prossiga com o seu Login');
					return res.redirect('/');
				});
			}
		});
	});

	app.post('/redefinir/:token', [
		check('password').isLength({ min: 8 }).withMessage('A senha deve possuir pelo menos 8 caracteres'),
		check('cfm_pwd', 'A senha de confirmação deve ser igual à senha informada').exists().custom((value, { req }) => value === req.body.password)
	], (req, res, next) => {

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.render('reset.ejs', { message: req.flash('validationMessage'), token: req.params.token, _csrf: req.csrfToken(), errors: errors.array() });
			return;
		} 
		User.findOne({ resetToken: req.params.token, resetValid: { $gt: Date.now() } }, function(err, user) {
			if (err) {
				logger.error('RPRT-Error while searching token ' + req.params.token + ': ' + err);
				req.flash('validationMessage', 'Token de redefinição de senha inválido ou expirado');
				return res.redirect('/');
			}
			if (!user) {
				logger.warn('RPRT-Token ' + req.params.token + ' within validity date not found');
				req.flash('validationMessage', 'Token de redefinição de senha inválido ou expirado');
				return res.redirect('/');
			}
			if (!user.validated) { // user was already validated. Password reset requested
				logger.verbose('RPRT-User ' + user.email + ' is not validated. Cannot reset password');
				req.flash('validationMessage', 'Reset da senha para novo usuário não permitido');
				return res.redirect('/');
			}
            user.password = user.generateHash(req.body.password);
			user.resetToken = undefined;
			user.resetValid = undefined;
			user.validated  = false;
			user.save(function(err) {
				if (err) {
					logger.error('RPRT-Error while saving user ' + user.email + ': ' + err);
					req.flash('validationMessage', 'Erro interno ao validar token. Favor entrar em contato com ciclosdavida@coldfire.com.br');
					return res.redirect('/');
				}
				user.sendMail(false);
				logger.info('RPR-Password reset for user ' + user.email);
				req.flash('validationMessage', 'Senha resetada. Um email de confirmação foi enviado.');
				return res.redirect('/');
			});
		});
	});

	app.get('/relatorio', isLoggedIn, function(req, res) {
		var data = req.user.dNasc.getUTCDate() + "/" + (req.user.dNasc.getUTCMonth()  + 1)+ "/" + req.user.dNasc.getUTCFullYear();
		if (req.user.superUser) {
			Notification.count({ replied: false }, function(err, conta) {
				if (err) {
					logger.error('RGM-Error while counting notifications: ' + err);
					res.render('relatorio.ejs', { message: req.flash('validationMessage'), data: logic.calcula(data, req.user.nome), user: req.user, notification: 0, _csrf: req.csrfToken(), errors: [] });
				} else {
					res.render('relatorio.ejs', { message: req.flash('validationMessage'), data: logic.calcula(data, req.user.nome), user: req.user, notification: conta, _csrf: req.csrfToken(), errors: [] });
				}
			});
		} else {
			res.render('relatorio.ejs', { message: req.flash('validationMessage'), data: logic.calcula(data, req.user.nome), user: req.user, notification: 0, _csrf: req.csrfToken(), errors: [] });
		}
	});

	app.post('/relatorio', isSuperAdmin, [
		check('nome').isLength({ min: 1 }).withMessage('Favor informar o nome').trim(),
		check('data', 'A data de nascimento deve ser uma data válida').custom((value) => logic.validateDate(value))
	], (req, res, next) => {
		const errors = validationResult(req);
		Notification.count({ replied: false }, function(err, conta) {
			var error = [];
			var data = req.body.data;
			var nome = req.body.nome;
			if (!errors.isEmpty()) {
				error = errors.array();
				data = req.user.dNasc.getUTCDate() + "/" + (req.user.dNasc.getUTCMonth()  + 1)+ "/" + req.user.dNasc.getUTCFullYear();
				nome = req.user.nome;
			};
			if (err) {
				logger.error('RGM-Error while counting notifications: ' + err);
				conta = 0;
			};
			res.render('ciclo.ejs', { message: req.flash('validationMessage'), data: logic.calcula(data, nome), user: req.user, notification: conta, _csrf: req.csrfToken(), errors: error });
		});
	});

	
    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/sair', function(req, res) {
        req.logout();
        res.redirect('/');
    });

/*	app.get('/favicon.ico', (req, res) => res.sendStatus(204));  // replaced by serve-favicon */
	
	app.get('*', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/relatorio');
		} else {
			res.redirect('/');
		}
	});

}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on 
	if (!req.isAuthenticated()) {
	// if they aren't redirect them to the home page
		res.redirect('/');
	} else {
		if (req.user.validated) {
			return next();
		} else {
			req.flash('validationMessage', 'Usuário não validado!');
			res.redirect('/');
		}
	}
}

// route middleware to make sure a user is logged in
function isSuperAdmin(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (!req.isAuthenticated()) {
		res.redirect('/');
	} else {
		if (req.user.superUser)
			return next();
		res.redirect('/relatorio');
	}
}


function randomValueBase64 (len) {
	return crypto.randomBytes(Math.ceil(len * 3 / 4))
		.toString('base64')   // convert to base64 format
		.slice(0, len)        // return required number of characters
		.replace(/\+/g, '0')  // replace '+' with '0'
		.replace(/\//g, '0'); // replace '/' with '0'
}
