const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {openDb,verifyPassword}=require('./db');

function createApp({db=openDb(process.env.DB_FILE||path.join(__dirname,'data','store.sqlite'))}={}) {
 const query=(sql,...args)=>db.prepare(sql).all(...args);
 const one=(sql,...args)=>db.prepare(sql).get(...args);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 const fail=(status,message)=>{const e=new Error(message); e.status=status;throw e;};
 const tx=(fn)=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const int=(v,name,min=0,max=1000000)=>{if(!Number.isSafeInteger(Number(v)) || v==='' || v===null || v===undefined || Number(v)<min || Number(v)>max)fail(400,`Invalid ${name}`);return Number(v)};
 const str=(v,name,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,`Invalid ${name}`);return v.trim();};
 const cents=(v)=>int(v,'price_cents',0,1000000000);
 const role=(user,allowed)=>{if(!allowed.includes(user.role))fail(403,'You do not have permission for this action');};
 const allowedTransitions={draft:['confirmed','cancelled'],confirmed:['packed','cancelled'],packed:['dispatched','cancelled'],dispatched:['delivered'],delivered:[],cancelled:[]};
 function auth(req){const token=(req.headers.authorization||'').replace(/^Bearer /i,'');if(!token)fail(401,'Please sign in');const hash=crypto.createHash('sha256').update(token).digest('hex');const user=one('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',hash,Date.now());if(!user)fail(401,'Session expired. Please sign in again');return user;}
 function json(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data));}
 function csv(res,filename,headers,rows){const esc=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,v=>"'"+v).replace(/"/g,'""')+'"'; const out=[headers.map(esc).join(','),...rows.map(r=>r.map(esc).join(','))].join('\r\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'});res.end('\uFEFF'+out);}
 function page(url){return {limit:int(url.searchParams.get('limit')||10,'limit',1,100),offset:(int(url.searchParams.get('page')||1,'page',1,100000)-1)*int(url.searchParams.get('limit')||10,'limit',1,100)};}
 async function handler(req,res){
  try{
   const url=new URL(req.url,'http://localhost'); const pathname=url.pathname;const method=req.method;
   if(pathname==='/api/health')return json(res,200,{ok:true,app:'Fieldwork Store'});
   if(!pathname.startsWith('/api/'))return serve(req,res,pathname);
   let body={};if(['POST','PATCH','PUT'].includes(method)) {let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>50000)fail(413,'Request too large');}try{body=raw?JSON.parse(raw):{};}catch{fail(400,'Invalid JSON');}if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid request body');}
   if(pathname==='/api/login'&&method==='POST'){
    const user=one('SELECT * FROM users WHERE email=?',String(body.email||'').toLowerCase());if(!user||typeof body.password!=='string'||!verifyPassword(body.password,user.password_hash))fail(401,'Incorrect email or password');
    const token=crypto.randomBytes(32).toString('hex');run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',crypto.createHash('sha256').update(token).digest('hex'),user.id,Date.now()+86400000);
    return json(res,200,{token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
   }
   const user=auth(req);
   if(pathname==='/api/me'&&method==='GET')return json(res,200,{user});
   if(pathname==='/api/logout'&&method==='POST'){const token=req.headers.authorization.replace(/^Bearer /i,'');run('DELETE FROM sessions WHERE token_hash=?',crypto.createHash('sha256').update(token).digest('hex'));return json(res,200,{ok:true});}
   if(pathname==='/api/summary'&&method==='GET'){
    const stock=one('SELECT COUNT(*) products,COALESCE(SUM(qty),0) units,COUNT(*) FILTER (WHERE qty<=low_stock_at AND active=1) low_stock FROM products WHERE active=1');
    const orders=one("SELECT COUNT(*) orders,COUNT(*) FILTER (WHERE status IN ('confirmed','packed','dispatched')) active_orders,COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','draft') THEN subtotal_cents END),0) revenue_cents FROM orders");
    return json(res,200,{...stock,...orders,recent:query('SELECT o.id,o.status,o.subtotal_cents,o.created_at,c.name customer FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC LIMIT 6')});
   }
   if(pathname==='/api/suppliers'){
    if(method==='GET')return json(res,200,{items:query('SELECT * FROM suppliers ORDER BY name')});
    if(method==='POST'){role(user,['admin']);const id=Number(run('INSERT INTO suppliers(name,contact) VALUES(?,?)',str(body.name,'name'),String(body.contact||'').slice(0,200)).lastInsertRowid);return json(res,201,{id});}
   }
   if(pathname==='/api/customers'){
    if(method==='GET')return json(res,200,{items:query('SELECT * FROM customers ORDER BY name')});
    if(method==='POST'){role(user,['admin','staff']);const id=Number(run('INSERT INTO customers(name,email,phone) VALUES(?,?,?)',str(body.name,'name'),String(body.email||'').slice(0,200),String(body.phone||'').slice(0,50)).lastInsertRowid);return json(res,201,{id});}
   }
   if(pathname==='/api/products'&&method==='GET'){
    const {limit,offset}=page(url);const search='%'+String(url.searchParams.get('q')||'').slice(0,100)+'%';const low=url.searchParams.get('low')==='1'?1:0;
    const filter='p.active=1 AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?) AND (?=0 OR p.qty<=p.low_stock_at)';const args=[search,search,search,low];
    return json(res,200,{items:query(`SELECT p.*,s.name supplier FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE ${filter} ORDER BY p.id DESC LIMIT ? OFFSET ?`,...args,limit,offset),total:one(`SELECT COUNT(*) n FROM products p WHERE ${filter}`,...args).n});
   }
   if(pathname==='/api/products'&&method==='POST'){
    role(user,['admin']);const data=[str(body.sku,'sku',60),str(body.name,'name'),str(body.category||'General','category'),body.supplier_id?int(body.supplier_id,'supplier_id',1):null,cents(body.price_cents),int(body.low_stock_at??5,'low_stock_at',0)];
    const id=Number(run('INSERT INTO products(sku,name,category,supplier_id,price_cents,low_stock_at) VALUES(?,?,?,?,?,?)',...data).lastInsertRowid);return json(res,201,{id});
   }
   const pm=pathname.match(/^\/api\/products\/(\d+)$/);
   if(pm&&method==='PATCH'){role(user,['admin']);const id=int(pm[1],'id',1);if(!one('SELECT id FROM products WHERE id=?',id))fail(404,'Product not found');const patches=[];const vals=[];
    for(const k of ['sku','name','category'])if(body[k]!==undefined){patches.push(k+'=?');vals.push(str(body[k],k));}
    for(const k of ['price_cents','low_stock_at'])if(body[k]!==undefined){patches.push(k+'=?');vals.push(int(body[k],k,0,k==='price_cents'?1000000000:1000000));}
    if(body.supplier_id!==undefined){patches.push('supplier_id=?');vals.push(body.supplier_id===null?null:int(body.supplier_id,'supplier_id',1));}
    if(!patches.length)fail(400,'Nothing to update');run(`UPDATE products SET ${patches.join(',')} WHERE id=?`,...vals,id);return json(res,200,{item:one('SELECT * FROM products WHERE id=?',id)});
   }
   if(pathname==='/api/stock/adjust'&&method==='POST'){
    role(user,['admin']);const id=int(body.product_id,'product_id',1),delta=int(Math.abs(Number(body.delta)),'delta',1,100000)*(Number(body.delta)<0?-1:1);const reason=str(body.reason,'reason',300);
    const result=tx(()=>{const p=one('SELECT * FROM products WHERE id=? AND active=1',id);if(!p)fail(404,'Product not found');if(p.qty+delta<0)fail(409,'Not enough stock for this adjustment');run('UPDATE products SET qty=qty+? WHERE id=?',delta,id);const movementId=Number(run('INSERT INTO stock_movements(product_id,delta,before_qty,after_qty,reason,actor_id) VALUES(?,?,?,?,?,?)',id,delta,p.qty,p.qty+delta,'manual: '+reason,user.id).lastInsertRowid);return {movementId,quantity:p.qty+delta};});return json(res,201,result);
   }
   if(pathname==='/api/stock/movements'&&method==='GET'){
    const {limit,offset}=page(url);const id=url.searchParams.get('product_id');const filter=id?'WHERE m.product_id=?':'';const args=id?[int(id,'product_id',1)]:[];
    return json(res,200,{items:query(`SELECT m.*,p.name product,p.sku,u.name actor FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN users u ON u.id=m.actor_id ${filter} ORDER BY m.id DESC LIMIT ? OFFSET ?`,...args,limit,offset),total:one(`SELECT COUNT(*) n FROM stock_movements m ${filter}`,...args).n});
   }
   if(pathname==='/api/orders'&&method==='POST'){
    role(user,['admin','staff']);const customerId=int(body.customer_id,'customer_id',1);if(!one('SELECT id FROM customers WHERE id=?',customerId))fail(400,'Unknown customer');if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)fail(400,'Add at least one item');
    const ids=new Set(); const items=body.items.map(i=>{const id=int(i.product_id,'product_id',1),qty=int(i.qty,'quantity',1,10000);if(ids.has(id))fail(400,'Duplicate product in order');ids.add(id);const p=one('SELECT * FROM products WHERE id=? AND active=1',id);if(!p)fail(400,'Product unavailable');return {p,qty};});
    const result=tx(()=>{const subtotal=items.reduce((sum,i)=>sum+i.p.price_cents*i.qty,0);if(!Number.isSafeInteger(subtotal)||subtotal>100000000000)fail(400,'Order total is too large');const id=Number(run('INSERT INTO orders(customer_id,subtotal_cents,notes,created_by) VALUES(?,?,?,?)',customerId,subtotal,String(body.notes||'').slice(0,1000),user.id).lastInsertRowid);for(const {p,qty} of items)run('INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_cents,qty) VALUES(?,?,?,?,?,?)',id,p.id,p.sku,p.name,p.price_cents,qty);run('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,detail) VALUES(?,?,?,?,?)',id,null,'draft',user.id,'Order created');return {id,status:'draft',subtotal_cents:subtotal};});return json(res,201,result);
   }
   if(pathname==='/api/orders'&&method==='GET'){
    const {limit,offset}=page(url);const status=String(url.searchParams.get('status')||''),search=String(url.searchParams.get('q')||'').slice(0,100),from=String(url.searchParams.get('from')||''),to=String(url.searchParams.get('to')||'');
    if(status&&!Object.keys(allowedTransitions).includes(status))fail(400,'Invalid status');for(const date of [from,to])if(date&&!/^\d{4}-\d\d-\d\d$/.test(date))fail(400,'Invalid date');
    const filter="(?='' OR o.status=?) AND (?='' OR c.name LIKE ? OR CAST(o.id AS TEXT) LIKE ?) AND (?='' OR date(o.created_at)>=?) AND (?='' OR date(o.created_at)<=?)";
    const args=[status,status,search,'%'+search+'%','%'+search+'%',from,from,to,to];
    return json(res,200,{items:query(`SELECT o.*,c.name customer FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${filter} ORDER BY o.id DESC LIMIT ? OFFSET ?`,...args,limit,offset),total:one(`SELECT COUNT(*) n FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${filter}`,...args).n});
   }
   const om=pathname.match(/^\/api\/orders\/(\d+)$/);
   if(om&&method==='GET'){const id=int(om[1],'id',1);const order=one('SELECT o.*,c.name customer FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?',id);if(!order)fail(404,'Order not found');return json(res,200,{order,items:query('SELECT * FROM order_items WHERE order_id=?',id),history:query('SELECT h.*,u.name actor FROM order_status_history h JOIN users u ON u.id=h.actor_id WHERE h.order_id=? ORDER BY h.id',id)});}
   if(om&&method==='PATCH'){
    role(user,['admin','staff']);const id=int(om[1],'id',1),status=str(body.status,'status');const result=tx(()=>{
      const order=one('SELECT * FROM orders WHERE id=?',id);if(!order)fail(404,'Order not found');if(order.status===status)return {id,status,unchanged:true};if(!(allowedTransitions[order.status]||[]).includes(status))fail(409,`Cannot move from ${order.status} to ${status}`);
      const items=query('SELECT * FROM order_items WHERE order_id=? ORDER BY product_id',id);
      if(status==='confirmed'){
       for(const item of items){const product=one('SELECT qty FROM products WHERE id=?',item.product_id);if(product.qty<item.qty)fail(409,`Not enough stock for ${item.name_snapshot} (${product.qty} available)`);}
       for(const item of items){const before=one('SELECT qty FROM products WHERE id=?',item.product_id).qty;run('UPDATE products SET qty=qty-? WHERE id=?',item.qty,item.product_id);run('INSERT INTO stock_movements(product_id,order_id,delta,before_qty,after_qty,reason,actor_id) VALUES(?,?,?,?,?,?,?)',item.product_id,id,-item.qty,before,before-item.qty,'order_confirmed',user.id);}
      }
      if(status==='cancelled'&&order.status!=='draft')for(const item of items){const before=one('SELECT qty FROM products WHERE id=?',item.product_id).qty;run('UPDATE products SET qty=qty+? WHERE id=?',item.qty,item.product_id);run('INSERT INTO stock_movements(product_id,order_id,delta,before_qty,after_qty,reason,actor_id) VALUES(?,?,?,?,?,?,?)',item.product_id,id,item.qty,before,before+item.qty,'order_cancelled',user.id);}
      run('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP,confirmed_at=CASE WHEN ?=\'confirmed\' THEN CURRENT_TIMESTAMP ELSE confirmed_at END,cancelled_at=CASE WHEN ?=\'cancelled\' THEN CURRENT_TIMESTAMP ELSE cancelled_at END WHERE id=?',status,status,status,id);
      run('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,detail) VALUES(?,?,?,?,?)',id,order.status,status,user.id,String(body.detail||'').slice(0,500));return {id,status,unchanged:false};
    });return json(res,200,result);
   }
   if(pathname==='/api/reports/low-stock'&&method==='GET')return json(res,200,{items:query('SELECT id,sku,name,category,qty,low_stock_at FROM products WHERE active=1 AND qty<=low_stock_at ORDER BY qty ASC')});
   if(pathname==='/api/reports/low-stock.csv'&&method==='GET'){role(user,['admin','staff']);const rows=query('SELECT sku,name,category,qty,low_stock_at FROM products WHERE active=1 AND qty<=low_stock_at ORDER BY qty');return csv(res,'low-stock.csv',['SKU','Product','Category','On hand','Threshold'],rows.map(r=>[r.sku,r.name,r.category,r.qty,r.low_stock_at]));}
   if(pathname==='/api/reports/orders.csv'&&method==='GET'){
    role(user,['admin','staff']);const rows=query('SELECT o.id,c.name customer,o.status,o.subtotal_cents,o.created_at FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC');return csv(res,'orders.csv',['Order','Customer','Status','Subtotal (PKR)','Date'],rows.map(r=>[r.id,r.customer,r.status,(r.subtotal_cents/100).toFixed(2),r.created_at]));
   }
   return fail(404,'Endpoint not found');
  }catch(e){const status=e.status||(String(e.message).includes('UNIQUE constraint')?409:500);if(status===500)console.error('Request error',e);json(res,status,{error:status===500?'Unexpected server error':e.message});}
 }
 function serve(req,res,pathname){if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});const root=path.resolve(__dirname,'../client');let file=pathname==='/'?'index.html':pathname.replace(/^\//,''); const full=path.resolve(root,file);if(!(full===root||full.startsWith(root+path.sep)))return json(res,403,{error:'Forbidden'});const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};try{const data=fs.readFileSync(full);res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);}catch{return json(res,404,{error:'Not found'});}}
 return {handler,db,server:()=>http.createServer(handler)};
}
if(require.main===module){const app=createApp();const port=Number(process.env.PORT)||4173;app.server().listen(port,()=>console.log(`Fieldwork Store ready at http://localhost:${port}`));}
module.exports={createApp};
