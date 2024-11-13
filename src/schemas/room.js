"use strict";

const mongoose = require("mongoose");

const {Schema} = mongoose;
const {ObjectId} = Schema.Types;

const schema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    isAbused: {
        type: Boolean,
        required: true,
        default: false,
    },
    label: {
        type: String,
        required: true,
    },
    members: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    backgroundImage: {
        type: String,
        required: true,
    },
    pageUrl: {
        type: String,
        required: true,
        unique: true,
    },
    administrators: {
        type: [ObjectId],
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = schema;
