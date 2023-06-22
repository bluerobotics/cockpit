import { type MiniWidgetProfile, MiniWidgetType } from '@/types/miniWidgets'
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
            hash: '0230b90e-0c6d-45ba-94e1-994a074b76c7',
            name: 'Attitude widget',
            component: WidgetType.Attitude,
            position: { x: 0.14, y: 0.2 },
            size: { width: 0.72, height: 0.6 },
            managerVars: { timesMounted: 0 },
            options: {
              showCenterAim: true,
              showPitchLines: true,
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
            position: { x: 0.15, y: 0.84 },
            size: { width: 0.7, height: 0.065 },
            managerVars: { timesMounted: 0 },
            options: {
              showYawValue: true,
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

export const miniWidgetsProfiles: MiniWidgetProfile[] = [
  {
    name: 'Default Cockpit Mini Widget profile',
    containers: [
      {
        name: 'Top-right container',
        widgets: [
          {
            component: MiniWidgetType.BaseCommIndicator,
            options: {},
          },
        ],
      },
      {
        name: 'Bottom-left container',
        widgets: [],
      },
      {
        name: 'Bottom-center container',
        widgets: [
          {
            component: MiniWidgetType.DepthIndicator,
            options: {},
          },
        ],
      },
      {
        name: 'Bottom-right container',
        widgets: [
          {
            component: MiniWidgetType.ArmerButton,
            options: {},
          },
          {
            component: MiniWidgetType.ModeSelector,
            options: {},
          },
        ],
      },
    ],
  },
]
export const miniWidgetsProfile = miniWidgetsProfiles[0]
