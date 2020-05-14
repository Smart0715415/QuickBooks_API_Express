var mysql      = require('mysql');

const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '123',
  database : 'QB'
});
connection.connect((err) => {
  if (err) { console.log("error!") }
  //else { console.log("success") }
})

function querySQL (sql, callback)
{
  connection.query(sql, function (err, rows) {
      callback(err, rows);
  });

}

module.exports={querySQL:querySQL}