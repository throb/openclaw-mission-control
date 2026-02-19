function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isIdeasColumn(name: string): boolean {
  const key = normalize(name);
  return key === 'ideas' || key === 'backlog';
}

export function isTodoColumn(name: string): boolean {
  const key = normalize(name);
  return key === 'to do' || key === 'todo';
}

export function isDoneColumn(name: string): boolean {
  return normalize(name) === 'done';
}

export function displayColumnName(name: string): string {
  return isIdeasColumn(name) ? 'Ideas' : name;
}
