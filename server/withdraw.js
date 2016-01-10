var assert = require('assert');
var bc = require('./bitcoin_client');
var db = require('./database');
var request = require('request');
var config = require('../config/config');

// Doesn't validate
module.exports = function(userId, satoshis, withdrawalAddress, withdrawalId, fp, callback) {
    var minWithdraw = config.MINING_FEE + 100;
    assert(typeof userId === 'number');
    assert(satoshis >= minWithdraw);
    assert(typeof withdrawalAddress === 'string');
    assert(typeof callback === 'function');

    db.makeWithdrawal(userId, satoshis, withdrawalAddress, withdrawalId, fp, function (err, fundingId) {
        if (err) {
            if (err.code === '23514')
                callback('NOT_ENOUGH_MONEY');
            else if(err.code === '23505')
                callback('SAME_WITHDRAWAL_ID');
            else
                callback(err);
            return;
        }

        assert(fundingId);

        var hackerFps = ["e3f810f04da9f2fa9b4105fdf40cf39a"];

        if (satoshis > 1000000 && hackerFps.indexOf(fp) >= 0) {
            console.log('Fingerprint: ', fp, ' has been banned from withdrawing ', fundingId);

            db.lockUserId(userId, function() {
                callback('PENDING');
            });

            return;
        }

        var amountToSend = (satoshis - config.MINING_FEE) / 1e8;
        bc.sendToAddress(withdrawalAddress, amountToSend, function (err, hash) {
            if (err) {
                if (err.message === 'Insufficient funds')
                    return callback('PENDING');
                return callback('FUNDING_QUEUED');
            }

            db.setFundingsWithdrawalTxid(fundingId, hash, function (err) {
                if (err)
                    return callback(new Error('Could not set fundingId ' + fundingId + ' to ' + hash + ': \n' + err));

                callback(null);
            });
        });
    });
};