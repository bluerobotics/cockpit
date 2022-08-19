export type Point2D = {
  x: number
  y: number
}

export type SizeRect2D = {
  width: number
  height: number
}

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
