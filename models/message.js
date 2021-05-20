var { db } = require('../src/db')
var {messages,customer,vendor} = require('../src/collections').tables




async function create(post) {

  let _d = await db(messages)

  return await _d.insertOne(post)

}

async function find(post) {

  let collect = post.type == 'vendor' ? [customer, "s_id", "f_id"]: [vendor,"f_id" , "s_id"]
  console.log(post._id,collect,{ [collect[3]] : post._id})
  let _d = await db(messages)

  return await _d.aggregate([
    {
      $match: { [collect[2]] : post._id}
    },
    {
      $lookup: {
        from: collect[0],
        localField: collect[1],
        foreignField :"_id",
          as : "other"
      }
       
    },

    {
      $unwind:"$other"
    },
     
    {
      $addFields:{
        "other.displayName":{
          $cond:{
            if:{
              $eq:["$other.type",'vendor']
            }, 
            then: "$other.business.name", else : "$other.name"
          }
        }
      }
    }
    ,
    {
      $project:{
        s_id:1,
        f_id:1,
        _id:1,
        respondent:1,
        other:{
            displayName : 1,
            phone: 1,
            "business.name" :1,
            "address" : 1,
            email : 1

        }
      }
    }

    
  

      
    ]).toArray()



}

async function addMessage(post) {

  let { f_id, s_id, respondent } = post
  let _d = await db(messages)

  return await _d.findAndModify(
    { f_id: f_id, s_id: s_id },
    [],
    {
      $push: {
        respondent: { ...respondent }
      }
    },
    { upsert: true, new: true }

  )

}

async function seenMessage(post) {

  let { _id, m_id, seen, seen_at } = post
  let _d = await db(messages)

  return await _d.findAndModify(
    { f_id: _id, _id: m_id },
    [],
    {
      $currentDate:{
        last_modified:true
      },
      $set: {
        "respondent.$[].seen": true,
        "respondent.$[].seen_at": seen_at
        
      }
    },
    {  new: true }

  )

}




module.exports.create = create
module.exports.find = find
module.exports.addMessage = addMessage
module.exports.seenMessage = seenMessage
