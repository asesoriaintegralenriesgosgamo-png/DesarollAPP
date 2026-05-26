// Detección de ciclos en dependencias Finish-to-Start (DAG).
// Cada tarea es un nodo; `task -> depends_on` es una arista.

export function buildDepMap(tasks) {
  const map = new Map();
  for (const t of tasks) {
    map.set(t.id, t.dependency_ids ?? []);
  }
  return map;
}

// ¿Agregar `task -> dependsOn` crearía un ciclo?
// Walk reverso: si desde `dependsOn` ya se puede alcanzar `task`, hay ciclo.
export function wouldCreateCycle(depMap, taskId, dependsOnTaskId) {
  if (taskId === dependsOnTaskId) return true;
  const visited = new Set();
  const stack = [dependsOnTaskId];
  while (stack.length) {
    const node = stack.pop();
    if (node === taskId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = depMap.get(node) || [];
    for (const n of next) stack.push(n);
  }
  return false;
}

export function detectCycle(depMap) {
  const color = new Map(); // 0 = unvisited, 1 = inStack, 2 = done
  function dfs(node) {
    if (color.get(node) === 1) return true;
    if (color.get(node) === 2) return false;
    color.set(node, 1);
    for (const next of depMap.get(node) || []) {
      if (dfs(next)) return true;
    }
    color.set(node, 2);
    return false;
  }
  for (const node of depMap.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}
