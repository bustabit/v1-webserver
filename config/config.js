/**
 * For development you can set the variables by creating a .env file on the root
 */
var fs = require('fs');
var production = process.env.NODE_ENV === 'production';

module.exports = {
  "DATABASE_URL": process.env.DATABASE_URL || "postgres://localhost:5432/bustabitdb",
  "BIP32_DERIVED": process.env.BIP32_DERIVED_KEY || "GET_ONE",
  "AWS_SES_KEY": process.env.AWS_SES_KEY || "GET_ONE",
  "AWS_SES_SECRET": process.env.AWS_SES_SECRET || "GET_ONE",
  "CONTACT_EMAIL": process.env.CONTACT_EMAIL || "ryan@moneypot.com",
  "SITE_URL": process.env.SITE_URL || "http://localhost:3841",
  "ENC_KEY": process.env.ENC_KEY || "devkey",
  "SIGNING_SECRET": process.env.SIGNING_SECRET || "secret",
  "BANKROLL_OFFSET": parseInt(process.env.BANKROLL_OFFSET) || 0,
  "RECAPTCHA_PRIV_KEY": process.env.RECAPTCHA_PRIV_KEY || 'GET_ONE',
  "RECAPTCHA_SITE_KEY": process.env.RECAPTCHA_SITE_KEY || 'GET_ONE',
  "PRODUCTION": process.env.NODE_ENV === 'production',
  "BITCOIND": {
    HOST: process.env.BITCOIND_HOST,
    PORT: process.env.BITCOIND_PORT || 8332,
    USER: process.env.BITCOIND_USER,
    PASS: process.env.BITCOIND_PASS,
    CERT: process.env.BITCOIND_CERT || ''
  },
  "PORT":  process.env.PORT || 3841,
  "BUILD": production? JSON.parse(fs.readFileSync('./config/buildConfig.js')) : null
};