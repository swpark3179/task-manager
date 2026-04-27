import { expect, test, describe } from "bun:test";
import {
  getCompletionPercentage,
  computeParentStatus,
  getEffectiveStatus,
  hasIncompleteTasks,
} from "../taskUtils";
import type { Task, TaskStatus } from "../../types";

const createTask = (status: TaskStatus, children?: Task[]): Task => ({
  id: 'id',
  user_id: 'user-1',
  parent_id: null,
  title: `Task`,
  description: null,
  status,
  children,
  created_date: '2025-04-16',
  completed_at: null,
  discarded_at: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("getCompletionPercentage", () => {
  test("returns 100 for completed task with no children", () => {
    expect(getCompletionPercentage(createTask('completed'))).toBe(100);
  });

  test("returns 0 for non-completed task with no children", () => {
    expect(getCompletionPercentage(createTask('pending'))).toBe(0);
  });

  test("returns 100 if all children are discarded", () => {
    const task = createTask('pending', [createTask('discarded'), createTask('discarded')]);
    expect(getCompletionPercentage(task)).toBe(100);
  });

  test("calculates correctly with active children", () => {
    const task = createTask('pending', [
      createTask('completed'),
      createTask('pending'),
      createTask('completed'),
      createTask('in_progress'),
      createTask('discarded') // Should be ignored
    ]);
    // 2 completed out of 4 active = 50%
    expect(getCompletionPercentage(task)).toBe(50);
  });

  test("treats a child whose grandchildren are all completed as completed", () => {
    // Intermediate parent's stored status remains 'pending' (DB never updates
    // it), but every grandchild is completed → effective status is 'completed'.
    const intermediate = createTask('pending', [
      createTask('completed'),
      createTask('completed'),
    ]);
    const root = createTask('pending', [
      intermediate,
      createTask('pending'),
    ]);
    // 1 of 2 active children effectively completed = 50%
    expect(getCompletionPercentage(root)).toBe(50);
  });

  test("returns 100 for a 3-level tree where all leaves are completed", () => {
    const root = createTask('pending', [
      createTask('pending', [
        createTask('completed'),
        createTask('completed'),
      ]),
      createTask('pending', [
        createTask('completed'),
      ]),
    ]);
    expect(getCompletionPercentage(root)).toBe(100);
  });
});

describe("computeParentStatus (nested)", () => {
  test("returns 'completed' when all descendants are completed via nested parents", () => {
    const children = [
      createTask('pending', [createTask('completed'), createTask('completed')]),
      createTask('pending', [createTask('completed')]),
    ];
    expect(computeParentStatus(children)).toBe('completed');
  });

  test("returns 'in_progress' when at least one descendant is completed", () => {
    const children = [
      createTask('pending', [createTask('completed'), createTask('pending')]),
      createTask('pending'),
    ];
    expect(computeParentStatus(children)).toBe('in_progress');
  });

  test("returns 'pending' when no descendant has progressed", () => {
    const children = [
      createTask('pending', [createTask('pending'), createTask('pending')]),
      createTask('pending'),
    ];
    expect(computeParentStatus(children)).toBe('pending');
  });

  test("ignores children whose entire subtree is discarded", () => {
    const children = [
      createTask('pending', [createTask('discarded'), createTask('discarded')]),
      createTask('completed'),
    ];
    // First child effectively discarded (all its leaves are discarded → its
    // effective status is 'completed' actually per current rules, since an
    // empty/all-discarded subtree means there's nothing left to do).
    // The second child is completed → overall completed.
    expect(computeParentStatus(children)).toBe('completed');
  });
});

describe("getEffectiveStatus", () => {
  test("returns stored status for terminal states even with children", () => {
    const task = createTask('discarded', [createTask('pending')]);
    expect(getEffectiveStatus(task)).toBe('discarded');
  });

  test("derives parent status from grandchildren", () => {
    const task = createTask('pending', [
      createTask('pending', [createTask('completed'), createTask('completed')]),
    ]);
    expect(getEffectiveStatus(task)).toBe('completed');
  });
});

describe("hasIncompleteTasks", () => {
  test("returns false when all leaves are completed even if parent stored status is 'pending'", () => {
    const task = createTask('pending', [
      createTask('completed'),
      createTask('completed', [createTask('completed')]),
    ]);
    expect(hasIncompleteTasks(task)).toBe(false);
  });

  test("returns true when any deep descendant is still pending", () => {
    const task = createTask('pending', [
      createTask('completed'),
      createTask('pending', [createTask('pending')]),
    ]);
    expect(hasIncompleteTasks(task)).toBe(true);
  });

  test("treats a fully-discarded subtree as not-incomplete", () => {
    const task = createTask('pending', [
      createTask('discarded'),
      createTask('discarded'),
    ]);
    expect(hasIncompleteTasks(task)).toBe(false);
  });
});
