// Runs an ArduPilot SITL WebAssembly build (?binary=ardusub&model=vectored) on its serial 0.
// It lives in its own worker because the module has no shutdown: terminating the worker
// is what stops the simulator and all of its threads.
// With model=JSON the physics comes from an external simulator, like BlueSim's web build, over a
// BroadcastChannel, so the simulator can be in an iframe or another tab. SIM_JSON's UDP socket is
// emulated by Emscripten as a WebSocket, which is stood in for here to bridge it to that channel.
const BUFFER_SIZE = 4096
const SERIAL_PORT = 0
// Florianópolis, Brazil, as lat,lng,alt,yaw
const HOME = '-27.598524,-48.459752,0,0'
const DEFAULTS_PATH = '/defaults.parm'
// Same channel name used by BlueSim's web build
const PHYSICS_CHANNEL_NAME = 'cockpit-sitl-json'
// Where Emscripten's SOCKFS connects SIM_JSON's UDP socket to
const PHYSICS_SOCKET_URL = 'ws://127.0.0.1:9002/'
const SERVO_PACKET_HEADER_SIZE = 8
const SERVO_PACKET_CHANNELS = { 18458: 16, 29569: 32 }
// Emscripten's poll() readable flags
const POLLIN = 0x1
const POLLRDNORM = 0x40

const params = new URL(self.location.href).searchParams
const model = params.get('model')
const defaultsFile = params.get('defaults')
let defaults = undefined
if (defaultsFile !== null) {
  const response = await fetch(`./${defaultsFile}`)
  if (!response.ok) {
    throw new Error(`Could not load the SITL defaults ${defaultsFile}: ${response.status}`)
  }
  defaults = await response.text()
}
const args = [
  '--model',
  model,
  '--home',
  params.get('home') ?? HOME,
  '--serial0',
  'wasm',
  '--serial1',
  'none',
  '--serial2',
  'none',
]
if (defaults !== undefined) {
  args.push('--defaults', DEFAULTS_PATH)
}

let sitlModule = undefined
if (model.startsWith('JSON')) {
  const textEncoder = new TextEncoder()
  const physicsChannel = new BroadcastChannel(PHYSICS_CHANNEL_NAME)
  let physicsSocket = undefined
  let isPhysicsPollPatched = false

  globalThis.WebSocket = new Proxy(WebSocket, {
    construct: (RealWebSocket, socketArgs) => {
      if (socketArgs[0] !== PHYSICS_SOCKET_URL) return new RealWebSocket(...socketArgs)
      const socket = {
        url: PHYSICS_SOCKET_URL,
        readyState: 0,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        // Each datagram is one servo packet, sent on as JSON since BlueSim (Godot) handles strings best
        send: (data) => {
          const packet = new DataView(data)
          const channels = SERVO_PACKET_CHANNELS[packet.getUint16(0, true)]
          if (channels === undefined) return
          const pwm = Array.from({ length: channels }, (_, index) =>
            packet.getUint16(SERVO_PACKET_HEADER_SIZE + index * 2, true)
          )
          physicsChannel.postMessage(
            JSON.stringify({
              frame_rate: packet.getUint16(2, true),
              frame_count: packet.getUint32(4, true),
              pwm,
            })
          )
        },
        close: () => {
          socket.readyState = 3
        },
      }
      setTimeout(() => {
        socket.readyState = 1
        // SOCKFS reports datagram sockets as always readable, which makes SIM_JSON's recv() spin instead
        // of waiting for BlueSim, so the physics socket only reports readable when it has data queued
        const sock = isPhysicsPollPatched
          ? undefined
          : sitlModule.FS.streams
              .map((stream) => stream?.node.sock)
              .find((candidate) => Object.values(candidate?.peers ?? {}).some((peer) => peer.socket === socket))
        if (sock !== undefined) {
          const sockOps = sock.sock_ops
          sock.sock_ops = {
            ...sockOps,
            poll: (polled) => {
              const mask = sockOps.poll(polled)
              return polled.recv_queue.length > 0 ? mask : mask & ~(POLLIN | POLLRDNORM)
            },
          }
          isPhysicsPollPatched = true
        }
        socket.onopen?.()
      })
      physicsSocket = socket
      return socket
    },
  })

  let isLinked = false
  physicsChannel.onmessage = ({ data }) => {
    if (physicsSocket === undefined) return
    if (!isLinked) {
      isLinked = true
      self.postMessage('running')
    }
    physicsSocket.onmessage?.({ data: textEncoder.encode(data).buffer })
  }
}

const { default: createModule } = await import(`./${params.get('binary')}.js`)
const sitl = await createModule({
  arguments: args,
  preRun: [
    (module) => {
      sitlModule = module
      if (defaults !== undefined) module.FS.writeFile(DEFAULTS_PATH, defaults)
    },
  ],
})
self.postMessage(model.startsWith('JSON') ? 'waiting-for-simulator' : 'running')

const malloc = sitl.cwrap('ardupilot_malloc', 'number', ['number'])
const read = sitl.cwrap('ardupilot_serial_read', 'number', ['number', 'number', 'number'])
const write = sitl.cwrap('ardupilot_serial_write', 'number', ['number', 'number', 'number'])
const readBuffer = malloc(BUFFER_SIZE)
const writeBuffer = malloc(BUFFER_SIZE)

self.onmessage = ({ data }) => {
  const length = Math.min(data.length, BUFFER_SIZE)
  sitl.HEAPU8.set(data.subarray(0, length), writeBuffer)
  write(SERIAL_PORT, writeBuffer, length)
}

setInterval(() => {
  const length = read(SERIAL_PORT, readBuffer, BUFFER_SIZE)
  if (length > 0) {
    self.postMessage(sitl.HEAPU8.slice(readBuffer, readBuffer + length))
  }
}, 10)
