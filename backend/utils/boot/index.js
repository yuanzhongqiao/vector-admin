process.env.NODE_ENV === "development"
  ? require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` })
  : require("dotenv").config();
const { OrganizationApiKey } = require("../../models/organizationApiKey");
const {
  OrganizationConnection,
} = require("../../models/organizationConnection");
const { OrganizationUser } = require("../../models/organizationUser");
const { SystemSettings } = require("../../models/systemSettings");
const { User } = require("../../models/user");

function findOrCreateDBFile() {
  const fs = require("fs");
  const path = require("path");
  const storageFolder = path.resolve(__dirname, `../../storage/`);
  const dbPath = `${storageFolder}vdbms.db`;
  if (!fs.existsSync(storageFolder)) fs.mkdirSync(storageFolder);
  if (fs.existsSync(dbPath)) return;
  fs.writeFileSync(dbPath, "");
  console.log("SQLite db created on boot.");
  return;
}

function setupVectorCacheStorage() {
  const fs = require("fs");
  const path = require("path");
  const storageFolder = path.resolve(__dirname, `../../storage/vector-cache`);
  if (!fs.existsSync(storageFolder))
    fs.mkdirSync(storageFolder, { recursive: true });
  console.log("Storage folder for vector-cache created.");
  return;
}

// Init all tables so to not try to reference foreign key
// tables that may not exist
async function initTables() {
  (await SystemSettings.db()).close();
  (await User.db()).close();
  (await OrganizationUser.db()).close();
  (await OrganizationApiKey.db()).close();
  (await OrganizationUser.db()).close();
  (await OrganizationConnection.db()).close();
}

async function systemInit() {
  try {
    await findOrCreateDBFile();
    await setupVectorCacheStorage();
    await initTables();
    const completeSetup = (await User.count('role = "admin"')) > 0;
    if (completeSetup) return;

    process.env.SYS_EMAIL = process.env.SYS_EMAIL ?? "root@vectoradmin.com";
    process.env.SYS_PASSWORD = process.env.SYS_PASSWORD ?? "password";

    const existingRootUser = await User.get(
      `email = '${process.env.SYS_EMAIL}' AND role = 'root'`
    );
    if (existingRootUser) return;

    const bcrypt = require("bcrypt");
    const userDb = await User.db();
    const { success, message } = await userDb
      .run(
        `INSERT INTO ${User.tablename} (email, password, role) VALUES (?, ?, 'root')`,
        [process.env.SYS_EMAIL, bcrypt.hashSync(process.env.SYS_PASSWORD, 10)]
      )
      .then((res) => {
        return { id: res.lastID, success: true, message: null };
      })
      .catch((error) => {
        return { id: null, success: false, message: error.message };
      });

    if (!success) {
      userDb.close();
      console.error("FAILED TO CREATE ROOT USER.", message);
    }

    console.log("Root user created with credentials");
    return;
  } catch (e) {
    console.error("systemInit", e.message, e);
    return;
  }
}

module.exports.systemInit = systemInit;