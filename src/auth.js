var jwt = require('jsonwebtoken')
var {ObjectId} = require('bson')


function Auth(req, res, next) {

    if (req.headers['authorization']) {
          let auth =  req.headers['authorization'].split(" ");
       
          try{
         
          if(auth[0] != 'Bearer'){
              res.status(401).send({message: 'Not Authorized'})
          }else{
              req.jwt = jwt.verify(auth[1],process.env.JWT_SECRET)
              next()
          }
        }catch(e){
            res.status(401).send({message:e.message})
        }
    } else {
        res.status(403).send({ message: 'Not Authorized' })
    }
}

function isPermitted(fn,user){
    return function isVendor(req, res, next) {

        if (!req.jwt) {
            res.status(403).send({ message: 'not authorized2' })
            return;
        }
   
        let { data: { _id } } = req.jwt
         fn({ _id : ObjectId(_id) }).then(e => {
            if (!e) {
                res.status(403).send({ message: 'not authorized1' })
                return;
            }
           
            if(e.type !== user || e.verified !== true){
                res.status(403).send({ message: 'not authorized3' })
                return;
            }  
    
            req.user = e
    
            next()
    
        }).catch(e=>{ res.status(500).send({message:'something went wrong!'})})
    }
}



exports.Auth = Auth
exports.isPermitted = isPermitted
