const now = require('../src/date')
var { db } = require('../src/db')
var vendor = require('../src/collections').tables.vendor
var orders = require('./orders')
var dispute = require('./dispute')
var messages = require('./message')
const maxD = 5000

async function create(post) {

    let _d = await db(vendor)

    return await _d.insertOne(post)


}

async function find(value) {

    let _d = await db(vendor)

    return await _d.findOne(value)


}

async function getOrders(_id) {

    return await orders.getOrders({ _id, u_id: 'ven_id' })


}


async function getOrder(post) {

    var p = {
        ...post,
        u_id: "ven_id"
    }

    return await orders.getOrder(p)


}




async function findAll(latlong) {

    let _d = await db(vendor)

    return await _d.find({
        location:
        {
            $near:
            {
                $geometry: { type: "Point", coordinates: latlong },
                $minDistance: maxD,
                $maxDistance: 5000
            }
        },
        verified: true,
        reg_completed: true,
        "subscription": {
            "$elemMatch": {
                "status": true,
                "exp_date": { "$gt": now }
            }
        }
    }, {

    }).project({ password: 0 }).toArray()


}

async function hasSubscription(_id, now) {

    let _d = await db(vendor)

    return await _d.findOne({
        "_id": _id,
        "subscription": {
            "$elemMatch": {
                "status": true,
                "exp_date": { "$gt": now }
            }
        }
    }, {
        projection: {
            "subscription.$": 1
        }
    })

}

async function createSubscription(post) {
    let { _id, ...rest } = post
    let _d = await db(vendor)

    return await _d.findOneAndUpdate({ _id }, {
        $push: {
            subscription: { ...rest }
        }
    })


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

    return await dispute.getDisputes({ u_id: "ven_id", _id })


}

async function addMessage(post) {

    return await messages.addMessage(post)


}

async function seenMessage(post) {

    return await messages.seenMessage(post)


}


async function getProducts(cord) {
    let _d = await db(vendor)

    return await _d.aggregate([
        {
            $geoNear: {
                near: { type: "Point", coordinates: cord },
                distanceField: "calculated",
                maxDistance: maxD,
                minDistance: 0,
                query: {
                    verified: true,
                    reg_complete: true,
                    "subscription": {
                        $elemMatch: {
                            status: true,
                            "exp_date": { "$gt": now }
                        }
                    }
                },
                // includeLocs: "dist.location",
                // spherical: true
            }
        },

        {
            $unwind: "$products"
        },
        {
            $sort: { "products.item": -1, "products.qty": -1 }
        },
        {

            $group: {
                "_id": "$products.category",
                product: {
                    $push: {
                        $mergeObjects: ["$products", { "ven_id": "$_id" }, { "distance": "$calculated" }


                        ]
                    }
                }
            }
        },





    ]).toArray()

}


async function getProduct(post) {
    let _d = await db(vendor)

    return await _d.aggregate([
        
            {
                $geoNear: {
                    near: { type: "Point", coordinates: post.latlong },
                    distanceField: "calculated",
                    maxDistance: maxD,
                    minDistance: 0,
                    query: {
                        verified: true,
                        "_id": post.ven_id,
                        "products": {
                            $elemMatch: {
                                _id: post._id
                            }
                        },
                        reg_complete: true,
                        "subscription": {
                            $elemMatch: {
                                status: true,
                                "exp_date": { "$gt": now }
                            }
                        }
                    },
                    // includeLocs: "dist.location",
                     spherical: true
                }
            },
        
          
      
          
         
        {
            $project:{
               "product":{
                   $filter:{
                       input:"$products",
                       as :"p",
                       cond:{
                           $eq:["$$p._id",post._id]
                       }
                   }
               },
                
                business: 1,
                reviews: 1,
                phone: 1,
                email: 1,
                address: 1,
                location: 1,
                verified: 1,
                reg_complete: 1,
            }
        }
        
       
    ]).toArray()

}

async function getVendors(post) {
    let _d = await db(vendor)

    return await _d.find(
        {
            "location": {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: post.cord
                    },
                    $maxDistance: maxD,
                    $minDistance: 0
                }
            },

            verified: true,
            reg_complete: true,
            "subscription": {
                $elemMatch: {
                    status: true,
                    "exp_date": { "$gt": now }
                }
            },


        }

          ,





    ).project({


        business: 1,
        reviews: 1,
        phone: 1,
        name: 1,
        email: 1,
        address: 1,
        location: 1,
        verified: 1,
        reg_complete: 1,



    }).toArray()

}

async function getVendor(post) {
    let _d = await db(vendor)

    return await _d.findOne(
        {
            "location": {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: post.lat_lng
                    },
                    $maxDistance: maxD,
                    $minDistance: 0
                }
            },
            _id: post._id,
            verified: true,
            reg_complete: true,
            "subscription": {
                $elemMatch: {
                    status: true,
                    "exp_date": { "$gt": now }
                }
            },


        }

        ,
        {
            projection: {
                password: 0,
                code: 0
            }
        }




    )

}












module.exports.create = create
module.exports.find = find
module.exports.findAll = findAll
module.exports.updateOne = updateOne
module.exports.updatePatch = updatePatch
module.exports.findandUpdate = findandUpdate
module.exports.hasSubscription = hasSubscription
module.exports.createSubscription = createSubscription
module.exports.getOrders = getOrders
module.exports.getOrder = getOrder
module.exports.updateOrder = updateOrder
module.exports.getMessages = getMessages
module.exports.addMessage = addMessage
module.exports.seenMessage = seenMessage
module.exports.getDisputes = getDisputes
module.exports.getProducts = getProducts
module.exports.getProduct = getProduct
module.exports.getVendors = getVendors
module.exports.getVendor = getVendor