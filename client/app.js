const h = React.createElement;
let activeHook = 0;
const store = [];
let rootInstance = null;
let queuedEffects = [];
const useState = (initial) => { const index = activeHook++; if (!(index in store))
    store[index] = initial; return [store[index], (next) => { store[index] = typeof next === 'function' ? next(store[index]) : next; if (rootInstance)
        rootInstance.forceUpdate(); }]; };
const useEffect = (fn, deps) => { const index = activeHook++; const previous = store[index]; if (!previous || deps.some((v, i) => v !== previous[i])) {
    store[index] = deps;
    queuedEffects.push(fn);
} };
class Root extends React.Component {
    componentDidMount() { this.flush(); }
    componentDidUpdate() { this.flush(); }
    flush() { const effects = queuedEffects; queuedEffects = []; effects.forEach((fn) => fn()); }
    render() { rootInstance = this; activeHook = 0; return App(); }
}
const money = (v) => 'Rs ' + (v / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const date = (s) => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const statusName = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
const nextStates = { draft: ['confirmed', 'cancelled'], confirmed: ['packed', 'cancelled'], packed: ['dispatched', 'cancelled'], dispatched: ['delivered'], delivered: [], cancelled: [] };
const I = (name) => h('span', { className: 'icon' }, name);
function App() {
    const [token, setToken] = useState(sessionStorage.getItem('fw_token') || '');
    const [user, setUser] = useState(null);
    const [tab, setTab] = useState('overview');
    const [data, setData] = useState({});
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [low, setLow] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [modal, setModal] = useState('');
    const [picked, setPicked] = useState(null);
    const [form, setForm] = useState({});
    const [items, setItems] = useState([{ product_id: '', qty: 1 }]);
    const [email, setEmail] = useState('admin@demo.local');
    const [password, setPassword] = useState('Admin123!');
    const canWrite = user?.role !== 'viewer';
    const admin = user?.role === 'admin';
    async function api(path, options = {}) { const headers = { 'Content-Type': 'application/json' }; if (token)
        headers.Authorization = 'Bearer ' + token; const res = await fetch('/api' + path, { ...options, headers: { ...headers, ...options.headers } }); if (!res.ok) {
        let j = {};
        try {
            j = await res.json();
        }
        catch { }
        throw Error(j.error || 'Something went wrong');
    } return res.json(); }
    const request = async (path, options = {}) => { setLoading(true); setError(''); try {
        return await api(path, options);
    }
    catch (e) {
        setError(e.message);
        throw e;
    }
    finally {
        setLoading(false);
    } };
    async function refresh() { if (!token)
        return; try {
        const [me, summary, products, orders, customers, suppliers, movements, lowstock] = await Promise.all([api('/me'), api('/summary'), api('/products?limit=100'), api('/orders?limit=100'), api('/customers'), api('/suppliers'), api('/stock/movements?limit=100'), api('/reports/low-stock')]);
        setUser(me.user);
        setData({ summary, products: products.items, orders: orders.items, customers: customers.items, suppliers: suppliers.items, movements: movements.items, lowstock: lowstock.items });
    }
    catch (e) {
        setError(e.message);
        if (e.message.includes('Session') || e.message.includes('sign in'))
            logoutLocal();
    } }
    useEffect(() => { refresh(); }, [token]);
    useEffect(() => { setPage(1); }, [tab, query, status, low, from, to]);
    function logoutLocal() { sessionStorage.removeItem('fw_token'); setToken(''); setUser(null); setData({}); }
    async function login(e) { e.preventDefault(); try {
        const r = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        sessionStorage.setItem('fw_token', r.token);
        setToken(r.token);
        setUser(r.user);
    }
    catch { } }
    async function logout() { try {
        await api('/logout', { method: 'POST' });
    }
    catch { } logoutLocal(); }
    function change(k, v) { setForm((f) => ({ ...f, [k]: v })); }
    function open(name, p = {}) { setForm({ ...p, product_id: p.id || '', price: p.price_cents !== undefined ? p.price_cents / 100 : '' }); setPicked(p); setItems([{ product_id: '', qty: 1 }]); setModal(name); setError(''); }
    async function save(path, payload, method = 'POST') { try {
        await request(path, { method, body: JSON.stringify(payload) });
        setModal('');
        setNotice('Changes saved');
        await refresh();
    }
    catch { } }
    async function updateOrder(id, st) { try {
        await request('/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status: st }) });
        setNotice('Order moved to ' + st);
        await refresh();
        if (modal === 'order-detail')
            await detail(id);
    }
    catch { } }
    async function detail(id) { try {
        const r = await request('/orders/' + id);
        setPicked(r);
        setModal('order-detail');
    }
    catch { } }
    async function download(filename) { try {
        setError('');
        const r = await fetch('/api/reports/' + filename + '.csv', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok)
            throw Error((await r.json()).error);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
    catch (e) {
        setError(e.message);
    } }
    const products = data.products || [], orders = data.orders || [], customers = data.customers || [], suppliers = data.suppliers || [], movements = data.movements || [], s = data.summary || {};
    const matches = (t) => String(t).toLowerCase().includes(query.toLowerCase());
    const filteredProducts = products.filter((p) => (matches(p.name) || matches(p.sku) || matches(p.category)) && (!low || p.qty <= p.low_stock_at));
    const filteredOrders = orders.filter((o) => (matches(o.customer) || matches(o.id)) && (!status || o.status === status) && (!from || o.created_at.slice(0, 10) >= from) && (!to || o.created_at.slice(0, 10) <= to));
    const paginate = (arr) => arr.slice((page - 1) * 7, page * 7);
    const pagination = (arr) => h('div', { className: 'pagination' }, h('span', null, `Showing ${arr.length ? ((page - 1) * 7 + 1) : 0}–${Math.min(page * 7, arr.length)} of ${arr.length}`), h('div', null, h('button', { disabled: page === 1, onClick: () => setPage(page - 1) }, '← Previous'), h('button', { disabled: page * 7 >= arr.length, onClick: () => setPage(page + 1) }, 'Next →')));
    const tag = (s) => h('span', { className: 'tag ' + s }, h('i'), statusName(s));
    const empty = (what) => h('div', { className: 'empty' }, h('div', { className: 'emptyicon' }, '⌕'), h('strong', null, 'Nothing to show'), h('p', null, what));
    const heading = (title, subtitle, action = null) => h('div', { className: 'sectionhead' }, h('div', null, h('h2', null, title), h('p', null, subtitle)), action);
    const field = (label, key, type = 'text', props = {}) => h('label', { className: 'field' }, h('span', null, label), h('input', { type, value: form[key] ?? '', onChange: (e) => change(key, e.target.value), ...props }));
    const selectField = (label, key, options) => h('label', { className: 'field' }, h('span', null, label), h('select', { value: form[key] ?? '', onChange: (e) => change(key, e.target.value) }, h('option', { value: '' }, 'Select an option'), options.map((x) => h('option', { key: x.id, value: x.id }, x.name))));
    const btn = (label, onClick, cls = 'primary') => h('button', { className: 'btn ' + cls, onClick, disabled: loading }, label);
    const table = (headers, rows, emptyMessage) => h('div', { className: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, headers.map(x => h('th', { key: x }, x)))), h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colSpan: headers.length }, empty(emptyMessage))))));
    const metric = (title, value, note, icon, tone) => h('div', { className: 'metric' }, h('div', { className: 'metric-top' }, h('span', null, title), h('span', { className: 'metric-icon ' + tone }, icon)), h('strong', null, value), h('small', null, note));
    let content = null;
    if (tab === 'overview')
        content = h('div', null, h('div', { className: 'welcome' }, h('div', null, h('div', { className: 'eyebrow' }, 'TODAY AT THE COUNTER'), h('h2', null, 'Here’s the latest, ' + (user?.name.split(' ')[0] || 'team') + '.'), h('p', null, 'Orders, stock and anything that needs a second look.')), h('div', { className: 'welcome-art' }, h('span', null, 'KEEP'), h('span', null, 'COUNT.'), h('small', null, '01 / OPERATIONS'))), h('div', { className: 'metrics' }, metric('Total products', s.products || 0, 'Active catalogue items', '▦', 'purple'), metric('Items in stock', s.units || 0, 'Units across all products', '◈', 'blue'), metric('Open orders', s.active_orders || 0, 'Awaiting fulfilment', '▤', 'yellow'), metric('Low stock alerts', s.low_stock || 0, 'Products below threshold', '!', 'red')), h('div', { className: 'split' }, h('div', { className: 'panel' }, heading('Recent orders', 'Latest activity from your store', btn('View all orders', () => setTab('orders'), 'ghost')), table(['ORDER', 'CUSTOMER', 'STATUS', 'TOTAL'], (s.recent || []).map((o) => h('tr', { key: o.id, onClick: () => detail(o.id), className: 'clickable' }, h('td', { className: 'semibold' }, '#' + String(o.id).padStart(4, '0')), h('td', null, o.customer), h('td', null, tag(o.status)), h('td', { className: 'semibold' }, money(o.subtotal_cents)))), 'No orders yet')), h('div', { className: 'panel' }, heading('Needs attention', 'Products running low', btn('View stock', () => { setTab('products'); setLow(true); }, 'ghost')), (data.lowstock || []).slice(0, 5).map((p) => h('div', { className: 'attention', key: p.id }, h('span', { className: 'attention-dot' }, '!'), h('div', null, h('strong', null, p.name), h('small', null, p.sku + ' · Alert at ' + p.low_stock_at)), h('b', null, p.qty + ' left'))), !(data.lowstock || []).length && empty('All stock levels are healthy.'))));
    if (tab === 'products')
        content = h('div', null, heading('Product catalogue', 'The full shelf, without the guesswork.', admin ? btn('+ Add product', () => open('product')) : null), h('div', { className: 'toolbar' }, h('input', { placeholder: 'Search products or SKUs...', value: query, onChange: (e) => setQuery(e.target.value) }), h('label', { className: 'check' }, h('input', { type: 'checkbox', checked: low, onChange: (e) => setLow(e.target.checked) }), 'Low stock only'), h('span', { className: 'muted' }, filteredProducts.length + ' products')), h('div', { className: 'panel' }, table(['PRODUCT', 'SKU', 'CATEGORY', 'PRICE', 'STOCK', 'ACTIONS'], paginate(filteredProducts).map((p) => h('tr', { key: p.id }, h('td', null, h('div', { className: 'product-name' }, h('span', { className: 'product-visual' }, p.name[0]), h('div', null, h('strong', null, p.name), h('small', null, p.supplier || 'No supplier')))), h('td', { className: 'mono' }, p.sku), h('td', null, p.category), h('td', { className: 'semibold' }, money(p.price_cents)), h('td', null, h('span', { className: p.qty <= p.low_stock_at ? 'stock low' : 'stock good' }, p.qty <= p.low_stock_at ? '● ' : '● ', p.qty, ' units')), h('td', null, admin ? h('div', { className: 'actions' }, btn('Edit', () => open('product', p), 'small'), btn('Adjust', () => open('adjust', p), 'small')) : h('span', { className: 'muted' }, 'View only')))), 'Try another search.'), pagination(filteredProducts)));
    if (tab === 'orders')
        content = h('div', null, heading('Orders', 'From first request to delivery.', canWrite ? btn('+ New order', () => open('new-order')) : null), h('div', { className: 'toolbar' }, h('input', { placeholder: 'Search by customer or order #...', value: query, onChange: (e) => setQuery(e.target.value) }), h('select', { value: status, onChange: (e) => setStatus(e.target.value) }, h('option', { value: '' }, 'All statuses'), Object.keys(nextStates).map(x => h('option', { value: x, key: x }, statusName(x)))), h('input', { type: 'date', value: from, 'aria-label': 'From date', onChange: (e) => setFrom(e.target.value) }), h('input', { type: 'date', value: to, 'aria-label': 'To date', onChange: (e) => setTo(e.target.value) }), canWrite && btn('↓ Export CSV', () => download('orders'), 'outline')), h('div', { className: 'panel' }, table(['ORDER ID', 'CUSTOMER', 'DATE', 'STATUS', 'TOTAL', ''], paginate(filteredOrders).map((o) => h('tr', { key: o.id, className: 'clickable', onClick: () => detail(o.id) }, h('td', { className: 'semibold' }, '#' + String(o.id).padStart(4, '0')), h('td', null, o.customer), h('td', null, date(o.created_at)), h('td', null, tag(o.status)), h('td', { className: 'semibold' }, money(o.subtotal_cents)), h('td', { className: 'link' }, 'View →'))), 'No orders match these filters.'), pagination(filteredOrders)));
    if (tab === 'stock')
        content = h('div', null, heading('Stock movements', 'Every change is recorded with a reason and who made it.', admin ? btn('+ Stock adjustment', () => open('adjust')) : null), h('div', { className: 'panel' }, table(['DATE', 'PRODUCT', 'CHANGE', 'BEFORE → AFTER', 'REASON', 'CHANGED BY'], paginate(movements.filter((m) => matches(m.product) || matches(m.sku) || matches(m.reason))).map((m) => h('tr', { key: m.id }, h('td', null, date(m.created_at)), h('td', null, h('strong', null, m.product), h('small', { className: 'block' }, m.sku)), h('td', { className: m.delta > 0 ? 'positive' : 'negative' }, (m.delta > 0 ? '+' : '') + m.delta), h('td', null, m.before_qty + ' → ' + m.after_qty), h('td', null, m.reason.replaceAll('_', ' ')), h('td', null, m.actor))), 'No movements found.'), pagination(movements.filter((m) => matches(m.product) || matches(m.sku) || matches(m.reason)))));
    if (tab === 'customers')
        content = h('div', null, heading('Customers', 'People and businesses you work with.', canWrite ? btn('+ Add customer', () => open('customer')) : null), h('div', { className: 'panel' }, table(['NAME', 'EMAIL', 'PHONE'], customers.filter((c) => matches(c.name)).map((c) => h('tr', { key: c.id }, h('td', { className: 'semibold' }, c.name), h('td', null, c.email || '—'), h('td', null, c.phone || '—'))), 'No customers found.')));
    if (tab === 'suppliers')
        content = h('div', null, heading('Suppliers', 'The people who keep things supplied.', admin ? btn('+ Add supplier', () => open('supplier')) : null), h('div', { className: 'panel' }, table(['SUPPLIER', 'CONTACT'], suppliers.map((s) => h('tr', { key: s.id }, h('td', { className: 'semibold' }, s.name), h('td', null, s.contact || '—'))), 'No suppliers found.')));
    if (tab === 'reports')
        content = h('div', null, heading('Reports', 'A closer look at the numbers.'), h('div', { className: 'reportgrid' }, h('div', { className: 'reportcard' }, h('span', { className: 'report-icon' }, '▤'), h('h3', null, 'Orders report'), h('p', null, 'Order values, customers and current fulfilment statuses.'), canWrite ? btn('Download orders CSV', () => download('orders'), 'outline') : h('small', null, 'Staff access required')), h('div', { className: 'reportcard' }, h('span', { className: 'report-icon' }, '◉'), h('h3', null, 'Low stock report'), h('p', null, (data.lowstock || []).length + ' products currently need a closer look.'), canWrite ? btn('Download low-stock CSV', () => download('low-stock'), 'outline') : h('small', null, 'Staff access required'))), h('div', { className: 'panel' }, heading('Low stock watchlist', 'Based on each product’s saved threshold'), table(['SKU', 'PRODUCT', 'ON HAND', 'ALERT AT'], (data.lowstock || []).map((p) => h('tr', { key: p.id }, h('td', { className: 'mono' }, p.sku), h('td', null, p.name), h('td', null, h('span', { className: 'stock low' }, p.qty + ' units')), h('td', null, p.low_stock_at))), 'Nothing is currently low on stock.')));
    let modalBody = null;
    if (modal === 'product')
        modalBody = h('form', { onSubmit: (e) => { e.preventDefault(); const payload = { sku: form.sku, name: form.name, category: form.category || 'General', price_cents: Math.round(Number(form.price) * 100), low_stock_at: Number(form.low_stock_at ?? 5), supplier_id: form.supplier_id ? Number(form.supplier_id) : null }; save(form.id ? '/products/' + form.id : '/products', payload, form.id ? 'PATCH' : 'POST'); } }, h('h2', null, form.id ? 'Edit product' : 'Add product'), h('p', { className: 'modal-sub' }, 'Price and low-stock settings are saved on the server.'), h('div', { className: 'formgrid' }, field('Product name', 'name', 'text', { required: true }), field('SKU', 'sku', 'text', { required: true }), field('Category', 'category'), selectField('Supplier', 'supplier_id', suppliers), field('Price (PKR)', 'price', 'number', { required: true, min: 0, step: '.01' }), field('Low stock alert at', 'low_stock_at', 'number', { required: true, min: 0 })), h('div', { className: 'modal-actions' }, btn('Cancel', () => setModal(''), 'ghost'), h('button', { className: 'btn primary', type: 'submit' }, 'Save product')));
    if (modal === 'adjust')
        modalBody = h('form', { onSubmit: (e) => { e.preventDefault(); save('/stock/adjust', { product_id: Number(form.product_id || form.id), delta: Number(form.delta), reason: form.reason }); } }, h('h2', null, 'Stock adjustment'), h('p', { className: 'modal-sub' }, 'Add or remove stock. Every correction appears in the movement log.'), h('div', { className: 'formgrid' }, selectField('Product', 'product_id', products), field('Quantity change (+/-)', 'delta', 'number', { required: true, step: 1 }), field('Reason for change', 'reason', 'text', { required: true, placeholder: 'e.g. Damaged items, stock count correction' })), h('div', { className: 'modal-actions' }, btn('Cancel', () => setModal(''), 'ghost'), h('button', { className: 'btn primary', type: 'submit' }, 'Record movement')));
    if (modal === 'customer' || modal === 'supplier')
        modalBody = h('form', { onSubmit: (e) => { e.preventDefault(); save('/' + (modal === 'customer' ? 'customers' : 'suppliers'), form); } }, h('h2', null, 'Add ' + modal), h('p', { className: 'modal-sub' }, 'Keep these details up to date for your team.'), h('div', { className: 'formgrid' }, field('Name', 'name', 'text', { required: true }), modal === 'customer' ? field('Email', 'email', 'email') : null, modal === 'customer' ? field('Phone', 'phone') : field('Contact', 'contact')), h('div', { className: 'modal-actions' }, btn('Cancel', () => setModal(''), 'ghost'), h('button', { className: 'btn primary', type: 'submit' }, 'Save ' + modal)));
    if (modal === 'new-order')
        modalBody = h('form', { onSubmit: (e) => { e.preventDefault(); const clean = items.filter(i => i.product_id).map(i => ({ product_id: Number(i.product_id), qty: Number(i.qty) })); save('/orders', { customer_id: Number(form.customer_id), notes: form.notes || '', items: clean }); } }, h('h2', null, 'Create a new order'), h('p', { className: 'modal-sub' }, 'Start with a draft. Stock is reserved only when you confirm it.'), selectField('Customer', 'customer_id', customers), h('div', { className: 'rowlabel' }, 'Order items'), items.map((i, index) => h('div', { className: 'itemrow', key: index }, h('select', { required: true, value: i.product_id, onChange: (e) => setItems(items.map((v, j) => j === index ? { ...v, product_id: e.target.value } : v)) }, h('option', { value: '' }, 'Choose product'), products.map((p) => h('option', { key: p.id, value: p.id }, p.name + ' · ' + money(p.price_cents) + ' · ' + p.qty + ' left'))), h('input', { type: 'number', required: true, min: 1, value: i.qty, onChange: (e) => setItems(items.map((v, j) => j === index ? { ...v, qty: e.target.value } : v)) }), h('button', { className: 'iconbtn', type: 'button', onClick: () => setItems(items.filter((_, j) => j !== index)), disabled: items.length === 1 }, '×'))), btn('+ Add another item', () => setItems([...items, { product_id: '', qty: 1 }]), 'ghost'), field('Notes (optional)', 'notes'), h('div', { className: 'modal-actions' }, btn('Cancel', () => setModal(''), 'ghost'), h('button', { type: 'submit', className: 'btn primary' }, 'Create draft')));
    if (modal === 'order-detail' && picked?.order) {
        const o = picked.order;
        modalBody = h('div', null, h('div', { className: 'detail-head' }, h('div', null, h('div', { className: 'eyebrow' }, 'ORDER DETAILS'), h('h2', null, 'Order #' + String(o.id).padStart(4, '0'))), tag(o.status), h('p', { className: 'modal-sub' }, o.customer + ' · ' + date(o.created_at)), h('div', { className: 'detail-items' }, picked.items.map((i) => h('div', { key: i.id, className: 'detail-line' }, h('div', null, h('strong', null, i.name_snapshot), h('small', { className: 'block' }, i.qty + ' × ' + money(i.unit_price_cents))), h('b', null, money(i.unit_price_cents * i.qty)))), h('div', { className: 'detail-total' }, 'Subtotal', h('strong', null, money(o.subtotal_cents))), h('h3', null, 'Activity'), h('div', { className: 'history' }, picked.history.map((e) => h('div', { key: e.id, className: 'history-line' }, h('span', { className: 'history-dot' }), h('div', null, h('strong', null, statusName(e.to_status)), h('small', { className: 'block' }, e.actor + ' · ' + date(e.created_at))))), canWrite && nextStates[o.status].length ? h('div', { className: 'modal-actions wrap' }, nextStates[o.status].map((st) => btn(st === 'cancelled' ? 'Cancel order' : 'Mark ' + st, () => updateOrder(o.id, st), st === 'cancelled' ? 'danger' : 'primary'))) : null))));
    }
    if (!token)
        return h('div', { className: 'login-page' }, h('div', { className: 'login-side' }, h('div', { className: 'brand light' }, h('span', { className: 'brand-icon' }, 'c/'), h('span', null, 'counterpoint', h('b', null, '.'))), h('div', { className: 'login-copy' }, h('span', { className: 'eyebrow' }, 'THE EVERYDAY OPERATIONS DESK'), h('h1', null, 'Know what’s moving.', h('em', null, ' Keep things moving.')), h('p', null, 'Stock on the shelf. Orders out the door. Everything accounted for.')), h('div', { className: 'login-footer' }, 'COUNTERPOINT  /  THE RETAIL DESK')), h('div', { className: 'login-right' }, h('form', { className: 'login-card', onSubmit: login }, h('div', { className: 'login-badge' }, '✦'), h('h2', null, 'Back at the desk.'), h('p', null, 'Pick up where the last shift left off.'), h('label', { className: 'field' }, h('span', null, 'Email address'), h('input', { required: true, type: 'email', value: email, onChange: (e) => setEmail(e.target.value) })), h('label', { className: 'field' }, h('span', null, 'Password'), h('input', { required: true, type: 'password', value: password, onChange: (e) => setPassword(e.target.value) })), error && h('div', { className: 'alert' }, error), h('button', { className: 'btn primary wide', type: 'submit', disabled: loading }, loading ? 'Signing in…' : 'Sign in →'), h('div', { className: 'demo-credentials' }, h('strong', null, 'Demo access'), h('div', null, 'Admin: admin@demo.local / Admin123!'), h('div', null, 'Staff: staff@demo.local / Staff123!'), h('div', null, 'Viewer: viewer@demo.local / Viewer123!')))));
    const nav = [['overview', '▦', 'Overview'], ['products', '◈', 'Products'], ['orders', '▤', 'Orders'], ['stock', '⇅', 'Stock history'], ['customers', '♙', 'Customers'], ['suppliers', '▥', 'Suppliers'], ['reports', '◉', 'Reports']];
    return h('div', { className: 'app-shell' }, h('aside', { className: 'sidebar' }, h('div', { className: 'brand' }, h('span', { className: 'brand-icon' }, 'c/'), h('span', null, 'counterpoint', h('b', null, '.'))), h('div', { className: 'nav-caption' }, 'YOUR DESK'), h('nav', null, nav.map(([id, icon, label]) => h('button', { className: 'nav-item ' + (tab === id ? 'active' : ''), key: id, onClick: () => { setTab(id); setQuery(''); setStatus(''); setLow(false); } }, h('span', { className: 'nav-icon' }, icon), label, (id === 'reports' && s.low_stock > 0) ? h('span', { className: 'nav-count' }, s.low_stock) : null))), h('div', { className: 'sidebar-bottom' }, h('div', { className: 'helpbox' }, h('span', null, '✦'), h('strong', null, 'Keep an eye on the shelves.'), h('p', null, 'A quick stock check now saves a headache later.')), h('div', { className: 'sidebar-foot' }, 'COUNTERPOINT / 2026'))), h('main', { className: 'main' }, h('header', { className: 'topbar' }, h('div', null, h('div', { className: 'breadcrumb' }, 'COUNTERPOINT  /  ', h('strong', null, statusName(tab))), h('h1', null, tab === 'overview' ? 'The daily brief' : nav.find(n => n[0] === tab)?.[2])), h('div', { className: 'top-actions' }, h('span', { className: 'date-pill' }, new Date().toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })), h('div', { className: 'profile' }, h('span', { className: 'avatar' }, user?.name.slice(0, 1)), h('div', null, h('strong', null, user?.name), h('small', { className: 'block' }, statusName(user?.role || '')))), h('button', { className: 'signout', onClick: logout, title: 'Sign out' }, '↗'))), h('div', { className: 'page-content' }, error && h('div', { className: 'alert', role: 'alert' }, error, h('button', { onClick: () => setError('') }, '×')), notice && h('div', { className: 'notice', role: 'status' }, notice, h('button', { onClick: () => setNotice('') }, '×')), content), h('footer', { className: 'footer' }, 'Counterpoint · Retail operations', h('span', null, 'Demo environment — fictional business data'))), modal && h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            setModal(''); } }, h('div', { className: 'modal', role: 'dialog', 'aria-modal': true }, h('button', { className: 'close', onClick: () => setModal(''), 'aria-label': 'Close dialog' }, '×'), error && h('div', { className: 'alert' }, error), modalBody)));
}
ReactDOM.render(h(Root), document.getElementById('root'));
