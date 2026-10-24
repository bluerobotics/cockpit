// Runs an ArduPilot SITL WebAssembly build (?binary=ardusub&model=vectored) on its serial 0.
// It lives in its own worker because the module has no shutdown: terminating the worker
// is what stops the simulator and all of its threads.
const BUFFER_SIZE = 4096
const SERIAL_PORT = 0
// Florianópolis, Brazil, as lat,lng,alt,yaw
const HOME = '-27.598524,-48.459752,0,0'

const params = new URL(self.location.href).searchParams
const { default: createModule } = await import(`./${params.get('binary')}.js`)
const sitl = await createModule({
  arguments: [
    '--model',
    params.get('model'),
    '--home',
    HOME,
    '--serial0',
    'wasm',
    '--serial1',
    'none',
    '--serial2',
    'none',
  ],
})

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
