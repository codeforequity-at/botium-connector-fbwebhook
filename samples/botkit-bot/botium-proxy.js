const nock = require('nock')
const request = require('request')

const botiumEndpoint = 'http://127.0.0.1:5000/'

nock('https://graph.facebook.com')
  .post(/.*/)
  .reply((uri, requestBody, cb) => {
    request.post({
      uri: botiumEndpoint + uri,
      json: requestBody
    }, (err, response, body) => {
      if (err) cb(err)
      else cb(null, [response.statusCode, body])
    })
  })
  .persist()
