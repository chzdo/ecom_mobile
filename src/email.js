var email = require('nodemailer');
var engine = require('consolidate')
let emailer = email.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  })

  module.exports.sendMail = async (post)=> await emailer.sendMail(post)
  module.exports.templates = engine.swig