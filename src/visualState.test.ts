import { describe, expect, it } from 'vitest'
import { getHairSegmentCount, getRapunzelFrameIndex, getRapunzelPose } from './visualState'

describe('visual state helpers', () => {
  it('converts hair length to 2m modular segments up to 12m', () => {
    expect(getHairSegmentCount(0)).toBe(0)
    expect(getHairSegmentCount(2)).toBe(1)
    expect(getHairSegmentCount(10)).toBe(5)
    expect(getHairSegmentCount(12)).toBe(6)
    expect(getHairSegmentCount(20)).toBe(6)
  })

  it('maps interpreter state to required poses', () => {
    expect(getRapunzelPose({ instructionType: null, status: 'idle' })).toBe('idle')
    expect(getRapunzelPose({ instructionType: 'climb', status: 'running' })).toBe('climbing')
    expect(getRapunzelPose({ instructionType: 'grow', status: 'running' })).toBe('idle')
    expect(getRapunzelPose({ instructionType: null, status: 'failure' })).toBe('worried')
    expect(getRapunzelPose({ instructionType: null, status: 'success' })).toBe('celebrating')
  })

  it('uses sprite sheet frame indexes for selected poses', () => {
    expect(getRapunzelFrameIndex('idle')).toBe(0)
    expect(getRapunzelFrameIndex('worried')).toBe(3)
    expect(getRapunzelFrameIndex('climbing')).toBe(6)
    expect(getRapunzelFrameIndex('celebrating')).toBe(7)
  })
})
