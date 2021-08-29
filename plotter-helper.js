const si = require('systeminformation')
const fs = require('fs-extra')

const PLOT_SIZE_IN_BYTES = 108890000000
const NUMBER_OF_PLOTTERS = 4

async function update_remote_plotter_mounts() {
  const disks = await si.fsSize()
  const availableDisks = disks
    .filter((d) => d.mount.match(/\/mnt\/HDDi_/) && d.available > PLOT_SIZE_IN_BYTES)
  for(let i = 0; i < NUMBER_OF_PLOTTERS; i += 1) {
    const disksForPlotter = availableDisks
      .filter((d) => d.mount.match(/\/mnt\/HDDi_(\d)+/)[1] % NUMBER_OF_PLOTTERS === i)
      .sort((d) => d.available)
      .map((d) => d.mount)
    fs.writeFileSync(`/root/plotter_${i + 1}_remote_mounts`, disksForPlotter.join(','))
  }
}
async function main() {
  setInterval(update_remote_plotter_mounts, 5 * 60 * 1000) // Update every 5 mins
}
