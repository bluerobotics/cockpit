import * as Connection from '@/libs/connection/connection'
import { type Profile, WidgetType } from '@/types/widgets'

export const webRtcSignallingServerUrl = 'ws://blueos.local:6021'
export const mavlink2restServerURI = new Connection.URI('ws://blueos.local:6040/ws/mavlink')
export const widgetProfiles: { [key: string]: Profile } = {
  'c2bcf04d-048f-496f-9d78-fc4002608028': {
    name: 'Default Cockpit profile',
    layers: [
      {
        hash: 'eddd8e53-88c3-46a9-9e50-909227661f38',
        name: 'Layer dragonfly',
        widgets: [
          {
            hash: '0230b90e-0c6d-45ba-94e1-994a074b76c7',
            name: 'Attitude widget',
            component: WidgetType.Attitude,
            position: { x: 0.025, y: 0.2 },
            size: { width: 0.95, height: 0.6 },
            options: {
              showRollPitchValues: true,
              desiredAimRadius: 205,
              pitchHeightFactor: 1750,
              hudColor: '#FFF',
            },
          },
          {
            hash: '6920ce40-5121-4031-b628-678c5449d94a',
            name: 'HUD Compass widget',
            component: WidgetType.HudCompass,
            position: { x: 0.15, y: 0.84 },
            size: { width: 0.7, height: 0.13 },
            options: {
              showYawValue: true,
              yawGainFactor: 150,
              hudColor: '#FFF',
            },
          },
        ],
      },
      {
        hash: 'ba3ab6ab-7f34-49be-90e1-63e5b2c3845a',
        name: 'Main video layer',
        widgets: [
          {
            hash: '6439e791-3031-4928-aff2-8bd9af713798',
            name: 'Main video widget',
            component: WidgetType.VideoPlayer,
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            options: {
              videoFitStyle: 'cover',
              flipHorizontally: false,
              flipVertically: false,
            },
          },
        ],
      },
    ],
  },
}
export const widgetProfile = Object.values(widgetProfiles)[0]
