var AsyncCache = require('async-cache');
var request = require('request');

exports.vpnIps = new AsyncCache({
  max: 10000,
  maxAge: 1000 * 60 * 60,
  load: function(ip, callback) {

    request('http://check.getipintel.net/check.php?ip=' + ip + '&contact=rhavar@protonmail.com', function (err, result) {

      if (err) {
        console.error('Got ip error: ', err);
        return callback(null, false);
      }

      var n = Number.parseFloat(result.body);
      if (Number.isNaN(n)) {
        console.error('could not parse: ', result.body);
        n = 0;
      }
      callback(null, n > 0.9);
    });
  }
});
