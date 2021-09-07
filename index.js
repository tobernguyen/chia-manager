const si = require('systeminformation')
const fs = require('fs-extra')
const shell = require('shelljs')
const yaml = require('js-yaml')

const BLOCK_DEVICE_PATTERN = /(HDDi_.*|\d+tb_.*)/
const HPOOL_OG_MINER_PATH = '/root/hpool-current'
const HPOOL_PP_MINER_PATH = '/root/hpool-pp'
const CHIA_CONFIG_PATH = '/root/.chia/mainnet/config/config.yaml'

/**
 * Auto find and mount all block devices. Discover to see if the device has
 * OG Plots or NFT Plots. Returns list of path to OG plots and list of path to NFT Plots
 * - List all block devices
 * - Filter devices with labels with following pattern: HDDi_*, [number]tb_*
 */
async function setupBlockDevices() {
  const ogPlotPaths = []
  const nftPlotPaths = []
  const devices = await si.blockDevices()
  for(const device of devices) {
    if (device.label.match(BLOCK_DEVICE_PATTERN)) {
      const mountPath = `/mnt/${device.label}`
      // Mount if device is not mounted
      if (!device.mount) {
        fs.mkdirpSync(mountPath)
        const result = shell.exec(`mount -L ${device.label} ${mountPath}`)
        if (result.code != 0) {
          console.error(`Failed to mount device ${device.label}: ${result.stderr} ${result.stdout}`)
        }
      }

      const files = shell.ls('-d', `${mountPath}/*`)
      for(const filePath of files) {
        if (filePath.endsWith('/plots')) {
          ogPlotPaths.push(filePath)
        } else if (filePath.endsWith('/nplots')) {
          nftPlotPaths.push(filePath)
        }
      }
    }
  }

  return {
    ogPlotPaths,
    nftPlotPaths
  }
}

async function configureHpoolMiner(hpoolMinerPath, plotPaths) {
  const configPath = `${hpoolMinerPath}/config.yaml`
  if (!fs.existsSync(configPath)) {
    console.log(`Config Not Found: ${configPath}. Skip configure this miner.`)
    return false
  }
  const config = yaml.load(fs.readFileSync(configPath, 'utf-8'))
  // If plotPaths has changed, update configPath and restart miner
  if ((config.path || []).sort().join(',') !== plotPaths.sort().join(',')) {
    config.path = plotPaths
    fs.writeFileSync(configPath, yaml.dump(config))
    return true
  }
  return false
}

async function startHpoolMiner(minerName, hpoolMinerPath, binaryName, currentProcess) {
  if (!fs.existsSync(`${hpoolMinerPath}/${binaryName}`)) {
    console.log(`[${minerName}] Miner binary not found: ${hpoolMinerPath}/${binaryName}. Skip starting this miner.`)
    return
  }
  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM')
    } catch (e) {
      console.error('Error while killing running hpool procses:', e)
    }
  }
  shell.cd(hpoolMinerPath)
  const child = shell.exec(`./${binaryName}`, { async: true, silent: true })
  let successConnect = false
  child.stdout.on('data', (data) => {
    const text = data.toString()
    if (text.match(/connect success/)) {
      successConnect = true
      console.log(`[${minerName}] connect success detected.`)
    }
  })
  setTimeout(() => {
    if (!successConnect) {
      console.error(`[${minerName}] failed to connect after 30 seconds.`)
    }
  }, 30 * 1000)
  child.on('exit', (code, signal) => {
    const last10Logs = shell.tail({'-n': 10}, `${hpoolMinerPath}/log/miner.log.log`)
    console.error(`[${minerName}] Process stopped. Code: ${code}. Signal ${signal}. Last 10 log lines:\n${last10Logs}`)
  })
  return child
}

async function configureChiaHarvester(plotPaths) {
  const configPath = CHIA_CONFIG_PATH
  if (!fs.existsSync(configPath)) {
    console.log(`Config Not Found: ${configPath}. Skip configure this harvester.`)
    return false
  }
  const config = yaml.load(fs.readFileSync(configPath, 'utf-8'))
  // If plotPaths has changed, update configPath and restart miner
  const currentPlotDirs = _.get(config, 'harvester.plot_directories', [])
  if (currentPlotDirs.sort().join(',') !== plotPaths.sort().join(',')) {
    _.set(config, 'harvester.plot_directories', plotPaths)
    fs.writeFileSync(configPath, yaml.dump(config))
    return true
  }
  return false
}

async function startChiaFarmer(forceRestart = false) {
  let result
  if (forceRestart) {
    result = shell.exec(`systemctl restart chia-farmer`)
  } else {
    result = shell.exec(`systemctl start chia-farmer`)
  }
  if (result.code != 0) {
    console.error(`Failed to start chia farmer service: ${result.stderr} ${result.stdout}`)
  }
}

async function main() {
  const plotPaths = await setupBlockDevices()
  
  await configureHpoolMiner(HPOOL_OG_MINER_PATH, plotPaths.ogPlotPaths)
  let hpoolOgMinerProcess = await startHpoolMiner('HPOOL_OG', HPOOL_OG_MINER_PATH, 'hpool-miner-chia')

  // await configureHpoolMiner(HPOOL_PP_MINER_PATH, plotPaths.nftPlotPaths)
  // let hpoolPpMinerProcess = await startHpoolMiner('HPOOL_PP', HPOOL_PP_MINER_PATH, 'hpool-miner-chia-pp')

  // Use Official Chia client for farming NFT Plots
  await configureChiaHarvester(plotPaths.nftPlotPaths)
  await startChiaFarmer()

  // Check for config change every 5 mins
  setInterval(async () => {
    // Refresh block devices
    const plotPaths = await setupBlockDevices()

    // Hpool OG
    const ogConfigChanged = await configureHpoolMiner(HPOOL_OG_MINER_PATH, plotPaths.ogPlotPaths)
    if (ogConfigChanged) {
      hpoolOgMinerProcess = await startHpoolMiner('HPOOL_OG', HPOOL_OG_MINER_PATH, 'hpool-miner-chia', hpoolOgMinerProcess)
    }

    // Hpool PP
    // const ppConfigChanged = await configureHpoolMiner(HPOOL_PP_MINER_PATH, plotPaths.nftPlotPaths)
    // if (ppConfigChanged) {
    //   hpoolPpMinerProcess = await startHpoolMiner('HPOOL_PP', HPOOL_PP_MINER_PATH, 'hpool-miner-chia-pp', hpoolPpMinerProcess)
    // }

    // Use Official Chia client for farming NFT Plots
    const configChanged = await configureChiaHarvester(plotPaths.nftPlotPaths)
    if (configChanged) {
      await startChiaFarmer(true)
    }

  }, 5 * 60 * 1000)
}
main()
