# Botium Connector for Facebook Webhooks

[![NPM](https://nodei.co/npm/botium-connector-fbwebhook.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-fbwebhook/)

[![Codeship Status for codeforequity-at/botium-connector-fbwebhook](https://app.codeship.com/projects/e0c1ab60-cd7e-0137-d7fc-36d20f9c8e15/status?branch=master)](https://app.codeship.com/projects/368651)
[![npm version](https://badge.fury.io/js/botium-connector-fbwebhook.svg)](https://badge.fury.io/js/botium-connector-fbwebhook)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your [Facebook Messenger Platform Webhooks](https://developers.facebook.com/docs/messenger-platform/).

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles ? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works ?
Botium emulates the [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform/)
* It sends inbound messages to your webhook
* It listens for outbound messages from your webhook

__Redis__ is used to connect the webhook to Botium scripts: all messages received over the webhook are published to Redis, and Botium on the other end subscribes to those Redis channels before running a conversation. 

You have to setup your webhook to send outbound messages to the endpoint started with `botium-cli inbound-proxy`
 instead of the real Facebook endpoint at https://graph.facebook.com. Depending on the technology you are using, there are several options to do this:

* If your technology allows to simply change the endpoint url, then this is the preferred way
* If you are using Node.js, there is a demo in _samples/botkit-bot_ how to use [Nock](https://github.com/nock/nock) to intercept network traffic to the original Facebook endpoint
* You can try to configure a HTTP-Proxy for your technology

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements

* __Node.js and NPM__
* a __Facebook Messenger Platform Webhook__
* a __Redis__ instance (Cloud hosted free tier for example from [redislabs](https://redislabs.com/) will do as a starter)
* a __project directory__ on your workstation to hold test cases and Botium configuration

## Install Botium and Facebook Webhook Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-fbwebhook
> cd <your working dir>
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-fbwebhook
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting your Facebook Webhook to Botium

Open the file _botium.json_ in your working directory and add the webhook url and Redis connection settings.

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "fbwebhook",
      "FBWEBHOOK_WEBHOOKURL": "...",
      "SIMPLEREST_INBOUND_REDISURL": "redis://127.0.0.1:6379"
    }
  }
}
```
Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

__Important: The `inbound-proxy` command has to be started with Botium CLI. Otherwise, Botium scripts will fail to receive any input or output messages from your chatbot!__

### Facebook Referrals

For simulating referral parameters (see [Facebook Docs](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messaging_referrals)), the _UPDATE_CUSTOM_ logic hook can be used.

Simulating an _m.me_-link with a referral parameter:

    #me
    UPDATE_CUSTOM SET_FB_REFERRAL_MME|some referral parameter

Simulating another referral type by specifying JSON code:

    #me
    UPDATE_CUSTOM SET_FB_REFERRAL|{"ref": "<REF_DATA_IF_SPECIFIED_IN_THE_AD>", "ad_id": "<ID_OF_THE_AD>", "source": "ADS", "type": "OPEN_THREAD", "ads_context_data": {"ad_title": "<TITLE_OF_THE_AD>", "photo_url": "<URL_OF_THE_IMAGE_FROM_AD_THE_USER_IS_INTERESTED_IN>", "video_url": "<THUMBNAIL_URL_OF_THE_VIDEO_FROM_THE_AD>", "post_id": "<ID_OF_THE_POST>"}}

## Running the Samples

Install botium-core as peerDependency 

    > npm install --no-save botium-core

Afterward in the folder _samples/botkit-bot_ there is an example for a simple Facebook Webhook chatbot - it is one of the samples of [Botkit](https://github.com/howdyai/botkit). Start the webhook:

    > cd samples/botkit-bot && npm install && npm run start:botium

Finally navigate into the samples/simple and run `npm install`, start the inbound proxy server 
and run the test itself with the following commands:

     > cd samples/simple
     > npm install
     > npm run inbound
     > npm test

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __fbwebhook__ to activate this connector.

### FBWEBHOOK_WEBHOOKURL
The URL of your Facebook Messenger Platform webhook

### FBWEBHOOK_TIMEOUT
Webhook timeout in milliseconds (default: 10000 = 10 seconds)

### FBWEBHOOK_PAGEID
If your webhook expects a special Facebook Page ID to process messages, you can add one here (default: 123456)

The Facebook Page ID can also be set in the test case spec itself:

    #begin
    UPDATE_CUSTOM FBWEBHOOK_PAGEID|77777777

### FBWEBHOOK_USERID
If your webhook expects a special Facebook User ID to process messages, you can add one here (default: 10 random digits)

The Facebook User ID can also be set in the test case spec itself:

    #begin
    UPDATE_CUSTOM FBWEBHOOK_USERID|66666666

### FBWEBHOOK_APPSECRET
If your webhook is [validating](https://developers.facebook.com/docs/messenger-platform/webhook#security) the _X-Hub-Signature_-header (it should!), then you have to give the Facebook App Secret to Botium to be able to generate this signature (default: empty)

## Open Issues and Restrictions

* Currently only plain text, quick replies, buttons and cards are supported
* Currently only individual receivers supported
