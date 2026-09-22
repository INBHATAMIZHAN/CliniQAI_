import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ override: true });

const db = new Database("cliniq.db");
db.pragma("foreign_keys = ON");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    phone TEXT UNIQUE,
    blood_group TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    past_illness TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_name TEXT,
    symptoms TEXT,
    medicines TEXT, -- JSON string
    date TEXT,
    image_data TEXT, -- Base64 for offline storage
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    bp TEXT,
    weight REAL,
    symptoms TEXT,
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    type TEXT,
    message TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS private_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT,
    staff_name TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_lab_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    patient_name TEXT,
    staff_id TEXT,
    staff_name TEXT,
    content TEXT,
    image_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT,
    doctor_name TEXT,
    time TEXT,
    reason TEXT,
    date TEXT DEFAULT (date('now', 'localtime')),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default users if empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("admin", "admin123", "admin", "System Admin");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("sarah", "sarah123", "doctor", "Dr. Sarah");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("james", "james123", "doctor", "Dr. James");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("nurse", "nurse123", "nurse", "Nurse Meena");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("asha", "asha123", "asha", "Asha Worker Lakshmi");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("ramesh", "ramesh123", "patient", "Ramesh Kumar");
} else {
  // Ensure Dr. Sharma is removed if it exists
  db.prepare("DELETE FROM users WHERE username = 'doctor' AND name = 'Dr. Sharma'").run();
}

// Seed default patient if empty
const patientCount = db.prepare("SELECT count(*) as count FROM patients").get() as { count: number };
if (patientCount.count === 0) {
  db.prepare("INSERT INTO patients (name, age, phone, blood_group, allergies, chronic_conditions, past_illness) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "Ramesh Kumar", 
    45, 
    "+91 98765 43210", 
    "O+", 
    "None", 
    "Diabetes", 
    "None"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { username, password, name, role, hospitalCode } = req.body;
    
    // Restriction: Only Doctor, Nurse and Patient can register
    if (role !== 'doctor' && role !== 'nurse' && role !== 'patient') {
      return res.status(403).json({ error: "Only Doctors, Nurses and Patients can register via this portal." });
    }

    // Hospital Code validation for staff
    if ((role === 'doctor' || role === 'nurse') && hospitalCode !== 'inba123') {
      return res.status(403).json({ error: "Invalid Hospital Code. Access Denied." });
    }

    try {
      const result = db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(username, password, name, role);
      res.json({ id: result.lastInsertRowid, username, name, role });
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.get("/api/stats", (req, res) => {
    const totalPatients = db.prepare("SELECT count(*) as count FROM patients").get() as { count: number };
    const todayVisits = db.prepare(`
      SELECT count(DISTINCT patient_id) as count 
      FROM (
        SELECT patient_id FROM prescriptions WHERE date(date) = date('now', 'localtime')
        UNION 
        SELECT patient_id FROM vitals WHERE date(recorded_at) = date('now', 'localtime')
      )
    `).get() as { count: number };
    const activeCases = db.prepare("SELECT count(DISTINCT patient_id) as count FROM alerts WHERE status = 'active'").get() as { count: number };
    const pendingLabs = db.prepare("SELECT count(*) as count FROM pending_lab_results").get() as { count: number };
    
    // Get today's appointments for a specific doctor if provided
    const doctorName = req.query.doctor_name as string;
    let todayAppointments = 0;
    if (doctorName) {
      const apptCount = db.prepare("SELECT count(*) as count FROM appointments WHERE doctor_name = ? AND date = date('now', 'localtime')").get(doctorName) as any;
      todayAppointments = apptCount.count;
    } else {
      const apptCount = db.prepare("SELECT count(*) as count FROM appointments WHERE date = date('now', 'localtime')").get() as any;
      todayAppointments = apptCount.count;
    }

    res.json({
      totalPatients: totalPatients.count,
      todayVisits: todayVisits.count,
      activeCases: activeCases.count,
      pendingLabs: pendingLabs.count,
      todayAppointments
    });
  });

  app.get("/api/doctors", (req, res) => {
    const doctors = db.prepare("SELECT name FROM users WHERE role = 'doctor'").all();
    res.json(doctors);
  });

  app.get("/api/appointments", (req, res) => {
    const doctorName = req.query.doctor_name as string;
    let appointments;
    if (doctorName) {
      appointments = db.prepare("SELECT * FROM appointments WHERE doctor_name = ? AND date = date('now', 'localtime') ORDER BY time ASC").all(doctorName);
    } else {
      appointments = db.prepare("SELECT * FROM appointments WHERE date = date('now', 'localtime') ORDER BY time ASC").all();
    }
    res.json(appointments);
  });

  app.post("/api/appointments", (req, res) => {
    const { patientName, doctorName, time, reason } = req.body;
    if (!patientName || !doctorName || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = db.prepare("INSERT INTO appointments (patient_name, doctor_name, time, reason) VALUES (?, ?, ?, ?)").run(
      patientName,
      doctorName,
      time,
      reason
    );
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/recent-activity", (req, res) => {
    const activities: any[] = [];
    
    // 1. Recent Prescriptions
    const prescriptions = db.prepare(`
      SELECT 'prescription' as type, doctor_name as user, patient_id, date as time, 'Prescription sent for Patient #' || patient_id as message
      FROM prescriptions 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...prescriptions);

    // 2. Recent Vitals
    const vitals = db.prepare(`
      SELECT 'vitals' as type, recorded_by as user, patient_id, recorded_at as time, recorded_by || ' updated Patient #' || patient_id || ' vitals' as message
      FROM vitals 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...vitals);

    // 3. Recent Lab Results
    const labs = db.prepare(`
      SELECT 'lab' as type, staff_name as user, patient_id, created_at as time, 'Lab Result received: Patient #' || patient_id as message
      FROM pending_lab_results 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...labs);

    // 4. Recent Appointments
    const appts = db.prepare(`
      SELECT 'appointment' as type, doctor_name as user, 0 as patient_id, created_at as time, 'New appointment: ' || patient_name as message
      FROM appointments 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...appts);

    // Sort all by time descending
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json(activities.slice(0, 10));
  });

  app.get("/api/patients", (req, res) => {
    const patients = db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
    res.json(patients);
  });

  app.get("/api/patients/search", (req, res) => {
    const { q } = req.query;
    const patients = db.prepare("SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? OR id = ?").all(`%${q}%`, `%${q}%`, q);
    res.json(patients);
  });

  app.get("/api/patients/:id", (req, res) => {
    const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const prescriptions = db.prepare("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC").all(req.params.id);
    const vitals = db.prepare("SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC").all(req.params.id);
    const alerts = db.prepare("SELECT * FROM alerts WHERE patient_id = ? AND status = 'active'").all(req.params.id);
    res.json({ ...patient as any, prescriptions, vitals, alerts });
  });

  app.post("/api/patients", (req, res) => {
    const { name, age, phone, blood_group, allergies, chronic_conditions, past_illness } = req.body;
    try {
      const result = db.prepare("INSERT INTO patients (name, age, phone, blood_group, allergies, chronic_conditions, past_illness) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, age, phone, blood_group, allergies, chronic_conditions, past_illness);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  const getValidPatientId = (id: any) => {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return 1;
    const exists = db.prepare("SELECT id FROM patients WHERE id = ?").get(parsedId);
    return exists ? parsedId : 1;
  };

  app.post("/api/prescriptions", (req, res) => {
    const { patient_id, doctor_name, symptoms, medicines, date, image_data } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO prescriptions (patient_id, doctor_name, symptoms, medicines, date, image_data) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, doctor_name, symptoms, JSON.stringify(medicines), date, image_data);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/vitals", (req, res) => {
    const { patient_id, bp, weight, symptoms, notes, recorded_by } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO vitals (patient_id, bp, weight, symptoms, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, bp, weight, symptoms, notes, recorded_by);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/alerts", (req, res) => {
    const { patient_id, type, message } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO alerts (patient_id, type, message) VALUES (?, ?, ?)").run(sanitizedPatientId, type, message);
    res.json({ id: result.lastInsertRowid });
  });

  // Private Data Endpoints
  app.get("/api/private-data", (req, res) => {
    const data = db.prepare("SELECT * FROM private_data ORDER BY created_at DESC").all();
    res.json(data);
  });

  app.post("/api/private-data", (req, res) => {
    const { staff_id, staff_name, content } = req.body;
    const result = db.prepare("INSERT INTO private_data (staff_id, staff_name, content) VALUES (?, ?, ?)").run(staff_id, staff_name, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/private-data/:id", (req, res) => {
    const { content } = req.body;
    db.prepare("UPDATE private_data SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/private-data/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const result = db.prepare("DELETE FROM private_data WHERE id = ?").run(id);
    res.json({ success: true, changes: result.changes });
  });

  // Pending Lab Results Endpoints
  app.get("/api/pending-lab-results", (req, res) => {
    const data = db.prepare("SELECT * FROM pending_lab_results ORDER BY created_at DESC").all();
    res.json(data);
  });

  app.post("/api/pending-lab-results", (req, res) => {
    const { patient_id, patient_name, staff_id, staff_name, content, image_data } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO pending_lab_results (patient_id, patient_name, staff_id, staff_name, content, image_data) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, patient_name, staff_id, staff_name, content, image_data);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/pending-lab-results/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const result = db.prepare("DELETE FROM pending_lab_results WHERE id = ?").run(id);
    res.json({ success: true, changes: result.changes });
  });

  app.post("/api/pending-lab-results/:id/approve", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const pending = db.prepare("SELECT * FROM pending_lab_results WHERE id = ?").get(id) as any;
    if (!pending) {
      return res.status(404).json({ error: "Pending lab result not found" });
    }

    try {
      const transaction = db.transaction(() => {
        // Insert into private_data
        db.prepare("INSERT INTO private_data (staff_id, staff_name, content) VALUES (?, ?, ?)").run(
          pending.staff_id,
          pending.staff_name,
          pending.content
        );
        // Delete from pending_lab_results
        db.prepare("DELETE FROM pending_lab_results WHERE id = ?").run(id);
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
