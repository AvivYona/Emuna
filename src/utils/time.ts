export function formatTime(date: Date): string {
  return date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function fromTimeString(value?: string | null): Date {
  const date = new Date();
  if (!value) {
    date.setHours(9, 0, 0, 0);
    return date;
  }
  const [hours, minutes] = value.split(':');
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
}
