var { db } = require('../src/db')
var { order, customer, vendor } = require('../src/collections').tables

const now = require('../src/date')


async function create(post) {

    let _d = await db(order)

    return await _d.insertOne(post)

}

async function find(value) {

    let _d = await db(order)

    return await _d.findOne(value)



}





async function updateOrder(post) {
    let { _id, u_id, log, ...rest } = post

    let _d = await db(order)

    return await _d.findOneAndUpdate({ _id, [u_id.key]: u_id.value }, {
        $push: {
            logs: { ...log }
        },
        $set: {
            ...rest
        }
    })


}


async function getOrders(post) {
    let _d = await db(order)
    let { _id,  u_id } = post

   
    return await _d.aggregate([
        {
            $match: {
               [u_id]: _id
            },
        },
        {

            $lookup: {
                from: vendor,
                localField: 'ven_id',
                foreignField: '_id',

                as: 'ven_info'

            }
        },
        {
            $unwind: "$ven_info"
        }
        ,
        {
            $addFields: {
                "product": {
                    $map: {
                        input: "$product",
                        in: {
                            $let: {
                                vars: {
                                    other: {
                                        $arrayElemAt: [
                                            "$ven_info.products",
                                            {
                                                $indexOfArray: [
                                                    "$ven_info.products",
                                                    "$$this._id"
                                                ]
                                            }
                                        ]
                                    },

                                },
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                "$$this._id", "$$other._id"

                                            ]
                                        }, then: {
                                            $mergeObjects: [
                                                "$$this", { product:"$$other"}

                                            ]
                                        }, else: {p:"$$other"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        ,
        {

            $lookup: {
                from: customer,
                localField: 'cus_id',
                foreignField: '_id',
                as: 'cus_info'

            }
        },
        {
            $unwind: "$cus_info"
        },
        {
            $addFields: {
                "hasPassedKeepIn": {
                    $cond: [{ $lte: ["keep_in", now] }, true, false]

                },
                "customer": { name:"$cus_info.name",phone:"$cus_info.phone",email:"$cus_info.email"},
                "vendor":  {name: "$ven_info.business.name", phone:'$ven_info.phone', email:"$ven_info.email",address:"$ven_info.address"}

            }
        },
        {
            $project: {
                
                    _id: 1,
                    ven_id: 1,
                    customer_id: 1,
                    date_ordered: 1,
                    time_in: 1,
                    product: 1,
                    customer: 1,
                    status:1,
                    hasPassedKeepIn:1,
                    order_type:1,
                    payment_type:1,
                    address: 1,
                    customer: 1,
                    vendor:1

                }
            

        }


    ]).toArray()

}



async function getOrder(post) {
    let _d = await db(order)
    let { _id, o_id, u_id } = post

   
    return await _d.aggregate([
        {
            $match: {
                _id: o_id,
                [u_id]: _id

            },
        },

        {

            $lookup: {
                from: vendor,
                localField: 'ven_id',
                foreignField: '_id',

                as: 'ven_info'

            }
        },
        {
            $unwind: "$ven_info"
        }
        ,
        {
            $addFields: {
                "product": {
                    $map: {
                        input: "$product",
                        in: {
                            $let: {
                                vars: {
                                    other: {
                                        $arrayElemAt: [
                                            "$ven_info.products",
                                            {
                                                $indexOfArray: [
                                                    "$ven_info.products",
                                                    "$$this._id"
                                                ]
                                            }
                                        ]
                                    },

                                },
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                "$$this._id", "$$other._id"

                                            ]
                                        }, then: {
                                            $mergeObjects: [
                                                "$$this", { product:"$$other"}

                                            ]
                                        }, else: {p:"$$other"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        ,
        {

            $lookup: {
                from: customer,
                localField: 'cus_id',
                foreignField: '_id',
                as: 'cus_info'

            }
        },
        {
            $unwind: "$cus_info"
        },
        {
            $addFields: {
                "hasPassedKeepIn": {
                    $cond: [{ $lte: ["keep_in", now] }, true, false]

                },
                "customer": { name:"$cus_info.name",phone:"$cus_info.phone",email:"$cus_info.email"},
                "vendor":  {name: "$ven_info.business.name", phone:'$ven_info.phone', email:"$ven_info.email",address:"$ven_info.address"}

            }
        },

{
    $project:{
        ven_info:0,
        cus_info:0
    }
}


    ]).toArray()

}




module.exports.create = create
module.exports.updateOrder = updateOrder
module.exports.getOrder = getOrder
module.exports.getOrders = getOrders
/**
 *      {

            $lookup: {
                from: vendor,

                pipeline:[
                    {
                        $match:{ "_id":"$ven_id"}
                    }
                ],

                as: 'vendor'

            }
        },
        {
            $unwind: "$vendor"
        },

        {
            $addFields: {
                "product": {
                    $map: {
                        input: "product",
                        in: {
                            $let: {
                                vars: {
                                    other: {
                                        $arrayElemAt: [
                                            "$vendor.products",
                                            {
                                                $indexOfArray: [
                                                    "$vendor.products",
                                                    "$$this._id"
                                                ]
                                            }
                                        ]
                                    },

                                },
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                "$$this._id", "$$other._id"

                                            ]
                                        }, then: {
                                            $mergeObjects: [
                                                "$$this", {
                                                    "product": {
                                                        $arrayElemAt: [
                                                            "$products",
                                                            {
                                                                $indexOfArray: [
                                                                    "$products",
                                                                    "$$this._id"
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                }

                                            ]
                                        }, else: "$$this"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        ,
        {

            $lookup: {
                from: customer,
                localField: 'cus_id',
                foreignField: '_id',
                as: 'customer'

            }
        },
        {
            $unwind: "$customer"
        },
        {
            $addFields: {
                "hasPassedKeepIn": {
                    $cond: [{ $lte: ["keep_in", now] }, true, false]

                },
                "customer" : "$customer",
                "vendor": "$vendor"

            }
        },
 */