// Runs an ArduPilot SITL WebAssembly build (?binary=ardusub&model=vectored) on its serial 0.
// It lives in its own worker because the module has no shutdown: terminating the worker
// is what stops the simulator and all of its threads.
// With model=JSON the physics comes from an external simulator, like BlueSim's web build, over a
// BroadcastChannel, so the simulator can be in an iframe or another tab.
const BUFFER_SIZE = 4096
const SERIAL_PORT = 0
// Florianópolis, Brazil, as lat,lng,alt,yaw
const HOME = '-27.598524,-48.459752,0,0'
const DEFAULTS_PATH = '/defaults.parm'
// Same channel name used by BlueSim's web build
const PHYSICS_CHANNEL_NAME = 'cockpit-sitl-json'
const SERVO_PACKET_HEADER_SIZE = 8
const SERVO_PACKET_CHANNELS = { 18458: 16, 29569: 32 }

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

const { default: createModule } = await import(`./${params.get('binary')}.js`)
const sitl = await createModule({
  arguments: args,
  preRun: [(module) => defaults !== undefined && module.FS.writeFile(DEFAULTS_PATH, defaults)],
})

const malloc = sitl.cwrap('ardupilot_malloc', 'number', ['number'])
const read = sitl.cwrap('ardupilot_serial_read', 'number', ['number', 'number', 'number'])
const write = sitl.cwrap('ardupilot_serial_write', 'number', ['number', 'number', 'number'])
const readBuffer = malloc(BUFFER_SIZE)
const writeBuffer = malloc(BUFFER_SIZE)

let forwardServos = undefined
if (model.startsWith('JSON')) {
  const textEncoder = new TextEncoder()
  const sensorsBuffer = malloc(BUFFER_SIZE)
  const servosBuffer = malloc(BUFFER_SIZE)
  const writeSensors = sitl.cwrap('ardupilot_json_sensors_write', 'number', ['number', 'number'])
  const readServos = sitl.cwrap('ardupilot_json_servos_read', 'number', ['number', 'number'])
  const physicsChannel = new BroadcastChannel(PHYSICS_CHANNEL_NAME)

  // Sends the newest servo outputs, as JSON since BlueSim (Godot) handles strings best
  forwardServos = () => {
    const length = readServos(servosBuffer, BUFFER_SIZE)
    if (length === 0) return
    const packets = new DataView(sitl.HEAPU8.buffer, servosBuffer, length)
    const channels = SERVO_PACKET_CHANNELS[packets.getUint16(0, true)]
    if (channels === undefined) return
    const packetSize = SERVO_PACKET_HEADER_SIZE + channels * 2
    const newest = (Math.floor(length / packetSize) - 1) * packetSize
    if (newest < 0) return
    const pwm = Array.from({ length: channels }, (_, index) =>
      packets.getUint16(newest + SERVO_PACKET_HEADER_SIZE + index * 2, true)
    )
    physicsChannel.postMessage(
      JSON.stringify({
        frame_rate: packets.getUint16(newest + 2, true),
        frame_count: packets.getUint32(newest + 4, true),
        pwm,
      })
    )
  }

  physicsChannel.onmessage = ({ data }) => {
    const sensors = textEncoder.encode(data).subarray(0, BUFFER_SIZE)
    sitl.HEAPU8.set(sensors, sensorsBuffer)
    writeSensors(sensorsBuffer, sensors.length)
    forwardServos()
  }
}

self.onmessage = ({ data }) => {
  const length = Math.min(data.length, BUFFER_SIZE)
  sitl.HEAPU8.set(data.subarray(0, length), writeBuffer)
  write(SERIAL_PORT, writeBuffer, length)
}

setInterval(() => {
  forwardServos?.()
  const length = read(SERIAL_PORT, readBuffer, BUFFER_SIZE)
  if (length > 0) {
    self.postMessage(sitl.HEAPU8.slice(readBuffer, readBuffer + length))
  }
}, 10)
