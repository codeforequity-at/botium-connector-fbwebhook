const util = require('util')
const crypto = require('crypto')
const randomize = require('randomatic')
const debug = require('debug')('botium-connector-fbwebhook')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const { Capabilities: CoreCapabilities } = require('botium-core')

const Capabilities = {
  FBWEBHOOK_WEBHOOKURL: 'FBWEBHOOK_WEBHOOKURL',
  FBWEBHOOK_TIMEOUT: 'FBWEBHOOK_TIMEOUT',
  FBWEBHOOK_PAGEID: 'FBWEBHOOK_PAGEID',
  FBWEBHOOK_USERID: 'FBWEBHOOK_USERID',
  FBWEBHOOK_APPSECRET: 'FBWEBHOOK_APPSECRET'
}
const Defaults = {
  [Capabilities.FBWEBHOOK_PAGEID]: '123456',
  [Capabilities.FBWEBHOOK_TIMEOUT]: 10000
}

class BotiumConnectorFbWebhook {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainer = null
    this.delegateCaps = null
    this.facebookUserId = null
    this.facebookPageId = null
  }

  Validate () {
    debug('Validate called')

    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.FBWEBHOOK_WEBHOOKURL]) throw new Error('FBWEBHOOK_WEBHOOKURL capability required')

    this.facebookUserId = this.caps[Capabilities.FBWEBHOOK_USERID] || randomize('0', 10)
    this.facebookPageId = this.caps[Capabilities.FBWEBHOOK_PAGEID]

    if (!this.delegateContainer) {
      this.delegateCaps = {
        [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.FBWEBHOOK_WEBHOOKURL],
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_TIMEOUT]: this.caps[Capabilities.FBWEBHOOK_TIMEOUT],
        [CoreCapabilities.SIMPLEREST_CONVERSATION_ID_TEMPLATE]: this.facebookUserId,
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]:
          `{
            "object": "page",
            "entry": [
              {
                "messaging": []
              }
            ]
           }`,
        [CoreCapabilities.SIMPLEREST_REQUEST_HOOK]: ({ requestOptions, msg, context }) => {
          const body = requestOptions.body
          body.entry[0].ts = Date.now()
          body.entry[0].id = this.caps[Capabilities.FBWEBHOOK_PAGEID]

          const msgData = {}
          if (msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].text || msg.buttons[0].payload)) {
            msgData.sourceData = {
              postback: {
                title: msg.buttons[0].text,
                payload: msg.buttons[0].payload || msg.buttons[0].text
              }
            }
          } 
          else if (msg.referral) {
            msgData.sourceData = {
              referral: msg.referral
            }
          }
          else {
            msgData.sourceData = {
              message: {
                text: msg.messageText
              }
            }
          }

          if (msgData.sourceData) {
            body.entry[0].messaging.push(msgData.sourceData)
          } else {
            debug(`No sourceData given. Ignored. ${msgData}`)
            return
          }

          body.entry[0].messaging.forEach((fbMsg) => {
            if (!fbMsg.sender) fbMsg.sender = {}
            if (!fbMsg.sender.id) fbMsg.sender.id = this.facebookUserId

            if (!fbMsg.recipient) fbMsg.recipient = {}
            if (!fbMsg.recipient.id) fbMsg.recipient.id = this.facebookPageId

            if (!fbMsg.delivery && !fbMsg.timestamp) fbMsg.timestamp = Date.now()

            if (fbMsg.message) {
              if (!fbMsg.message.mid) fbMsg.message.mid = `mid.${randomize('0', 10)}`
            }
          })

          let xHubSignature
          if (this.caps[Capabilities.FBWEBHOOK_APPSECRET]) {
            const hmac = crypto.createHmac('sha1', this.caps[Capabilities.FBWEBHOOK_APPSECRET])
            hmac.update(JSON.stringify(body), 'utf8')
            xHubSignature = 'sha1=' + hmac.digest('hex')
          }
          requestOptions.headers = Object.assign(requestOptions.headers || {}, {
            'X-Hub-Signature': xHubSignature,
            Botium: true
          })
        },
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
          debug(`Response Body: ${util.inspect(botMsg.sourceData, false, null, true)}`)
          const fbMessage = botMsg.sourceData.message
          if (fbMessage) {
            botMsg.buttons = botMsg.buttons || []
            botMsg.media = botMsg.media || []
            botMsg.cards = botMsg.cards || []

            if (fbMessage.text) {
              botMsg.messageText = fbMessage.text
            }
            if (fbMessage.quick_replies) {
              botMsg.buttons = botMsg.buttons || []
              fbMessage.quick_replies.map(qr => {
                botMsg.buttons.push({
                  text: qr.title,
                  payload: qr.payload
                })
              })
            }
            if (fbMessage.attachment) {
              const attachment = fbMessage.attachment.payload
              switch (attachment.template_type) {
                case 'generic':
                  botMsg.cards = botMsg.cards || []
                  attachment.elements.map(element => {
                    botMsg.cards.push({
                      text: element.title,
                      subtext: element.subtitle,
                      image: element.image_url && {
                        mediaUri: element.image_url
                      },
                      buttons: element.buttons && element.buttons.map(button => ({
                        text: button.title,
                        payload: button.payload
                      }))
                    })
                  })
                  break
                case 'button':
                  botMsg.messageText = attachment.text
                  botMsg.buttons = botMsg.buttons || []
                  attachment.buttons.map(button => {
                    botMsg.buttons.push({
                      text: button.title,
                      payload: button.payload
                    })
                  })
                  break
                default:
                  // Types of attachment not supported list, media, receipt, airline_boardingpass
                  debug(`WARNING: recieved unsupported message: ${fbMessage}`)
              }
            }
          } else {
            debug('WARNING: recieved non message fb event')
          }
        },
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_JSONPATH]: '$.body.recipient.id',
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_VALUE]: '{{botium.conversationId}}'
      }
      for (const capKey of Object.keys(this.caps).filter(c => c.startsWith('SIMPLEREST'))) {
        if (!this.delegateCaps[capKey]) this.delegateCaps[capKey] = this.caps[capKey]
      }

      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    return this.delegateContainer.Validate()
  }

  async Build () {
    await this.delegateContainer.Build()
  }

  async Start () {
    await this.delegateContainer.Start()
  }

  async UserSays (msg) {
    await this.delegateContainer.UserSays(msg)
  }

  async Stop () {
    await this.delegateContainer.Stop()
  }

  async Clean () {
    await this.delegateContainer.Clean()
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorFbWebhook
}
