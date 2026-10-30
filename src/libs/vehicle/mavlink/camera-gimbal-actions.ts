import {
  createDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { MavCmd, MavComponent, MAVLinkType, MavResult } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { isCommandAckConfirmed } from '@/libs/vehicle/types'

import type { MAVLinkVehicle } from './vehicle'

// Numeric values of the MAVLink enums, which the dialect only exposes as names
const GIMBAL_MANAGER_FLAGS_RETRACT = 1
const GIMBAL_MANAGER_FLAGS_YAW_LOCK = 16
const GIMBAL_DEVICE_FLAGS_YAW_LOCK = 16
const MAV_MOUNT_MODE_HOME_LOCATION = 6
const FOCUS_TYPE_AUTO = 4
const ZOOM_TYPE_CONTINUOUS = 1
const CAMERA_INFORMATION_MESSAGE_ID = 259

const ackTimeoutMs = 3000
const cameraInformationRetries = 3
const cameraInformationRetryMs = 5000

type CameraGimbalVehicle = Pick<
  MAVLinkVehicle<unknown>,
  'onIncomingMAVLinkMessage' | 'sendCommandLong' | 'systemId' | 'waitForCommandAck'
>

/**
 * Ids of the predefined camera and gimbal actions
 */
export type CameraGimbalActionId =
  | 'gimbal_center'
  | 'gimbal_point_down'
  | 'gimbal_point_home'
  | 'gimbal_retract'
  | 'gimbal_toggle_yaw_lock'
  | 'vehicle_camera_auto_focus'
  | 'vehicle_camera_take_picture'
  | 'vehicle_camera_toggle_recording'

/**
 * How a camera or gimbal command ended, short of failing: confirmed by the vehicle, sent with no answer back, or not
 * sent because it was no longer wanted by its turn
 */
export type CameraGimbalCommandOutcome = 'accepted' | 'unacknowledged' | 'skipped'

/**
 * Data lake variable set once the vehicle has described a camera. The vehicle does not say which camera it described,
 * so this only tells that it has at least one.
 */
export const vehicleCameraDetectedVariableId = 'vehicle-camera-detected'
const cameraDetectedName = 'Vehicle camera detected'

/**
 * Data lake variable holding whether Cockpit last asked the vehicle cameras to record. ArduPilot does not report its
 * recording state, so this is what was commanded rather than what the cameras are doing. It is one for every camera,
 * as the vehicle does not tell its cameras apart and Cockpit's own recordings start every camera at once.
 */
export const vehicleCameraRecordingVariableId = 'vehicle-camera-recording'

const setVariable = (id: string, name: string, value: boolean): void => {
  if (getDataLakeVariableInfo(id) === undefined) {
    createDataLakeVariable({ id, name, type: 'boolean', persistent: false, persistValue: false })
  }
  setDataLakeVariableData(id, value)
}

/**
 * Store what Cockpit last asked the vehicle cameras to do, for every path that starts or stops their recording
 * @param {boolean} isRecording - Whether recording was requested
 */
export const setVehicleCameraRecordingRequested = (isRecording: boolean): void => {
  setVariable(vehicleCameraRecordingVariableId, 'Vehicle camera recording (requested)', isRecording)
}

/**
 * Data lake variable with the flags a gimbal reports in its attitude, which exists once that gimbal has reported
 * @param {number} systemId - The vehicle's system id
 * @param {number} gimbalId - The gimbal device id, 1-based
 * @returns {string} The variable id
 */
export const gimbalFlagsVariableId = (systemId: number, gimbalId: number): string =>
  `/mavlink/${systemId}/1/GIMBAL_DEVICE_ATTITUDE_STATUS/gimbal_device_id=${gimbalId}/flags`

/**
 * The gimbals of a vehicle that have reported their attitude
 * @param {number} systemId - The vehicle's system id
 * @returns {number[]} Their device ids, ascending
 */
export const detectedGimbalIds = (systemId: number): number[] => {
  const pattern = new RegExp(`^/mavlink/${systemId}/1/GIMBAL_DEVICE_ATTITUDE_STATUS/gimbal_device_id=(\\d+)/flags$`)
  return Object.keys(getAllDataLakeVariablesInfo())
    .map((id) => Number(pattern.exec(id)?.[1]))
    .filter((id) => !Number.isNaN(id))
    .sort((a, b) => a - b)
}

/**
 * Whether a set of gimbal flags has the gimbal holding its yaw relative to North
 * @param {number} flags - GIMBAL_DEVICE_FLAGS bits, as in GIMBAL_DEVICE_ATTITUDE_STATUS
 * @returns {boolean} True if the yaw lock bit is set
 */
export const hasGimbalYawLock = (flags: number): boolean => (flags & GIMBAL_DEVICE_FLAGS_YAW_LOCK) !== 0

/**
 * What one action sends: the command whose acknowledgment settles it, how to send it, and what to do once it went
 * through
 */
interface CameraGimbalCommand {
  /**
   * Command the vehicle acknowledges
   */
  command: MavCmd
  /**
   * Send the command, without waiting for its acknowledgment
   */
  send: () => void
  /**
   * Run after the command was accepted or went unanswered
   */
  onSent?: () => void
}

type CommandLongParams = [number, number, number, number, number, number, number]

// Camera commands go to every component, as a camera can be its own MAVLink component rather than the autopilot's
const commandLong = (
  v: CameraGimbalVehicle,
  command: MavCmd,
  params: CommandLongParams,
  targetComponent: number = MavComponent.MAV_COMP_ID_AUTOPILOT1
): CameraGimbalCommand => ({
  command,
  send: () => void v.sendCommandLong(command, ...params, { targetComponent, awaitAck: false }),
})

const cameraGimbalCommands = (
  v: CameraGimbalVehicle,
  deviceId: number
): Record<CameraGimbalActionId, () => CameraGimbalCommand> => {
  // NaN marks the angles or rates ArduPilot should ignore.
  // ponytail: this is command 1000 under its pre-2022 name, which mavlink2rest 0.11 (what BlueOS ships) still
  // uses; mavlink2rest 1.x calls it MAV_CMD_DO_GIMBAL_MANAGER_PITCHYAW, so switch once BlueOS moves to it.
  const pitchYaw = (angles: [number, number], rates: [number, number], flags: number): CameraGimbalCommand =>
    commandLong(v, MavCmd.MAV_CMD_DO_GIMBAL_MANAGER_TILTPAN, [...angles, ...rates, flags, 0, deviceId])
  const camera = (command: MavCmd, params: CommandLongParams): CameraGimbalCommand =>
    commandLong(v, command, params, MavComponent.MAV_COMP_ID_ALL)
  // The primary gimbal (id 0) is gimbal 1 unless the vehicle was set up otherwise
  const flags = Number(getDataLakeVariableData(gimbalFlagsVariableId(v.systemId, deviceId || 1)) ?? 0)

  return {
    gimbal_center: () => pitchYaw([0, 0], [NaN, NaN], 0),
    gimbal_point_down: () => pitchYaw([-90, 0], [NaN, NaN], 0),
    gimbal_retract: () => pitchYaw([NaN, NaN], [NaN, NaN], GIMBAL_MANAGER_FLAGS_RETRACT),
    // Without angles or rates ArduPilot only changes the lock in RC targeting; zero rates hold the gimbal in place
    gimbal_toggle_yaw_lock: () =>
      pitchYaw([NaN, NaN], [0, 0], hasGimbalYawLock(flags) ? 0 : GIMBAL_MANAGER_FLAGS_YAW_LOCK),
    // ponytail: ArduPilot applies mount modes to its primary gimbal only; point a secondary one at home through
    // MAV_CMD_DO_SET_ROI_LOCATION with the home position if that is ever needed.
    gimbal_point_home: () =>
      commandLong(v, MavCmd.MAV_CMD_DO_MOUNT_CONTROL, [0, 0, 0, 0, 0, 0, MAV_MOUNT_MODE_HOME_LOCATION]),
    vehicle_camera_auto_focus: () =>
      camera(MavCmd.MAV_CMD_SET_CAMERA_FOCUS, [FOCUS_TYPE_AUTO, 0, deviceId, 0, 0, 0, 0]),
    vehicle_camera_take_picture: () => camera(MavCmd.MAV_CMD_IMAGE_START_CAPTURE, [deviceId, 0, 1, 0, 0, 0, 0]),
    vehicle_camera_toggle_recording: () => {
      const isRecording = getDataLakeVariableData(vehicleCameraRecordingVariableId) === true
      // Stream 0 with the camera id in the selector param; a zero selector falls back to treating param 1 as the id
      const command = isRecording
        ? camera(MavCmd.MAV_CMD_VIDEO_STOP_CAPTURE, [0, deviceId, 0, 0, 0, 0, 0])
        : camera(MavCmd.MAV_CMD_VIDEO_START_CAPTURE, [0, 0, deviceId, 0, 0, 0, 0])
      return { ...command, onSent: () => setVehicleCameraRecordingRequested(!isRecording) }
    },
  }
}

const refusalReasons: Partial<Record<MavResult, string>> = {
  [MavResult.MAV_RESULT_TEMPORARILY_REJECTED]: 'The vehicle is busy, try again.',
  [MavResult.MAV_RESULT_DENIED]: 'The vehicle refused it. Check that its gimbal or camera is set up.',
  [MavResult.MAV_RESULT_UNSUPPORTED]: 'The vehicle does not support it. Check that its gimbal or camera is set up.',
  [MavResult.MAV_RESULT_FAILED]: 'The vehicle tried and failed.',
}

const sendAndAwaitAck = async (
  vehicle: CameraGimbalVehicle,
  { command, send }: CameraGimbalCommand
): Promise<boolean> => {
  // Listens before sending, so a fast acknowledgment cannot arrive ahead of the listener
  const answer = vehicle.waitForCommandAck(command, ackTimeoutMs)
  send()
  const ack = await answer
  if (!ack) return false
  if (isCommandAckConfirmed(ack)) return true
  throw new Error(refusalReasons[ack.result.type] ?? 'The vehicle refused it.')
}

let activeVehicle: CameraGimbalVehicle | undefined

// Only ArduPilot vehicles set activeVehicle, so a connected vehicle without it runs another firmware
const notSupportedError = (): Error => new Error('Camera and gimbal controls are only available on ArduPilot vehicles.')

// An acknowledgment only names the command, so commands that share one wait in the same queue, or two would settle on
// one ack. Each is built when its turn comes, so a toggle reads the state the command before it left behind.
const queues = new Map<string, Promise<unknown>>()

const runQueued = (
  queue: string,
  build: (vehicle: CameraGimbalVehicle) => CameraGimbalCommand | undefined
): Promise<CameraGimbalCommandOutcome> => {
  const run = async (): Promise<CameraGimbalCommandOutcome> => {
    if (!activeVehicle) throw notSupportedError()
    const command = build(activeVehicle)
    if (!command) return 'skipped'
    const acknowledged = await sendAndAwaitAck(activeVehicle, command)
    command.onSent?.()
    return acknowledged ? 'accepted' : 'unacknowledged'
  }
  const next = (queues.get(queue) ?? Promise.resolve()).catch(() => undefined).then(run)
  queues.set(queue, next)
  return next
}

/**
 * Run a camera or gimbal action on the vehicle and wait for it to answer
 * @param {CameraGimbalActionId} id - The action to run
 * @param {number} deviceId - The gimbal and camera to act on, 1-based, or 0 for the primary gimbal and every camera
 * @returns {Promise<CameraGimbalCommandOutcome>} 'accepted' when the vehicle confirmed it, 'unacknowledged' when it
 * never answered, which is treated as having worked; rejects when the vehicle refused it or is not an ArduPilot one
 */
export const runCameraGimbalAction = (
  id: CameraGimbalActionId,
  deviceId: number
): Promise<CameraGimbalCommandOutcome> => {
  // Gimbal actions share one queue, as all but pointing home are the same command
  const queue = id.startsWith('gimbal_') ? 'gimbal' : id
  return runQueued(queue, (vehicle) => cameraGimbalCommands(vehicle, deviceId)[id]())
}

const heldZooms = new Map<number, symbol>()

const zoomCommand = (v: CameraGimbalVehicle, direction: -1 | 0 | 1, cameraId: number): CameraGimbalCommand =>
  commandLong(
    v,
    MavCmd.MAV_CMD_SET_CAMERA_ZOOM,
    [ZOOM_TYPE_CONTINUOUS, direction, cameraId, 0, 0, 0, 0],
    MavComponent.MAV_COMP_ID_ALL
  )

/**
 * Start zooming a vehicle camera, and wait for it to answer
 * @param {-1 | 1} direction - -1 zooms out, 1 zooms in
 * @param {number} cameraId - The camera, 1-based, or 0 for every camera
 * @returns {Promise<CameraGimbalCommandOutcome>} As {@link runCameraGimbalAction}, or 'skipped' when the press was
 * released before an earlier zoom command let it go out
 */
export const zoomVehicleCamera = (direction: -1 | 1, cameraId: number): Promise<CameraGimbalCommandOutcome> => {
  const press = Symbol()
  heldZooms.set(cameraId, press)
  // A start still queued when its press was released must not go out after that press's stop
  return runQueued('zoom', (vehicle) =>
    heldZooms.get(cameraId) === press ? zoomCommand(vehicle, direction, cameraId) : undefined
  )
}

/**
 * Stop zooming a vehicle camera right away, without waiting for the start's answer or its own
 * @param {number} cameraId - The camera, 1-based, or 0 for every camera
 */
export const stopZoomingVehicleCamera = (cameraId: number): void => {
  heldZooms.delete(cameraId)
  if (activeVehicle) zoomCommand(activeVehicle, 0, cameraId).send()
}

// Asks a few times, as the vehicle may still be bringing its camera up when Cockpit connects
const requestCameraInformation = (vehicle: CameraGimbalVehicle, attemptsLeft: number): void => {
  if (attemptsLeft === 0 || getDataLakeVariableData(vehicleCameraDetectedVariableId) === true) return
  const params: CommandLongParams = [CAMERA_INFORMATION_MESSAGE_ID, 0, 0, 0, 0, 0, 0]
  void vehicle.sendCommandLong(MavCmd.MAV_CMD_REQUEST_MESSAGE, ...params, { awaitAck: false })
  setTimeout(() => requestCameraInformation(vehicle, attemptsLeft - 1), cameraInformationRetryMs)
}

/**
 * Point the predefined camera and gimbal actions, which act on its primary gimbal and every camera, at a vehicle, and
 * start looking for its camera
 * @param {CameraGimbalVehicle} vehicle - The vehicle whose cameras and gimbals the actions control
 */
export const registerCameraGimbalActions = (vehicle: CameraGimbalVehicle): void => {
  activeVehicle = vehicle
  setVariable(vehicleCameraDetectedVariableId, cameraDetectedName, false)
  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.CAMERA_INFORMATION, () =>
    setVariable(vehicleCameraDetectedVariableId, cameraDetectedName, true)
  )
  requestCameraInformation(vehicle, cameraInformationRetries)
}

// Registered for every firmware, so a mapped joystick button on a non-ArduPilot vehicle tells why it does nothing
const cameraGimbalActionIds: CameraGimbalActionId[] = [
  'gimbal_center',
  'gimbal_point_down',
  'gimbal_point_home',
  'gimbal_retract',
  'gimbal_toggle_yaw_lock',
  'vehicle_camera_auto_focus',
  'vehicle_camera_take_picture',
  'vehicle_camera_toggle_recording',
]
cameraGimbalActionIds.forEach((id) => {
  registerActionCallback(availableCockpitActions[id], async () => {
    await runCameraGimbalAction(id, 0)
  })
})
