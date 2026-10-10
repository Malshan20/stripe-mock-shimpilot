import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, scryptSync, randomBytes } from 'node:crypto';
const globalDb = globalThis as unknown as { labDb?: DatabaseSync };
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function db() {
  if (globalDb.labDb) return globalDb.labDb;
  const path = resolve(process.env.DATABASE_PATH ?? '.data/demo.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT,name TEXT NOT NULL,provider TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL,access_token TEXT);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL,summary TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,storage_path TEXT NOT NULL,provider TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS billing(user_id TEXT PRIMARY KEY REFERENCES users(id),customer_id TEXT,subscription_id TEXT,status TEXT NOT NULL DEFAULT 'free',checkout_id TEXT);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),provider TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS webhook_receipts(id TEXT PRIMARY KEY,type TEXT NOT NULL,created_at TEXT NOT NULL);`);
  const id = '00000000-0000-4000-8000-000000000001';
  database.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run(id,'demo@shimpilot.test',hashPassword('DemoPass123!'),'Malshan','mock');
  if (!database.prepare("SELECT value FROM metadata WHERE key='seeded'").get()) {
    for (const [title,description] of [
      ['Developer portal','A portal for developers to manage API keys, track usage, and browse documentation.'],
      ['Subscription billing','Monthly Pro subscriptions using Stripe Checkout, a customer portal, signed webhooks, and cancellation.'],
      ['Release notes assistant','Generate summaries of software releases and save embeddings for search.']
    ]) database.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(randomUUID(),id,title,description,null,new Date().toISOString());
  }
  database.prepare("INSERT OR IGNORE INTO metadata VALUES('seeded','true')").run();
  globalDb.labDb = database;
  return database;
}
export function logEvent(userId: string, provider: string, action: string, status: string, detail: string) {
  db().prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(randomUUID(),userId,provider,action,status,detail.slice(0,500),new Date().toISOString());
}
export type Project = {id:string;user_id:string;title:string;description:string;summary:string|null;created_at:string};
export type FileRecord = {id:string;user_id:string;name:string;mime:string;size:number;storage_path:string;provider:string;created_at:string};
export type Billing = {user_id:string;customer_id:string|null;subscription_id:string|null;status:string;checkout_id:string|null};
export function billingFor(id:string): Billing {
  db().prepare('INSERT OR IGNORE INTO billing(user_id) VALUES(?)').run(id);
  return db().prepare('SELECT * FROM billing WHERE user_id=?').get(id) as Billing;
}
