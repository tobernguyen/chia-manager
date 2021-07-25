const si = require('systeminformation')

async function main() {
  const devices = await si.blockDevices()
  console.log(devices)
}
main()