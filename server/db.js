const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff','viewer')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General', supplier_id INTEGER REFERENCES suppliers(id), price_cents INTEGER NOT NULL CHECK(price_cents>=0), qty INTEGER NOT NULL DEFAULT 0 CHECK(qty>=0), low_stock_at INTEGER NOT NULL DEFAULT 5 CHECK(low_stock_at>=0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','packed','dispatched','delivered','cancelled')), subtotal_cents INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT, cancelled_at TEXT);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), sku_snapshot TEXT NOT NULL, name_snapshot TEXT NOT NULL, unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), qty INTEGER NOT NULL CHECK(qty>0), UNIQUE(order_id, product_id));
CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), order_id INTEGER REFERENCES orders(id), delta INTEGER NOT NULL CHECK(delta!=0), before_qty INTEGER NOT NULL, after_qty INTEGER NOT NULL, reason TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(product_id,order_id,reason));
CREATE TABLE IF NOT EXISTS order_status_history(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), from_status TEXT, to_status TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_date ON stock_movements(product_id,created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
`;
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) { return salt + ':' + crypto.pbkdf2Sync(password,salt,140000,32,'sha256').toString('hex'); }
function verifyPassword(password, stored) {const [salt] = stored.split(':');const candidate=passwordHash(password,salt);return crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(stored));}
function openDb(filename=':memory:', seed=true) {
 if(filename!==':memory:') fs.mkdirSync(path.dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename); db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;'+schema);
 if(seed && !db.prepare('SELECT id FROM users LIMIT 1').get()) seedDb(db);
 return db;
}
function seedDb(db){
 const u=db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)');
 u.run('Huzaifa Haris','admin@demo.local',passwordHash('Admin123!'),'admin');
 u.run('Amna Sabahat','staff@demo.local',passwordHash('Staff123!'),'staff');
 u.run('Shanaya haris','viewer@demo.local',passwordHash('Viewer123!'),'viewer');
 const s=db.prepare('INSERT INTO suppliers(name,contact) VALUES(?,?)');
 [['Noble Paper Co.','accounts@noble.example'],['Westline Distribution','sales@westline.example'],['Cedar Supply','contact@cedar.example']].forEach(x=>s.run(...x));
 const c=db.prepare('INSERT INTO customers(name,email,phone) VALUES(?,?,?)');
 [['Ayesha Malik','ayesha@example.test','0300-0000011'],['Bilal Ahmed','bilal@example.test','0300-0000012'],['Kiran Traders','orders@kiran.example','0300-0000013'],['Northside Studio','studio@example.test','0300-0000014']].forEach(x=>c.run(...x));
 const p=db.prepare('INSERT INTO products(sku,name,category,supplier_id,price_cents,qty,low_stock_at) VALUES(?,?,?,?,?,?,?)');
 [['ST-101','A5 Dotted Notebook','Stationery',1,125000,38,10],['ST-102','Brass Desk Pen','Stationery',1,89000,17,8],['DS-201','Canvas Laptop Sleeve','Accessories',2,320000,9,10],['DS-202','Walnut Desk Organizer','Workspace',3,485000,6,8],['AC-301','Ceramic Coffee Cup','Lifestyle',3,195000,24,8],['AC-302','Minimalist Tote Bag','Accessories',2,220000,4,6],['ST-103','Weekly Planner Pad','Stationery',1,75000,52,10],['DS-203','LED Reading Lamp','Workspace',2,570000,12,5]].forEach(x=>p.run(...x));
 // Seed completed and open orders with consistent stock reservations and history.
 const o=db.prepare('INSERT INTO orders(customer_id,status,subtotal_cents,notes,created_by,confirmed_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)');
 const it=db.prepare('INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_cents,qty) VALUES(?,?,?,?,?,?)');
 const hist=db.prepare('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,detail) VALUES(?,?,?,?,?)');
 [[1,'delivered',1,2],[2,'dispatched',3,1],[3,'packed',5,3],[4,'confirmed',2,1]].forEach(([customer,status,productId,qty])=>{
  const product=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  const id=Number(o.run(customer,status,product.price_cents*qty,'Seeded example order',1).lastInsertRowid);
  it.run(id,productId,product.sku,product.name,product.price_cents,qty);
  db.prepare('UPDATE products SET qty=qty-? WHERE id=?').run(qty,productId);
  hist.run(id,null,status,1,'Initial demo record');
  db.prepare('INSERT INTO stock_movements(product_id,order_id,delta,before_qty,after_qty,reason,actor_id) VALUES(?,?,?,?,?,?,?)').run(productId,id,-qty,product.qty,product.qty-qty,'order_confirmed',1);
 });
}
module.exports={openDb,passwordHash,verifyPassword,schema};
