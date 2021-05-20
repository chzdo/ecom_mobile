var express = require('express')
var router = express.Router
var emailService = require('../src/email')
var { Auth, isPermitted } = require('../src/auth')
var jwt = require('jsonwebtoken')
var { ObjectId } = require('bson')
var bycrpt = require('bcrypt')
var { isPast, isAfter, add, isBefore } = require('date-fns')
var { create, find, findAll, updateOne, findandUpdate, updatePatch, hasSubscription, createSubscription, getOrders, getOrder, updateOrder, getMessages, addMessage, seenMessage, getDisputes } = require('../models/vendor')
var mQ = require('../src/queue')
var now = require('../src/date')
const { check, validationResult, body } = require('express-validator')
var { verify } = require('../src/paystack')
var path = require('path')



let app = router()


const action ={
   Placed: 'Placed Order',
   Complain: 'Complaint Created',
   Override: 'Override Keep In',
   Accepted: 'Accepted Order',
    Rejected : 'Rejected Order',
    Processing :'Processing Order',
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



/**  Route to create a vendor */
app.post('/create', [
    check('phone').notEmpty().bail().withMessage('Phone Number is required').isNumeric().withMessage('Phone number must be numbers').bail().custom(checkPhone).trim(),
    check('email').notEmpty().bail().withMessage('Email is required').isEmail().withMessage('Invalid Email Address').custom(checkEmail).trim(),
    check('name').notEmpty().withMessage('name is required').bail().isString().withMessage('name must be a string').trim(),
    check('password').notEmpty().withMessage('Password is required').bail().isString().withMessage('password must be a string').isLength({ min: 11, max: 25 }).trim(),
    check('confirm_password', 'password mismatch').notEmpty().bail().exists().bail().custom((value, { req }) => value == req.body.password),

], async function (req, res) {
    try {

        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
        }

        delete req.body.confirm_password
        req.body.password = bycrpt.hashSync(req.body.password, 10)
        req.body.verified = false,
            req.body.reg_complete = false
        req.body.type = "vendor"
        var dt = new Date()
        dt.setMinutes(dt.getMinutes() + 30)
        dt.setTime(dt.getTime() - dt.getTimezoneOffset() * 60 * 1000)
        req.body.code = {
            code: Math.floor(1000 + Math.random() * 9000),
            exp: dt
        }


        create(req.body).then(async ({ ops: [{ password, ...payload }] }) => {
            let ops = Object.assign({}, payload)
            ops.code = ops.code.code
           
            delete payload.password
           // delete payload.code


            let a = mQ.EnqMail({
                from: process.env.EMAIL_FROM,
                to: ops.email,
                subject: 'Account Confirmation',
                html: await emailService.templates('./templates/vendor/register.html', ops)
            })

            let message = `An Email has been sent to ${ops.email}! please confirm you email `;
            res.status(200).send({ message, payload })
        }).catch(e => res.status(500).send({ message: e.message }))
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


/** login route */
app.post('/login', async function (req, res) {

    try {
        await body('email').notEmpty().withMessage('Email is required!').bail().isEmail().withMessage('Invalid Email Address').trim().run(req)
        await body('password').notEmpty().withMessage('Password is required!').trim().run(req)

        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }
        let { email, password } = req.body
        find({ email }).then((value) => {

            if (!value) {
                res.status(404).send({ message: 'vendor not found' })
                return;
            }

            if (!bycrpt.compareSync(password, value.password)) {
                res.status(404).send({ message: 'vendor not found' })
                return;
            }

            if (!value.verified) {
                res.status(400).send({ message: 'You have not verified account', payload: { redirect: true } })
                return;
            }



            value.type = "vendor"
            delete value.password
            delete value.business
            delete value.reviews
            delete value.products
            delete value.code
       
            let access = jwt.sign({
                data: value
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP, notBefore: 0, issuer: process.env.JWT_ISS, audience: process.env.JWT_AUD });

            res.status(200).send({ message: 'vendor found', 'payload': access })
        }).catch(e => res.status(500).send({ message: e.message }))
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

/**  verify account route */
app.patch('/account', async function (req, res) {
    try {
        var dt = new Date()
        dt.setTime(dt.getTime() - dt.getTimezoneOffset() * 60 * 1000);

        await body('_id').notEmpty().withMessage('_id is required!').bail().isMongoId().withMessage('Invalid Email Address').trim().customSanitizer(e => (ObjectId(e))).
            custom(e => (find({ _id: e }).then(e => (!e && Promise.reject('Inavlid ID'))))).run(req)
        await body('code').notEmpty().withMessage('Code is required!').custom((e, { req }) => (
            find(
                {

                    $and: [
                        {
                            '_id': req.body._id
                        },
                        {
                            'code.code': e
                        },
                        {
                            'code.used': {
                                $exists: false
                            }
                        },
                        {
                            'code.exp': {
                                $gte: dt
                            }
                        }
                    ]
                }
            ).then(e => {
                console.log(e);
                return !e && Promise.reject('Invalid or expired code')
            }
            ))).

            trim().run(req)

        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }

        let { _id } = req.body

        post = {
            _id,
            verified: true,
            'code.used': true
        }
        updateOne(post).then((value) => {

            if (!value) {
                res.status(500).send({ message: 'Something went wrong' })
                return;
            }
            if (value.result.n == 0) {
                res.status(404).send({ message: 'Could not find ID' })
                return;
            }


            res.status(204).send({})
        }).catch(e => res.status(500).send({ message: e.message }))
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


/**  resend code route */
app.patch('/resend', async function (req, res) {

    try {
        await body('_id').notEmpty().withMessage('_id is required!').bail().isMongoId().withMessage('Invalid Email Address').trim().customSanitizer(e => (ObjectId(e))).
            custom(e => (find({ _id: e }).then(e => (!e && Promise.reject('Inavlid ID'))))).run(req)


        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }



        var dt = new Date()
        dt.setMinutes(dt.getMinutes() + 30)
        dt.setTime(dt.getTime() - dt.getTimezoneOffset() * 60 * 1000)
        req.body.code = {
            code: Math.floor(1000 + Math.random() * 9000),
            exp: dt
        }
      
        findandUpdate(req.body).then(async (resp) => {
            
            if (!resp) {
                res.status(500).send({ message: 'Something went wrong' })
                return;
            }
            if (!resp.value) {
                res.status(404).send({ message: 'Could not find ID' })
                return;
            }
            let { value } = resp
            value.code = req.body.code.code

            mQ.EnqMail({
                from: process.env.EMAIL_FROM,
                to: value.email,
                subject: 'Account Activation',
                html: await emailService.templates('./templates/vendor/register.html', value)

            })

            res.status(200).send({ message: 'Code has been sent to your email' })
        }).catch(e => res.status(500).send({ message: emessage }))
    } catch (e) {
        res.status(500).send({ message: emessage })
    }
})



/***  Routes with Auth listed below */


app.use([Auth, isPermitted(find, 'vendor')])
/**  Route to get all vendors */








/** @userinfo Route to get a vendor */
app.get('/', async function (req, res) {

    delete req.user.password
    delete req.user.code

    let a =  await find({_id : req.user._id})
    delete a.password
    delete a.code
    res.status(200).send({ message: 'user found', 'payload': a })

})

/**  @address Route to update address*/
app.patch('/address', async function (req, res) {
    try {
        await body('address').notEmpty().withMessage('Address Required').bail().isString().withMessage('address must be a string').trim().run(req)
        await body('state').notEmpty().withMessage('State Required').bail().isString().withMessage('state must be a string').trim().run(req)
        await body('lga').notEmpty().withMessage('LGA Required').bail().isString().withMessage('lga must be a string').trim().run(req)

        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
        }

        let post = {
            _id: ObjectId(req.user._id),
            ...req.body
        }


        updateOne(post).then(e => {

            if (!e) {
                res.status(500).send({ message: 'Something went wrong' })
                return;
            }
            if (e.result.n == 0) {
                res.status(404).send({ message: 'Could not find ID' })
                return;
            }


            res.status(204).send()
        }).catch(e => { res.status(500).send({ message: e.message }) })

    } catch (e) {
        res.status(500).send({ message: e.message })
    }


})

/**  @address Route to update location*/

app.patch('/location', async function (req, res) {
    try {
        await body('latlong').notEmpty().withMessage('Latitude Required').bail().isLatLong().withMessage('must be a cordinate').trim().run(req)

        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
        }

        var c = Array.from(req.body.latlong.split(","), (v, k) => parseFloat(v))

        let post = {
            _id: ObjectId(req.user._id),
            location: {
                type: "Point",
                coordinates: [...c]
            }
        }
        updateOne(post).then(e => {
            if (!e) {
                res.status(500).send({ message: 'Something went wrong' })
                return;
            }
            if (e.result.n == 0) {
                res.status(404).send({ message: 'Could not find ID' })
                return;
            }


            res.status(204).send()
        }).catch(e => { res.status(500).send({ message: e.message }) })

    } catch (e) {
        res.status(500).send({ message: e.message })
    }


})


/**  Route to verify nin  and business name
**/
app.patch('/verify_identity', [
    body('nin').notEmpty().withMessage('NIN is required').bail().isLength({ min: 11, max: 11 }).withMessage('Invalid NIN')
        .custom(checkNIN),
    body('rc_number').notEmpty().withMessage('RC is required').bail().isLength({ min: 11, max: 11 }).withMessage('Invalid RC Number')
        .custom(checkRC),
    body('name').notEmpty().withMessage('Name is required').bail()
        .custom(checkName)
], (req, res) => {
    try {
        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }

        let { nin, ...rest } = req.body

        if(!(req.user.address && req.user.location)){
            res.status(400).send({message:'You have not added your address or location'})
            return;
        }
        var post = {
            _id: req.user._id,
            nin: nin,
            business: {
                ...rest
            },
            reg_complete: true
        }

        //run external api to confirm NIN and RC_NUMBER

        updateOne(post).then(async e => {
            if (!e) {
                res.status(500).send({ message: 'Something went wrong' })
                return;
            }
            if (e.result.n == 0) {
                res.status(404).send({ message: 'Could not find ID' })
                return;
            }
            delete post._id
            post.name = req.user.name

            mQ.EnqMail({
                from: process.env.EMAIL_FROM,
                to: req.user.email,
                subject: 'Business Name Verification',
                html: await emailService.templates('./templates/vendor/verify_business.html', post)
            })
            let message = "NIN Verified !"
            res.status(201).send({ message })

        }).catch(e => (res.status(500).send({ message: e.message })))
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.use([isVerified])

app.post('/subscribe', [
    body('ref').notEmpty().withMessage('Ref is required').bail().isLength({ min: 13, max: 13 }).withMessage('Invalid Ref')
    ,
    body('type').notEmpty().withMessage('type  is required').bail().isIn(['Monthly', 'Yearly']).withMessage('Invalid Type')
    ,
    body('duration').notEmpty().withMessage('duration is required').bail().isInt({ min: 1, max: 12 }).withMessage('Invalid duration').toInt()

], async (req, res) => {
    try {
        let errors = validationResult(req)

        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }


        let hasSub = await hasSubscription(req.user._id, now)

        if (hasSub) {
            res.status(400).send({ message: 'You still have an active subcription' })
            return;
        }



        let { data } = await verify(req.body.ref)

        if (data.status != true) {
            res.status(500).send({ message: 'Server Error' })
            return
        }

        let { data: { customer, ...rest } } = data

        if (customer.email == req.user.email) {
            res.status(400).send({ message: 'This payment is not attributed to this user!' })

        }

        let basic_amount = req.body.type == 'Monthly' ? process.env.MONTHLY_PAYMENT : process.env.YEARLY_PAYMENT

        let expected_amount = parseInt(basic_amount) * parseInt(req.body.duration)

        if (expected_amount == rest.amount) {
            res.status(400).send({ message: 'The amount paid does not tally with plan selected! please contact us for clarification' })
            return
        }

        let opts = req.body.type == 'Monthly' ? { months: parseInt(req.body.duration) } : { years: parseInt(req.body.duration) }
        var post = {
            _id: req.user._id,
            ...req.body,
            date_started: new Date(rest.paid_at),
            exp_date: add(new Date(rest.paid_at), opts),
            amount: formatter.format(rest.amount),
            status: true,
            pay_status: rest.status


        }




        let upd = await createSubscription(post)
        if (!upd) {
            res.send({ message: 'Something went wrong' })
            return;
        }

        post.name = req.user.name


        mQ.EnqMail({
            from: process.env.EMAIL_FROM,
            to: req.user.email,
            subject: 'Subscription Notice',
            html: await emailService.templates('./templates/vendor/subscription.html', post)
        })
        mQ.EnqMail({
            from: process.env.EMAIL_FROM,
            to: req.user.email,
            subject: 'Subscription Payment Reciept',
            html: await emailService.templates('./templates/vendor/subscription_reciept.html', post)
        })
        let message = "Subscription Successful "

        res.status(201).send({ message, payload: post })



    } catch (e) {
        res.status(500).send({ message: e.message })
    }

})


app.get('/orders', async function (req, res) {
    try {


        let r = await getOrders(req.user._id)
          if(r.length == 0){
            res.status(404).send({ message: 'Orders not found' })
            return
          }
        res.status(200).send({ message: 'success', payload: r })
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.get('/disputes', async function (req, res) {
    try {


        let r = await getDisputes(req.user._id)
        
        if(r.length == 0){
            res.status(404).send({ message: 'Disputes  not found' })
            return
          }

        res.status(200).send({ message: 'success', payload: r })
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.get('/orders/:_id', async function (req, res) {
    try {
        await check("_id").notEmpty().isMongoId().trim().customSanitizer(e => ObjectId(e)).run(req)

        let errors = validationResult(req)


        if (!errors.isEmpty()) {

            res.status(422).send(errors)
            return;
        }


        let r = await getOrder({_id:req.user._id,o_id: req.params._id})
      

        if(r.length == 0){
            res.status(404).send({message:'Order not found'})
            return;
        }


        res.status(200).send({ message: 'success', payload: r })
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.patch('/orders', async function (req, res) {
    try {
        await body("_id").notEmpty().isMongoId().trim().customSanitizer(e => ObjectId(e)).run(req)
        

        await body("status").notEmpty().isIn([            
            'Accepted',
            'Processing',
            'Waiting Delivery',
            'Waiting  Pickup',
            'Rejected',
            'Cancelled',
            'Completed'
          ]).trim().run(req)

                
        let errors = validationResult(req)
        
        if (!errors.isEmpty()) {

            res.status(422).send(errors)
            return;
        }

        let [resp] = await getOrder(req.user._id,req.body._id)
        let  {orders} = resp
        
     
        
        if(!(orders.hasPassedKeepIn && orders.override_keep_in)){
            res.status(400).send({message:`Keep in time has passed! Please Override before you continue`})
            return
        }
         if(['Completed','Rejected', 'Cancelled'].includes(orders.status)){
            res.status(400).send({message:`This transaction has been ${orders.status}`})
            return
         }
        if(orders.status == 'Placed' && !['Accepted','Rejected'].includes(req.body.status)){
                   res.status(400).send({message:"Invalid status update"})
                   return
        }else if(orders.status == 'Accepted' && !['Processing'].includes(req.body.status)){
            res.status(400).send({message:"Invalid status update"})
            return
        }else if(orders.status == 'Processing' && !['Cancelled','Waiting Delivery','Waiting  Pickup'].includes(req.body.status)){
            res.status(400).send({message:"Invalid status update"})
            return
        }else if((orders.status == 'Waiting Delivery' || orders.status == 'Waiting  Pickup')  && !['Cancelled','Completed'].includes(req.body.status)){
            res.status(400).send({message:"Invalid status update"})
            return
        }
      
        if(req.body.status == 'Completed' && !orders.confirm_payment){
            res.status(400).send({message:"Please you have not confirmed payment"})
            return
        }
     
        let post = {
            _id: req.body._id,
            u_id: {
                key: "ven_id",
                value: req.user._id
            },
             status: req.body.status,
            log: {
                action: action[req.body.status],
                by: req.user._id,
                date: now,
                reason: req.body.reason || "N/A"

            }
        }

        let r = await updateOrder(post)

        if (!r.value) {
            res.status(400).send({ message: 'Update not successfully! Could not find item !' })
            return;
        }

        mQ.EnqMail({
            from:process.env.EMAIL_FROM,
            to: orders.customer.email,
            Subject: `Order ${req.body._id} Status Change`,
            html: await emailService.templates('./templates/vendor/order_status.html',orders.customer)
        })
      

        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.patch('/orders/override_keep_in/', async function (req, res) {
    try {

        
        await check("_id").notEmpty().withMessage('Order ID is required').bail().isMongoId().bail().trim().customSanitizer(e => ObjectId(e)).run(req)

        let errors = validationResult(req)


            if (!errors.isEmpty()) {

            res.status(422).send(errors)
            return;
        }
        let post = {
            _id: req.body._id,
            u_id: {
                key: "ven_id",
                value: req.user._id
            },
            override_keep_in: true,
            log: {
                action: "Override Keep In",
                by: req.user._id,
                date: now,
                reason: "Vendor choice"

            }
        }

        let r = await updateOrder(post)

        if (!r.value) {
            res.status(400).send({ message: 'Update not successfully! Could not find item !' })
            return;
        }

        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.patch('/orders/confirm_payment', async function (req, res) {
    try {

        
        await check("_id").notEmpty().withMessage('Order ID is required').bail().isMongoId().bail().trim().customSanitizer(e => ObjectId(e)).run(req)

        let errors = validationResult(req)


            if (!errors.isEmpty()) {

            res.status(422).send(errors)
            return;
        }

        let [order] = await getOrder(req.user._id,req.body._id)

        let {orders} = order

        if(!['Waiting Delivery','Waiting Self Pickup'].includes(orders.status)){
             res.status(400).send({message:'Order is not yet ready to accept payment! Ensure you place aorder on waiting Delivery or Pickup'})
             return
        }
        let post = {
            _id: req.body._id,
            u_id: {
                key: "ven_id",
                value: req.user._id
            },
            confirm_payment: true,
            log: {
                action: action.Payment,
                by: req.user._id,
                date: now,
                reason: "Client Paid"

            }
        }
 
        let r = await updateOrder(post)

        if (!r.value) {
            res.status(400).send({ message: 'Update not successfully! Could not find item !' })
            return;
        }

        mQ.EnqMail({
            from:process.env.EMAIL_FROM,
            to: orders.customer.email,
            Subject: `Order ${req.body._id} Payment Confirmation`,
            html: await emailService.templates('./templates/vendor/order_reciept.html',orders.customer)
        })

        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})



app.get('/messages', async function (req, res) {
    try {
 
    
        let r = await getMessages(req.user)
   
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
            return;
        }

        if(r.length == 0){
            res.status(404).send({ message: 'No Messages' })
            return;
        }
     
        res.status(200).send({message:"success", payload:r})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.post('/messages', async function (req, res) {
    try {
            await body('s_id').notEmpty().withMessage('Reciever ID required').bail().isMongoId().trim().customSanitizer(e=> ObjectId(e)).run(req)
            await body('message').notEmpty().withMessage('message is required').bail().trim().run(req)
           
       let errors = validationResult(req)

       if(!errors.isEmpty()){
           res.status(422).send(errors)
           return;
       }

       var post = {
           f_id:req.user._id,
           s_id:req.body.s_id,           
           respondent:{
               _id : new ObjectId(),
               sender: req.user._id,
               reciever: req.body.s_id,
               date: now,
               message:req.body.message

           }
       }
         
       let  r = await addMessage(post)

   
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
            return;
        }
   
     
        res.status(201).send({message:"success", payload:r.value})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.patch('/messages', async function (req, res) {
    try {
            await body('_id').notEmpty().withMessage('Message ID required').bail().isMongoId().trim().customSanitizer(e=> ObjectId(e)).run(req)
          
       let errors = validationResult(req)

       if(!errors.isEmpty()){
           res.status(422).send(errors)
           return;
       }

       var post = {
            _id: req.user._id,
            m_id:req.body._id,           
            seen:true,
            seen_at: now
       }
         
       let  r = await seenMessage(post)

   
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
            return;
        }
   
     
        res.status(201).send({message:"success", payload:r.value})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})










/** Routes that need active subscription */

app.use([hasSub, require('express-fileupload')({ debug: true })])


app.post('/products', async function (req, res) {
    try {
        await body('name').notEmpty().withMessage('Name of product is required').trim().escape().custom(checkPName).run(req)
        await body('item').notEmpty().withMessage('Item Name of product is required').trim().escape().run(req)
        await body('amount').notEmpty().withMessage('Amount of product is required').trim().escape().customSanitizer(e => (formatter.format(e))).run(req)
        await body('category').notEmpty().withMessage('Category of product is required').trim().escape().run(req)
        await body('keywords').notEmpty().withMessage('keywords of product is required').trim().run(req)
        await body('qty').notEmpty().withMessage('Qty of product is required').isInt().withMessage('qty must be numeric').trim().escape().toInt().run(req)

        if (!req.files) {
            res.status(422).send({ message: 'image is required' })
            return;
        }

        if (!req.files.image) {
            res.status(421).send({ message: 'image is required' })
            return;
        }
        let img = req.files.image
        if (!['image/jpeg', 'image/jpg'].includes(img.mimetype)) {
            res.status(421).send({ message: 'Wrong Image file! jpeg required' })
            return;
        }
        if (img.size > 50000) {
            res.status(421).send({ message: 'image is size too big. should be 50kb' })
            return;
        }

        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }

        let Obj = new ObjectId()

        let { keywords, ...rest } = req.body
        keywords = keywords.split(",")
        // let img_path = 
        // let ch = ()=> console.log('hello')   
        img.path = __dirname + '/../static/images/' + Obj + path.extname(img.name)
        mQ.EnqImg(img)

        let olPrds = req.user.products ? req.user.products : []
        let post = {
            _id: req.user._id,
            products: [
                ...olPrds,
                {
                    _id: Obj,
                    ...rest,
                    keywords,
                    image: process.env.IMG_URL + Obj + path.extname(img.name),
                    date_created: now
                }
            ]
        }
        //  res.send(post)
        let r = await updateOne(post)
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
        }
        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.patch('/products/:_id', async function (req, res) {
    try {
        await check('_id').trim().escape().isMongoId().withMessage('Inavlid request').customSanitizer(e => ObjectId(e)).custom(checkPID).run(req)
        await body('name').optional().trim().escape().custom(checkPName).run(req)
        await body('item').optional().trim().escape().run(req)
        await body('amount').optional().trim().escape().customSanitizer(e => (formatter.format(e))).run(req)
        await body('category').optional().trim().escape().run(req)
        await body('keywords').optional().trim().run(req)
        await body('qty').optional().isInt().withMessage('qty must be numeric').trim().escape().toInt().run(req)

        if (req.files) {
            if (req.files.image) {
                let img = req.files.image
                if (!['image/jpeg', 'image/jpg'].includes(img.mimetype)) {
                    res.status(421).send({ message: 'Wrong Image file! jpeg required' })
                    return;
                }
                if (img.size > 50000) {
                    res.status(421).send({ message: 'image is size too big. should be 50kb' })
                    return;
                }
                img.path = __dirname + '/../static/images/' + req.params._id + path.extname(img.name)
                mQ.EnqImg(img)
                req.body.image = process.env.IMG_URL + req.params._id + path.extname(img.name)

            }


        }



        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }


        keywords = req.body.keyword && keywords.split(",")
        let set = {}



        Object.keys(req.body).forEach(e => {
            set["products.$." + e] = req.body[e]
        })

        let post = {
            _id: req.user._id,
            subElem: "products",
            subElemId: ObjectId(req.params._id),
            ...set
        }

        let r = await updatePatch(post)
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
            return
        }
        if (!r.value) {
            res.status(404).send({ message: 'user ID not found' })
            return;
        }
        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})

app.patch('/reviews/reply', async function (req, res) {
    try {
        await body('_id').notEmpty().withMessage('Review id is required').bail().isMongoId().withMessage('Invalid ID').bail().trim().escape().run(req)
        await body('reply').notEmpty().withMessage('reply is required').trim().escape().run(req)
       
   

        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }
      
        let post = {
            _id: req.user._id,
            subElem: "reviews",
            subElemId: ObjectId(req.body._id),
            "reviews.$.reply" : req.body.reply,
            "reviews.$.reply_date" : now
        }
        //  res.send(post)
        let r = await updatePatch(post)
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
        }
        if (!r.value) {
            res.status(404).send({ message: 'Review Not found' })
        }
        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})


app.patch('/reviews/seen', async function (req, res) {
    try {
        await body('_id').notEmpty().withMessage('Review id is required').bail().isMongoId().withMessage('Invalid ID').bail().trim().escape().run(req)
       

        let errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.status(422).send(errors)
            return;
        }
      
        let post = {
            _id: req.user._id,
            subElem: "reviews",
            subElemId: ObjectId(req.body._id),
            "reviews.$.seen" : true,
            "reviews.$.seen_at" : now
        }
        //  res.send(post)
        let r = await updatePatch(post)
        if (!r) {
            res.status(500).send({ message: 'Something went wrong' })
        }
        if (!r.value) {
            res.status(404).send({ message: 'Review Not found' })
        }
        res.status(204).send({})
    } catch (e) {
        res.status(500).send({ message: e.message })
    }
})





/**  custom validation */
function checkPhone(value) {
    return find({ phone: value }).then(e => (e && Promise.reject('This phone number already exist')))
}
function checkID(value) {
    return find({ _id: value }).then(e => (e && Promise.reject('ID already exist')))
}

function checkEmail(value) {
    return find({ email: value }).then(e => (e && Promise.reject('This Email already exist')))
}
function checkNIN(value) {
    return find({ nin: value }).then(e => (e && Promise.reject('This NIN already exist')))
}
function checkRC(value) {
    return find({ 'business.rc_number': value }).then(e => (e && Promise.reject('This NIN already exist')))
}
function checkName(value) {
    return find({ 'business.name': value }).then(e => (e && Promise.reject('This NIN already exist')))
}
function checkPName(value,{req}) {
    return find({ _id: req.user_id, 'products.name': value }).then(e => (e && Promise.reject('This Product  already exist : check name')))
}
function checkPID(value) {
    return find({ 'products._id': value }).then(e => (!e && Promise.reject(" Invalid Request")))
}
/**  custom Auth for vendors */

function hasSub(req, res, next) {

    hasSubscription(req.user._id, now).then(
        e => {
            if (e) {
                next()
                return
            }
            res.status(400).send({ message: 'You do not have an active subscription' })
            return
        }
    ).catch(e => res.status(500).send({ message: e.message }))




}

function isVerified(req, res, next) {

  
    if(!(req.user.verified && req.user.reg_complete)){
        res.status(400).send({message:"You have not completed your profile"})
        return;
        
    }

  next()


}

module.exports = app