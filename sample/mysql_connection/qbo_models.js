const pool=require("./connection.js");

function get_qb_login_details(id,cb)
{
   pool.query("SELECT RealmID,CompanyName,AccessToken,Expires,RefreshToken from account_quickbooks_keys where find_in_set('id',Account) ",function (error, results, fields) {
    if (error) throw error;
       cb(results);
   })
}

module.exports= {get_qb_login_details:get_qb_login_details}