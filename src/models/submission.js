"use strict";

const {useDatabase} = require("../init/database");
const database = useDatabase();

const schema = require("../schemas/submission");
module.exports = database.model("Submission", schema);
