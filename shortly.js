var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var sessions = require('express-session');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = require('./config').id;
var GITHUB_CLIENT_SECRET = require('./config').secret;


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(sessions({
  resave: false,
  saveUninitialized: false,
  secret: 'blahblah',
  cookie: {maxAge: 60*60*1000, authed: false}
}));

/*
app.use(function(req,res,next) {
  if (!req.session.authed && req.method!=='POST') {
    if (req.path==='/signup') {
      res.render('signup');
    } else {
      if (req.path!=='/login') {
        res.redirect('login');
      } else {
        res.render('login');
      }
    }
  } else {
    next();
  }
});
*/

app.get('/login', function(req,res) {
  res.render('login');
});

app.post('/login', function(req,res){
  util.authenticate(req.body.username,req.body.password, function(user) {
    if (!user) {
      res.redirect('/login');
    } else {
      req.session.regenerate(function() {
        req.session.authed = true;
        res.redirect('/');
      });
    }
  });
});
    

app.get('/', function(req, res) {
  !req.session.authed ? res.redirect('login') : res.render('index');
});

app.get('/signup', function(req,res) {
  res.render('signup');
});

app.post('/signup', function(req,res){
  var user = new User({
    username: req.body.username,
    password: req.body.password
  });
  user.save()
    .then(function(newUser) {
      req.session.regenerate(function() {
        req.session.authed = true;
        res.redirect('/');
      });
    });
}); 

app.get('/links', function(req, res) {
  if (!req.session.authed) res.redirect('login');

  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  if (!req.session.authed) res.redirect('login');

  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.get('/logout', function(req, res){
  req.session.destroy(function(){
    res.redirect('/');
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
