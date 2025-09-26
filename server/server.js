
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const {google} = require('googleapis');
const Twilio = require('twilio');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple DB (SQLite)
const DB_PATH = path.join(__dirname, 'psykeros.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT, service TEXT, datetime TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

/**
 * Google Calendar integration (skeleton).
 * - Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in env.
 * - Create OAuth2Client and generate auth URL. After consent, exchange code and store tokens securely (e.g., in DB or secrets manager).
 */
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || '',
  process.env.GOOGLE_CLIENT_SECRET || '',
  process.env.GOOGLE_REDIRECT_URI || ''
);

// Scopes for calendar access
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

app.get('/api/google-auth-url', (req, res) => {
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({url});
});

// Callback endpoint (must match redirect URI)
app.get('/google-oauth2callback', async (req, res) => {
  const code = req.query.code;
  if(!code) return res.status(400).send('Missing code');
  try{
    const {tokens} = await oAuth2Client.getToken(code);
    // Save tokens.refresh_token securely (DB or secrets manager). Here we write to a local file for demo only.
    fs.writeFileSync(path.join(__dirname, 'google_tokens.json'), JSON.stringify(tokens, null,2));
    res.send('Google OAuth successful. Tokens saved (demo). You can close this window.');
  }catch(e){
    console.error(e);
    res.status(500).send('OAuth exchange failed');
  }
});

// Example: create event on primary calendar using stored tokens
app.post('/api/calendar/create-event', async (req, res) => {
  // Expected: {summary, description, startISO, endISO}
  const {summary, description, startISO, endISO} = req.body;
  try{
    // Load tokens (demo). In prod, fetch from DB per user.
    const tokPath = path.join(__dirname, 'google_tokens.json');
    if(!fs.existsSync(tokPath)) return res.status(500).json({error:'Google tokens not configured'});
    const tokens = JSON.parse(fs.readFileSync(tokPath));
    oAuth2Client.setCredentials(tokens);
    const calendar = google.calendar({version:'v3', auth:oAuth2Client});
    const event = {
      summary: summary || 'Cita Psykeros',
      description: description || '',
      start: {dateTime: startISO},
      end: {dateTime: endISO}
    };
    const created = await calendar.events.insert({calendarId:'primary', requestBody: event});
    res.json({created: created.data});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
});


/**
 * Secure PDF upload for professional documents (e.g., degrees).
 * - Uses multer to store files under server/uploads/{userId}/
 * - In production: protect with authentication and file scanning.
 */
const uploadDir = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive:true});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const sub = path.join(uploadDir, 'docs');
    if(!fs.existsSync(sub)) fs.mkdirSync(sub, {recursive:true});
    cb(null, sub);
  },
  filename: function (req, file, cb) {
    // keep original name but prefix timestamp
    const name = Date.now() + '_' + file.originalname.replace(/\s+/g,'_');
    cb(null, name);
  }
});
const upload = multer({ 
  storage,
  limits: {fileSize: 5 * 1024 * 1024}, // 5MB limit
  fileFilter: function (req, file, cb) {
    if(file.mimetype !== 'application/pdf') return cb(new Error('Only PDFs allowed'));
    cb(null, true);
  }
});

// Admin check (demo): compare with ADMIN_EMAIL/ADMIN_PASS from env or require a token
function adminCheck(req, res, next){
  // For demo accept a header x-admin-key == ADMIN_PASS (not secure). Replace with proper auth.
  const key = req.headers['x-admin-key'];
  if(!key || key !== process.env.ADMIN_PASS) return res.status(401).json({error:'unauthorized'});
  next();
}

app.post('/api/upload-pdf', adminCheck, upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).json({error:'missing file'});
  // Save metadata in DB if desired
  res.json({message:'File uploaded', path: '/server/uploads/docs/' + req.file.filename});
});


/**
 * Nodemailer setup for contact form emails (requires SMTP env vars)
 */
let mailerTransport = null;
if(process.env.SMTP_HOST){
  mailerTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

app.post('/api/contact', async (req, res)=>{
  const {name,email,message} = req.body;
  if(!name || !email || !message) return res.status(400).json({error:'missing'});
  // Send notification email to clinic if transport configured
  if(mailerTransport){
    try{
      await mailerTransport.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@example.com',
        to: process.env.SMTP_USER,
        subject: `Contacto desde sitio: ${name}`,
        text: `De: ${name} <${email}>\n\n${message}`
      });
    }catch(e){
      console.error('Mail send failed', e);
    }
  }
  res.json({message:'Mensaje recibido. Gracias.'});
});

/**
 * Twilio SMS example: send confirmation SMS for an appointment
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
let twClient = null;
if(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN){
  twClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

app.post('/api/send-sms', async (req,res)=>{
  const {to, body} = req.body;
  if(!to || !body) return res.status(400).json({error:'missing'});
  if(!twClient) return res.status(500).json({error:'Twilio not configured'});
  try{
    const msg = await twClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });
    res.json({sid: msg.sid});
  }catch(e){
    console.error(e);
    res.status(500).json({error: e.message});
  }
});



// Appointments endpoint (create)
app.post('/api/appointments', (req, res)=>{
  const {name,email,phone,service,datetime} = req.body;
  if(!name || !email || !phone || !service || !datetime) return res.status(400).json({error:'missing fields'});
  db.run(`INSERT INTO appointments (name,email,phone,service,datetime) VALUES (?,?,?,?,?)`, [name,email,phone,service,datetime], function(err){
    if(err) return res.status(500).json({error:err.message});
    // Here: add Google Calendar integration (use OAuth2) - placeholder
    res.json({message:'Cita creada', id: this.lastID});
  });
});

// Get appointments (protected - simple token auth)
const SECRET = process.env.SECRET || 'change_this_secret';
app.get('/api/appointments', (req,res)=>{
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({error:'unauthorized'});
  const token = auth.split(' ')[1];
  try{
    jwt.verify(token, SECRET);
  }catch(e){
    return res.status(401).json({error:'invalid token'});
  }
  db.all(`SELECT * FROM appointments ORDER BY datetime DESC LIMIT 200`, [], (err, rows)=> {
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Simple contact endpoint
app.post('/api/contact', (req,res)=>{
  const {name,email,message} = req.body;
  if(!name || !email || !message) return res.status(400).json({error:'missing'});
  // Send email logic: configure nodemailer with env vars
  res.json({message:'Mensaje recibido. Gracias.'});
});

// Testimonials
app.get('/api/testimonials', (req,res)=>{
  db.all(`SELECT * FROM testimonials ORDER BY created_at DESC LIMIT 20`, [], (err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});
app.post('/api/testimonials', (req,res)=>{
  const {author,content} = req.body;
  if(!author || !content) return res.status(400).json({error:'missing'});
  db.run(`INSERT INTO testimonials (author,content) VALUES (?,?)`, [author,content], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({id:this.lastID});
  });
});

// Simple user auth (for client portal)
app.post('/api/register', async (req,res)=>{
  const {email,password,name} = req.body;
  if(!email || !password) return res.status(400).json({error:'missing'});
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (email,password,name) VALUES (?,?,?)`, [email,hash,name], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({message:'user created'});
  });
});
app.post('/api/login', (req,res)=>{
  const {email,password} = req.body;
  if(!email || !password) return res.status(400).json({error:'missing'});
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err,user)=>{
    if(err) return res.status(500).json({error:err.message});
    if(!user) return res.status(401).json({error:'invalid'});
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({error:'invalid'});
    const token = jwt.sign({id:user.id,email:user.email}, SECRET, {expiresIn:'8h'});
    res.json({token});
  });
});

// Static files for client portal (simple)
app.get('/portal', (req,res)=> {
  res.sendFile(path.join(__dirname, '..', 'public', 'portal.html'));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));
