import { useEffect, useRef, useState } from 'react';
import { OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import type { Project } from '../dashboard/data';
import { DashboardDownload, useDashboardRequest } from '../../auth/DashboardSession';

type Row = { line: number } & ({ error: string } | { skipped: true } | { title: string; status: string; project?: string });
type Job = { id: string; fileName: string | null; projectName: string; taskCount: number; failedCount: number; skippedCount: number; createdAt: string };
type History = { items: Job[]; nextCursor: string | null };
type Upload = { name: string; requestId: string } & ({ csv: string } | { headers: string[]; rows: string[][] });

const steps = ['Upload', 'Column mapping', 'Validation', 'Preview', 'Import'];
const columns = [
  { key: 'title', label: 'Task Title', aliases: ['title', 'task title', 'task name'], required: true },
  { key: 'project', label: 'Project', aliases: ['project', 'project name', 'project id'], required: true },
  { key: 'description', label: 'Description', aliases: ['description'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'priority', label: 'Priority', aliases: ['priority'] },
  { key: 'due_date', label: 'Due date', aliases: ['due date', 'deadline'] },
  { key: 'assignee_email', label: 'Assignee email', aliases: ['assignee email', 'email'] },
];
const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ');
const asCellText = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

function importTime(value: string) {
  const date = new Date(value);
  return `${date.toDateString() === new Date().toDateString() ? 'Today' : day.format(date)}, ${time.format(date)}`;
}

function RowPreview({ rows }: { rows: Row[] }) {
  return <div className="operations-table-scroll"><table className="operations-table import-preview-table">
    <thead><tr><th scope="col">Row</th><th scope="col">Task or validation result</th><th scope="col">Project</th><th scope="col">Status</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.line}><td>{row.line}</td><td>{'error' in row ? row.error : 'skipped' in row ? 'Empty row' : row.title}</td>
      <td>{'project' in row ? row.project : '—'}</td><td>{'error' in row ? 'Invalid' : 'skipped' in row ? 'Skipped' : row.status}</td></tr>)}</tbody>
  </table></div>;
}

export function ImportTasks({ projects, onComplete }: { projects: Project[]; onComplete: () => Promise<void> }) {
  const dashboardRequest = useDashboardRequest();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [upload, setUpload] = useState<Upload>();
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState<Row[]>();
  const [job, setJob] = useState<Job>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const retry = new URLSearchParams(window.location.search).get('retry');
  const valid = rows?.filter(row => 'title' in row).length ?? 0;
  const failed = rows?.filter(row => 'error' in row).length ?? 0;
  const skipped = rows?.filter(row => 'skipped' in row).length ?? 0;
  const isCsv = upload && 'csv' in upload;
  const allowed = ['title', 'project'].every(key => (mapping[key] ?? -1) >= 0);
  const unique = Object.values(mapping).filter(index => index >= 0);
  const mappingValid = isCsv ? Boolean(projectId) : allowed && new Set(unique).size === unique.length;

  async function selectFile(file?: File) {
    if (!file || busy) return;
    setError('');
    setRows(undefined);
    setJob(undefined);
    setUpload(undefined);
    setBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      if (!file.size || !(isCsv ? file.size <= 32768 : /\.xlsx$/i.test(file.name) && file.size <= 10 * 1024 * 1024)) {
        throw Error('Choose an Excel workbook up to 10 MB or a CSV up to 32 KiB.');
      }
      const requestId = crypto.randomUUID();
      if (isCsv) {
        const csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        setUpload({ name: file.name, requestId, csv });
      } else {
        const { readSheet } = await import('read-excel-file/browser');
        let sheet;
        try { sheet = await readSheet(file, 1); }
        catch { throw Error('The first worksheet could not be read. Check the workbook and try again.'); }
        if (sheet.length < 2 || sheet.length > 101) throw Error('Include a header and 1 to 100 rows in the first worksheet.');
        const [header, ...data] = sheet;
        const headers = header.map(asCellText);
        setMapping(Object.fromEntries(columns.map(({ key, aliases }) => [key,
          headers.findIndex(value => aliases.includes(normalizeHeader(value)))])));
        setUpload({ name: file.name, requestId, headers, rows: data.map(row => row.map(asCellText)) });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The file could not be read.');
    } finally { setBusy(false); }
  }

  function payload() {
    if (!upload) return undefined;
    const base = { requestId: upload.requestId, fileName: upload.name };
    if ('csv' in upload) return { ...base, projectId, csv: upload.csv };
    return { ...base, rows: upload.rows.map(row => Object.fromEntries(columns.filter(({ key }) => mapping[key] >= 0)
      .map(({ key }) => [key, row[mapping[key]] ?? '']))) };
  }

  async function run(mode: 'preview' | 'import') {
    if (!upload || busy) return;
    setError('');
    setBusy(true);
    try {
      const options = { method: 'POST', body: JSON.stringify({ ...payload(), allowPartial: !isCsv && failed > 0 }) };
      if (mode === 'preview') {
        const preview = await dashboardRequest<{ rows: Row[] }>('/imports/preview', options);
        setRows(preview.rows);
        setStep(2);
      } else {
        const completed = await dashboardRequest<Job>('/imports', options);
        setJob(completed);
        setStep(4);
        try { await onComplete(); }
        catch { setError('The import was saved. Reload the page to refresh your tasks.'); }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The import request failed.');
    } finally { setBusy(false); }
  }

  function invalidatePreview() {
    setRows(undefined);
    setUpload(current => current && { ...current, requestId: crypto.randomUUID() });
  }

  return <div className="operations-page import-wizard">
    <OperationsHeading section="Productivity" title="Import tasks from Excel"
      description="Bring structured work into Flowdeck with validation before anything is created.">
      <a className="button button--secondary" href={`${import.meta.env.BASE_URL}task-import-template.xlsx`} download><Icon name="download" />Sample template</a>
    </OperationsHeading>
    {retry && <p className="import-retry-note">Upload a corrected workbook containing only the failed rows. <DashboardDownload
      path={`/imports/${encodeURIComponent(retry)}/report`} filename="import-errors.csv">Download the previous error report</DashboardDownload>.</p>}
    <ol className="import-steps">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>
      <span className={step >= index ? 'import-step-active' : ''}>{step > index ? <Icon name="check" /> : index + 1}</span>
      <div><small>Step {index + 1}</small><strong>{label}</strong></div>
    </li>)}</ol>
    <section className="operations-card" aria-label={steps[step]} aria-busy={busy}>
      {step === 0 ? <div className="import-upload">
        <div className={`import-drop-zone ${dragging ? 'import-drop-zone--active' : ''}`}
          onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]); }}>
          <Icon name="upload" />
          <strong>{upload?.name ?? 'Drop your Excel workbook here'}</strong>
          <span>{upload ? 'File selected' : 'or click to browse · .xlsx files up to 10 MB'}</span>
          <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectFile(file);
          }} />
          <button className="button button--secondary" type="button" disabled={busy} onClick={() => input.current?.click()}>
            {upload ? 'Replace file' : 'Select file'}
          </button>
        </div>
        <aside className="import-tips">
          <h2>Before you upload</h2>
          <ul>{['Keep column headers in the first row', 'Task Title and Project are required', 'Use Flowdeck status names for best results'].map(tip =>
            <li key={tip}><Icon name="check" />{tip}</li>)}</ul>
        </aside>
      </div> : <div className="import-step-content">
        {step === 1 && upload && <>
          <h2>Map workbook columns</h2>
          {'csv' in upload ? <label className="operations-filter">Project <select value={projectId} onChange={(event) => {
            setProjectId(event.target.value); invalidatePreview();
          }}><option value="">Select a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> :
            <div className="import-mappings">{columns.map(({ key, label, required }) => <label key={key}>
              {label}{required && ' *'}<select value={mapping[key]} onChange={(event) => {
                setMapping(current => ({ ...current, [key]: Number(event.target.value) })); invalidatePreview();
              }}>
                <option value={-1}>Choose a column</option>
                {upload.headers.map((header, index) => <option value={index} key={index}>{header || `Column ${index + 1}`}</option>)}
              </select>
            </label>)}</div>}
        </>}
        {(step === 2 || step === 3) && rows && <>
          <h2>{step === 2 ? 'Validation results' : 'Import preview'}</h2>
          <p>{valid} ready · {failed} invalid · {skipped} skipped</p>
          {step === 3 && failed > 0 && <p>Only valid rows will be imported. Invalid rows will appear in the error report.</p>}
          <RowPreview rows={step === 3 ? rows.filter(row => 'title' in row) : rows} />
        </>}
        {step === 4 && job && <>
          <h2>Import complete</h2><p role="status">{job.taskCount} imported · {job.failedCount} failed · {job.skippedCount} skipped</p>
          {job.failedCount > 0 && <DashboardDownload className="button button--secondary" path={`/imports/${job.id}/report`} filename="import-errors.csv"><Icon name="download" />Error report</DashboardDownload>}
        </>}
      </div>}
      {!projects.length && <p className="import-notice" role="status">Create a project before importing tasks.</p>}
      {busy && <p className="import-notice" role="status">Processing file…</p>}
      {error && <p className="import-notice field-error" role="alert">{error}</p>}
      <footer className="import-footer">
        {step > 0 && step < 4 && <button className="button button--secondary" type="button" disabled={busy} onClick={() => {
          setError(''); setStep(step - 1);
        }}>Back</button>}
        {step < 4 ? <button className="button button--primary" type="button"
          disabled={busy || !projects.length || (step === 0 && !upload) || (step === 1 && !mappingValid) ||
            (step >= 2 && (!valid || Boolean(isCsv && failed)))}
          onClick={() => step === 1 ? void run('preview') : step === 3 ? void run('import') : setStep(step + 1)}>
          {step === 3 ? `Import ${valid} ${valid === 1 ? 'task' : 'tasks'}` : 'Continue'}<Icon name="arrow" />
        </button> : <a className="button button--primary" href="/imports/history">View import history</a>}
      </footer>
    </section>
  </div>;
}

export function ImportHistory() {
  const dashboardRequest = useDashboardRequest();
  const [history, setHistory] = useState<History>();
  const [cursor, setCursor] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const path = cursor ? `/imports?cursor=${cursor}` : '/imports';
    dashboardRequest<History>(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setHistory(previous => ({ ...result,
        items: [...(cursor ? previous?.items ?? [] : []), ...result.items] }));
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [cursor, attempt]);

  return <div className="operations-page">
    <OperationsHeading section="Productivity" title="Import history" description="Review previous task uploads, outcomes, and error reports.">
      <a className="button button--primary" href="/imports/new"><Icon name="sheet" />New import</a>
    </OperationsHeading>
    <section className="operations-card" aria-label="Task import history">
      <div className="operations-table-scroll"><table className="operations-table import-history-table">
        <thead><tr>{['File', 'Uploaded', 'Status', 'Imported', 'Failed', 'Skipped'].map(label => <th key={label} scope="col">{label}</th>)}
          <th scope="col"><span className="sr-only">Import actions</span></th></tr></thead>
        <tbody>{history?.items.map(item => <tr key={item.id}>
          <td><div className="operations-person"><span className="operations-tile operation-tone--green"><Icon name="sheet" /></span>
            <strong>{item.fileName ?? item.projectName}</strong></div></td>
          <td><time dateTime={item.createdAt}>{importTime(item.createdAt)}</time></td>
          <td><span className={`operations-pill ${item.failedCount ? 'operation-pill--warning' : 'operation-pill--success'}`}>
            {item.failedCount ? 'Completed with errors' : 'Completed'}</span></td>
          <td>{item.taskCount}</td><td>{item.failedCount}</td><td>{item.skippedCount}</td>
          <td><div className="import-history-actions">
            <DashboardDownload className="icon-button" path={`/imports/${item.id}/report`} filename="import-errors.csv" title="Download error report" aria-label={`Download error report for ${item.fileName ?? item.projectName}`}><Icon name="download" /></DashboardDownload>
            <a className="icon-button" href={item.failedCount ? `/imports/new?retry=${item.id}` : '/imports/new'}
              title={item.failedCount ? 'Retry failed rows' : 'Start a new import'} aria-label={item.failedCount ? 'Retry failed rows' : 'Start a new import'}><Icon name="history" /></a>
          </div></td>
        </tr>)}</tbody>
      </table></div>
      {error && <div className="operation-empty"><p role="alert">{error}</p><button className="button button--secondary" type="button"
        onClick={() => { setLoading(true); setError(''); setAttempt(attempt + 1); }}>Retry</button></div>}
      {loading && <p className="operation-empty" role="status">Loading import history…</p>}
      {!loading && history?.items.length === 0 && <p className="operation-empty">No completed imports yet.</p>}
      {history?.nextCursor && !error && <button className="panel-footer-button" type="button" disabled={loading} onClick={() => {
        setLoading(true); setCursor(history.nextCursor ?? undefined);
      }}>Load older imports</button>}
    </section>
  </div>;
}
