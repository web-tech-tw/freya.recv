"use strict";

// Routers
exports.routerFiles = [
    "./rooms.js",
    "./submissions.js",
    "./swagger.js",
];

// Load routes
exports.load = () => {
    const routerMappers = exports.routerFiles.map((n) => require(n));
    routerMappers.forEach((c) => c());
};
