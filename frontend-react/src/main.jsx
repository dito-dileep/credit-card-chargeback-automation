import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import heroImage from './assets/chargeback-hero.png';
import './style.css';
import './tasklist.css';

const api = (url, options) => fetch(`/api${url}`, options).then(async response => {
  const body = await response.text();
  let result;
  let invalidJson = false;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    invalidJson = true;
    if (response.ok) throw Error('Server returned an invalid JSON response');
  }
  if (!response.ok) {
    throw Error(
      result?.error
      || (!invalidJson && body)
      || `Request failed (HTTP ${response.status})`
    );
  }
  return result;
});

export function App() {
  const [tab, setTab] = useState('Statement');
  const [transactions, setTransactions] = useState([]);
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState('FRAUD');
  const [message, setMessage] = useState('');

  const load = () => Promise.all([
    api('/transactions'),
    api('/disputes'),
    api('/tasklist')
  ]).then(([transactionRows, disputeCases, workflowTasks]) => {
    setTransactions(transactionRows);
    setCases(disputeCases);
    setTasks(workflowTasks);
  }).catch(error => setMessage(error.message));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async () => {
    const items = Object.keys(selected)
      .filter(id => selected[id])
      .map(transactionId => ({ transactionId, reason }));
    try {
      const disputeCase = await api('/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'customer-001', items })
      });
      setMessage(`Claim ${disputeCase.id.slice(0, 8)} submitted. Workflow ${
        disputeCase.workflowInstanceId || 'is disabled until Camunda is connected'
      }`);
      setSelected({});
      setTab('Tracking');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const respondToTask = async (task, accepted) => {
    try {
      await api(`/disputes/${task.caseId}/transactions/${task.id}/merchant-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted })
      });
      setMessage(`Merchant response recorded for ${task.merchant}.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const tabs = ['Statement', 'Tracking', 'Tasklist', 'Fraud desk'];

  return <main>
    <header>
      <div className="brand">
        <span className="brandmark">C</span>
        <div><small>CAPITAL ONE · DISPUTES</small><h1>Chargeback Center</h1></div>
      </div>
      <nav aria-label="Main navigation">
        {tabs.map(name => <button
          className={tab === name ? 'active' : ''}
          onClick={() => setTab(name)}
          key={name}
        >{name}</button>)}
      </nav>
    </header>

    {message && <p className="notice" role="status">{message}</p>}

    {tab === 'Statement' && <>
      <section className="hero" style={{
        backgroundImage: `linear-gradient(90deg,rgba(4,18,46,.98) 0%,rgba(7,31,75,.82) 46%,rgba(7,31,75,.08) 100%),url(${heroImage})`
      }}>
        <div className="hero-copy">
          <span className="eyebrow">SECURE SELF-SERVICE</span>
          <p>Account ending in <b>4821</b></p>
          <h2>Clear answers for every charge.</h2>
          <p className="subcopy">Select the transactions you don’t recognize and submit one secure dispute case. We’ll track every line, every decision, and every refund.</p>
          <div className="trust"><span>◈ Encrypted request</span><span>◷ Real-time tracking</span></div>
        </div>
        <button className="primary" disabled={!selectedCount} onClick={submit}>
          {selectedCount ? `Submit ${selectedCount} selected` : 'Select transactions'}
        </button>
      </section>
      <section className="section-head">
        <div><span className="eyebrow dark">YOUR ACTIVITY</span><h2>Recent transactions</h2></div>
        <label className="reason">Dispute reason
          <select value={reason} onChange={event => setReason(event.target.value)}>
            <option value="FRAUD">Fraud</option>
            <option value="MERCHANDISE_NOT_RECEIVED">Merchandise not received</option>
            <option value="DUPLICATE">Duplicate charge</option>
          </select>
        </label>
      </section>
      <section className="table-card">
        <div className="table-note">Choose each transaction that needs review. Submit selected lines as one claim.</div>
        <table>
          <thead><tr><th></th><th>Transaction</th><th>Date</th><th>Amount</th><th>Card status</th></tr></thead>
          <tbody>{transactions.map(transaction => <tr key={transaction.id}>
            <td><input
              aria-label={`Select ${transaction.merchant}`}
              type="checkbox"
              disabled={transaction.disputed}
              checked={!!selected[transaction.id]}
              onChange={event => setSelected({
                ...selected,
                [transaction.id]: event.target.checked
              })}
            /></td>
            <td><strong>{transaction.merchant}</strong>
              <small>{transaction.id}{transaction.disputed ? ' · already disputed' : ''}</small>
            </td>
            <td>{transaction.date}</td>
            <td className="amount">₹{Number(transaction.amount).toLocaleString('en-IN')}</td>
            <td><span className="pill">{transaction.status}</span></td>
          </tr>)}</tbody>
        </table>
      </section>
    </>}

    {tab === 'Tracking' && <Tracking cases={cases} />}
    {tab === 'Tasklist' && <Tasklist tasks={tasks} onRespond={respondToTask} />}
    {tab === 'Fraud desk' && <Fraud cases={cases} />}
    <footer>Protected demo environment · Multi-Transaction Chargeback Automation</footer>
  </main>;
}

function Tracking({ cases }) {
  return <section>
    <h2>Dispute tracking</h2>
    {!cases.length
      ? <div className="empty">No dispute claims yet. Select transactions from your statement.</div>
      : cases.map(disputeCase => <article className="case" key={disputeCase.id}>
        <div><strong>Claim {disputeCase.id.slice(0, 8)}</strong>
          <small>{new Date(disputeCase.createdAt).toLocaleString()}</small>
        </div>
        <span className="pill">{disputeCase.status}</span>
        <ul>{disputeCase.items.map(item => <li key={item.id}>
          <b>{item.merchant}</b> — ₹{item.amount}
          <span className={`status ${item.decision}`}>{item.decision}</span>
          {' · refund: '}{item.refundStatus}
          {' · merchant: '}{item.merchantResponse || 'AWAITING'}
          {item.fraudAlertStatus !== 'NOT_REQUIRED'
            ? ` · fraud alert: ${item.fraudAlertStatus}`
            : ''}
        </li>)}</ul>
      </article>)}
  </section>;
}

function Tasklist({ tasks, onRespond }) {
  return <section>
    <h2>Tasklist · merchant responses</h2>
    <p>Correlate a merchant decision with the matching transaction while its response window is open.</p>
    {!tasks.length
      ? <div className="empty">No merchant responses are waiting. Start a workflow with Camunda enabled.</div>
      : tasks.map(task => <article className="case" key={task.id}>
        <div><strong>{task.merchant}</strong>
          <small>Transaction {task.transactionId} · case {task.caseId.slice(0, 8)}</small>
        </div>
        <span className="pill">AWAITING RESPONSE</span>
        <p>Disputed amount: ₹{Number(task.amount).toLocaleString('en-IN')}</p>
        <div className="task-actions">
          <button onClick={() => onRespond(task, true)}>Accept dispute</button>
          <button onClick={() => onRespond(task, false)}>Contest dispute</button>
        </div>
      </article>)}
  </section>;
}

function Fraud({ cases }) {
  const alerts = cases.flatMap(disputeCase => disputeCase.items)
    .filter(item => Number(item.amount) >= 4000);
  return <section>
    <h2>High-value fraud monitoring</h2>
    <p>Items at or above ₹4,000 are routed through the REST connector to the fraud-desk API and optional Slack webhook.</p>
    {alerts.length
      ? <table><tbody>{alerts.map(item => <tr key={item.id}>
        <td>{item.merchant}</td>
        <td>₹{item.amount}</td>
        <td><span className="pill">{item.fraudAlertStatus}</span></td>
      </tr>)}</tbody></table>
      : <div className="empty">No high-value alerts yet.</div>}
  </section>;
}

export const root = createRoot(document.getElementById('root'));
root.render(<App />);
