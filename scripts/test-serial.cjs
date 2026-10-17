const { SerialPort } = require('serialport')
console.log('electron node', process.versions.node, 'modules', process.versions.modules, 'napi', process.versions.napi)
SerialPort.list()
  .then((p) => console.log('OK serialport under electron, ports:', p.length))
  .catch((e) => {
    console.error('ERR', e.message)
    process.exit(1)
  })
