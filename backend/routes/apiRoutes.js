const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const jwtAuth = require("../lib/jwtAuth");
const sendEmail = require("../utils/sendEmail");


// ✅ ADD JOB
router.post("/jobs", jwtAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.type !== "recruiter") {
      return res.status(401).json({
        message: "Only recruiters can post jobs",
      });
    }

    const data = req.body;

    await pool.execute(
      `INSERT INTO jobs 
      (userId, title, maxApplicants, maxPositions, deadline, skillsets, jobType, duration, salary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        data.title,
        data.maxApplicants,
        data.maxPositions,
        data.deadline,
        JSON.stringify(data.skillsets),
        data.jobType,
        data.duration,
        data.salary,
      ]
    );

    res.json({ message: "Job added successfully" });
  } catch (err) {
    res.status(400).json(err);
  }
});


// ✅ GET ALL JOBS (FINAL ADVANCED FILTERS)
router.get("/jobs", async (req, res) => {
  try {
    let query = "SELECT * FROM jobs WHERE 1=1";
    let values = [];

    // 🔍 search
    if (req.query.q) {
      query += " AND title LIKE ?";
      values.push(`%${req.query.q}%`);
    }

    // 💼 jobType (FIXED)
    if (req.query.jobType) {
      const types = req.query.jobType.split(",").map(t => t.trim());

      query += ` AND (` + types.map(() => "jobType LIKE ?").join(" OR ") + `)`;

      types.forEach(type => {
        values.push(`%${type}%`);
      });
    }

    // 💰 salary
    if (req.query.salaryMin) {
      query += " AND salary >= ?";
      values.push(req.query.salaryMin);
    }

    if (req.query.salaryMax) {
      query += " AND salary <= ?";
      values.push(req.query.salaryMax);
    }

    // ⏳ duration
    if (req.query.duration) {
      query += " AND duration <= ?";
      values.push(req.query.duration);
    }

    // 🧠 skills
    if (req.query.skills) {
      query += " AND skillsets LIKE ?";
      values.push(`%${req.query.skills}%`);
    }

    // 🔽 sorting
    const allowedSort = ["salary", "duration", "dateOfPosting"];

    if (req.query.sortBy && allowedSort.includes(req.query.sortBy)) {
      const order = req.query.order === "desc" ? "DESC" : "ASC";
      query += ` ORDER BY ${req.query.sortBy} ${order}`;
    }

    const [rows] = await pool.execute(query, values);

    res.json(rows);
  } catch (err) {
    res.status(400).json(err);
  }
});


// ✅ GET JOB BY ID
router.get("/jobs/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM jobs WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(400).json(err);
  }
});


// ✅ UPDATE JOB
router.put("/jobs/:id", jwtAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.type !== "recruiter") {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const data = req.body;

    await pool.execute(
      `UPDATE jobs SET 
        maxApplicants = ?, 
        maxPositions = ?, 
        deadline = ?
       WHERE id = ? AND userId = ?`,
      [
        data.maxApplicants,
        data.maxPositions,
        data.deadline,
        req.params.id,
        user.id,
      ]
    );

    res.json({ message: "Job updated successfully" });
  } catch (err) {
    res.status(400).json(err);
  }
});


// ✅ DELETE JOB
router.delete("/jobs/:id", jwtAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.type !== "recruiter") {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    await pool.execute(
      "DELETE FROM jobs WHERE id = ? AND userId = ?",
      [req.params.id, user.id]
    );

    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    res.status(400).json(err);
  }
});


// APPLY FOR JOB (WITH RESUME CHECK)
router.post("/jobs/:id/applications", jwtAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.type !== "applicant") {
      return res.status(401).json({
        message: "Only applicants can apply",
      });
    }

    //  NEW: CHECK RESUME
    const [userRows] = await pool.execute(
      "SELECT resume FROM users WHERE id = ?",
      [user.id]
    );

    if (!userRows[0].resume) {
      return res.status(400).json({
        message: "Upload resume before applying",
      });
    }

    const jobId = req.params.id;
    const { sop } = req.body;

    // ❌ already applied check
    const [existing] = await pool.execute(
      `SELECT * FROM applications 
       WHERE userId = ? AND jobId = ? 
       AND status NOT IN ('cancelled','rejected','finished')`,
      [user.id, jobId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Already applied",
      });
    }

    // 🔍 check job exists
    const [jobs] = await pool.execute(
      "SELECT * FROM jobs WHERE id = ?",
      [jobId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    const job = jobs[0];

    // ✅ insert application
    await pool.execute(
      `INSERT INTO applications 
       (userId, recruiterId, jobId, sop) 
       VALUES (?, ?, ?, ?)`,
      [user.id, job.userId, jobId, sop]
    );

    res.json({ message: "Applied successfully" });

  } catch (err) {
    res.status(400).json(err);
  }
});


// ✅ GET APPLICATIONS (RECRUITER)  🔥 UPDATED
router.get("/applications", jwtAuth, async (req, res) => {
  const user = req.user;

  if (user.type !== "recruiter") {
    return res.status(401).json({ message: "Only recruiters allowed" });
  }

  const [rows] = await pool.execute(
    `SELECT 
      applications.id,
      applications.status,
      applications.sop,
      users.email,
      users.resume,   -- ✅ ADDED THIS
      jobs.title
     FROM applications
     JOIN users ON applications.userId = users.id
     JOIN jobs ON applications.jobId = jobs.id
     WHERE applications.recruiterId = ?`,
    [user.id]
  );

  res.json(rows);
});


// ✅ MY APPLICATIONS
router.get("/my-applications", jwtAuth, async (req, res) => {
  const user = req.user;

  const [rows] = await pool.execute(
    `SELECT applications.status, jobs.title 
     FROM applications 
     JOIN jobs ON applications.jobId = jobs.id 
     WHERE applications.userId = ?`,
    [user.id]
  );

  res.json(rows);
});


// ✅ SAVE JOB
router.post("/jobs/:id/save", jwtAuth, async (req, res) => {
  const user = req.user;

  await pool.execute(
    "INSERT INTO saved_jobs (userId, jobId) VALUES (?, ?)",
    [user.id, req.params.id]
  );

  res.json({ message: "Saved" });
});


// ✅ GET SAVED JOBS
router.get("/saved-jobs", jwtAuth, async (req, res) => {
  const user = req.user;

  const [rows] = await pool.execute(
    `SELECT jobs.title FROM saved_jobs 
     JOIN jobs ON saved_jobs.jobId = jobs.id 
     WHERE saved_jobs.userId = ?`,
    [user.id]
  );

  res.json(rows);
});



// ✅ UPDATE APPLICATION STATUS (RECRUITER ONLY)
router.put("/applications/:id", jwtAuth, async (req, res) => {
  try {
    const user = req.user;
    const { status } = req.body;
    const appId = req.params.id;

    // 🔐 only recruiter allowed
    if (user.type !== "recruiter") {
      return res.status(401).json({
        message: "Only recruiters can update status",
      });
    }

    // ✅ valid statuses
    const validStatuses = ["shortlisted", "accepted", "rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    // 🔍 get application
    const [rows] = await pool.execute(
      "SELECT * FROM applications WHERE id = ?",
      [appId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const application = rows[0];

    // 🧠 VALID FLOW LOGIC
    if (application.status === "accepted" || application.status === "rejected") {
      return res.status(400).json({
        message: "Final status already set",
      });
    }

    // 🚫 cannot directly accept from applied
    if (application.status === "applied" && status === "accepted") {
      return res.status(400).json({
        message: "Shortlist before accepting",
      });
    }

    // ✅ update status
    await pool.execute(
      "UPDATE applications SET status = ? WHERE id = ?",
      [status, appId]
    );

    // 🔥 EMAIL TEST (HARDCODED TO YOUR EMAIL)
    await sendEmail(
  applicantEmail,
  "Application Status Update",
  `Your application status has been updated to: ${status}`
);

    res.json({
      message: `Application ${status} successfully`,
    });

  } catch (err) {
    res.status(400).json(err);
  }
});


module.exports = router;