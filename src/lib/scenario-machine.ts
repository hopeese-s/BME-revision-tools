// ============================================================================
// EgBE Memory & Revision Engine — XState Scenario State Machine
//
// Clinical & Engineering Troubleshooting Branching Scenarios
//
// State machine for interactive branching scenarios where BME students
// diagnose equipment malfunctions, clinical cases, or circuit failures.
// Tracks: decision history, score, penalty time, timeout detection.
//
// States:
//   idle → active (when scenario launched)
//   active:
//     - presenting (showing prompt/info node)
//     - awaiting_decision (at a decision node with choices)
//     - showing_feedback (after a decision, before moving on)
//     - success (reached outcome_success)
//     - failure (reached outcome_failure)
//   timed_out (exceeded time limit)
//   completed (scenario finished)
// ============================================================================

import { createMachine, assign } from 'xstate';
import type {
  Scenario,
  ScenarioMachineContext,
  ScenarioNode,
  ScenarioTransition,
  UUID,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ScenarioEvent =
  | { type: 'START'; scenario: Scenario; entryNode: ScenarioNode }
  | { type: 'MAKE_DECISION'; transition: ScenarioTransition; targetNodeId: UUID }
  | { type: 'DISMISS_FEEDBACK'; nextNodeId: UUID }
  | { type: 'TICK'; elapsedSeconds: number }
  | { type: 'TIMEOUT' }
  | { type: 'RESTART' }
  | { type: 'EXIT' };

// ---------------------------------------------------------------------------
// Machine Definition
// ---------------------------------------------------------------------------

export type ScenarioState =
  | 'idle'
  | 'presenting'
  | 'awaiting_decision'
  | 'showing_feedback'
  | 'success'
  | 'failure'
  | 'timed_out'
  | 'completed';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvent = any;

export const scenarioMachine = createMachine({
  types: {} as {
    context: ScenarioMachineContext;
    events: ScenarioEvent;
  },
  id: 'scenarioRunner',
  initial: 'idle',

  context: {
    scenario: {} as Scenario,
    currentNodeId: '' as UUID,
    visitedNodeIds: [] as UUID[],
    score: 0,
    penaltySeconds: 0,
    elapsedSeconds: 0,
    timeLimitSeconds: null as number | null,
    isTimedOut: false,
    history: [] as ScenarioTransition[],
  },

  states: {
    // ---------- Idle ----------
    idle: {
      entry: assign({
        scenario: {} as Scenario,
        currentNodeId: '' as UUID,
        visitedNodeIds: [] as UUID[],
        score: 0,
        penaltySeconds: 0,
        elapsedSeconds: 0,
        isTimedOut: false,
        history: [] as ScenarioTransition[],
      }),
      on: {
        START: {
          target: 'presenting',
          actions: assign(({ event }: { event: AnyEvent }) => ({
            scenario: event.scenario,
            currentNodeId: event.entryNode.id,
            visitedNodeIds: [event.entryNode.id],
            timeLimitSeconds: event.scenario.time_limit_seconds ?? null,
            score: 0,
            penaltySeconds: 0,
            elapsedSeconds: 0,
            isTimedOut: false,
            history: [],
          })),
        },
      },
    },

    // ---------- Active: Presenting Node ----------
    presenting: {
      entry: assign(({ context }: { context: ScenarioMachineContext }) => ({
        visitedNodeIds: [
          ...context.visitedNodeIds,
          context.currentNodeId,
        ],
      })),
      always: [
        {
          target: 'awaiting_decision',
          guard: () => true,
        },
      ],
      on: {
        TICK: {
          actions: assign(({ event }: { event: AnyEvent }) => ({
            elapsedSeconds: event.elapsedSeconds,
          })),
        },
        TIMEOUT: {
          target: 'timed_out',
          actions: assign({
            isTimedOut: true,
          }),
        },
        EXIT: {
          target: 'idle',
        },
      },
    },

    // ---------- Active: Awaiting Decision ----------
    awaiting_decision: {
      on: {
        MAKE_DECISION: {
          target: 'showing_feedback',
          actions: assign(
            ({ context, event }: { context: ScenarioMachineContext; event: AnyEvent }) => ({
              history: [...context.history, event.transition],
              score: event.transition.is_correct
                ? context.score + 1
                : context.score,
              penaltySeconds:
                context.penaltySeconds + event.transition.penalty_seconds,
              currentNodeId: event.targetNodeId,
            }),
          ),
        },
        TICK: {
          actions: assign(({ event }: { event: AnyEvent }) => ({
            elapsedSeconds: event.elapsedSeconds,
          })),
        },
        TIMEOUT: {
          target: 'timed_out',
          actions: assign({
            isTimedOut: true,
          }),
        },
        EXIT: {
          target: 'idle',
        },
      },
    },

    // ---------- Active: Showing Feedback ----------
    showing_feedback: {
      on: {
        DISMISS_FEEDBACK: {
          target: 'presenting',
          actions: assign(({ event }: { event: AnyEvent }) => ({
            currentNodeId: event.nextNodeId,
          })),
        },
        TICK: {
          actions: assign(({ event }: { event: AnyEvent }) => ({
            elapsedSeconds: event.elapsedSeconds,
          })),
        },
        TIMEOUT: {
          target: 'timed_out',
          actions: assign({
            isTimedOut: true,
          }),
        },
      },
    },

    // ---------- Terminal: Success ----------
    success: {
      entry: assign(({ context }: { context: ScenarioMachineContext }) => ({
        score: context.score + 10, // Bonus for reaching success
      })),
      type: 'final',
    },

    // ---------- Terminal: Failure ----------
    failure: {
      type: 'final',
    },

    // ---------- Terminal: Timed Out ----------
    timed_out: {
      type: 'final',
    },

    // ---------- Terminal: Completed ----------
    completed: {
      type: 'final',
    },
  },

  on: {
    RESTART: {
      target: '.idle',
    },
  },
});

// ---------------------------------------------------------------------------
// Scenario Runner Helpers (called by UI components)
// ---------------------------------------------------------------------------

/**
 * Given a scenario node, determine how the UI should render it.
 */
export function getNodePresentation(
  node: ScenarioNode,
): {
  mode: 'prompt' | 'decision' | 'info' | 'success' | 'failure';
  content: string;
  hasChoices: boolean;
} {
  switch (node.node_type) {
    case 'prompt':
      return { mode: 'prompt', content: node.content_en, hasChoices: false };
    case 'decision':
      return { mode: 'decision', content: node.content_en, hasChoices: true };
    case 'info':
      return { mode: 'info', content: node.content_en, hasChoices: false };
    case 'outcome_success':
      return { mode: 'success', content: node.content_en, hasChoices: false };
    case 'outcome_failure':
      return { mode: 'failure', content: node.content_en, hasChoices: false };
  }
}

/**
 * Get the next state based on the node type after DISMISS_FEEDBACK.
 */
export function getNextStateForNode(
  currentNode: ScenarioNode,
): ScenarioState {
  switch (currentNode.node_type) {
    case 'outcome_success':
      return 'success';
    case 'outcome_failure':
      return 'failure';
    case 'prompt':
      return 'presenting';
    case 'decision':
      return 'awaiting_decision';
    case 'info':
      return 'presenting';
    default:
      return 'presenting';
  }
}

/**
 * Compute net score: correct decisions minus penalty seconds (floor).
 */
export function computeNetScore(
  correctCount: number,
  penaltySeconds: number,
): number {
  const penaltyReduction = Math.floor(penaltySeconds / 10); // -1 point per 10s penalty
  return Math.max(0, correctCount - penaltyReduction);
}

/**
 * Compute time-based grade for scenario performance.
 */
export function computeGrade(
  netScore: number,
  totalDecisions: number,
  timeUsedSeconds: number,
  timeLimitSeconds: number | null,
): { grade: 'A' | 'B' | 'C' | 'F'; percentage: number } {
  if (totalDecisions === 0) {
    return { grade: 'F', percentage: 0 };
  }

  const accuracyPercentage = (netScore / totalDecisions) * 100;

  let grade: 'A' | 'B' | 'C' | 'F';

  if (accuracyPercentage >= 90) {
    grade = 'A';
  } else if (accuracyPercentage >= 70) {
    grade = 'B';
  } else if (accuracyPercentage >= 50) {
    grade = 'C';
  } else {
    grade = 'F';
  }

  // Time bonus: if completed under 70% of time limit, bump grade
  if (
    timeLimitSeconds &&
    timeUsedSeconds < timeLimitSeconds * 0.7 &&
    grade !== 'A'
  ) {
    switch (grade) {
      case 'B':
        grade = 'A';
        break;
      case 'C':
        grade = 'B';
        break;
      case 'F':
        grade = 'C';
        break;
    }
  }

  return { grade, percentage: Math.round(accuracyPercentage) };
}

/**
 * Get appropriate feedback message based on transition.
 */
export function getFeedback(
  transition: ScenarioTransition,
  preferredLanguage: 'en' | 'th' = 'en',
): {
  message: string;
  isCorrect: boolean;
} {
  const message =
    preferredLanguage === 'th' && transition.feedback_th
      ? transition.feedback_th
      : transition.feedback_en ?? '';

  return {
    message: message || (transition.is_correct ? 'Correct!' : 'Not quite right.'),
    isCorrect: transition.is_correct,
  };
}