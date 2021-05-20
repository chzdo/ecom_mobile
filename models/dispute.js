var { db } = require('../src/db')
var { order, customer, vendor ,disputes } = require('../src/collections').tables

const now = require('../src/date')


async function create(post) {

    let _d = await db(disputes)

    return await _d.insertOne(post)

}

async function find(value) {

    let _d = await db(disputes)

    return await _d.findOne(value)



}








async function getDisputes(post) {
    let _d = await db(disputes)
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

            $lookup: {
                from: order,
                localField: 'order_id',
                foreignField: '_id',

                as: 'order_info'

            }
        },
        {
            $unwind: "$order_info"
        }
        ,
        {
            $addFields: {
                "order_info.product": {
                    $map: {
                        input: "$order_info.product",
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
                "vendor":  {name: "$ven_info.business.name", phone:'$ven_info.phone', email:"$ven_info.email",address:"$ven_info.address"},
                "order":  {product: "$order_info.product", status:'$order_info.status', date_ordered:"$other_info.date_ordered",logs:"$order_info.logs"}

            }
        },
        {
            $project: {
                
                    
                    customer: 1,
                    vendor:1,
                    order:1

                }
            

        }


    ]).toArray()

}





module.exports.create = create

module.exports.getDisputes = getDisputes
