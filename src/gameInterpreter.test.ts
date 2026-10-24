import { describe, expect, it } from 'vitest'
import {
  compileLevelProgram,
  createExecution,
  resetExecution,
  runToCompletion,
  stepExecution,
} from './gameInterpreter'

const blockIds = {
  climb: 'climb-block',
  grow: 'grow-block',
  repeat: 'repeat-block',
}

describe('Rapunzel interpreter', () => {
  it('fails with the faulty default program (repeat 5)', () => {
    const compiled = compileLevelProgram(5, blockIds)
    const finalState = runToCompletion(createExecution(compiled))

    expect(finalState.status).toBe('failure')
    expect(finalState.hairLength).toBe(10)
    expect(finalState.climbHeight).toBe(10)
  })

  it('succeeds with the fixed program (repeat 6)', () => {
    const compiled = compileLevelProgram(6, blockIds)
    const finalState = runToCompletion(createExecution(compiled))

    expect(finalState.status).toBe('success')
    expect(finalState.hairLength).toBe(12)
    expect(finalState.climbHeight).toBe(12)
  })

  it('steps one instruction at a time', () => {
    const compiled = compileLevelProgram(6, blockIds)
    const initial = createExecution(compiled)

    const afterFirstStep = stepExecution(initial)
    expect(afterFirstStep.pointer).toBe(1)
    expect(afterFirstStep.hairLength).toBe(0)
    expect(afterFirstStep.status).toBe('running')

    const afterSecondStep = stepExecution(afterFirstStep)
    expect(afterSecondStep.pointer).toBe(2)
    expect(afterSecondStep.hairLength).toBe(2)
    expect(afterSecondStep.activeBlockId).toBe('grow-block')
  })

  it('resets progress back to the level start', () => {
    const compiled = compileLevelProgram(6, blockIds)
    const progressed = stepExecution(stepExecution(createExecution(compiled)))

    const reset = resetExecution(compiled)

    expect(progressed.hairLength).toBeGreaterThan(0)
    expect(reset.pointer).toBe(0)
    expect(reset.hairLength).toBe(0)
    expect(reset.climbHeight).toBe(0)
    expect(reset.status).toBe('idle')
  })
})
