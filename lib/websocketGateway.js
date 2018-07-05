const websocket = require('websocket-stream')
const pump = require('pump')

module.exports = connectToGateway

let replicationCount = 0
let connecting = 0

function connectToGateway (archive, updateConnecting) {
  if (!updateConnecting) updateConnecting = () => {}
  let cancelled = false
  let connected = false
  let archiveStream

  archive.ready(() => {
    const key = archive.key.toString('hex')
    const host = document.location.host
    const proto = document.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${host}/proxy/${key}`
    console.log('connectToGateway', key)

    function connectWebsocket () {
      if (connected) return
      if (navigator.onLine === false) {
        console.log('Offline, not syncing')
        console.log('Waiting 5 seconds to reconnect')
        setTimeout(connectWebsocket, 5000)
        return
      }
      console.log('Connecting websocket', url)
      console.log('Active replications', ++replicationCount)
      const stream = websocket(url)
      archiveStream = archive.replicate({live: true})
      updateConnecting(++connecting)
      connected = true
      pump(
        stream,
        archiveStream,
        stream,
        err => {
          connected = false
          updateConnecting(--connecting)
          if (err) {
            console.log('Pipe finished', err.message)
            if (err.stack) {
              console.log(err.stack)
            }
          } else {
            console.log('Pipe finished, no errors')
          }
          console.log('Active replications', --replicationCount)
          if (!cancelled) {
            console.log('Waiting 5 seconds to reconnect')
            setTimeout(connectWebsocket, 5000)
          }
        }
      )
    }
    connectWebsocket()
  })

  function cancel () {
    cancelled = true
    console.log('Ending replication on websocket')
    if (archiveStream) {
      archiveStream.finalize() // Gracefully end the stream
    }
  }

  return cancel
}