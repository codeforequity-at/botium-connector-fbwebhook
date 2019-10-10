const express = require('express')
const Redis = require('ioredis')
const bodyParser = require('body-parser')
const randomize = require('randomatic')
const debug = require('debug')('botium-fbwebhook-proxy')

const processEvent = async (event, { redis, ...rest }) => {
  try {
    debug('Got Message Event:')
    debug(JSON.stringify(event, null, 2))

    if (event.to) {
      redis.publish(event.to, JSON.stringify(event))
      debug(`Published event for recipient id ${event.to}`)
    }
  } catch (err) {
    debug('Error while publishing to redis')
    debug(err)
  }
}

const setupEndpoints = ({ app, endpoint, redisurl, ...rest }) => {
  const redis = new Redis(redisurl)
  redis.on('connect', () => {
    debug(`Redis connected to ${JSON.stringify(redisurl || 'default')}`)
  })
  const messagesEndpoint = (endpoint || '/') + '*/me/messages'
  const catchAllEndpoint = (endpoint || '/') + '*'

  app.post(messagesEndpoint, (req, res) => {
    console.log(req.url)
    console.log(req.body)
    if (req.body) {
      const response = {
        recipient_id: req.body.recipient && req.body.recipient.id,
        message_id: `mid.${randomize('0', 10)}`
      }
      processEvent({
        to: req.body.recipient && req.body.recipient.id,
        message_id: response.message_id,
        body: req.body
      }, { redis, ...rest })
      res.status(200).json(response)
    } else {
      res.status(200).end()
    }
  })

  app.get(catchAllEndpoint, (req, res) => {
    res.json({
      first_name: 'Botium',
      last_name: 'Botium',
      profile_pic: 'http://www.google.com',
      locale: 'en_US',
      timezone: -7,
      gender: 'male'
    })
  })

  app.all(catchAllEndpoint, (req, res) => {
    res.json({ hint: `Botium Facebook Messenger Platform emulator</br>POST messages to ${messagesEndpoint}` }).end()
  })
}

const startProxy = ({ port, endpoint, ...rest }) => {
  const app = express()

  app.use(endpoint, bodyParser.json())
  app.use(endpoint, bodyParser.urlencoded({ extended: true }))

  setupEndpoints({ app, endpoint, ...rest })

  app.listen(port, () => {
    console.log(`Botium Facebook Messenger Platform emulator is listening on port ${port}`)
    console.log(`Facebook Messenger Platform emulator endpoint available at http://127.0.0.1:${port}${endpoint}`)
  })
}

module.exports = {
  setupEndpoints,
  startProxy
}
