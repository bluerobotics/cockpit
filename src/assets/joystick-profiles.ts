import type { MavlinkControllerMapping } from '@/libs/joystick/protocols'

export const ps4MavlinkMapping: MavlinkControllerMapping = {
  name: 'PS4 controller to Mavlink',
  axesCorrespondencies: ['y', 'x', 'r', 'z'],
  axesMins: [-1000, 1000, -1000, 1000],
  axesMaxs: [1000, -1000, 1000, 0],
  buttons: [0, 1, 2, 3, 9, 10, undefined, undefined, 4, 6, 7, 8, 11, 12, 13, 14, 5],
}

// TODO: Adjust mapping for PS5 controller
export const ps5MavlinkMapping: MavlinkControllerMapping = {
  name: 'PS5 controller to Mavlink',
  axesCorrespondencies: ['x', 'y', 'z', 'r'],
  axesMins: [1000, -1000, 1000, -1000],
  axesMaxs: [-1000, 1000, 0, 1000],
  buttons: [0, 1, 2, 3, 9, 10, undefined, undefined, 4, 6, 7, 8, 11, 12, 13, 14, 5],
}
