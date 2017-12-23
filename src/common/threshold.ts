export type ThresholdOrientation = 'up' | 'down' | 'any'

export interface Threshold {
  readonly orientation: ThresholdOrientation
  readonly price: number
}
