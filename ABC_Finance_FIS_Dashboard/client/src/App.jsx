import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = '/api';
const emptyForm = { company: 'ABC Finance', year: 2026, quarter: 'Annual', currency: 'M', cash: 80000, receivables: 40000, inventory: 30000, equipment: 150000, payables: 35000, shortDebt: 15000, longDebt: 100000, equity: 150000, notes: '' };
const fmt = (n, currency = 'M') => `${currency}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const num = n => Number(n || 0);
const calc = r => {
  const currentAssets = num(r.cash) + num(r.receivables) + num(r.inventory);
  const totalAssets = currentAssets + num(r.equipment);
  const currentLiabilities = num(r.payables) + num(r.shortDebt);
  const totalLiabilities = currentLiabilities + num(r.longDebt);
  const equity = num(r.equity);
  return { currentAssets, totalAssets, currentLiabilities, totalLiabilities, equity,
    workingCapital: currentAssets - currentLiabilities,
    currentRatio: currentLiabilities ? currentAssets / currentLiabilities : 0,
    quickRatio: currentLiabilities ? (currentAssets - num(r.inventory)) / currentLiabilities : 0,
    debtAsset: totalAssets ? totalLiabilities / totalAssets * 100 : 0,
    debtEquity: equity ? totalLiabilities / equity * 100 : 0,
    equityRatio: totalAssets ? equity / totalAssets * 100 : 0,
    totalLiabilitiesEquity: totalLiabilities + equity };
};

function App() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState('Balance Sheet');
  const [year, setYear] = useState('All');
  const [quarter, setQuarter] = useState('All');
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dbStatus, setDbStatus] = useState('Checking connection');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mobileNav, setMobileNav] = useState(false);

  async function loadRecords() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams();
      if (year !== 'All') params.set('year', year);
      if (quarter !== 'All') params.set('quarter', quarter);
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`${API}/records?${params.toString()}`);
      if (!response.ok) throw new Error('Could not load financial records from the API.');
      const data = await response.json();
      setRecords(data);
      setDbStatus('API connected');
      if (!selectedId && data.length) setSelectedId(data[0]._id);
      else if (selectedId && !data.some(r => r._id === selectedId) && data.length) setSelectedId(data[0]._id);
      if (!data.length) setSelectedId('');
    } catch {
      setDbStatus('API unavailable');
      setError('Cannot reach the API. Start MongoDB and run `npm run dev` from the project root.');
    } finally { setBusy(false); }
  }

  useEffect(() => { loadRecords(); }, [year, quarter, search]);
  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(d => setDbStatus(d.state === 1 ? `MongoDB: ${d.database}` : 'MongoDB disconnected'))
      .catch(() => setDbStatus('API unavailable'));
  }, []);

  const selected = records.find(r => r._id === selectedId) || records[0] || null;
  const stats = useMemo(() => selected ? calc(selected) : calc(emptyForm), [selected]);
  const chartData = selected ? [
    { name: 'Assets', amount: stats.totalAssets },
    { name: 'Liabilities', amount: stats.totalLiabilities },
    { name: 'Equity', amount: stats.equity }
  ] : [];
  const years = [...new Set(records.map(r => r.year))].sort((a,b) => b-a);

  function beginCreate() {
    setForm({ ...emptyForm, year: Number(year === 'All' ? 2026 : year), quarter: quarter === 'All' ? 'Annual' : quarter });
    setShowForm(true);
  }
  function beginEdit() {
    if (!selected) return;
    const { _id, __v, createdAt, updatedAt, ...data } = selected;
    setForm({ ...emptyForm, ...data, _id: selected._id, _edit: true });
    setShowForm(true);
  }
  async function saveRecord(e) {
    e.preventDefault(); setError(''); setNotice('');
    try {
      const payload = { ...form };
      delete payload._id; delete payload._edit;
      const targetId = form._id || null;
      const response = await fetch(targetId ? `${API}/records/${targetId}` : `${API}/records`, {
        method: targetId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save record.');
      setShowForm(false); setSelectedId(data._id); setNotice(targetId ? 'Financial record updated successfully.' : 'Financial record added successfully.');
      await loadRecords();
    } catch (err) { setError(err.message); }
  }
  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.company} (${selected.year} ${selected.quarter})? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API}/records/${selected._id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Delete failed.');
      setNotice('Record deleted.'); setSelectedId(''); await loadRecords();
    } catch (err) { setError(err.message); }
  }
  function exportCSV() {
    const rows = [['Company','Year','Quarter','Cash','Receivables','Inventory','Equipment','Accounts Payable','Short-term Debt','Long-term Debt','Equity','Total Assets','Total Liabilities','Current Ratio','Quick Ratio','Working Capital','Debt to Assets %','Debt to Equity %']];
    records.forEach(r => {
      const s = calc(r);
      rows.push([r.company,r.year,r.quarter,r.cash,r.receivables,r.inventory,r.equipment,r.payables,r.shortDebt,r.longDebt,r.equity,s.totalAssets,s.totalLiabilities,s.currentRatio.toFixed(2),s.quickRatio.toFixed(2),s.workingCapital,s.debtAsset.toFixed(2),s.debtEquity.toFixed(2)]);
    });
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ABC_Finance_FIS_Report.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const nav = [
    { label: 'Home', icon: 'bi-house-door' },
    { label: 'Analytics', icon: 'bi-grid-1x2', child: 'Balance Sheet' },
    { label: 'Pages', icon: 'bi-journal-bookmark', child: 'Ratio Analysis' },
    { label: 'Services', icon: 'bi-wrench-adjustable', child: 'Records' },
    { label: 'Blog', icon: 'bi-rss' },
    { label: 'FAQs', icon: 'bi-patch-question' },
    { label: 'Contact Us', icon: 'bi-question-circle' }
  ];
  const pageFor = label => label === 'Home' ? 'Dashboard' : label === 'Analytics' ? 'Balance Sheet' : label === 'Pages' ? 'Ratio Analysis' : label === 'Services' ? 'Records' : label;

  return <div className={`app-shell ${dark ? 'dark-mode' : ''}`}>
    <header className="topbar">
      <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><i className="bi bi-list" /></button>
      <div className="brand"><i className="bi bi-graph-up-arrow" /><span>ABC Finance</span></div>
      <div className="top-search"><i className="bi bi-search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company..." /></div>
      <button className="top-icon" title="Location / business context" onClick={() => setPage('About')}><i className="bi bi-geo-alt" /></button>
      <button className="top-icon" title="Notifications" onClick={() => setNotice('You are viewing sample academic financial data.')}><i className="bi bi-bell" /></button>
      <button className="top-icon" title="Help" onClick={() => setPage('About')}><i className="bi bi-question-circle" /></button>
      <button className="user-avatar" title="Project profile" onClick={() => setPage('About')}>AF</button>
    </header>

    <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
      <div className="sidebar-label">MENU</div>
      {nav.map(item => <div key={item.label}>
        <button className={`nav-item ${page === pageFor(item.label) || (item.child && page === item.child) ? 'selected' : ''}`}
          onClick={() => { setPage(pageFor(item.label)); setMobileNav(false); }}>
          <i className={`bi ${item.icon}`} /><span>{item.label}</span>{item.child && <i className="bi bi-chevron-right nav-chevron" />}
        </button>
        {item.label === 'Analytics' && <button className={`nav-child ${page === 'Balance Sheet' ? 'child-active' : ''}`} onClick={() => {setPage('Balance Sheet');setMobileNav(false);}}>Balance Sheet</button>}
        {item.label === 'Pages' && <button className={`nav-child ${page === 'Ratio Analysis' ? 'child-active' : ''}`} onClick={() => {setPage('Ratio Analysis');setMobileNav(false);}}>Ratio Analysis</button>}
      </div>)}
      <div className="sidebar-bottom"><div className="db-card"><i className="bi bi-database-check" /><strong>Database status</strong><span className={dbStatus.includes('MongoDB:') ? 'db-online' : 'db-offline'}>{dbStatus}</span><small>MongoDB · Express · React</small></div><div className="side-foot">FIS MODULE PROJECT<br/>ABC Finance · 2026</div></div>
    </aside>
    {mobileNav && <button className="backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <main className="main-content">
      <div className="breadcrumb"><span>Analytics</span><i className="bi bi-chevron-right" /><strong>{page}</strong></div>
      <div className="title-bar"><div><h1>{page === 'Dashboard' ? 'Financial Overview' : page === 'About' ? 'Project Information' : page === 'Blog' ? 'Blog' : page === 'FAQs' ? 'Frequently Asked Questions' : page === 'Contact Us' ? 'Contact Us' : `${page} Dashboard`}</h1><p>Financial Information Systems · ABC Finance · Sample data for academic use</p></div>
        <div className="title-actions"><button className="btn btn-outline-secondary btn-sm" onClick={() => setDark(!dark)}><i className={`bi ${dark ? 'bi-sun' : 'bi-moon-stars'} me-2`} />Theme</button><button className="btn btn-outline-secondary btn-sm" onClick={exportCSV}><i className="bi bi-download me-2" />Export CSV</button><button className="btn btn-primary btn-sm" onClick={beginCreate}><i className="bi bi-plus-lg me-2" />Add record</button></div>
      </div>

      {error && <div className="alert alert-warning alert-dismissible">{error}<button className="btn-close" onClick={() => setError('')} /></div>}
      {notice && <div className="alert alert-success alert-dismissible">{notice}<button className="btn-close" onClick={() => setNotice('')} /></div>}

      {page === 'Blog' ? <BlogPage dbStatus={dbStatus} count={records.length}/> : page === 'FAQs' ? <FaqPage/> : page === 'Contact Us' ? <ContactPage dbStatus={dbStatus}/> : page === 'About' ? <section className="panel about-panel"><h2>ABC Finance — FIS Dashboard</h2><p>This project demonstrates how a Financial Information System can store and present balance sheet data, calculate financial ratios, and help a user review a company's financial position.</p><div className="row g-3"><div className="col-md-4"><div className="about-tile"><strong>Frontend</strong><span>React, Bootstrap 5, Recharts</span></div></div><div className="col-md-4"><div className="about-tile"><strong>Backend</strong><span>Node.js and Express REST API</span></div></div><div className="col-md-4"><div className="about-tile"><strong>Database</strong><span>MongoDB, viewed in VS Code or Compass</span></div></div></div><p><strong>Database status:</strong> {dbStatus} ({records.length} records loaded)</p><h3>How to connect</h3><ol><li>Start MongoDB Community Server on your computer.</li><li>Connect the MongoDB extension in VS Code (or MongoDB Compass) to <code>mongodb://127.0.0.1:27017</code>.</li><li>Make sure <code>server/.env</code> contains <code>PORT=5000</code> and <code>MONGODB_URI=mongodb://127.0.0.1:27017/fis_finance_dashboard</code>.</li><li>Run <code>npm run dev</code> from the project root.</li><li>Refresh the connection and open <code>fis_finance_dashboard</code> → <code>financialrecords</code>.</li></ol><p className="muted">The data is fictional. Use only the figures and reporting period approved by your lecturer.</p></section> :
      <>
        <section className="filters-row">
          <label>Year<select className="form-select form-select-sm" value={year} onChange={e => setYear(e.target.value)}><option>All</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
          <label>Quarter<select className="form-select form-select-sm" value={quarter} onChange={e => setQuarter(e.target.value)}>{['All','Q1','Q2','Q3','Q4','Annual'].map(q => <option key={q}>{q}</option>)}</select></label>
          <div className="selected-record"><span className={`connection-dot ${dbStatus.includes('MongoDB:') ? 'online' : ''}`} />{busy ? 'Loading records…' : `${records.length} record(s) loaded`}</div>
          <button className="btn btn-light btn-sm" onClick={loadRecords}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>
        </section>

        {page !== 'Records' && <section className="row g-3 kpi-grid">
          <div className="col-6 col-xl-2"><Kpi label="Working Capital" value={fmt(stats.workingCapital)} icon="bi-cash-stack" /></div>
          <div className="col-6 col-xl-2"><Kpi label="Current Ratio" value={`${stats.currentRatio.toFixed(2)} : 1`} icon="bi-speedometer2" /></div>
          <div className="col-6 col-xl-2"><Kpi label="Liquidity / Quick" value={`${stats.quickRatio.toFixed(2)} : 1`} icon="bi-droplet" /></div>
          <div className="col-6 col-xl-2"><Kpi label="Quick Ratio" value={`${stats.quickRatio.toFixed(2)} : 1`} icon="bi-lightning-charge" /></div>
          <div className="col-6 col-xl-2"><Kpi label="Debt to Asset" value={`${stats.debtAsset.toFixed(2)}%`} icon="bi-pie-chart" /></div>
          <div className="col-6 col-xl-2"><Kpi label="Debt to Equity" value={`${stats.debtEquity.toFixed(2)}%`} icon="bi-bank" /></div>
        </section>}

        {page === 'Records' ? <section className="panel"><div className="panel-head"><div><h2>Financial records</h2><p>Create, select, update or delete records stored in MongoDB.</p></div><button className="btn btn-primary btn-sm" onClick={beginCreate}>Add new record</button></div><RecordsTable records={records} selectedId={selected?._id} onSelect={r => setSelectedId(r._id)} onEdit={beginEdit} onDelete={deleteSelected} /></section> :
        <div className="row g-3 content-grid">
          {page !== 'Ratio Analysis' && <div className="col-12 col-xl-5"><section className="panel balance-panel"><div className="panel-head"><div><h2>Balance Sheet</h2><p>Statement of financial position</p></div><span className="date-chip">{selected ? `${selected.year} · ${selected.quarter}` : 'No record'}</span></div>
            {selected ? <BalanceSheet record={selected} stats={stats} /> : <EmptyState onAdd={beginCreate} />}
            {selected && <div className={`balance-status ${Math.abs(stats.totalAssets - stats.totalLiabilitiesEquity) < 1 ? 'ok' : 'warning'}`}><i className={`bi ${Math.abs(stats.totalAssets - stats.totalLiabilitiesEquity) < 1 ? 'bi-check-circle' : 'bi-exclamation-triangle'}`} />{Math.abs(stats.totalAssets - stats.totalLiabilitiesEquity) < 1 ? 'Assets equal liabilities plus equity.' : `Balance difference: ${fmt(stats.totalAssets - stats.totalLiabilitiesEquity)}`}</div>}
            {selected && <div className="record-actions"><button className="btn btn-outline-primary btn-sm" onClick={beginEdit}><i className="bi bi-pencil me-1" />Edit selected</button><button className="btn btn-outline-danger btn-sm" onClick={deleteSelected}><i className="bi bi-trash me-1" />Delete</button></div>}
          </section></div>}
          {page !== 'Balance Sheet' && <div className="col-12 col-xl-7"><section className="panel chart-panel"><div className="panel-head"><div><h2>{page === 'Ratio Analysis' ? 'Ratio Analysis' : 'Financial Position'}</h2><p>Ratios and balance sheet comparison</p></div><button className="icon-btn" title="Export CSV" onClick={exportCSV}><i className="bi bi-three-dots" /></button></div>
            {selected ? <><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:10,right:8,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)"/><XAxis dataKey="name" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'var(--muted)'}} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}k`}/><Tooltip formatter={v => fmt(v)} /><Legend/><Bar dataKey="amount" name="Amount (M)" fill="#7662e8" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div><div className="ratio-list">
              <RatioLine label="Current ratio" value={`${stats.currentRatio.toFixed(2)} : 1`} formula="Current assets ÷ current liabilities" description="Measures short-term ability to cover current liabilities."/>
              <RatioLine label="Quick ratio" value={`${stats.quickRatio.toFixed(2)} : 1`} formula="(Current assets − inventory) ÷ current liabilities" description="Tests short-term liquidity without relying on inventory."/>
              <RatioLine label="Debt to asset ratio" value={`${stats.debtAsset.toFixed(2)}%`} formula="Total liabilities ÷ total assets × 100" description="Shows the share of assets financed by liabilities."/>
              <RatioLine label="Debt to equity ratio" value={`${stats.debtEquity.toFixed(2)}%`} formula="Total liabilities ÷ equity × 100" description="Compares creditor funding with owner funding."/>
              <RatioLine label="Equity ratio" value={`${stats.equityRatio.toFixed(2)}%`} formula="Equity ÷ total assets × 100" description="Shows the proportion of assets funded by equity."/>
            </div></> : <EmptyState onAdd={beginCreate}/>}
          </section></div>}
          {page === 'Dashboard' && <div className="col-12"><section className="panel"><div className="panel-head"><div><h2>All balance sheet records</h2><p>Select a record to see its detailed figures and ratios.</p></div></div><RecordsTable records={records} selectedId={selected?._id} onSelect={r => setSelectedId(r._id)} onEdit={beginEdit} onDelete={deleteSelected}/></section></div>}
          {page === 'Ratio Analysis' && <div className="col-12"><section className="panel"><div className="panel-head"><div><h2>Ratio interpretation</h2><p>Interpret results in context; benchmarks differ by industry.</p></div></div><div className="interpret-grid"><Interpret title="Liquidity" text="Current and quick ratios indicate whether the company can meet short-term obligations. A higher number is not automatically better; compare against cash needs and industry norms."/><Interpret title="Solvency" text="Debt-to-assets and debt-to-equity show how much financing comes from creditors. High leverage can increase financial risk, particularly when cash flows are weak."/><Interpret title="Working capital" text="Positive working capital means current assets exceed current liabilities. Review the quality and collectability of receivables and the ability to sell inventory."/><Interpret title="Balance sheet limitation" text="A balance sheet does not contain sales or profit figures. Profitability ratios need the income statement, and turnover ratios often need sales, cost of sales and average balances."/></div></section></div>}
        </div>}
      </>}

      <footer className="footer"><span>© 2026 ABC Finance · FIS Academic Project</span><span>React <b>•</b> Bootstrap <b>•</b> MongoDB</span></footer>
    </main>

    {showForm && <div className="modal-backdrop-custom" role="presentation"><div className="record-modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-heading"><div><h2 id="form-title">{form._edit ? 'Edit financial record' : 'Add financial record'}</h2><p>Values are stored in MongoDB and ratios update automatically.</p></div><button className="icon-btn" onClick={() => setShowForm(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></div>
      <form onSubmit={saveRecord}><div className="form-grid">
        <Field label="Company name" name="company" form={form} setForm={setForm} required/><Field label="Financial year" name="year" form={form} setForm={setForm} type="number" required/><Field label="Quarter" name="quarter" form={form} setForm={setForm} options={['Q1','Q2','Q3','Q4','Annual']}/><Field label="Currency prefix" name="currency" form={form} setForm={setForm} required/>
        {[
          ['cash','Cash and bank'],['receivables','Accounts receivable'],['inventory','Inventory'],['equipment','Property and equipment'],['payables','Accounts payable'],['shortDebt','Short-term debt'],['longDebt','Long-term debt'],['equity',"Owner's equity"]
        ].map(([name,label])=><Field key={name} label={label} name={name} form={form} setForm={setForm} type="number" min="0" required/>)}
        <div className="field-wide"><label className="form-label">Notes (optional)</label><textarea className="form-control" rows="2" value={form.notes || ''} onChange={e => setForm({...form,notes:e.target.value})}/></div>
      </div><div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" type="submit">Save to MongoDB</button></div></form>
    </div></div>}
  </div>;
}

function Kpi({label,value,icon}) { return <div className="kpi-card"><div className="kpi-top"><span>{label}<i className="bi bi-info-circle ms-1" /></span><i className={`bi ${icon} kpi-icon`} /></div><strong>{value}</strong></div>; }
function BalanceSheet({record:r,stats:s}) {
  const m = v => fmt(v,r.currency || 'M');
  const line = (label,value,bold=false) => <div className={`balance-line ${bold?'bold':''}`} key={label}><span>{label}</span><strong>{m(value)}</strong></div>;
  return <div className="balance-table">
    <div className="balance-table-head"><span>Line items</span><span>Balance</span></div>
    <div className="balance-section">1&nbsp;&nbsp; Assets</div>
    {line('Cash',r.cash)}{line('Accounts receivable',r.receivables)}{line('Inventories',r.inventory)}{line('Current assets',s.currentAssets,true)}{line('Property & equipment',r.equipment)}{line('Total assets',s.totalAssets,true)}
    <div className="balance-section">2&nbsp;&nbsp; Liabilities</div>
    {line('Accounts payable',r.payables)}{line('Short-term debt',r.shortDebt)}{line('Current liabilities',s.currentLiabilities,true)}{line('Long-term debt',r.longDebt)}{line('Total liabilities',s.totalLiabilities,true)}
    <div className="balance-section">3&nbsp;&nbsp; Equity</div>
    {line("Owner's equity",s.equity)}{line('Total liabilities + equity',s.totalLiabilitiesEquity,true)}
  </div>;
}
function RatioLine({label,value,formula,description}) { return <div className="ratio-line"><div className="ratio-line-top"><strong>{label}</strong><b>{value}</b></div><code>{formula}</code><p>{description}</p></div>; }
function RecordsTable({records,selectedId,onSelect,onEdit,onDelete}) {
  return <div className="table-responsive"><table className="table records-table align-middle"><thead><tr><th>Company</th><th>Year</th><th>Period</th><th>Total assets</th><th>Total liabilities</th><th>Current ratio</th><th>Actions</th></tr></thead><tbody>
    {records.map(r=>{const s=calc(r);return <tr key={r._id} className={r._id===selectedId?'row-selected':''} onClick={()=>onSelect(r)}><td><strong>{r.company}</strong><small>{r.notes || 'Financial statement'}</small></td><td>{r.year}</td><td><span className="period-tag">{r.quarter}</span></td><td>{fmt(s.totalAssets,r.currency)}</td><td>{fmt(s.totalLiabilities,r.currency)}</td><td>{s.currentRatio.toFixed(2)} : 1</td><td onClick={e=>e.stopPropagation()}><button className="table-action" title="Select record" onClick={()=>onSelect(r)}><i className="bi bi-eye" /></button></td></tr>})}
    {!records.length&&<tr><td colSpan="7" className="empty-cell">No records match these filters. Use “Add record” to create one.</td></tr>}
  </tbody></table></div>;
}
function Field({label,name,form,setForm,type='text',options,required,min}) {
  return <div><label className="form-label">{label}</label>{options?<select className="form-select" value={form[name] ?? ''} onChange={e=>setForm({...form,[name]:e.target.value})}>{options.map(o=><option key={o}>{o}</option>)}</select>:<input className="form-control" type={type} min={min} required={required} value={form[name] ?? ''} onChange={e=>setForm({...form,[name]:type==='number'?Number(e.target.value):e.target.value})}/>}</div>;
}
function EmptyState({onAdd}) { return <div className="empty-state"><i className="bi bi-database" /><strong>No financial record selected</strong><p>Add a record or clear the filters to see balance sheet data.</p><button className="btn btn-primary btn-sm" onClick={onAdd}>Add record</button></div>; }
function BlogPage({dbStatus,count}) {
  const posts = [
    ['Understanding the balance sheet', 'Assets = Liabilities + Equity. This dashboard groups cash, receivables, inventory and equipment as assets, payables and debt as liabilities, and owner\'s equity as the residual claim.'],
    ['Liquidity: current and quick ratio', 'The current ratio (current assets ÷ current liabilities) and quick ratio ((current assets − inventory) ÷ current liabilities) show whether ABC Finance can pay short-term obligations.'],
    ['Solvency: debt-to-assets and debt-to-equity', 'These ratios show how much of the business is financed by creditors. Higher leverage increases risk, especially when cash flow is weak.'],
    ['How the data is stored', `Records are saved by the Express API into MongoDB (database fis_finance_dashboard, collection financialrecords). Current status: ${dbStatus}. Records loaded: ${count}.`],
    ['Limits of a balance sheet', 'A balance sheet has no sales or profit figures, so profitability ratios such as net profit margin or return on assets need the income statement.']
  ];
  return <section className="panel"><div className="panel-head"><div><h2>Latest articles</h2><p>Short notes that explain the figures shown in this dashboard.</p></div></div><div className="interpret-grid">{posts.map(([t,x]) => <Interpret key={t} title={t} text={x}/>)}</div></section>;
}
function FaqPage() {
  const faqs = [
    ['Where is my data stored?', 'In MongoDB at mongodb://127.0.0.1:27017, database fis_finance_dashboard, collection financialrecords. Changes made in the app are saved there.'],
    ['How do I add, edit or delete a record?', 'Use Add record in the top-right. Edit and delete act on the record selected in the Balance Sheet view. Changes are saved to MongoDB immediately.'],
    ['How are the ratios calculated?', 'Current ratio = current assets ÷ current liabilities. Quick ratio = (current assets − inventory) ÷ current liabilities. Working capital = current assets − current liabilities. Debt-to-assets = total liabilities ÷ total assets × 100. Debt-to-equity = total liabilities ÷ equity × 100. Equity ratio = equity ÷ total assets × 100.'],
    ['Why does it say "API unavailable"?', 'The backend or MongoDB is not running. Start MongoDB, then run npm run dev from the project root. Check http://localhost:5000/api/health: state 1 means connected.'],
    ['Can I export my data?', 'Yes. Export CSV downloads the records currently shown, including total assets, total liabilities and the calculated ratios.'],
    ['Is the data real?', 'No. ABC Finance and all figures are fictional sample data for the FIS module. Use the figures and period your lecturer approves.'],
    ['Where can I see the data in VS Code?', 'Install the MongoDB for VS Code extension, add a connection to mongodb://127.0.0.1:27017, then open fis_finance_dashboard → financialrecords.']
  ];
  return <section className="panel"><div className="panel-head"><div><h2>Common questions</h2><p>Answers about the data, ratios and setup.</p></div></div><div className="faq-list">{faqs.map(([q,a]) => <details key={q} className="faq-item"><summary>{q}</summary><p>{a}</p></details>)}</div></section>;
}
function ContactPage({dbStatus}) {
  return <section className="panel"><div className="panel-head"><div><h2>Project contact</h2><p>This is an academic project, so there is no live support desk.</p></div></div><div className="interpret-grid"><Interpret title="Project" text="ABC Finance — Financial Information Systems (FIS) module dashboard, 2026."/><Interpret title="Questions about the figures" text="Contact your FIS lecturer or module coordinator. All data is fictional and for demonstration only."/><Interpret title="Technical checks" text={`Frontend: http://localhost:5173 · API: http://localhost:5000/api/health · Database status: ${dbStatus}`}/></div></section>;
}
function Interpret({title,text}) { return <div className="interpret-card"><strong>{title}</strong><p>{text}</p></div>; }

export default App;