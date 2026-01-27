/**
 * Authentication helpers for JWT-based authentication
 */

import jwt from "jsonwebtoken";

// Fixed users list
export const USERS = [
  {
    userName: "vishal",
    password: process.env.VISHAL_PASSWORD || "password1",
  },
];

// JWT secret - in production, use environment variable
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

/**
 * Generate JWT token for user
 */
export function generateToken(userName) {
  try {
    return jwt.sign({ userName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    console.error(
      `[Server] Error generating token for user: ${userName}`,
      error
    );
    return null;
  }
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate user credentials
 */
export function authenticateUser(userName, password) {
  console.error(`[Auth] Authenticating user: ${userName}`, USERS);
  const user = USERS.find((u) => u.userName === userName);
  if (!user) {
    return { success: false, error: "Invalid username or password" };
  }

  if (user.password !== password) {
    return { success: false, error: "Invalid username or password" };
  }

  return { success: true, user: { userName: user.userName } };
}

/**
 * Authentication middleware
 */
export function authenticate(req, res, next) {
  // Skip authentication only for login endpoint and health check
  // Use originalUrl to handle reverse proxy scenarios and base paths
  // Remove query string for path matching
  const path = (req.originalUrl || req.path).split("?")[0];
  console.error(
    `[Server] Auth middleware - method: ${req.method}, path: ${req.path}, originalUrl: ${req.originalUrl}, matched path: ${path}`
  );

  if (path === "/api/auth/login" || path === "/health") {
    console.error(`[Server] Auth middleware - skipping auth for: ${path}`);
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = decoded;
  next();
}
