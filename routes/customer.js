var express = require('express')
var router = express.Router
var emailService = require('../src/email')
//var { Auth, isPermitted } = require('../src/auth')
var jwt = require('jsonwebtoken')
var { ObjectId } = require('bson')
var bycrpt = require('bcrypt')
var { isPast, isAfter, add, isBefore } = require('date-fns')
var { getProducts, getProduct, getVendors, getVendor } = require('../models/customer')
var mQ = require('../src/queue')
var now = require('../src/date')
const { check, validationResult, body, param } = require('express-validator')
var { verify } = require('../src/paystack')
var path = require('path')
const e = require('express')



let app = router()


const action = {
    Placed: 'Placed Order',
    Complain: 'Complaint Created',
    Override: 'Override Keep In',
    Accepted: 'Accepted Order',
    Rejected: 'Rejected Order',
    Processing: 'Processing Order',
    "Waiting Delivery": 'Item Ready For Collection',
    "Waiting Self Pickup": 'Item Ready For Collection',
    Cancelled: 'Cancelled Order',
    Payment: 'Order Payment',
    Completed: 'Completed Order'
}


var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NGN',

});





app.use(express.json())




app.get('/products', async function (req, res) {
    try {

        await body('latlong').notEmpty().isLatLong().customSanitizer(e => Array.from(e.split(","), (e, i) => parseFloat(e))).run(req)

        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }



        let products = await getProducts(req.body.latlong)

        if (products.length == 0) {
            res.status(404).send({ message: 'Products not found' })
            return;
        }
        res.send({ message: 'success', payload: products })


    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.get('/products/:_id/:ven_id', async function (req, res) {
    try {
        await param('_id').notEmpty().withMessage('ID required').isMongoId().trim().customSanitizer(e => ObjectId(e)).run(req)
        await param('ven_id').notEmpty().withMessage('Vendor ID required').isMongoId().trim().customSanitizer(e => ObjectId(e)).run(req)
        await body('latlong').notEmpty().isLatLong().customSanitizer(e => Array.from(e.split(","), (e, i) => parseFloat(e))).run(req)
        req.params['latlong'] = req.body.latlong

        let err = validationResult(req)

        if (!err.isEmpty()) {
            res.status(422).send(err)
            return;
        }
      
        let products = await getProduct(req.params)
  
        if (products.length == 0) {
            res.status(404).send({ message: 'Products not found' })
            return;
        }
        res.send({ message: 'success', payload: products })


    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.get('/vendors', async function (req, res) {
    try {



        let vendors = await getVendors()

        if (vendors.length == 0) {
            res.status(404).send({ message: 'Products not found' })
            return;
        }
        res.send({ message: 'success', payload: vendors })


    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.get('/vendors/:_id', async function (req, res) {
    try {

        await param('_id').notEmpty().isMongoId().customSanitizer(e => ObjectId(e)).run(req)
        await param('latlong').notEmpty().isLatLong().customSanitizer(e => Array.from(e.split(","), (e, i) => parseFloat(e))).run(req)
        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }

        let vendors = await getVendor(req.params._id)

        if (!vendors) {
            res.status(404).send({ message: 'Products not found' })
            return;
        }
        res.send({ message: 'success', payload: vendors })


    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

module.exports = app