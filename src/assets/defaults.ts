import { type MiniWidgetProfile, MiniWidgetType } from '@/types/miniWidgets'
import { type Profile, WidgetType } from '@/types/widgets'

export const defaultGlobalAddress = process.env.NODE_ENV === 'development' ? 'blueos.local' : window.location.hostname
export const widgetProfiles: { [key: string]: Profile } = {
  'c2bcf04d-048f-496f-9d78-fc4002608028': {
    name: 'Default Cockpit profile',
    views: [
      {
        hash: 'eddd8e53-88c3-46a9-9e50-909227661f38',
        name: 'Video view',
        widgets: [
          {
            hash: '8b1448f5-3f07-4bfc-8a0e-5d491993f858',
            name: 'Depth HUD',
            component: WidgetType.DepthHUD,
            position: { x: 0.89, y: 0.23 },
            size: { width: 0.09, height: 0.62 },
            managerVars: {
              timesMounted: 0,
              configMenuOpen: false,
              lastNonMaximizedX: 0.4,
              lastNonMaximizedY: 0.32,
              lastNonMaximizedWidth: 0.2,
              lastNonMaximizedHeight: 0.36,
            },
            options: {
              showDepthValue: true,
              hudColor: '#FFFFFF',
            },
          },
          {
            hash: '0230b90e-0c6d-45ba-94e1-994a074b76c7',
            name: 'Attitude HUD',
            component: WidgetType.Attitude,
            position: { x: 0.14, y: 0.2 },
            size: { width: 0.72, height: 0.6 },
            managerVars: {
              timesMounted: 0,
              configMenuOpen: false,
              lastNonMaximizedX: 0.4,
              lastNonMaximizedY: 0.32,
              lastNonMaximizedWidth: 0.2,
              lastNonMaximizedHeight: 0.36,
            },
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
            name: 'HUD Compass',
            component: WidgetType.CompassHUD,
            position: { x: 0.15, y: 0.84 },
            size: { width: 0.7, height: 0.065 },
            managerVars: {
              timesMounted: 0,
              configMenuOpen: false,
              lastNonMaximizedX: 0.4,
              lastNonMaximizedY: 0.32,
              lastNonMaximizedWidth: 0.2,
              lastNonMaximizedHeight: 0.36,
            },
            options: {
              showYawValue: true,
              hudColor: '#FFF',
            },
          },
          {
            hash: '6439e791-3031-4928-aff2-8bd9af713798',
            name: 'Video player',
            component: WidgetType.VideoPlayer,
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            managerVars: {
              timesMounted: 0,
              configMenuOpen: false,
              lastNonMaximizedX: 0.4,
              lastNonMaximizedY: 0.32,
              lastNonMaximizedWidth: 0.2,
              lastNonMaximizedHeight: 0.36,
            },
            options: {
              videoFitStyle: 'cover',
              flipHorizontally: false,
              flipVertically: false,
            },
          },
        ],
        miniWidgetContainers: [
          {
            name: 'Bottom-left container',
            widgets: [
              {
                hash: 'c6eb406b-8e3c-4ab9-a348-4ad5058352be',
                component: MiniWidgetType.ViewSelector,
                options: {},
              },
            ],
          },
          {
            name: 'Bottom-center container',
            widgets: [
              {
                hash: 'c6eb406b-8e3c-4ab9-a348-4ad5058352be',
                component: MiniWidgetType.DepthIndicator,
                options: {},
              },
            ],
          },
          {
            name: 'Bottom-right container',
            widgets: [
              {
                hash: '837a6722-1e54-4ace-9a92-d9c5af059d16',
                component: MiniWidgetType.ArmerButton,
                options: {},
              },
              {
                hash: 'c6301929-cdfc-48af-9fdd-c87ce65d7395',
                component: MiniWidgetType.ModeSelector,
                options: {},
              },
              {
                hash: 'a4d0d6ce-9978-40f2-89ab-958f91137177',
                component: MiniWidgetType.MiniVideoRecorder,
                options: {},
              },
            ],
          },
        ],
      },
      {
        hash: 'f8a76470-9122-44f7-97f7-4555a59ee9c4',
        name: 'Map view',
        widgets: [
          {
            hash: '6439e791-3031-4928-aff2-8bd9af713798',
            name: 'Main Map',
            component: WidgetType.Map,
            position: { x: 0, y: 0 },
            size: { width: 1, height: 1 },
            managerVars: {
              timesMounted: 0,
              configMenuOpen: false,
              lastNonMaximizedX: 0.4,
              lastNonMaximizedY: 0.32,
              lastNonMaximizedWidth: 0.2,
              lastNonMaximizedHeight: 0.36,
            },
            options: {},
          },
        ],
        miniWidgetContainers: [
          {
            name: 'Bottom-left container',
            widgets: [
              {
                hash: 'c6eb406b-8e3c-4ab9-a348-4ad5058352be',
                component: MiniWidgetType.ViewSelector,
                options: {},
              },
            ],
          },
          { name: 'Bottom-center container', widgets: [] },
          { name: 'Bottom-right container', widgets: [] },
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
            hash: '5b21cf5b-5849-413a-8bee-f1c4b42522f8',
            component: MiniWidgetType.BaseCommIndicator,
            options: {},
          },
          {
            hash: '41354445-2057-4574-80f5-bdc6d394dfe7',
            component: MiniWidgetType.JoystickCommIndicator,
            options: {},
          },
          {
            hash: '7b31c4c4-e273-4f75-b0b7-d56263c4177d',
            component: MiniWidgetType.BatteryIndicator,
            options: {},
          },
        ],
      },
    ],
  },
]
export const miniWidgetsProfile = miniWidgetsProfiles[0]
