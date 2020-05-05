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

You have to setup your webhook to send outbound messages to the Botium Facebook Messenger Platform emulator endpoint instead of the real Facebook endpoint at https://graph.facebook.com. Depending on the technology you are using, there are several options to do this:

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

## Install and Run the Botium Facebook Messenger Platform emulator

The Botium Facebook Messenger Platform emulator is responsible for the receiving part, listens for messages from your webhook, and puts them into Redis. It is running outside of Botium as a background service.

You have to configure your Facebook webhook to deliver the outbound messages to the Botium Facebook Messenger Platform emulator. 

Installation with NPM:

    > npm install -g botium-connector-fbwebhook
    > botium-fbwebhookproxy-cli start --help

There are several options required for running the service:

_--port_: Local port to listen

_--endpoint_: endpoint (url part after the port ...) (optional, default _/_)

_--redisurl_: Redis connection url

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
      "FBWEBHOOK_WEBHOOKURL": "..."
    }
  }
}
```
Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

__Important: The Botium Facebook Messenger Platform emulator has to be running when Botium is started. Otherwise, Botium scripts will fail to receive any input or output messages from your chatbot!__

## Running the Samples

The folder _samples/botkit-bot_ is an example for a simple Facebook Webhook chatbot - it is one of the samples of [Botkit](https://github.com/howdyai/botkit). Start the webhook:

    > cd samples/botkit-bo && npm install && npm start:botium

Afterwards, start the Botium Facebook Messenger Platform emulator:

    > botium-fbwebhookproxy-cli start

And finally, you can find the Botium test project in _samples/simple_, to run a simple test case

    > cd samples/simple && npm install && npm test

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __fbwebhook__ to activate this connector.

### FBWEBHOOK_WEBHOOKURL
The URL of your Facebook Messenger Platform webhook

### FBWEBHOOK_TIMEOUT
Webhook timeout in milliseconds (default: 10000 = 10 seconds)

### FBWEBHOOK_PAGEID
If your webhook expects a special Facebook Page ID to process messages, you can add one here (default: 123456)

### FBWEBHOOK_APPSECRET
If your webhook is [validating](https://developers.facebook.com/docs/messenger-platform/webhook#security) the _X-Hub-Signature_-header (it should!), then you have to give the Facebook App Secret to Botium to be able to generate this signature (default: empty)

### FBWEBHOOK_REDISURL
The url of your Redis instance - for example _redis://127.0.0.1:6379_.

Or a Redis options object - see [here](https://github.com/luin/ioredis#connect-to-redis)

## Open Issues and Restrictions

* Currently only individual receivers supported
