import { expect, test, describe } from "bun:test";
import { calculateStatusSummary, filterActiveTasks } from "../taskUtils";
import type { Task, TaskStatus } from "../../types";

const createTask = (id: string, status: TaskStatus): Task => ({
  id,
  user_id: 'user-1',
  parent_id: null,
  title: `Task ${id}`,
  description: null,
  status,
  created_date: '2025-04-16',
  completed_at: null,
  discarded_at: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("calculateStatusSummary", () => {
  test("should return zeroed summary for empty task array", () => {
    const summary = calculateStatusSummary([]);
    expect(summary).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      discarded: 0,
    });
  });

  test("should correctly count statuses", () => {
    const tasks: Task[] = [
      createTask('1', 'pending'),
      createTask('2', 'in_progress'),
      createTask('3', 'completed'),
      createTask('4', 'discarded'),
      createTask('5', 'pending'),
    ];

    const summary = calculateStatusSummary(tasks);
    expect(summary).toEqual({
      total: 5,
      completed: 1,
      inProgress: 1,
      pending: 2,
      discarded: 1,
    });
  });

  test("should handle tasks with only one status", () => {
    const tasks: Task[] = [
      createTask('1', 'completed'),
      createTask('2', 'completed'),
    ];

    const summary = calculateStatusSummary(tasks);
    expect(summary).toEqual({
      total: 2,
      completed: 2,
      inProgress: 0,
      pending: 0,
      discarded: 0,
    });
  });
});

describe("filterActiveTasks", () => {
  test("drops completed and discarded top-level tasks", () => {
    const tasks: Task[] = [
      createTask('1', 'pending'),
      createTask('2', 'in_progress'),
      createTask('3', 'completed'),
      createTask('4', 'discarded'),
    ];

    const active = filterActiveTasks(tasks);
    expect(active.map((t) => t.id)).toEqual(['1', '2']);
  });

  test("keeps a terminal-looking parent when it has active children", () => {
    const parent: Task = {
      ...createTask('p', 'pending'),
      children: [
        createTask('c1', 'completed'),
        createTask('c2', 'in_progress'),
      ],
    };

    const active = filterActiveTasks([parent]);
    expect(active).toHaveLength(1);
    // Only the still-active child survives under the retained parent.
    expect(active[0].children?.map((c) => c.id)).toEqual(['c2']);
  });

  test("drops a parent whose children are all finished", () => {
    const parent: Task = {
      ...createTask('p', 'pending'),
      children: [
        createTask('c1', 'completed'),
        createTask('c2', 'discarded'),
      ],
    };

    expect(filterActiveTasks([parent])).toHaveLength(0);
  });
});
