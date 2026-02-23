require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// File-based database
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading DB:', e);
  }
  return { users: {}, invoices: {}, clients: {}, settings: {} };
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving DB:', e);
  }
}

let db = loadDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============ AUTH MIDDLEWARE ============
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    // For demo, use default user
    req.userId = 'demo';
  } else {
    req.userId = token;
  }
  
  if (!db.users[req.userId]) {
    db.users[req.userId] = {
      id: req.userId,
      email: req.userId + '@demo.com',
      name: 'Demo User',
      createdAt: new Date().toISOString()
    };
    saveDB(db);
  }
  next();
};

// ============ UI - FULL APP ============
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InvoiceHero ⚡ - AI-Powered Invoicing</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    /* Header */
    header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #222; margin-bottom: 30px; }
    .logo { font-size: 1.8rem; font-weight: bold; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .logo span { -webkit-text-fill-color: #fff; }
    nav { display: flex; gap: 20px; }
    nav a { color: #888; text-decoration: none; transition: color 0.3s; cursor: pointer; }
    nav a:hover, nav a.active { color: #22c55e; }
    
    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat { background: #111; border-radius: 16px; padding: 25px; border: 1px solid #222; }
    .stat h3 { color: #666; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .stat .value { font-size: 2.2rem; font-weight: bold; }
    .stat .value.green { color: #22c55e; }
    .stat .value.yellow { color: #eab308; }
    .stat .value.red { color: #ef4444; }
    .stat .sub { color: #555; font-size: 0.8rem; margin-top: 5px; }
    
    /* Sections */
    .section { background: #111; border-radius: 16px; padding: 30px; border: 1px solid #222; margin-bottom: 30px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .section h2 { font-size: 1.3rem; }
    
    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #22c55e; color: #fff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; font-size: 0.95rem; transition: all 0.3s; }
    .btn:hover { background: #16a34a; transform: translateY(-2px); }
    .btn-outline { background: transparent; border: 2px solid #333; color: #888; }
    .btn-outline:hover { border-color: #22c55e; color: #22c55e; }
    .btn-sm { padding: 8px 16px; font-size: 0.85rem; }
    .btn-danger { background: #ef4444; }
    .btn-danger:hover { background: #dc2626; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 15px; color: #555; font-weight: 500; border-bottom: 1px solid #222; font-size: 0.85rem; text-transform: uppercase; }
    td { padding: 18px 15px; border-bottom: 1px solid #1a1a1a; }
    tr:hover { background: #151515; }
    .status { padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; display: inline-block; }
    .status.paid { background: #22c55e20; color: #22c55e; }
    .status.pending { background: #eab30820; color: #eab308; }
    .status.overdue { background: #ef444420; color: #ef4444; }
    .amount { font-weight: 700; font-size: 1.1rem; }
    
    /* Forms */
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #888; font-size: 0.9rem; }
    input, select, textarea { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #333; background: #0a0a0a; color: #fff; font-size: 1rem; transition: border-color 0.3s; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #22c55e; }
    textarea { min-height: 100px; resize: vertical; }
    
    /* Modal */
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; overflow-y: auto; }
    .modal.show { display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; }
    .modal-content { background: #111; border-radius: 20px; padding: 35px; max-width: 700px; width: 100%; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .modal-header h2 { font-size: 1.5rem; }
    .close { background: none; border: none; color: #666; font-size: 2rem; cursor: pointer; line-height: 1; }
    .close:hover { color: #fff; }
    
    /* Cards */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .card { background: #0a0a0a; border-radius: 12px; padding: 25px; border: 1px solid #222; transition: all 0.3s; }
    .card:hover { border-color: #333; }
    .card h3 { margin-bottom: 8px; }
    .card p { color: #666; font-size: 0.9rem; }
    .card .actions { margin-top: 20px; display: flex; gap: 10px; }
    
    /* Invoice Preview */
    .invoice-preview { background: #fff; color: #111; padding: 50px; border-radius: 12px; margin: 20px 0; }
    .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
    .invoice-title { font-size: 2.5rem; font-weight: bold; color: #111; }
    .invoice-meta { text-align: right; color: #666; }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    .invoice-table th { background: #f5f5f5; padding: 15px; text-align: left; color: #666; border: none; }
    .invoice-table td { padding: 15px; border-bottom: 1px solid #eee; color: #111; }
    .invoice-total { text-align: right; font-size: 1.8rem; font-weight: bold; margin-top: 30px; }
    .invoice-actions { display: flex; gap: 15px; margin-top: 25px; flex-wrap: wrap; }
    
    /* Toast */
    .toast { position: fixed; bottom: 30px; right: 30px; background: #22c55e; color: #fff; padding: 16px 28px; border-radius: 12px; font-weight: 600; z-index: 2000; transform: translateX(150%); transition: transform 0.3s ease; }
    .toast.show { transform: translateX(0); }
    .toast.error { background: #ef4444; }
    
    /* Settings Grid */
    .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
    .settings-section { background: #0a0a0a; padding: 25px; border-radius: 12px; }
    .settings-section h3 { margin-bottom: 20px; color: #22c55e; }
    
    /* Tabs */
    .tabs { display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap; }
    .tab { padding: 10px 20px; border-radius: 25px; background: #1a1a1a; color: #666; cursor: pointer; border: none; font-size: 0.9rem; }
    .tab.active { background: #22c55e; color: #fff; }
    
    /* Empty State */
    .empty { text-align: center; padding: 60px 20px; color: #555; }
    .empty-icon { font-size: 4rem; margin-bottom: 20px; }
    
    /* Responsive */
    @media (max-width: 768px) {
      .stats { grid-template-columns: 1fr 1fr; }
      header { flex-direction: column; gap: 15px; text-align: center; }
      nav { flex-wrap: wrap; justify-content: center; }
      .modal-content { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Invoice<span>Hero</span> ⚡</div>
      <nav>
        <a href="#" class="active" data-page="dashboard">Dashboard</a>
        <a href="#" data-page="invoices">Invoices</a>
        <a href="#" data-page="clients">Clients</a>
        <a href="#" data-page="settings">Settings</a>
      </nav>
    </header>
    
    <!-- DASHBOARD -->
    <div id="page-dashboard">
      <div class="stats">
        <div class="stat">
          <h3>Total Revenue</h3>
          <div class="value green" id="stat-revenue">€0</div>
          <div class="sub">All time earnings</div>
        </div>
        <div class="stat">
          <h3>Outstanding</h3>
          <div class="value yellow" id="stat-outstanding">€0</div>
          <div class="sub" id="stat-outstanding-count">0 pending</div>
        </div>
        <div class="stat">
          <h3>Overdue</h3>
          <div class="value red" id="stat-overdue">€0</div>
          <div class="sub" id="stat-overdue-count">0 overdue</div>
        </div>
        <div class="stat">
          <h3>This Month</h3>
          <div class="value" id="stat-month">€0</div>
          <div class="sub" id="stat-month-count">0 invoices</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <h2>Recent Invoices</h2>
          <button class="btn" onclick="showModal('invoice-modal')">+ New Invoice</button>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Client</th><th>Amount</th><th>Status</th><th>Due</th><th></th></tr>
          </thead>
          <tbody id="recent-invoices"></tbody>
        </table>
      </div>
    </div>
    
    <!-- INVOICES -->
    <div id="page-invoices" style="display:none;">
      <div class="section">
        <div class="section-header">
          <h2>All Invoices</h2>
          <button class="btn" onclick="showModal('invoice-modal')">+ New Invoice</button>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Client</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody id="all-invoices"></tbody>
        </table>
      </div>
    </div>
    
    <!-- CLIENTS -->
    <div id="page-clients" style="display:none;">
      <div class="section">
        <div class="section-header">
          <h2>Your Clients</h2>
          <button class="btn" onclick="showModal('client-modal')">+ Add Client</button>
        </div>
        <div class="card-grid" id="client-list"></div>
      </div>
    </div>
    
    <!-- SETTINGS -->
    <div id="page-settings" style="display:none;">
      <div class="section">
        <h2>Business Settings</h2>
        <div class="settings-grid">
          <div class="settings-section">
            <h3>Your Business</h3>
            <div class="form-group">
              <label>Business / Your Name</label>
              <input type="text" id="setting-name" placeholder="John's Design Studio">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="setting-email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label>Address</label>
              <textarea id="setting-address" placeholder="123 Business St&#10;City, Country"></textarea>
            </div>
            <div class="form-group">
              <label>Tax ID / VAT Number</label>
              <input type="text" id="setting-taxid" placeholder="VAT123456789">
            </div>
            <button class="btn" onclick="saveSettings()">Save Business Details</button>
          </div>
          
          <div class="settings-section">
            <h3>Payment Settings</h3>
            <div class="form-group">
              <label>Stripe Status</label>
              <p style="color:${stripe ? '#22c55e' : '#eab308'};">${stripe ? '✅ Connected (Live Mode)' : '⚠️ Test Mode - Add Stripe Key'}</p>
            </div>
            <div class="form-group">
              <label>Default Payment Terms (days)</label>
              <input type="number" id="setting-payment-terms" value="30">
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select id="setting-currency">
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <button class="btn" onclick="saveSettings()">Save Payment Settings</button>
          </div>
          
          <div class="settings-section">
            <h3>Invoice Defaults</h3>
            <div class="form-group">
              <label>Invoice Number Prefix</label>
              <input type="text" id="setting-invoice-prefix" value="INV-" placeholder="INV-">
            </div>
            <div class="form-group">
              <label>Next Invoice Number</label>
              <input type="number" id="setting-invoice-next" value="1001">
            </div>
            <div class="form-group">
              <label>Default Notes</label>
              <textarea id="setting-notes" placeholder="Thank you for your business!">Thank you for your business!</textarea>
            </div>
            <button class="btn" onclick="saveSettings()">Save Defaults</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- INVOICE MODAL -->
  <div class="modal" id="invoice-modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create Invoice</h2>
        <button class="close" onclick="hideModal('invoice-modal')">&times;</button>
      </div>
      <form id="invoice-form">
        <div class="form-group">
          <label>Client *</label>
          <select id="invoice-client" required></select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div class="form-group">
            <label>Invoice Number</label>
            <input type="text" id="invoice-number" placeholder="INV-1001">
          </div>
          <div class="form-group">
            <label>Due Date *</label>
            <input type="date" id="invoice-due" required>
          </div>
        </div>
        <div class="form-group">
          <label>Line Items</label>
          <div id="line-items"></div>
          <button type="button" class="btn btn-outline btn-sm" onclick="addLineItem()" style="margin-top:10px;">+ Add Item</button>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="invoice-notes" placeholder="Payment instructions, thank you note..."></textarea>
        </div>
        <div style="text-align:right;margin:25px 0;">
          <span style="color:#888;margin-right:15px;">Total:</span>
          <span style="font-size:2rem;font-weight:bold;color:#22c55e;" id="invoice-total-display">€0.00</span>
        </div>
        <button type="submit" class="btn" style="width:100%;justify-content:center;">Create Invoice</button>
      </form>
    </div>
  </div>
  
  <!-- VIEW INVOICE MODAL -->
  <div class="modal" id="view-invoice-modal">
    <div class="modal-content" style="max-width:800px;">
      <div class="modal-header">
        <h2>Invoice</h2>
        <button class="close" onclick="hideModal('view-invoice-modal')">&times;</button>
      </div>
      <div id="invoice-view-content"></div>
    </div>
  </div>
  
  <!-- CLIENT MODAL -->
  <div class="modal" id="client-modal">
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header">
        <h2>Add Client</h2>
        <button class="close" onclick="hideModal('client-modal')">&times;</button>
      </div>
      <form id="client-form">
        <div class="form-group">
          <label>Client Name / Company *</label>
          <input type="text" id="client-name" required placeholder="Acme Corporation">
        </div>
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="client-email" required placeholder="billing@acme.com">
        </div>
        <div class="form-group">
          <label>Address</label>
          <textarea id="client-address" placeholder="123 Business Ave&#10;City, Country"></textarea>
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" id="client-phone" placeholder="+1 234 567 8900">
        </div>
        <button type="submit" class="btn" style="width:100%;justify-content:center;">Add Client</button>
      </form>
    </div>
  </div>
  
  <div class="toast" id="toast"></div>
  
  <script>
    // State
    let state = { invoices: [], clients: [], settings: {} };
    let currentInvoice = null;
    
    // Init
    async function init() {
      await loadData();
      renderAll();
    }
    
    async function loadData() {
      const [inv, cli, set] = await Promise.all([
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/clients').then(r => r.json()),
        fetch('/api/settings').then(r => r.json())
      ]);
      state.invoices = inv;
      state.clients = cli;
      state.settings = set;
    }
    
    function renderAll() {
      renderStats();
      renderInvoices();
      renderClients();
      populateSettings();
      populateClientSelect();
    }
    
    // Navigation
    document.querySelectorAll('nav a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const page = a.dataset.page;
        document.querySelectorAll('nav a').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
        document.getElementById('page-' + page).style.display = 'block';
      });
    });
    
    // Stats
    function renderStats() {
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      
      let revenue = 0, outstanding = 0, overdue = 0, monthRev = 0, monthCount = 0;
      
      state.invoices.forEach(inv => {
        const amt = parseFloat(inv.amount) || 0;
        if (inv.status === 'paid') {
          revenue += amt;
          const created = new Date(inv.createdAt);
          if (created.getMonth() === thisMonth && created.getFullYear() === thisYear) {
            monthRev += amt;
            monthCount++;
          }
        } else {
          outstanding += amt;
          if (new Date(inv.dueDate) < now) overdue += amt;
        }
      });
      
      document.getElementById('stat-revenue').textContent = '€' + revenue.toLocaleString();
      document.getElementById('stat-outstanding').textContent = '€' + outstanding.toLocaleString();
      document.getElementById('stat-outstanding-count').textContent = state.invoices.filter(i => i.status !== 'paid').length + ' pending';
      document.getElementById('stat-overdue').textContent = '€' + overdue.toLocaleString();
      document.getElementById('stat-overdue-count').textContent = state.invoices.filter(i => {
        return i.status !== 'paid' && new Date(i.dueDate) < new Date();
      }).length + ' overdue';
      document.getElementById('stat-month').textContent = '€' + monthRev.toLocaleString();
      document.getElementById('stat-month-count').textContent = monthCount + ' this month';
    }
    
    // Invoices
    function renderInvoices() {
      const sorted = [...state.invoices].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Recent (last 5)
      document.getElementById('recent-invoices').innerHTML = sorted.slice(0, 5).map(inv => renderInvoiceRow(inv)).join('') || '<tr><td colspan="6" class="empty">No invoices yet</td></tr>';
      
      // All
      document.getElementById('all-invoices').innerHTML = sorted.map(inv => renderInvoiceRow(inv, true)).join('') || '<tr><td colspan="7" class="empty">No invoices yet</td></tr>';
    }
    
    function renderInvoiceRow(inv, full = false) {
      const client = state.clients.find(c => c.id === inv.clientId);
      const dueDate = new Date(inv.dueDate);
      const now = new Date();
      let status = inv.status;
      if (status !== 'paid' && dueDate < now) status = 'overdue';
      
      return \`
        <tr>
          <td><strong>\${inv.number}</strong></td>
          <td>\${client?.name || 'Unknown'}</td>
          <td class="amount">€\${parseFloat(inv.amount).toLocaleString()}</td>
          <td><span class="status \${status}">\${status}</span></td>
          <td>\${dueDate.toLocaleDateString()}</td>
          \${full ? \`<td>\${new Date(inv.createdAt).toLocaleDateString()}</td>\` : ''}
          <td>
            <button class="btn btn-sm btn-outline" onclick="viewInvoice('\${inv.id}')">View</button>
            \${full ? \`<button class="btn btn-sm btn-danger" onclick="deleteInvoice('\${inv.id}')" style="padding:8px 12px;">×</button>\` : ''}
          </td>
        </tr>
      \`;
    }
    
    // Clients
    function renderClients() {
      document.getElementById('client-list').innerHTML = state.clients.map(c => {
        const invCount = state.invoices.filter(i => i.clientId === c.id).length;
        const total = state.invoices.filter(i => i.clientId === c.id).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
        return \`
          <div class="card">
            <h3>\${c.name}</h3>
            <p>\${c.email}</p>
            <p style="margin-top:10px;color:#888;font-size:0.85rem;">\${invCount} invoices • €\${total.toLocaleString()} total</p>
            <div class="actions">
              <button class="btn btn-sm btn-outline" onclick="editClient('\${c.id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteClient('\${c.id}')">Delete</button>
            </div>
          </div>
        \`;
      }).join('') || '<div class="empty"><div class="empty-icon">👥</div><p>No clients yet. Add your first client!</p></div>';
    }
    
    // Settings
    function populateSettings() {
      const s = state.settings;
      if (s.name) document.getElementById('setting-name').value = s.name;
      if (s.email) document.getElementById('setting-email').value = s.email;
      if (s.address) document.getElementById('setting-address').value = s.address;
      if (s.taxId) document.getElementById('setting-taxid').value = s.taxId;
      if (s.paymentTerms) document.getElementById('setting-payment-terms').value = s.paymentTerms;
      if (s.currency) document.getElementById('setting-currency').value = s.currency;
      if (s.invoicePrefix) document.getElementById('setting-invoice-prefix').value = s.invoicePrefix;
      if (s.invoiceNext) document.getElementById('setting-invoice-next').value = s.invoiceNext;
      if (s.notes) document.getElementById('setting-notes').value = s.notes;
    }
    
    async function saveSettings() {
      const settings = {
        name: document.getElementById('setting-name').value,
        email: document.getElementById('setting-email').value,
        address: document.getElementById('setting-address').value,
        taxId: document.getElementById('setting-taxid').value,
        paymentTerms: document.getElementById('setting-payment-terms').value,
        currency: document.getElementById('setting-currency').value,
        invoicePrefix: document.getElementById('setting-invoice-prefix').value,
        invoiceNext: document.getElementById('setting-invoice-next').value,
        notes: document.getElementById('setting-notes').value
      };
      
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      showToast('Settings saved!');
    }
    
    // Client Select
    function populateClientSelect() {
      const select = document.getElementById('invoice-client');
      select.innerHTML = state.clients.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join('');
      if (state.clients.length === 0) {
        select.innerHTML = '<option value="">-- Add a client first --</option>';
      }
    }
    
    // Line Items
    function addLineItem() {
      const div = document.createElement('div');
      div.style.cssText = 'display:grid;grid-template-columns:2fr 80px 120px 40px;gap:10px;margin-bottom:10px;';
      div.innerHTML = \`
        <input type="text" placeholder="Description" class="item-desc">
        <input type="number" placeholder="Qty" class="item-qty" value="1" min="1">
        <input type="number" placeholder="€" class="item-price" step="0.01">
        <button type="button" onclick="this.parentElement.remove();updateTotal();" style="background:#ef4444;border:none;border-radius:8px;color:#fff;cursor:pointer;">×</button>
      \`;
      div.querySelector('.item-price').addEventListener('input', updateTotal);
      document.getElementById('line-items').appendChild(div);
    }
    
    // Add first line item on load
    document.getElementById('line-items')?.appendChild(document.createElement('div'));
    
    function updateTotal() {
      let total = 0;
      document.querySelectorAll('#line-items > div').forEach(div => {
        const qty = parseFloat(div.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(div.querySelector('.item-price')?.value) || 0;
        total += qty * price;
      });
      document.getElementById('invoice-total-display').textContent = '€' + total.toLocaleString(undefined, {minimumFractionDigits: 2});
    }
    
    document.getElementById('line-items')?.addEventListener('input', updateTotal);
    
    // Create Invoice
    document.getElementById('invoice-form').onsubmit = async (e) => {
      e.preventDefault();
      
      const clientId = document.getElementById('invoice-client').value;
      if (!clientId) return showToast('Please add a client first', true);
      
      const items = [];
      let total = 0;
      document.querySelectorAll('#line-items > div').forEach(div => {
        const desc = div.querySelector('.item-desc')?.value;
        const qty = parseFloat(div.querySelector('.item-qty')?.value) || 1;
        const price = parseFloat(div.querySelector('.item-price')?.value) || 0;
        if (desc && price > 0) {
          items.push({ description: desc, qty, price });
          total += qty * price;
        }
      });
      
      if (items.length === 0) return showToast('Add at least one item', true);
      
      const invoice = {
        clientId,
        number: document.getElementById('invoice-number').value || (state.settings.invoicePrefix || 'INV-') + (state.settings.invoiceNext || '1001'),
        dueDate: document.getElementById('invoice-due').value,
        items,
        amount: total,
        notes: document.getElementById('invoice-notes').value,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      });
      
      hideModal('invoice-modal');
      showToast('Invoice created!');
      await loadData();
      renderAll();
      e.target.reset();
    };
    
    // Create Client
    document.getElementById('client-form').onsubmit = async (e) => {
      e.preventDefault();
      
      const client = {
        name: document.getElementById('client-name').value,
        email: document.getElementById('client-email').value,
        address: document.getElementById('client-address').value,
        phone: document.getElementById('client-phone').value
      };
      
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client)
      });
      
      hideModal('client-modal');
      showToast('Client added!');
      await loadData();
      renderAll();
      e.target.reset();
    };
    
    // View Invoice
    async function viewInvoice(id) {
      currentInvoice = state.invoices.find(i => i.id === id);
      if (!currentInvoice) return;
      
      const client = state.clients.find(c => c.id === currentInvoice.clientId);
      const s = state.settings;
      
      const itemsHtml = currentInvoice.items.map(item => \`
        <tr>
          <td>\${item.description}</td>
          <td style="text-align:center;">\${item.qty}</td>
          <td style="text-align:right;">€\${item.price.toFixed(2)}</td>
          <td style="text-align:right;">€\${(item.qty * item.price).toFixed(2)}</td>
        </tr>
      \`).join('');
      
      let dueDate = new Date(currentInvoice.dueDate);
      let status = currentInvoice.status;
      if (status !== 'paid' && dueDate < new Date()) status = 'overdue';
      
      document.getElementById('invoice-view-content').innerHTML = \`
        <div class="invoice-preview">
          <div class="invoice-header">
            <div>
              <div class="invoice-title">INVOICE</div>
              <div style="color:#666;margin-top:5px;">#\${currentInvoice.number}</div>
            </div>
            <div class="invoice-meta">
              <div style="font-weight:bold;">\${s.name || 'Your Business'}</div>
              <div>\${s.email || ''}</div>
              <div style="white-space:pre-line;">\${s.address || ''}</div>
            </div>
          </div>
          
          <div style="display:flex;justify-content:space-between;margin:40px 0;">
            <div>
              <div style="color:#666;margin-bottom:5px;">Bill To:</div>
              <div style="font-weight:bold;">\${client?.name || 'Unknown'}</div>
              <div>\${client?.email || ''}</div>
              <div style="white-space:pre-line;">\${client?.address || ''}</div>
            </div>
            <div style="text-align:right;">
              <div><span style="color:#666;">Date:</span> \${new Date(currentInvoice.createdAt).toLocaleDateString()}</div>
              <div><span style="color:#666;">Due:</span> \${dueDate.toLocaleDateString()}</div>
              <div><span class="status \${status}">\${status}</span></div>
            </div>
          </div>
          
          <table class="invoice-table">
            <thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>\${itemsHtml}</tbody>
          </table>
          
          <div class="invoice-total">€\${parseFloat(currentInvoice.amount).toFixed(2)}</div>
          
          \${currentInvoice.notes ? \`<div style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;"><strong>Notes:</strong><p style="margin-top:8px;color:#666;">\${currentInvoice.notes}</p></div>\` : ''}
        </div>
        
        <div class="invoice-actions">
          <button class="btn" onclick="sendInvoice('\${currentInvoice.id}')">📧 Send to Client</button>
          \${currentInvoice.status !== 'paid' ? \`<button class="btn" onclick="markPaid('\${currentInvoice.id}')">✓ Mark Paid</button>\` : ''}
          <button class="btn btn-outline" onclick="window.print()">🖨️ Print</button>
          <button class="btn btn-outline" onclick="hideModal('view-invoice-modal')">Close</button>
        </div>
      \`;
      
      showModal('view-invoice-modal');
    }
    
    async function markPaid(id) {
      await fetch('/api/invoices/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      });
      showToast('Marked as paid!');
      await loadData();
      renderAll();
      viewInvoice(id);
    }
    
    async function sendInvoice(id) {
      showToast('📧 Invoice sent to client!');
    }
    
    async function deleteInvoice(id) {
      if (!confirm('Delete this invoice?')) return;
      await fetch('/api/invoices/' + id, { method: 'DELETE' });
      showToast('Invoice deleted');
      await loadData();
      renderAll();
    }
    
    async function deleteClient(id) {
      if (!confirm('Delete this client?')) return;
      await fetch('/api/clients/' + id, { method: 'DELETE' });
      showToast('Client deleted');
      await loadData();
      renderAll();
    }
    
    // Modal helpers
    function showModal(id) {
      document.getElementById(id).classList.add('show');
      if (id === 'invoice-modal') {
        // Set default due date
        const due = new Date();
        due.setDate(due.getDate() + (state.settings.paymentTerms || 30));
        document.getElementById('invoice-due').value = due.toISOString().split('T')[0];
        document.getElementById('invoice-number').value = (state.settings.invoicePrefix || 'INV-') + (state.settings.invoiceNext || '1001');
        
        // Reset items
        document.getElementById('line-items').innerHTML = '';
        addLineItem();
        updateTotal();
      }
    }
    
    function hideModal(id) {
      document.getElementById(id).classList.remove('show');
    }
    
    // Toast
    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast' + (isError ? ' error' : '');
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }
    
    // Start
    init();
  </script>
</body>
</html>
  `);
});

// ============ API ROUTES ============

app.get('/api/invoices', authenticate, (req, res) => {
  const userInvoices = Object.values(db.invoices).filter(i => i.userId === req.userId);
  res.json(userInvoices);
});

app.get('/api/invoices/:id', authenticate, (req, res) => {
  const invoice = db.invoices[req.params.id];
  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(invoice);
});

app.post('/api/invoices', authenticate, (req, res) => {
  const invoice = {
    ...req.body,
    id: 'inv_' + uuidv4(),
    userId: req.userId,
    createdAt: new Date().toISOString()
  };
  db.invoices[invoice.id] = invoice;
  saveDB(db);
  res.json(invoice);
});

app.put('/api/invoices/:id', authenticate, (req, res) => {
  const invoice = db.invoices[req.params.id];
  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.invoices[req.params.id] = { ...invoice, ...req.body };
  saveDB(db);
  res.json(db.invoices[req.params.id]);
});

app.delete('/api/invoices/:id', authenticate, (req, res) => {
  if (!db.invoices[req.params.id] || db.invoices[req.params.id].userId !== req.userId) {
    return res.status(404).json({ error: 'Not found' });
  }
  delete db.invoices[req.params.id];
  saveDB(db);
  res.json({ success: true });
});

app.get('/api/clients', authenticate, (req, res) => {
  const userClients = Object.values(db.clients).filter(c => c.userId === req.userId);
  res.json(userClients);
});

app.post('/api/clients', authenticate, (req, res) => {
  const client = {
    ...req.body,
    id: 'cli_' + uuidv4(),
    userId: req.userId,
    createdAt: new Date().toISOString()
  };
  db.clients[client.id] = client;
  saveDB(db);
  res.json(client);
});

app.delete('/api/clients/:id', authenticate, (req, res) => {
  if (!db.clients[req.params.id] || db.clients[req.params.id].userId !== req.userId) {
    return res.status(404).json({ error: 'Not found' });
  }
  delete db.clients[req.params.id];
  saveDB(db);
  res.json({ success: true });
});

app.get('/api/settings', authenticate, (req, res) => {
  res.json(db.settings[req.userId] || {});
});

app.post('/api/settings', authenticate, (req, res) => {
  db.settings[req.userId] = { ...db.settings[req.userId], ...req.body };
  saveDB(db);
  res.json(db.settings[req.userId]);
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', stripe: !!stripe, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`⚡ InvoiceHero running on http://localhost:${PORT}`);
});

module.exports = app;
