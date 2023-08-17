// Import library 
const express = require('express');
const session = require('express-session');
const {Issuer, generators} = require('openid-client');
const path = require('path');
const app = express();

// Init session
app.use(session({
  secret: 'my-secret',
  resave: true,
  saveUninitialized: false
}));

//middleware
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'front-end'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// load contents of .env into process.env
require('dotenv').config();
// 
async function setUpOIDC(){
	const issuer = await Issuer.discover('https://student-devportal.rel.verify.ibmcloudsecurity.com/oidc/endpoint/default/.well-known/openid-configuration');
	const client = new issuer.Client({
		client_id: process.env.CLIENT_ID,
		client_secret: process.env.CLIENT_SECRET,
		redirect_uris: process.env.REDIRECT_URI,
		response_typese:process.env.RESPONSE_TYPE
	});
	console.log('client', client)
	return client;
}



// Home route
app.get('/', (req,res) => {
	if (req.session.token) {
    res.redirect("/dashboard");
  } else {
    res.render('index')
  }
});

// Login require
// store the code_verifier in your framework's session mechanism, if it is a cookie based solution
// it should be httpOnly (not readable by javascript) and encrypted.

app.get('/login', async(req, res) => {
	const client = await setUpOIDC();
	const url = client.authorizationUrl({
		scope:process.env.SCOPE,
		state:generators.state(),
		redirect_uri:process.env.REDIRECT_URI,
		response_types:process.env.RESPONSE_TYPE,
	});
	res.redirect(url);
});


app.get('/redirect', async (req, res) => {
		const client = await setUpOIDC();
		const params = client.callbackParams(req);
		const tokenSet = await client.callback(process.env.REDIRECT_URI, 
			params, { state: req.query.state, nonce: req.session.nonce });
		const userinfo = await client.userinfo(tokenSet.access_token);
		req.session.tokenSet = tokenSet;
		req.session.userinfo = userinfo;
	    console.log(userinfo);
		res.redirect('/dashboard');
	  });

// Page for render userInfo
app.get('/dashboard', (req, res) => {
	const userinfo = req.session.userinfo;
	if (!userinfo) {
	  return res.redirect('/login');
	}
	console.log('======== Requesting userInfo claims using valid token');
	res.render('dashboard', {userInfo :userinfo});
  });
  
  app.get('/logout', async (req, res) => {
	// import client
	const client = await setUpOIDC();
	// get token from session
	const token = req.session.tokenSet;
	console.log(token);
      // check result
	req.session.destroy(() => {
	  res.redirect('/');
	});
	// logout from OP ? doesn't work
	await client.revoke(token.access_token).catch(console.error);
  });

// Listen PORT
app.listen  (process.env.PORT, async () => {
	console.log('Server started');
	console.log(`Navigate to http://localhost:${process.env.PORT}`);
});
