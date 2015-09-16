var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
Promise.promisifyAll(bcrypt);

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  links: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', function(model, attrs, options){
        //maybe Sync or return promise?
        //def isn't running til after event finishes firing
      return bcrypt.hashAsync(model.get('password'), null, null)
              .then(function(hash) {
                model.set('password', hash);
              });
    });
  },
  compareHash: function(password, match, cb) {
    bcrypt.compareAsync(password, match.get('password')).then(function(result) {
      cb(result);
    });
  }
});

module.exports = User;
