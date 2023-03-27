import { type Profile, WidgetType } from '@/types/widgets'

export const defaultGlobalAddress = 'blueos.local'
export const widgetProfiles: { [key: string]: Profile } = {
  'c2bcf04d-048f-496f-9d78-fc4002608028': {
    name: 'Default Cockpit profile',
    layers: [
      {
        hash: 'eddd8e53-88c3-46a9-9e50-909227661f38',
        name: 'Layer dragonfly',
        widgets: [
          {
            hash: '4ee737c2-a49c-4899-b045-954bc4af238a',
            name: 'Video Recorder widget',
            component: WidgetType.VideoRecorder,
            position: { x: 0.01, y: 0.45 },
            size: { width: 0.05, height: 0.1 },
            managerVars: { timesMounted: 0 },
            options: {
              streamName: undefined,
            },
          },
          {
            hash: '8b1448f5-3f07-4bfc-8a0e-5d491993f858',
            name: 'Depth HUD widget',
            component: WidgetType.DepthHUD,
            position: { x: 0.88, y: 0.23 },
            size: { width: 0.1, height: 0.62 },
            managerVars: { timesMounted: 0 },
            options: {
              showDepthValue: true,
              hudColor: '#FFFFFF',
            },
          },
          {
            hash: 'a27ffc81-42ae-4d11-883c-12a744e019e1',
            name: 'PowerBar',
            component: WidgetType.PowerBar,
            position: { x: 0.1, y: 0.0 },
            size: { width: 0.8, height: 0.06 },
            managerVars: { timesMounted: 0 },
            options: {},
          },
          {
            hash: '0230b90e-0c6d-45ba-94e1-994a074b76c7',
            name: 'Attitude widget',
            component: WidgetType.Attitude,
            position: { x: 0.14, y: 0.2 },
            size: { width: 0.72, height: 0.6 },
            managerVars: { timesMounted: 0 },
            options: {
              showRollPitchValues: true,
              desiredAimRadius: 180,
              pitchHeightFactor: 1000,
              hudColor: '#FFF',
            },
          },
          {
            hash: '6920ce40-5121-4031-b628-678c5449d94a',
            name: 'HUD Compass widget',
            component: WidgetType.HudCompass,
            position: { x: 0.2, y: 0.85 },
            size: { width: 0.6, height: 0.12 },
            managerVars: { timesMounted: 0 },
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
            managerVars: { timesMounted: 0 },
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
