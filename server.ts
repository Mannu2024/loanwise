import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not found. Auth features will be limited.");
}

const db = admin.apps.length ? admin.firestore() : null;
const auth = admin.apps.length ? admin.auth() : null;

// Node.js supports TypeScript type stripping natively — no compilation step is required.
// If server-side code uses enums, modify the build and start scripts to compile the entry point file to dist/server.cjs with esbuild or similar.

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OTP Routes
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email || !db) {
      return res.status(400).json({ error: "Email is required or Firebase not initialized" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    try {
      // Store OTP in Firestore
      await db.collection("otps").doc(email).set({
        otp,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send Email
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"CreditWise" <noreply@creditwise.com>',
        to: email,
        subject: "Your CreditWise Verification Code",
        text: `Your verification code is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Verification Code</h2>
            <p>Use the following code to verify your email address on CreditWise:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes.</p>
          </div>
        `,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp || !db || !auth) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    try {
      const otpDoc = await db.collection("otps").doc(email).get();
      if (!otpDoc.exists) {
        return res.status(400).json({ error: "OTP not found" });
      }

      const data = otpDoc.data();
      if (data?.otp !== otp || data?.expiresAt < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      // OTP is valid, delete it
      await db.collection("otps").doc(email).delete();

      // Check if user exists
      let isNewUser = false;
      let customToken = null;
      try {
        const userRecord = await auth.getUserByEmail(email);
        // User exists, generate custom token for login
        customToken = await auth.createCustomToken(userRecord.uid);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          isNewUser = true;
        } else {
          throw error;
        }
      }

      res.json({ success: true, isNewUser, customToken });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Verification failed" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
