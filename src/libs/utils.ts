export const constrain = (value: number, min: number, max: number): number => {
  return Math.max(Math.min(value, max), min)
}

export const radians = (angle: number): number => (angle * Math.PI) / 180

export const degrees = (angle: number): number => (angle * 180) / Math.PI
