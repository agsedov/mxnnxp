import { describe, expect, it } from 'vitest'
import { Algebraic } from './algebraic'
import { COS_SIN_TABLE } from './angles'

describe('COS_SIN_TABLE', () => {
  it('lists the 16 distinct basic angles once each', () => {
    // Every multiple of pi/6 and pi/4 in [0, 2pi), with the coincidences
    // (pi/2, pi, 3pi/2) collapsed into their single canonical key.
    expect(Object.keys(COS_SIN_TABLE)).toEqual([
      '0',
      'pi/6',
      'pi/4',
      'pi/3',
      'pi/2',
      '2pi/3',
      '3pi/4',
      '5pi/6',
      'pi',
      '7pi/6',
      '5pi/4',
      '4pi/3',
      '3pi/2',
      '5pi/3',
      '7pi/4',
      '11pi/6',
    ])
  })

  it('gives exact cos and sin values', () => {
    const label = (angle: string) => COS_SIN_TABLE[angle].map(value => value.toString())
    expect(label('0')).toEqual(['1', '0'])
    expect(label('pi/6')).toEqual(['sqrt(3)/2', '1/2'])
    expect(label('pi/4')).toEqual(['sqrt(2)/2', 'sqrt(2)/2'])
    expect(label('pi/3')).toEqual(['1/2', 'sqrt(3)/2'])
    expect(label('5pi/6')).toEqual(['-sqrt(3)/2', '1/2'])
    expect(label('3pi/2')).toEqual(['0', '-1'])
    expect(label('11pi/6')).toEqual(['sqrt(3)/2', '-1/2'])
  })

  it('lies on the unit circle for every angle', () => {
    for (const [angle, [cos, sin]] of Object.entries(COS_SIN_TABLE)) {
      expect(cos.mul(cos).add(sin.mul(sin)).equals(Algebraic.ONE), angle).toBe(true)
    }
  })
})
