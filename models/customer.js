const now = require('../src/date')
var { db } = require('../src/db')
var customer = require('../src/collections').tables.customer

var orders = require('./orders')
var dispute = require('./dispute')
var messages = require('./message')
var vendor = require('./vendor')

async function create(post) {

    let _d = await db(vendor)

    return await _d.insertOne(post)


}

async function find(value) {

    let _d = await db(vendor)

    return await _d.findOne(value)


}

async function getProducts(post) {
 
   return await vendor.getProducts(post)
    

}
async function getProduct(post) {
 
    return await vendor.getProduct(post)
     
 
 }
 async function getVendors() {
 
    return await vendor.getVendors()
     
 
 }
 async function getVendor(post) {
 
    return await vendor.getVendor(post)
     
 
 }

async function getOrder(post) {

        var p={
            ...post,
            u_id:"ven_id"
        }

        return await orders.getOrder(p)

 
}











async function updateOne(post) {
    let { _id, ...rest } = post

    let _d = await db(vendor)

    return await _d.updateOne({ _id }, {
        $set: {
            ...rest
        }
    })


}

async function updatePatch(post) {
    let { _id, subElem, subElemId, ...rest } = post

    let _d = await db(vendor)

    return await _d.findOneAndUpdate({
        _id: _id,
        [subElem]: { "$elemMatch": { _id: subElemId } }
    }, {
        "$currentDate": {
            lastModified: true
        },
        "$set": {

            ...rest
        }
    }, { projection: { [subElem + ".$"]: 1, _id: 1 } })


}

async function findandUpdate(post) {
    let { _id, ...rest } = post
    let _d = await db(vendor)

    return await _d.findOneAndUpdate({ _id }, {
        $set: {
            ...rest
        }
    }, { projection: { password: 0 } })


}

async function updateOrder(post) {
 

    return await orders.updateOrder(post)


}

async function getMessages(post) {
 
    return await messages.find(post)


}

async function getDisputes(_id) {
 
    return await dispute.getDisputes({u_id: "ven_id",_id})


}

async function addMessage(post) {
 
    return await messages.addMessage(post)


}

async function seenMessage(post) {
 
    return await messages.seenMessage(post)


}
module.exports.create = create
module.exports.find = find

module.exports.updateOne = updateOne
module.exports.updatePatch = updatePatch
module.exports.findandUpdate = findandUpdate
module.exports.getProducts = getProducts
module.exports.getVendors = getVendors
module.exports.getProduct = getProduct
module.exports.getVendor = getVendor
module.exports.getOrder = getOrder
module.exports.updateOrder = updateOrder
module.exports.getMessages = getMessages
module.exports.addMessage = addMessage
module.exports.seenMessage = seenMessage
module.exports.getDisputes = getDisputes