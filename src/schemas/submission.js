"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

const schema = new Schema({
    roomCode: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
    },
}, {
    timestamps: true,
});

module.exports = schema;
