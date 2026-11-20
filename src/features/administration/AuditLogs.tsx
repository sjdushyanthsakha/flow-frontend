import { useEffect, useState } from 'react';
import { OperationsDialog, OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import { dateKey, initials } from '../dashboard/data';
import { useDashboardRequest } from '../../auth/DashboardSession';

type Event = { id: string; action: string; module: string; record: string; actor: string | null; fields: string[]; createdAt: string };
type Audit = { items: Event[]; nextCursor: string | null; timezone: string };
const modules = ['Task', 'User', 'Organization', 'Roles', 'Import'];

type ChangeValues = Record<string, string | number | boolean | null>;
type AuditDetail = { source: string; previousValues: ChangeValues | null; updatedValues: ChangeValues | null };

function AuditValueCard({ label, values, fields }: { label: string; values: ChangeValues | null; fields: string[] }) {
  return <div className="audit-value-card">
    <h4>{label}</h4>
    {values ? <dl>{fields.filter(field => Object.hasOwn(values, field)).map(field => (
      <div key={field}><dt>{field}</dt><dd>{values[field] === null ? 'None' : String(values[field])}</dd></div>
    ))}</dl> : <p>No value recorded</p>}
  </div>;
}

function AuditDetailPanel({ event, displayTime, timezone, onClose }: {
  event: Event; displayTime: string; timezone?: string; onClose: () => void;
}) {
  const dashboardRequest = useDashboardRequest();
  const [detail, setDetail] = useState<AuditDetail>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<AuditDetail>(`/administration/audit/${event.id}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [event.id, attempt]);

  const fullTimestamp = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long', timeZone: timezone })
    .format(new Date(event.createdAt));
  const fields = [...new Set([
    ...event.fields, ...Object.keys(detail?.previousValues ?? {}), ...Object.keys(detail?.updatedValues ?? {}),
  ])];

  return <OperationsDialog title={`${event.action} ${event.module}`} eyebrow="Activity detail" variant="drawer" onClose={onClose}>
    <div className="audit-affected-record">
      <Icon name="audit" /><div><span>Affected record</span><strong>{event.record}</strong></div>
    </div>
    <dl className="audit-detail-metadata">
      <div><dt>Performed by</dt><dd>{event.actor ?? 'System'}</dd></div>
      <div><dt>Timestamp</dt><dd><time dateTime={event.createdAt} title={fullTimestamp} aria-label={fullTimestamp}>{displayTime}</time></dd></div>
      {detail && <div><dt>Source</dt><dd>{detail.source}</dd></div>}
    </dl>
    <section className="audit-change-details" aria-busy={!detail && !error}>
      <h3>Change details</h3>
      {error ? <>
        <p className="field-error" role="alert">{error}</p>
        <button type="button" className="button button--secondary" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Retry</button>
      </> : !detail ? <p className="operation-muted" role="status">Loading change details…</p> :
        detail.previousValues || detail.updatedValues ? <div className="audit-value-pair">
          <AuditValueCard label="Previous value" values={detail.previousValues} fields={fields} />
          <Icon className="audit-detail-arrow" name="arrow" />
          <AuditValueCard label="Updated value" values={detail.updatedValues} fields={fields} />
        </div> : <>
          {fields.length > 0 && <p className="operation-muted">Changed fields include {fields.join(', ')}.</p>}
          <p className="operation-muted">No change values were recorded for this event.</p>
        </>}
    </section>
    <p className="audit-detail-note">Audit records are read-only.</p>
  </OperationsDialog>;
}

export function AuditLogs({ workspaceSearch }: { workspaceSearch: string }) {
  const dashboardRequest = useDashboardRequest();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Audit>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Event>();
  const [attempt, setAttempt] = useState(0);
  const query = new URLSearchParams({ search: search.trim() || workspaceSearch.trim(), module, from, to }).toString();
  const path = `/administration/audit?${query}`;

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    const timeout = setTimeout(() => {
      dashboardRequest<Audit>(path, { signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setData(result);
      }).catch((failure: Error) => {
        if (!controller.signal.aborted) { setData(undefined); setError(failure.message); }
      }).finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    }, 120);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [path, attempt]);

  function timestamp(value: string) {
    const timeZone = data?.timezone;
    const time = new Date(value);
    const date = dateKey(time, timeZone);
    const now = new Date();
    const recent = date === dateKey(now, timeZone) ? 'Today' :
      date === dateKey(new Date(now.getTime() - 86400000), timeZone) ? 'Yesterday' :
        new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone }).format(time);
    return `${recent}, ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(time)}`;
  }

  return <div className="operations-page">
    <OperationsHeading section="Administration" title="Audit logs" description="A traceable record of important workspace actions and data changes." />
    <section className="operations-card" aria-label="Audit records">
      <div className="operations-toolbar">
        <label className="operations-search"><Icon name="search" /><input type="search" aria-label="Search actions or records"
          placeholder="Search actions or records…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="operations-actions">
          <select aria-label="Module" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="">All</option>{modules.map(item => <option key={item}>{item}</option>)}
          </select>
          <input type="date" aria-label="From date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input type="date" aria-label="To date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>
      <div className="operations-table-scroll"><table className="operations-table audit-table">
        <thead><tr>{['Actor', 'Action', 'Module', 'Affected record', 'Timestamp'].map(title => <th key={title} scope="col">{title}</th>)}
          <th scope="col"><span className="sr-only">Details</span></th></tr></thead>
        <tbody>{data?.items.map((item) => <tr key={item.id} onClick={(event) => {
          event.currentTarget.querySelector('button')?.focus({ preventScroll: true });
          setViewing(item);
        }}>
          <td><div className="operations-person"><span className="operations-avatar" aria-hidden="true">{initials(item.actor ?? 'System')}</span>{item.actor ?? 'System'}</div></td>
          <td><span className="operations-pill">{item.action}</span></td><td>{item.module}</td><td><strong>{item.record}</strong></td>
          <td><time className="operation-muted audit-timestamp" dateTime={item.createdAt}><Icon name="clock" />{timestamp(item.createdAt)}</time></td>
          <td><button type="button" className="icon-button audit-open" aria-label={`View ${item.action.toLowerCase()} event for ${item.record}`}
            aria-haspopup="dialog"><Icon name="arrow" /></button></td>
        </tr>)}</tbody>
      </table></div>
      {error && <div className="operation-empty"><p role="alert">{error}</p>
        <button className="button button--secondary" type="button" onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
      {busy && <p className="operation-empty" role="status">Loading audit records…</p>}
      {!busy && data?.items.length === 0 && <p className="operation-empty">No audit records match.</p>}
      {data?.nextCursor && !busy && <button className="panel-footer-button" type="button" onClick={async () => {
        const anchor = data.nextCursor;
        setBusy(true);
        setError('');
        try {
          const next = await dashboardRequest<Audit>(`${path}&cursor=${anchor}`);
          setData(current => current?.nextCursor === anchor ? { ...next, items: [...current.items, ...next.items] } : current);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load audit records.'); }
        finally { setBusy(false); }
      }}>Load more</button>}
    </section>
    {viewing && <AuditDetailPanel key={viewing.id} event={viewing}
      displayTime={timestamp(viewing.createdAt)} timezone={data?.timezone} onClose={() => setViewing(undefined)} />}
  </div>;
}
