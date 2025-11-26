"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const db_1 = require("./db");
const PORT = process.env.PORT || 4000;
(0, db_1.initDb)()
    .then(() => {
    app_1.default.listen(PORT, () => {
        console.log(`Push / Pull API running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
});
