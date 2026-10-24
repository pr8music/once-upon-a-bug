import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as Blockly from 'blockly'
import './App.css'
import magicalNightScene from './assets/rapunzel/magical_night_scene.svg'
import midnightTowerScene from './assets/rapunzel/midnight_tower_scene.svg'
import nightSkyWithTower from './assets/rapunzel/night_sky_with_tower.svg'
import rapunzelHairSheet from './assets/rapunzel/rapunzel_hair_sheet.svg'
import rapunzelSpriteSheet from './assets/rapunzel/rapunzel_sprite_sheet.svg'
import {
  type CompiledLevelProgram,
  type ExecutionSnapshot,
  TARGET_HEIGHT_METERS,
  compileLevelProgram,
  createExecution,
  isTerminalStatus,
  resetExecution,
  stepExecution,
} from './gameInterpreter'
import { getHairSegmentCount, getRapunzelFrameIndex, getRapunzelPose } from './visualState'

const DEFAULT_REPEAT_COUNT = 5
const STORAGE_REPEAT_KEY = 'ouab.rapunzel.repeatCount'
const STORAGE_SOLVED_KEY = 'ouab.rapunzel.solved'

function ensureBlocksRegistered() {
  if (Blockly.Blocks.ouab_repeat) {
    return
  }

  Blockly.defineBlocksWithJsonArray([
    {
      args0: [
        {
          max: 12,
          min: 1,
          name: 'COUNT',
          type: 'field_number',
          value: DEFAULT_REPEAT_COUNT,
        },
      ],
      colour: 285,
      message0: 'Repeat %1 times',
      nextStatement: null,
      statementInputCount: 1,
      tooltip: 'How many times Rapunzel runs the sequence.',
      type: 'ouab_repeat',
    },
    {
      colour: 330,
      message0: 'Grow Hair +2m',
      nextStatement: null,
      previousStatement: null,
      tooltip: 'Grow Rapunzel\'s hair by 2 meters.',
      type: 'ouab_grow',
    },
    {
      colour: 200,
      message0: 'Climb',
      nextStatement: null,
      previousStatement: null,
      tooltip: 'Rapunzel climbs to current hair length.',
      type: 'ouab_climb',
    },
  ])

  const repeat = Blockly.Blocks.ouab_repeat
  const init = repeat.init
  repeat.init = function initRepeat(this: Blockly.Block) {
    init.call(this)
    this.appendStatementInput('DO').appendField('do')
  }
}

function sanitizeRepeatCount(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REPEAT_COUNT
  }

  return Math.max(1, Math.min(12, Math.floor(parsed)))
}

function loadStoredRepeatCount(): number {
  const raw = window.localStorage.getItem(STORAGE_REPEAT_KEY)
  return sanitizeRepeatCount(raw ?? DEFAULT_REPEAT_COUNT)
}

function createDefaultWorkspace(workspace: Blockly.WorkspaceSvg, repeatCount: number) {
  workspace.clear()

  const repeat = workspace.newBlock('ouab_repeat')
  const grow = workspace.newBlock('ouab_grow')
  const climb = workspace.newBlock('ouab_climb')

  repeat.setFieldValue(String(repeatCount), 'COUNT')

  repeat.getInput('DO')?.connection?.connect(grow.previousConnection)
  grow.nextConnection?.connect(climb.previousConnection)

  repeat.moveBy(36, 36)

  const fixedBlocks = [repeat, grow, climb]
  for (const block of fixedBlocks) {
    block.setDeletable(false)
    block.setMovable(false)
  }

  grow.setEditable(false)
  climb.setEditable(false)

  repeat.initSvg()
  grow.initSvg()
  climb.initSvg()

  repeat.render()
  grow.render()
  climb.render()
}

interface WorkspaceProgram {
  compiled: CompiledLevelProgram
  repeatCount: number
}

function parseWorkspaceProgram(workspace: Blockly.WorkspaceSvg):
  | { error: string; ok: false }
  | { ok: true; program: WorkspaceProgram } {
  const topBlocks = workspace.getTopBlocks(true).filter((block) => !block.isInsertionMarker())

  if (topBlocks.length !== 1) {
    return {
      error:
        'Keep one top block only: Repeat (with Grow Hair and Climb nested inside).',
      ok: false,
    }
  }

  const repeat = topBlocks[0]
  if (repeat.type !== 'ouab_repeat') {
    return {
      error: 'The story must begin with a Repeat block.',
      ok: false,
    }
  }

  const repeatCount = sanitizeRepeatCount(repeat.getFieldValue('COUNT'))

  const firstChild = repeat.getInputTargetBlock('DO')
  if (!firstChild || firstChild.type !== 'ouab_grow') {
    return {
      error: 'Place Grow Hair first inside Repeat.',
      ok: false,
    }
  }

  const secondChild = firstChild.getNextBlock()
  if (!secondChild || secondChild.type !== 'ouab_climb') {
    return {
      error: 'Place Climb directly after Grow Hair.',
      ok: false,
    }
  }

  if (secondChild.getNextBlock()) {
    return {
      error: 'This level uses exactly two blocks in the loop: Grow Hair, then Climb.',
      ok: false,
    }
  }

  const compiled = compileLevelProgram(repeatCount, {
    climb: secondChild.id,
    grow: firstChild.id,
    repeat: repeat.id,
  })

  return {
    ok: true,
    program: {
      compiled,
      repeatCount,
    },
  }
}

function App() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const timerRef = useRef<number | null>(null)
  const runtimeRef = useRef<ExecutionSnapshot>(resetExecution(null))

  const [execution, setExecution] = useState<ExecutionSnapshot>(() => resetExecution(null))
  const [repeatCount, setRepeatCount] = useState(DEFAULT_REPEAT_COUNT)
  const [solvedBefore, setSolvedBefore] = useState(
    () => window.localStorage.getItem(STORAGE_SOLVED_KEY) === 'true',
  )

  runtimeRef.current = execution

  const hairPercent = Math.min(100, (execution.hairLength / TARGET_HEIGHT_METERS) * 100)
  const climbPercent = Math.min(100, (execution.climbHeight / TARGET_HEIGHT_METERS) * 100)
  const hairSegmentCount = getHairSegmentCount(execution.hairLength)
  const activeInstruction =
    execution.pointer > 0 ? execution.compiled?.instructions[execution.pointer - 1] ?? null : null
  const pose = getRapunzelPose({
    instructionType: activeInstruction?.type ?? null,
    status: execution.status,
  })
  const rapunzelFrameIndex = getRapunzelFrameIndex(pose)
  const hairSegmentIndexes = useMemo(
    () => Array.from({ length: hairSegmentCount }, (_, index) => index),
    [hairSegmentCount],
  )
  const worldScene =
    execution.status === 'success'
      ? magicalNightScene
      : execution.status === 'failure' || execution.status === 'error'
        ? midnightTowerScene
        : nightSkyWithTower

  const statusLabel = useMemo(() => {
    if (execution.status === 'success') {
      return 'Escaped!'
    }
    if (execution.status === 'failure') {
      return 'Bug still active'
    }
    if (execution.status === 'error') {
      return 'Program issue'
    }
    if (execution.status === 'running') {
      return 'Running'
    }
    return 'Ready'
  }, [execution.status])

  const setHighlight = (blockId: string | null) => {
    const workspace = workspaceRef.current
    if (!workspace) {
      return
    }

    workspace.highlightBlock(blockId ?? null)
  }

  const stopRunLoop = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const buildFreshExecution = (): ExecutionSnapshot | null => {
    const workspace = workspaceRef.current
    if (!workspace) {
      return null
    }

    const parsed = parseWorkspaceProgram(workspace)
    if (!parsed.ok) {
      const next = {
        ...resetExecution(null),
        message: parsed.error,
        status: 'error' as const,
      }
      setExecution(next)
      runtimeRef.current = next
      setHighlight(null)
      return null
    }

    setRepeatCount(parsed.program.repeatCount)
    window.localStorage.setItem(STORAGE_REPEAT_KEY, String(parsed.program.repeatCount))

    const fresh = createExecution(parsed.program.compiled)
    setExecution(fresh)
    runtimeRef.current = fresh
    setHighlight(null)
    return fresh
  }

  const stepRuntime = (): boolean => {
    let current = runtimeRef.current
    if (!current.compiled || isTerminalStatus(current.status)) {
      const fresh = buildFreshExecution()
      if (!fresh) {
        return true
      }
      current = fresh
    }

    const next = stepExecution({
      ...current,
      status: 'running',
    })

    runtimeRef.current = next
    setExecution(next)
    setHighlight(next.activeBlockId)

    if (next.status === 'success') {
      window.localStorage.setItem(STORAGE_SOLVED_KEY, 'true')
      setSolvedBefore(true)
    }

    return isTerminalStatus(next.status)
  }

  const handleStep = () => {
    stopRunLoop()
    stepRuntime()
  }

  const handleRun = () => {
    stopRunLoop()

    const runTick = () => {
      const done = stepRuntime()
      if (!done) {
        timerRef.current = window.setTimeout(runTick, 380)
      } else {
        timerRef.current = null
      }
    }

    runTick()
  }

  const handleReset = () => {
    stopRunLoop()

    const fresh = buildFreshExecution()
    if (!fresh) {
      return
    }

    const reset = resetExecution(fresh.compiled)
    runtimeRef.current = reset
    setExecution(reset)
    setHighlight(null)
  }

  useEffect(() => {
    ensureBlocksRegistered()

    if (!editorRef.current) {
      return
    }

    const workspace = Blockly.inject(editorRef.current, {
      grid: {
        colour: '#d1b690',
        length: 20,
        snap: true,
        spacing: 20,
      },
      move: {
        drag: true,
        wheel: true,
      },
      renderer: 'zelos',
      toolbox: {
        contents: [
          {
            kind: 'block',
            type: 'ouab_repeat',
          },
          {
            kind: 'block',
            type: 'ouab_grow',
          },
          {
            kind: 'block',
            type: 'ouab_climb',
          },
        ],
        kind: 'flyoutToolbox',
      },
      trashcan: false,
      zoom: {
        controls: false,
        wheel: true,
      },
    })

    workspaceRef.current = workspace

    const startingRepeat = loadStoredRepeatCount()
    setRepeatCount(startingRepeat)
    createDefaultWorkspace(workspace, startingRepeat)

    const parsed = parseWorkspaceProgram(workspace)
    if (parsed.ok) {
      const start = createExecution(parsed.program.compiled)
      setExecution(start)
      runtimeRef.current = start
    }

    const onWorkspaceChange = () => {
      const activeRepeat = workspace
        .getTopBlocks(false)
        .find((block) => block.type === 'ouab_repeat')

      if (!activeRepeat) {
        return
      }

      const nextRepeatCount = sanitizeRepeatCount(activeRepeat.getFieldValue('COUNT'))
      setRepeatCount(nextRepeatCount)
      window.localStorage.setItem(STORAGE_REPEAT_KEY, String(nextRepeatCount))
    }

    workspace.addChangeListener(onWorkspaceChange)

    return () => {
      stopRunLoop()
      workspace.removeChangeListener(onWorkspaceChange)
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [])

  return (
    <main className="storybook-shell">
      <header className="storybook-title">
        <h1>Once Upon a Bug</h1>
        <p>Someone put a bug in your fairy tale. Fix the code. Rewrite the ending.</p>
      </header>

      <section className="storybook-book" aria-label="Rapunzel level">
        <article className="page page-world" aria-label="Tower world">
          <img className="world-scene" src={worldScene} alt="" aria-hidden="true" />

          <div className="tower-anchor">
            <div
              className={`hair-stack ${execution.status === 'success' ? 'hair-stack-sparkle' : ''}`}
              style={{ height: `${Math.max(hairPercent, 2)}%` }}
            >
              {hairSegmentIndexes.map((index) => (
                <span
                  key={index}
                  className="hair-segment"
                  style={{
                    backgroundImage: `url(${rapunzelHairSheet})`,
                    backgroundPositionX: `${(index % 6) * -24}px`,
                  }}
                />
              ))}
              {hairSegmentCount > 0 ? (
                <span className="hair-tip" style={{ backgroundImage: `url(${rapunzelHairSheet})` }} />
              ) : null}
              {execution.status === 'success' ? (
                <span
                  className="hair-sparkle"
                  style={{ backgroundImage: `url(${rapunzelHairSheet})` }}
                />
              ) : null}
            </div>
            <div
              className={`rapunzel rapunzel-${pose}`}
              style={{
                backgroundImage: `url(${rapunzelSpriteSheet})`,
                backgroundPositionX: `${rapunzelFrameIndex * -64}px`,
                bottom: `${26 + climbPercent * 2.4}px`,
              } satisfies CSSProperties}
            />
          </div>

          <div className="feedback-panel" role="status" aria-live="polite">
            <strong>{statusLabel}</strong>
            <p>{execution.message}</p>
          </div>
        </article>

        <article className="page page-code" aria-label="Block editor and controls">
          <h2>Rapunzel&apos;s Buggy Program</h2>
          <p className="prompt">
            Her window is 12m high, but the loop currently stops at 10m. Fix the repeat count.
          </p>

          <div className="editor-card">
            <div className="blockly-host" ref={editorRef} />
          </div>

          <div className="controls">
            <button type="button" onClick={handleRun}>
              Run
            </button>
            <button type="button" onClick={handleStep}>
              Step
            </button>
            <button type="button" onClick={handleReset}>
              Reset
            </button>
          </div>

          <dl className="stats">
            <div>
              <dt>Hair length</dt>
              <dd>{execution.hairLength}m</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{TARGET_HEIGHT_METERS}m</dd>
            </div>
            <div>
              <dt>Repeat count</dt>
              <dd>{repeatCount}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusLabel}</dd>
            </div>
          </dl>

          {solvedBefore ? <p className="badge">⭐ Story memory: Rapunzel escaped before!</p> : null}
        </article>
      </section>
    </main>
  )
}

export default App
