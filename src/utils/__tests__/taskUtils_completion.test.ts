import { expect, test, describe } from "bun:test";
import { getCompletionPercentage } from "../taskUtils";
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
});
