var axios = require('axios')
const verify_url = 'https://api.paystack.co/transaction/verify/'


async  function verifyPayment(ref){

  return await axios.get(
        verify_url + encodeURIComponent(ref),
        {
            headers:{
                 authorization: process.env.PAY_STACK_SECRET_TEST,
                'content-type': 'application/json',
                'cache-control': 'no-cache'
            }
        }
    )
}


exports.verify = verifyPayment


