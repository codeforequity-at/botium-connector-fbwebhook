const Redis = require('ioredis')
const _ = require('lodash')
const randomize = require('randomatic')
const request = require('request-promise-native')
const crypto = require('crypto')
const debug = require('debug')('botium-connector-fbwebhook')

const Capabilities = {
  FBWEBHOOK_WEBHOOKURL: 'FBWEBHOOK_WEBHOOKURL',
  FBWEBHOOK_TIMEOUT: 'FBWEBHOOK_TIMEOUT',
  FBWEBHOOK_REDISURL: 'FBWEBHOOK_REDISURL',
  FBWEBHOOK_PAGEID: 'FBWEBHOOK_PAGEID',
  FBWEBHOOK_APPSECRET: 'FBWEBHOOK_APPSECRET'
}
const Defaults = {
  [Capabilities.FBWEBHOOK_PAGEID]: 123456,
  [Capabilities.FBWEBHOOK_TIMEOUT]: 10000
}

const getTs = () => {
  return (new Date()).getTime()
}

class BotiumConnectorFbWebhook {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.redis = null
    this.facebookUserId = null
  }

  Validate () {
    debug('Validate called')

    Object.assign(this.caps, Defaults)

    if (!this.caps[Capabilities.FBWEBHOOK_WEBHOOKURL]) throw new Error('FBWEBHOOK_WEBHOOKURL capability required')

    return Promise.resolve()
  }

  async Build () {
    debug('Build called')
    await this._buildRedis()
  }

  async Start () {
    debug('Start called')
    this.facebookUserId = randomize('0', 10)
    await this._subscribeRedis()
  }

  async UserSays (msg) {
    debug('UserSays called')
    const msgData = {}
    if (msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].text || msg.buttons[0].payload)) {
      msgData.sourceData = {
        postback: {
          title: msg.buttons[0].text,
          payload: msg.buttons[0].payload || msg.buttons[0].text
        }
      }
    } else {
      msgData.sourceData = {
        message: {
          text: msg.messageText
        }
      }
    }
    const userSaysData = await this._sendToBot(msgData)
    msg.sourceData = Object.assign(msg.sourceData || {}, userSaysData)
  }

  async Stop () {
    debug('Stop called')
    await this._unsubscribeRedis()
    this.facebookUserId = null
  }

  async Clean () {
    debug('Clean called')
    await this._cleanRedis()
  }

  _buildRedis () {
    return new Promise((resolve, reject) => {
      this.redis = new Redis(this.caps[Capabilities.FBWEBHOOK_REDISURL])
      this.redis.on('connect', () => {
        debug(`Redis connected to ${JSON.stringify(this.caps[Capabilities.FBWEBHOOK_REDISURL] || 'default')}`)
        resolve()
      })
      this.redis.on('message', (channel, event) => {
        if (this.facebookUserId) {
          if (!_.isString(event)) {
            return debug(`WARNING: received non-string message from ${channel}, ignoring: ${event}`)
          }
          try {
            event = JSON.parse(event)
          } catch (err) {
            return debug(`WARNING: received non-json message from ${channel}, ignoring: ${event}`)
          }
          if (!event.to || event.to !== this.facebookUserId) {
            return
          }

          const botMsg = { sender: 'bot', sourceData: event }
          const fbMessage = event.body.message

          if (fbMessage.text) {
            botMsg.messageText = event.body.message.text
          }
          if (fbMessage.quick_reply) {
            botMsg.buttons = [{
              text: fbMessage.text,
              payload: fbMessage.quick_reply.payload
            }]
          }
          if (fbMessage.attachment) {
            const attachment = fbMessage.attachment.payload
            switch (attachment.template_type) {
              case 'generic': {
                botMsg.cards = []
                attachment.elements.map(element => {
                  botMsg.cards.push({
                    text: element.title,
                    subtext: element.subtitle,
                    image: element.image_url && {
                      mediaUri: element.image_url
                    },
                    buttons: element.buttons && element.buttons.map(button => ({text: button.title, payload: button.payload}))
                  })
                })
              }
              case 'button': {
                botMsg.buttons = []
                attachment.buttons.map(button => {
                  botMsg.buttons.push({
                    text: button.title,
                    payload: button.payload
                  })
                })
              }
              default:
                // Types of attachment not supported list, media, receipt, airline_boardingpass
                debug(`WARNING: recieved unsupported message from ${channel}, ignoring ${event}`)
            }
          }

          debug(`Received a message to queue ${channel}: ${JSON.stringify(botMsg)}`)
          setTimeout(() => this.queueBotSays(botMsg), 100)

          this._sendToBot({
            sourceData: {
              delivery: {
                mids: [
                  event.message_id
                ],
                watermark: getTs()
              }
            }
          }).catch((err) => {
            debug(`Sending delivery event failed, ignoring - ${err}`)
          })
        }
      })
    })
  }

  async _sendToBot (msg) {
    const ts = getTs()

    const msgContainer = {
      object: 'page',
      entry: [
        {
          id: this.caps[Capabilities.FBWEBHOOK_PAGEID],
          time: ts,
          messaging: []
        }
      ]
    }

    if (msg.sourceData) {
      msgContainer.entry[0].messaging.push(msg.sourceData)
    } else {
      debug(`No sourceData given. Ignored. ${msg}`)
      return
    }

    msgContainer.entry[0].messaging.forEach((fbMsg) => {
      if (!fbMsg.sender) fbMsg.sender = {}
      if (!fbMsg.sender.id) fbMsg.sender.id = this.facebookUserId

      if (!fbMsg.recipient) fbMsg.recipient = {}
      if (!fbMsg.recipient.id) fbMsg.recipient.id = this.caps[Capabilities.FBWEBHOOK_PAGEID]

      if (!fbMsg.delivery && !fbMsg.timestamp) fbMsg.timestamp = ts

      if (fbMsg.message) {
        if (!fbMsg.message.mid) fbMsg.message.mid = `mid.${randomize('0', 10)}`
      }
    })

    const requestOptions = {
      uri: this.caps[Capabilities.FBWEBHOOK_WEBHOOKURL],
      method: 'POST',
      headers: {
        'Botium': true
      },
      body: msgContainer,
      json: true,
      timeout: this.caps[Capabilities.FBWEBHOOK_TIMEOUT]
    }

    if (this.caps[Capabilities.FBWEBHOOK_APPSECRET]) {
      var hmac = crypto.createHmac('sha1', this.caps[Capabilities.FBWEBHOOK_APPSECRET])
      hmac.update(JSON.stringify(msgContainer), 'utf8')
      const calculated = 'sha1=' + hmac.digest('hex')
      requestOptions.headers['X-Hub-Signature'] = calculated
    }

    try {
      debug(`Sending message to ${requestOptions.uri}`)
      const response = await request(requestOptions)
      return { fbWebhookRequest: msgContainer, fbWebhookResponse: response }
    } catch (err) {
      throw new Error(`Failed sending message to ${requestOptions.uri}: ${err}`)
    }
  }

  _subscribeRedis () {
    return new Promise((resolve, reject) => {
      this.redis.subscribe(this.facebookUserId, (err, count) => {
        if (err) {
          return reject(new Error(`Redis failed to subscribe channel ${this.facebookUserId}: ${err}`))
        }
        debug(`Redis subscribed to ${count} channels. Listening for updates on the ${this.facebookUserId} channel.`)
        resolve()
      })
    })
  }

  _unsubscribeRedis () {
    return new Promise((resolve, reject) => {
      this.redis.unsubscribe(this.facebookUserId, (err) => {
        if (err) {
          return reject(new Error(`Redis failed to unsubscribe channel ${this.facebookUserId}: ${err}`))
        }
        debug(`Redis unsubscribed from ${this.facebookUserId} channel.`)
        resolve()
      })
    })
  }

  _cleanRedis () {
    if (this.redis) {
      this.redis.disconnect()
      this.redis = null
    }
  }
}

module.exports = BotiumConnectorFbWebhook
