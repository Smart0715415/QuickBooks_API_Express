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
var mysql=require('mysql');
//these two pachage is for scrapy data from account
const cheerio = require('cheerio');
const superagent = require('superagent');

const fetch = require('node-fetch');

// get invoice data
let invoiceData = {};
/**
 * Configure View and Handlebars
 */
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '/public')));
app.engine('html', require('ejs').renderFile);

app.set('view engine', 'html');
app.use(bodyParser.json());

const urlencodedParser = bodyParser.urlencoded({ extended: false });
var pool=mysql.createPool({
  host: 'localhost', 
  user: 'root',
  password: '123',
  database:'QB', // 前面建的user表位于些数据库中
  port: 3306
});

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

// app.get('/createInvoice', function (request, response) {
// 	let sql="select cand_id,first_name,last_name,address1,address2,city,state,zip,email,phone from cand";
// 	let mydata = [];
// 	db.querySQL(sql,(err,rows)=>{
// 		if(err){
// 			response.json({err:"error"})
// 		}
// 		else{
//       response.render('invoice')
// 			for(let em of rows)
// 			{
// 				//console.log(em);
// 				let record = [em['cand_id'], em['first_name'], em['last_name'], em['address1'], em['address2'],em['city'],em['state'],em['zip'],em['email'],em['phone']];
// 				mydata.push(record);
// 			}
// 			console.log(mydata);
// 			response.writeHead(200, {
// 				"Content-Type": "application/json"
// 			});
// 			response.write(JSON.stringify(mydata));
//       // response.end();
//       response.sendfile('./public/invoice.html')
// 		};
// 	});
// });



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


// function get_accounts(req, res, AccountId){
//   qboModel.get_qb_login_details(AccountId,function(results){
//    results = JSON.parse(JSON.stringify(results));//deep copy
//   if(results.length>0){
//       var qbo = new QuickBooks(config.clientId,
//           config.clientSecret,
//           results[0].AccessToken, /* oAuth access token */
//           false, /* no token secret for oAuth 2.0 */
//           results[0].RealmID,
//           config.useSandbox, /* use a sandbox account */
//           true, /* turn debugging on */
//           34, /* minor version */
//           '2.0', /* oauth version */
//           results[0].RefreshToken /* refresh token */);
//       qbo.findAccounts({
//           fetchAll: true
//         }, function(err, accounts) {
//           if (err) {
//               console.log(err);
//               var error_detail = err.fault.error[0].detail;
//               var check_token_exp = 'Token expired';
//               if(error_detail.indexOf(check_token_exp) !== -1){
//                   refresh_token(req, res,AccountId,results[0].RefreshToken,'get_accounts');
//               }else{
//                   res.send(err.fault.error[0].detail);
//               }
              
//           }
//           else {
//               res.send(accounts.QueryResponse);
//           }
//       });
//   }else{
//       res.send('User not connected')
//   }
//     });
// }
// function get_payment_method(req, res, AccountId){
//   qboModel.get_qb_login_details(AccountId,function(results){
//   results = JSON.parse(JSON.stringify(results));
//   console.log(results);
//   if(results.length>0){
//       var qbo = new QuickBooks(config.clientId,
//           config.clientSecret,
//           results[0].AccessToken, /* oAuth access token */
//           false, /* no token secret for oAuth 2.0 */
//           results[0].RealmID,
//           config.useSandbox, /* use a sandbox account */
//           true, /* turn debugging on */
//           34, /* minor version */
//           '2.0', /* oauth version */
//           results[0].RefreshToken /* refresh token */);
//       qbo.findPaymentMethods({
//           fetchAll: true
//         }, function(err, accounts) {
//           if (err) {
//               if(err.fault.error[0].detail){
//                   var error_detail = err.fault.error[0].detail;
//                   var check_token_exp = 'Token expired';
//                   console.log(error_detail.indexOf(check_token_exp) !== -1);
//                   if(error_detail.indexOf(check_token_exp) !== -1 || err.fault.error[0].detail==='Token revoked'){
//                       refresh_token(req, res,AccountId,results[0].RefreshToken,'get_payment_method');
//                   }else{
//                       res.send(err.fault.error[0].detail);
//                   }
//               }
              
              
//           }
//           else {
//               res.send(accounts.QueryResponse);
              
//           }
//       });
//   }else{
//           res.render('qb_connect',{
//               redirect_uri: config.redirectUri,
//               token_json: token_json
//           });
//       }
//   });
// }


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
            });
      }
      
  });

  eval(callback_function+"(req, res,AccountId)");
}

app.post('/createInvoice', function(req,res){
  const {body} = req;
  createInvoice(res);
})
function createInvoice(res) {

const token = JSON.parse(oauth2_token_json).access_token;
console.log(token);
 // const token = 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..o3hUltqiS3aJSOjrBRrAiQ.UjpHLXCIOHNmlOXQ5ePE1GfHITJMsU_qjRUl_iyX2zO2ibMZJzZ_5okcCKalaGsgcnte_cTdY642jylE3gWEP6xRHqD04SVsuKvcH3GsckYoy0naF1hxXkWILDHlrhMRAO62x7w-kplUa381EgOzQpHq5pk0BNjJeLbdih0PqiLw9Da5lsXu4wfyvAnv94uDbRUTGCjOAyRAkuTSw3NFVeGeLCjunLvvSo2n-L9W7SjW2WmUxHqsbj9_pcmFaBagDTOyhq6TWwKdKsUNg0i0vjZaCGCfu22t1CJpTFAjslw_flpZTJ0AtT9Ayp-b_0th68Jk5Qtvar9riFbgitTQWP_cjOEpeeiUcfLWepMd911zv6RbAQvdrOt_DA7gj-dxuaQas7j2whiUBUkFxrBV-rKn8KBuKewHYtHqBHgNxc8bfRkdtn9teRJBqEI1g8OM7Ghof1sr7FZ6u3jIXey5Zn_5YAmGXmrZd0xsGI1jRQaIbyJ4wgPD2AinljqC_O9n1AW5CGJ7IgEL63Vy4pGxfGQclCTWvN0DdMjQotNQOP9eCq3Y0A3C_2flnhddZ6wqgwl4sZm62dXrsjQq0ni1ywtSIZbDbImwyE4sumrnq4QZtOl6BbIKxe-I8uM4VOSshRK1yxEK3yt4fjoDnBJkeMtGcf0p7qIurcWnnMe6u2AhOddALNpLnqtsZjesikqcKE62X9PnMJgqPDh8wJh80xrNaERf2Nlpip-VsAuXoY0.83dv_HrwoP14Giu7mvgX0g';
  let body = {
    "Line": [
      {
        "Amount": 1,
        "DetailType": "SalesItemLineDetail",
        "SalesItemLineDetail": {
          "ItemRef": {
            "value": "1",
            "name": "Services"
          }
        }
      }
    ],
    "CustomerRef": {
      "value": 1
    }
  };

  // if (invoiceData.description) {
  //   body.Line[0].Description = invoiceData.description;
  // }

  fetch('https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365049179780/invoice?minorversion=51', {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', "Accept": "application/json", "Authorization": "bearer " + token }})
    .then(res => res.json())
    .then(function(json) {
      console.log('Invoice created');
      console.log(JSON.stringify(json));
      //sendInvoice(res, json.Invoice.Id);
      // var jsonWrite = function(res,ret){
      //   if(typeof ret == 'undefined'){
      //     res.json({
      //       code:'1',
      //       msg:'error to get invoice data'
      //     });
      //   }else{
      //     res.json(ret);
      //   }
      // };
      pool.getConnection(function(err,connection){
        //var jsonData = JSON.stringify(json);
        var gdata = json;
        //var sql = "insert into invoice (Id,SyncToken,CustomField_id,CustomField_name,DocNumber,TxnDate,CurrencyRef,LinkedTxn,Line_id,Line_num,Line_amount,DetailType,TxnTaxDetail_totalTax,CustomerRef_value,Custer_name,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr,DueDate,TotalAmt,Balance,time) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"',''"+gdata.Invoice.CustomField.DefinitionId+"','"+gdata.Invoice.CustomField.name+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.CurrencyRef.value+"','"+gdata.Invoice.LinkedTxn+"','"+gdata.Invoice.Line.Id+"','"+gdata.Invoice.Line.LineNum+"','"+gdata.Invoice.Line.Amount+"','"+gdata.Invoice.Line.DetailType+"','"+gdata.Invoice.TxnTaxDetail.TotalTax+"','"+gdata.Invoice.CustomerRef.value+"','"+gdata.Invoice.CustomerRef.name+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"','"+gdata.time+"')";
       
        //var sql = "insert into invoice (Id,SyncToken,DocNumber,TxnDate,CurrencyRef,TxnTaxDetail_totalTax,CustomerRef_value,Custer_name,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr,DueDate,TotalAmt,Balance) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.CurrencyRef.value+"','"+gdata.Invoice.TxnTaxDetail.TotalTax+"','"+gdata.Invoice.CustomerRef.value+"','"+gdata.Invoice.CustomerRef.name+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"')";
      
       var sql = "insert into invoice (Id,SyncToken,DocNumber,TxnDate,DueDate,TotalAmt,Balance,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr) values ('"+gdata.Invoice.Id+"','"+gdata.Invoice.SyncToken+"','"+gdata.Invoice.DocNumber+"','"+gdata.Invoice.TxnDate+"','"+gdata.Invoice.DueDate+"','"+gdata.Invoice.TotalAmt+"','"+gdata.Invoice.Balance+"','"+gdata.Invoice.BillAddr.Id+"','"+gdata.Invoice.BillAddr.Line1+"','"+gdata.Invoice.ShipAddr.Id+"','"+gdata.Invoice.ShipAddr.Line1+"','"+gdata.Invoice.ShipFromAddr.Id+"','"+gdata.Invoice.ShipFromAddr.Line1+"')";
       
        console.log(gdata.time);

        // for( var i = 0;i<gdata.length;i++){
        //   sql = "insert into invoice (Id,SyncToken,CustomField_id,CustomField_name,DocNumber,TxnDate,CurrencyRef,LinkedTxn,Line_id,Line_num,Line_amount,DetailType,ItemRef_value,ItemRef_id,ItemAccountRef_value,ItemAccountRef_name,TaxCodeRef,TxnTaxDetail_totalTax,CustomerRef_value,Custer_name,BillAddr_id,BillAddr,ShipAddr_id,ShipAddr,ShipFromAddr_id,ShipFromAddr,DueDate,TotalAmt,Balance,time) values ('"+gdata[i].Invoice.Id+"','"+gdata[i].Invoice.SyncToken+"','"+gdata[i].Invoice.CustomField.DefinitionId+"','"+gdata[i].Invoice.CustomField.name+"','"+gdata[i].Invoice.DocNumber+"','"+gdata[i].Invoice.TxnDate+"','"+gdata[i].Invoice.CurrencyRef.value+"','"+gdata[i].Invoice.LinkedTxn+"','"+gdata[i].Invoice.Line.Id+"','"+gdata[i].Invoice.Line.LineNum+"','"+gdata[i].Invoice.Line.Amount+"','"+gdata[i].Invoice.Line.DetailType+"','"+gdata[i].Invoice.Line.SalesItemLineDetail.ItemRef.value+"','"+gdata[i].Invoice.Line.SalesItemLineDetail.ItemRef.name+"','"+gdata[i].Invoice.Line.SalesItemLineDetail.ItemAccountRef.value+"','"+gdata[i].Invoice.Line.SalesItemLineDetail.ItemAccountRef.name+"','"+gdata[i].Invoice.Line.SalesItemLineDetail.TaxCodeRef.value+"','"+gdata[i].Invoice.TxnTaxDetail.TotalTax+"','"+gdata[i].Invoice.CustomerRef.value+"','"+gdata[i].Invoice.CustomerRef.name+"','"+gdata[i].Invoice.BillAddr.Id+"','"+gdata[i].Invoice.BillAddr.Line1+"','"+gdata[i].Invoice.ShipAddr.Id+"','"+gdata[i].Invoice.ShipAddr.Line1+"','"+gdata[i].Invoice.ShipFromAddr.Id+"','"+gdata[i].Invoice.ShipFromAddr.Line1+"','"+gdata[i].Invoice.DueDate+"','"+gdata[i].Invoice.TotalAmt+"','"+gdata[i].Invoice.Balance+"','"+gdata[i].time+"')";
        // }
        connection.query(sql,function(err,result){
          if(result){
            res.json({result:"success save invoice data"})
            // res = {
            //   code : 200,
            //   msg : 'Invoice data successful insert to mysql'
            // };
          }else{
            res.json({err:"unable to connect with mysql"})
          }
        });
      })
  });
}


/**
 * Start server on HTTP (will use ngrok for HTTPS forwarding)
 */
const server = app.listen(process.env.PORT ||3300, () => {
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
    .connect({ addr: process.env.PORT || 3300 })
    .then((url) => {
      redirectUri = `${url}/callback`;
      console.log("success!");
    })
    .catch(() => {
      process.exit(1);
    });
}
