import type { Point2D, SizeRect2D } from './general'

export enum WidgetType {
  IndicatorsWidgetComponent = 'IndicatorsWidget',
  CounterCardComponent = 'CounterCard',
  IndependentReactorComponent = 'IndependentReactor',
  VideoPlayerComponent = 'VideoPlayer',
  MapWidgetComponent = 'MapWidget',
  CompassWidgetComponent = 'CompassWidget',
}

export type Widget = {
  hash: string
  component: WidgetType
  position: Point2D
  size: SizeRect2D
}

export type Layer = {
  hash: string
  widgets: Widget[]
}
