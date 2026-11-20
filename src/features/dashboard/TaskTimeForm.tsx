import { useState, type FormEvent } from 'react';
import { Icon } from '../../lib/icons';
import { useDashboardRequest } from '../../auth/DashboardSession';

export function TaskTimeForm({ taskId, onLogged, drawer = false }: { taskId: string; onLogged: () => void; drawer?: boolean }) {
  const dashboardRequest = useDashboardRequest();
  const [minutes, setMinutes] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !minutes) return;
    setBusy(true);
    setError('');
    setConfirmation('');
    try {
      const entry = await dashboardRequest<{ minutes: number }>(`/tasks/${taskId}/time-entries`, {
        method: 'POST', body: JSON.stringify({ minutes: Number(minutes), requestId }),
      });
      setConfirmation(`${entry.minutes} ${entry.minutes === 1 ? 'minute' : 'minutes'} logged.`);
      setMinutes('');
      setRequestId(crypto.randomUUID());
      onLogged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not log time.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={drawer ? "task-time drawer-time" : "task-time"}>
      <summary className={drawer ? "button button--secondary" : undefined}>{drawer && <Icon name="clock" />}Log time</summary>
      <form onSubmit={(event) => void submit(event)}>
        <label>Minutes worked<input type="number" min={1} max={1440} step={1} value={minutes} required disabled={busy}
          onChange={(event) => {
            setMinutes(event.target.value);
            setRequestId(crypto.randomUUID());
            setConfirmation('');
          }} /></label>
        <button className="button button--secondary" type="submit" disabled={busy || !minutes}>Save time</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {confirmation && <p role="status">{confirmation}</p>}
    </details>
  );
}
