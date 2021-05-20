
const Queue = require('beequeue');
const { id } = require('date-fns/locale');
const fs = require('fs')
var emailService = require('./email')


let opt = {
  prefix: 'bq',
  stallInterval: 5000,
  nearTermWindow: 1200000,
  delayedDebounce: 1000,
  redis: {
    host: '127.0.0.1',
    port: 6379,
    db: 0,
    options: {},
  },
  isWorker: true,
  getEvents: true,
  sendEvents: true,
  storeJobs: true,
  ensureScripts: true,
  activateDelayedJobs: false,
  removeOnSuccess: true,
  removeOnFailure: false,
  redisScanCount: 100,
}
const Email_Q = new Queue('email',opt);
const IMG_Q = new Queue('img',opt);

exports.EnqMail = (mail)=>{
  return   Email_Q.createJob(mail).retries(3).save();
}

exports.EnqImg = (img)=>{

  return   IMG_Q.createJob(img).retries(3).save();
}











IMG_Q.on('ready', function () {
  IMG_Q.process(function (job, done) {
 
  console.log('processing image job ' +job.id);
  setTimeout( async function () {
  let buf =   Buffer.from(job.data.data,'base64')
  console.log(buf)
  try{
  //  if(fs.existsSync(job.data.path)){
    //  fs.unlinkSync(job.data.path)
   // }
    fs.writeFileSync(job.data.path,buf)
      done(null,"hello")
}catch(e){
  done(e)
}

  }, 10000);
});

console.log('processing image jobs...');
});













Email_Q.on('ready', function () {
    Email_Q.process(function (job, done) {
       console.log(job)
    console.log('processing email job ' +job.id);
    setTimeout( async function () {
       let a =  await emailService.sendMail(job.data)
       if(a.accepted){
        done(null,a)
        return
       }
        done(a)
    }, 10000);
  });

  console.log('processing email jobs...');
});



Email_Q.on('succeeded', function (result) {
    console.log('completed job ' + result);
   // res.send('output: ' + result);
  });

  IMG_Q.on('succeeded', function (result) {
    console.log('completed job ' + result);
   // res.send('output: ' + result);
  });


  Email_Q.on('failed', function (result) {
    console.log(result)
    console.log('completed job ' + result);
   // res.send('output: ' + result);
  });

  IMG_Q.on('failed', function (result) {
    console.log(result)
    console.log('completed job ' + result);
   // res.send('output: ' + result);
  });


  