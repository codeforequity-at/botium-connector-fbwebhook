const PluginClass = require('./src/connector')
const ProxyClass = require('./src/proxy')

module.exports = {
  PluginVersion: 1,
  PluginClass: PluginClass
}

module.exports.proxy = ProxyClass
