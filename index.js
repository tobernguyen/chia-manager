const si = require('systeminformation')
const fs = require('fs-extra')
const shell = require('shelljs')

/**
 * Auto find and mount all block devices. Discover to see if the device has
 * OG Plots or NFT Plots. Returns list of path to OG plots and list of path to NFT Plots
 * - List all block devices
 * - Filter devices with labels with following pattern: HDDi_*, [number]tb_*
 */
async function setupBlockDevices() {
  const BLOCK_DEVICE_PATTERN = /(HDDi_.*|\d+tb_.*)/

  const ogPlotPaths = []
  const nftPlotPaths = []
  const devices = await si.blockDevices()
  for(const device of devices) {
    if (device.label.match(BLOCK_DEVICE_PATTERN)) {
      const mountPath = `/mnt/${device.label}`
      // Mount if device is not mounted
      if (device.mount !== '') {
        fs.mkdirpSync(mountPath)
        const result = shell.exec(`mount -L ${device.label} ${mountPath}`)
        if (result.code != 0) {
          console.error(`Failed to mount device ${device.label}: ${result.stderr} ${result.stdout}`)
        }
      }

      const files = shell.ls('-d -l', mountPath)
      console.log(files)
      for(const file of files) {
        if (file.name === 'plots') {
          ogPlotPaths.push(`${mountPath}/${file.name}`)
        } else if (file.name === 'nplots') {
          nftPlotPaths.push(`${mountPath}/${file.name}`)
        }
      }
    }
  }

  return {
    ogPlotPaths,
    nftPlotPaths
  }
}

async function main() {
  const plotPaths = await setupBlockDevices()
  console.log(plotPaths)
}
main()