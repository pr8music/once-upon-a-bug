import {
  TARGET_HEIGHT_METERS,
  type ExecutionStatus,
  type InstructionType,
} from './gameInterpreter'

const HAIR_SEGMENT_METERS = 2
const MAX_HAIR_SEGMENTS = TARGET_HEIGHT_METERS / HAIR_SEGMENT_METERS

export type RapunzelPose = 'idle' | 'worried' | 'climbing' | 'celebrating'

interface VisualStateInput {
  instructionType: InstructionType | null
  status: ExecutionStatus
}

const RAPUNZEL_FRAME_BY_POSE: Record<RapunzelPose, number> = {
  celebrating: 7,
  climbing: 6,
  idle: 0,
  worried: 3,
}

export function getHairSegmentCount(hairLength: number): number {
  const segments = Math.floor(hairLength / HAIR_SEGMENT_METERS)
  return Math.max(0, Math.min(MAX_HAIR_SEGMENTS, segments))
}

export function getRapunzelPose({ instructionType, status }: VisualStateInput): RapunzelPose {
  if (status === 'success') {
    return 'celebrating'
  }

  if (status === 'failure' || status === 'error') {
    return 'worried'
  }

  if (status === 'running' && instructionType === 'climb') {
    return 'climbing'
  }

  return 'idle'
}

export function getRapunzelFrameIndex(pose: RapunzelPose): number {
  return RAPUNZEL_FRAME_BY_POSE[pose]
}
