export const TARGET_HEIGHT_METERS = 12
export const HAIR_GROWTH_PER_BLOCK = 2

export type InstructionType = 'repeat' | 'grow' | 'climb'
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'failure' | 'error'

export interface ProgramBlockIds {
  repeat: string
  grow: string
  climb: string
}

export interface ExecutionInstruction {
  blockId: string
  iteration: number
  type: InstructionType
}

export interface CompiledLevelProgram {
  repeatCount: number
  instructions: ExecutionInstruction[]
}

export interface ExecutionSnapshot {
  activeBlockId: string | null
  climbHeight: number
  compiled: CompiledLevelProgram | null
  hairLength: number
  message: string
  pointer: number
  status: ExecutionStatus
}

export const isTerminalStatus = (status: ExecutionStatus): boolean =>
  status === 'success' || status === 'failure' || status === 'error'

export function compileLevelProgram(
  repeatCount: number,
  blockIds: ProgramBlockIds,
): CompiledLevelProgram {
  const safeRepeatCount = Math.max(1, Math.floor(repeatCount))
  const instructions: ExecutionInstruction[] = []

  for (let iteration = 1; iteration <= safeRepeatCount; iteration += 1) {
    instructions.push({ blockId: blockIds.repeat, iteration, type: 'repeat' })
    instructions.push({ blockId: blockIds.grow, iteration, type: 'grow' })
    instructions.push({ blockId: blockIds.climb, iteration, type: 'climb' })
  }

  return {
    instructions,
    repeatCount: safeRepeatCount,
  }
}

export function createExecution(compiled: CompiledLevelProgram): ExecutionSnapshot {
  return {
    activeBlockId: null,
    climbHeight: 0,
    compiled,
    hairLength: 0,
    message: 'Ready. Fix the loop and run the tale!',
    pointer: 0,
    status: 'idle',
  }
}

export function resetExecution(compiled: CompiledLevelProgram | null): ExecutionSnapshot {
  if (!compiled) {
    return {
      activeBlockId: null,
      climbHeight: 0,
      compiled: null,
      hairLength: 0,
      message: 'Build a valid story program first.',
      pointer: 0,
      status: 'idle',
    }
  }

  return createExecution(compiled)
}

export function stepExecution(snapshot: ExecutionSnapshot): ExecutionSnapshot {
  if (!snapshot.compiled) {
    return {
      ...snapshot,
      message: 'I cannot run yet: the block story is incomplete.',
      status: 'error',
    }
  }

  const instruction = snapshot.compiled.instructions[snapshot.pointer]
  if (!instruction) {
    const escaped =
      snapshot.hairLength >= TARGET_HEIGHT_METERS && snapshot.climbHeight >= TARGET_HEIGHT_METERS

    return {
      ...snapshot,
      message: escaped
        ? 'Rapunzel made it to the ground! 🎉'
        : 'So close! The braid stopped short of the 12m window.',
      status: escaped ? 'success' : 'failure',
    }
  }

  let nextHairLength = snapshot.hairLength
  let nextClimbHeight = snapshot.climbHeight

  if (instruction.type === 'grow') {
    nextHairLength = Math.min(
      TARGET_HEIGHT_METERS,
      snapshot.hairLength + HAIR_GROWTH_PER_BLOCK,
    )
  }

  if (instruction.type === 'climb') {
    nextClimbHeight = Math.min(TARGET_HEIGHT_METERS, nextHairLength)
  }

  const pointer = snapshot.pointer + 1
  const done = pointer >= snapshot.compiled.instructions.length
  const escaped =
    done && nextHairLength >= TARGET_HEIGHT_METERS && nextClimbHeight >= TARGET_HEIGHT_METERS

  return {
    activeBlockId: instruction.blockId,
    climbHeight: nextClimbHeight,
    compiled: snapshot.compiled,
    hairLength: nextHairLength,
    message: done
      ? escaped
        ? 'Rapunzel made it to the ground! 🎉'
        : 'The program ended with hair below the 12m target.'
      : instruction.type === 'repeat'
        ? `Loop ${instruction.iteration}/${snapshot.compiled.repeatCount}`
        : instruction.type === 'grow'
          ? `Hair grows to ${nextHairLength}m`
          : `Rapunzel climbs to ${nextClimbHeight}m`,
    pointer,
    status: done ? (escaped ? 'success' : 'failure') : 'running',
  }
}

export function runToCompletion(snapshot: ExecutionSnapshot): ExecutionSnapshot {
  let current = snapshot
  while (!isTerminalStatus(current.status)) {
    current = stepExecution(current)
  }
  return current
}
