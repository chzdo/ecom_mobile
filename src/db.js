var mongoClient = require('mongodb').MongoClient

 const connection = "mongodb://localhost/"

client = new mongoClient(connection,{ useUnifiedTopology: true })

module.exports.db = async (table) =>{
    await  client.connect()
  
   return  client.db(process.env.DATABASE_NAME).collection(table);
     
}