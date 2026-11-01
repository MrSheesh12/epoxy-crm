CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,name TEXT,salt TEXT,hash TEXT,role TEXT DEFAULT 'admin');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER,created_at TEXT);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT,address TEXT,city TEXT,notes TEXT,sms_opt_in INTEGER DEFAULT 0,created_at TEXT);
CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY,customer_id INTEGER,name TEXT,phone TEXT,email TEXT,address TEXT,source TEXT DEFAULT 'Manual',status TEXT DEFAULT 'New',project_type TEXT,sq_ft REAL,notes TEXT,meta_lead_id TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS activities(id INTEGER PRIMARY KEY,customer_id INTEGER,lead_id INTEGER,type TEXT,text TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS quotes(id INTEGER PRIMARY KEY,customer_id INTEGER,lead_id INTEGER,title TEXT,status TEXT DEFAULT 'Draft',items TEXT DEFAULT '[]',tax_rate REAL DEFAULT 0,discount REAL DEFAULT 0,notes TEXT,valid_until TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS crews(id INTEGER PRIMARY KEY,name TEXT,members TEXT,color TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,customer_id INTEGER,quote_id INTEGER,title TEXT,address TEXT,start_date TEXT,end_date TEXT,crew_id INTEGER,status TEXT DEFAULT 'Scheduled',total REAL DEFAULT 0,notes TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,customer_id INTEGER,job_id INTEGER,number TEXT,status TEXT DEFAULT 'Unpaid',items TEXT DEFAULT '[]',tax_rate REAL DEFAULT 0,total REAL DEFAULT 0,due_date TEXT,notes TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,invoice_id INTEGER,amount REAL,method TEXT,kind TEXT DEFAULT 'Payment',paid_on TEXT,note TEXT,created_at TEXT);
-- SMS placeholder for future Twilio integration (not used in v1)
CREATE TABLE IF NOT EXISTS sms_messages(id INTEGER PRIMARY KEY,customer_id INTEGER,lead_id INTEGER,direction TEXT,to_number TEXT,from_number TEXT,body TEXT,status TEXT,twilio_sid TEXT,created_at TEXT);
