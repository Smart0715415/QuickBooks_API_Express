'use strict';

require('dotenv').config();

/**
 * Require the dependencies
 * @type {*|createApplication}
 */
const express = require('express');
//const session = require('express-session');
const app = express();
const path = require('path');
const OAuthClient = require('intuit-oauth');
const bodyParser = require('body-parser');
const ngrok = process.env.NGROK_ENABLED === 'true' ? require('ngrok') : null;
const qboModel = require('./mysql_connection/qbo_models.js');
//const db=require("./mysql_connection/connection.js");
const db=require("./mysql_connection/connection.js");

//these two pachage is for scrapy data from account
const cheerio = require('cheerio');
const superagent = require('superagent');

/**
 * Configure View and Handlebars
 */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));
app.engine('html', require('ejs').renderFile);

app.set('view engine', 'html');
app.use(bodyParser.json());

const urlencodedParser = bodyParser.urlencoded({ extended: false });

/**
 * App Variables
 * @type {null}
 */
let oauth2_token_json = null;
let redirectUri = '';

/**
 * Instantiate new Client
 * @type {OAuthClient}
 */

let oauthClient = null;

/**
 * Home Route
 */
app.get('/', function (req, res) {
  res.render('index');
});

/**
 * Get the AuthorizeUri
 */
app.get('/authUri', urlencodedParser, function (req, res) {
  oauthClient = new OAuthClient({
    clientId: req.query.json.clientId,
    clientSecret: req.query.json.clientSecret,
    environment: req.query.json.environment,
    redirectUri: req.query.json.redirectUri,
  });

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'intuit-test',
  });
  res.send(authUri);
});

/**
 * Handle the callback to extract the `Auth Code` and exchange them for `Bearer-Tokens`
 */
app.get('/callback', function (req, res) {
  oauthClient
    .createToken(req.url)
    .then(function (authResponse) {
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
    })
    .catch(function (e) {
      console.error(e);
    });

  res.send('');
});

/**
 * Display the token : CAUTION : JUST for sample purposes
 */
app.get('/retrieveToken', function (req, res) {
  res.send(oauth2_token_json);
});

/**
 * Refresh the access-token
 */
app.get('/refreshAccessToken', function (req, res) {
  oauthClient
    .refresh()
    .then(function (authResponse) {
      console.log(`The Refresh Token is  ${JSON.stringify(authResponse.getJson())}`);
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
      res.send(oauth2_token_json);
    })
    .catch(function (e) {
      console.error(e);
    });
});

/**
 * getCompanyInfo ()
 */
app.get('/getCompanyInfo', function (req, res) {
  const companyID = oauthClient.getToken().realmId;

  const url =
    oauthClient.environment == 'sandbox'
      ? OAuthClient.environment.sandbox
      : OAuthClient.environment.production;

  oauthClient
    .makeApiCall({ url: `${url}v3/company/${companyID}/companyinfo/${companyID}` })
    .then(function (authResponse) {
      console.log(`The response for API call is :${JSON.stringify(authResponse)}`);
      res.send(JSON.parse(authResponse.text()));
    })
    .catch(function (e) {
      console.error(e);
    });
});
app.get('/accessCompanyDB',function(req,res){

  superagent.get('https://c73.qbo.intuit.com/app/chartofaccounts')
    .end(function (err, sres) {
      if (err) {
        return next(err);
      }
      
      var $ = cheerio.load('div data-automation-id="chart-of-accounts-grid" data-dojo-attach-point="grid" class="dgrid dgrid-grid ui-widget dgrid-03 universal-grid" data-dojo-bind="visible:showSpinner" id="dgrid_3" role="grid"><div class="dgrid-hider-menu" role="dialog" aria-label="Show or hide columns" id="dgrid_3-hider-menu" style="display: none;">...</div>');
      var items = [];
      $('#dgrid dgrid-grid ui-widget dgrid-03 universal-grid').each(function (idx, element) {
        //var $element = $(chart-of-accounts-grid);
        items.push({
          NAME:$('#dgrid-cell dgrid-cell-padding dgrid-column-0 field-name dgrid-sortable sorted_div dgrid-focus'),
          TYPE: $element.attr('#dgrid-cell dgrid-cell-padding dgrid-column-2 field-type dgrid-sortable sorted_div dgrid-focus'),
          DETAIL: $element.attr('#dgrid-cell dgrid-cell-padding dgrid-column-3 field-detailType dgrid-focus'),
          QUICKBOOKS: $element.attr('#dgrid-cell dgrid-cell-padding dgrid-column-4 field-balance dgrid-sortable sorted_div dgrid-focus'),
          BANK_BALANCE: $element.attr('#dgrid-cell dgrid-cell-padding dgrid-column-5 field-bankBalance dgrid-sortable sorted_div dgrid-focus'),
          ACTION: $element.attr('#dgrid-cell dgrid-cell-padding dgrid-column-6 field-action dgrid-focus')
        });
      });
      res.send(items);
    });
});
app.get('/connectMysql',function(req,res,next){
  //get_accounts(req, res, req.body.AccountId);
  var sql="select * from test";
  db.querySQL(sql,(err,rows)=>{
    if(err){
      res.json({err:"unable to connect with mysql"})
    }
    else{
      res.json({list:rows})
    }
  })
    //res.render('index', { title: 'Express' });
});  



/**
 * disconnect ()
 */
app.get('/disconnect', function (req, res) {
  console.log('The disconnect called ');
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.OpenId, OAuthClient.scopes.Email],
    state: 'intuit-test',
  });
  res.redirect(authUri);
});


function get_accounts(req, res, AccountId){
  qboModel.get_qb_login_details(AccountId,function(results){
   results = JSON.parse(JSON.stringify(results));//deep copy
  if(results.length>0){
      var qbo = new QuickBooks(config.clientId,
          config.clientSecret,
          results[0].AccessToken, /* oAuth access token */
          false, /* no token secret for oAuth 2.0 */
          results[0].RealmID,
          config.useSandbox, /* use a sandbox account */
          true, /* turn debugging on */
          34, /* minor version */
          '2.0', /* oauth version */
          results[0].RefreshToken /* refresh token */);
      qbo.findAccounts({
          fetchAll: true
        }, function(err, accounts) {
          if (err) {
              console.log(err);
              var error_detail = err.fault.error[0].detail;
              var check_token_exp = 'Token expired';
              if(error_detail.indexOf(check_token_exp) !== -1){
                  refresh_token(req, res,AccountId,results[0].RefreshToken,'get_accounts');
              }else{
                  res.send(err.fault.error[0].detail);
              }
              
          }
          else {
              res.send(accounts.QueryResponse);
          }
      });
  }else{
      res.send('User not connected')
  }
    });
}
function get_payment_method(req, res, AccountId){
  qboModel.get_qb_login_details(AccountId,function(results){
  results = JSON.parse(JSON.stringify(results));
  console.log(results);
  if(results.length>0){
      var qbo = new QuickBooks(config.clientId,
          config.clientSecret,
          results[0].AccessToken, /* oAuth access token */
          false, /* no token secret for oAuth 2.0 */
          results[0].RealmID,
          config.useSandbox, /* use a sandbox account */
          true, /* turn debugging on */
          34, /* minor version */
          '2.0', /* oauth version */
          results[0].RefreshToken /* refresh token */);
      qbo.findPaymentMethods({
          fetchAll: true
        }, function(err, accounts) {
          if (err) {
              if(err.fault.error[0].detail){
                  var error_detail = err.fault.error[0].detail;
                  var check_token_exp = 'Token expired';
                  console.log(error_detail.indexOf(check_token_exp) !== -1);
                  if(error_detail.indexOf(check_token_exp) !== -1 || err.fault.error[0].detail==='Token revoked'){
                      refresh_token(req, res,AccountId,results[0].RefreshToken,'get_payment_method');
                  }else{
                      res.send(err.fault.error[0].detail);
                  }
              }
              
              
          }
          else {
              res.send(accounts.QueryResponse);
              
          }
      });
  }else{
          res.render('qb_connect',{
              redirect_uri: config.redirectUri,
              token_json: token_json
          });
      }
  });
}


function refresh_token(req, res,AccountId,oldrefresh_token,callback_function){
  var auth = (new Buffer(config.clientId + ':' + config.clientSecret).toString('base64'));
  var postBody = {
      url: config.token_endpoint,
      headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + auth,
      },
      form: {
          grant_type: 'refresh_token',
          refresh_token: oldrefresh_token
      }
  };

  request.post(postBody, function (err, res, data) {
      var accessToken = JSON.parse(res.body);
      if(accessToken.access_token){
          pool.query('UPDATE account_quickbooks_keys SET   AccessToken = ?, RefreshToken = ?, Expires = ? WHERE Account = ?', [accessToken.access_token,accessToken.refresh_token,accessToken.expires_in,AccountId], function (error, results, fields) {
              if (error) throw error;
              // ...
            });
      }
      
  });

  eval(callback_function+"(req, res,AccountId)");
}

/**
 * Start server on HTTP (will use ngrok for HTTPS forwarding)
 */
const server = app.listen(process.env.PORT || 8000, () => {
  console.log(`💻 Server listening on port ${server.address().port}`);
  if (!ngrok) {
    redirectUri = `${server.address().port}` + '/callback';
    console.log("success!");
  }
});

/**
 * Optional : If NGROK is enabled
 */
if (ngrok) {
  console.log('NGROK Enabled');
  ngrok
    .connect({ addr: process.env.PORT || 8000 })
    .then((url) => {
      redirectUri = `${url}/callback`;
      console.log("success!");
    })
    .catch(() => {
      process.exit(1);
    });
}
