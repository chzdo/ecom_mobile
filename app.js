const express = require('express')
const vendor  =  require('./routes/vendor')
const customer  =  require('./routes/customer')
const app = express()
const cors = require('cors')
const path = require('path')
const bodyPaser = require('body-parser')
let corsOptions={
   "origin": 'https://www.fb.com',
   "methods": "POST"
}

app.use(express.static('static'))
app.use(cors(corsOptions))
app.options("*",cors(corsOptions),(req,res,next)=>{
    next()
})
//app.use(express.json())


app.use('/customer',customer)
app.use('/vendor',vendor)
app.use(function(req, res) {
    res.status(405).send({message:'Route Does not exist!'});
});

// Start the server on port 3000
app.listen(3000, '127.0.0.1');
console.log('Node server running on port 3000');