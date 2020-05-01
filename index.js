const PluginClass = require('./src/connector')

module.exports = {
  PluginVersion: 1,
  PluginClass: PluginClass
}

module.exports.proxy = require('./src/plugin')
