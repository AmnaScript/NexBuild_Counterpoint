const fs=require('node:fs');const path=require('node:path');
const base=process.env.DB_FILE||path.join(__dirname,'..','server','data','store.sqlite');
for(const suffix of ['','-shm','-wal']){try{fs.unlinkSync(base+suffix);console.log('Deleted',base+suffix)}catch(e){if(e.code!=='ENOENT')throw e;}}
console.log('Database reset. Launch the server to seed the demo again.');
