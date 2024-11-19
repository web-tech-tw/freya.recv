"use strict";

const {getMust} = require("../config");
const {StatusCodes} = require("http-status-codes");
const {useApp, withAwait, express} = require("../init/express");

const middlewareValidator = require("express-validator");
const middlewareInspector = require("../middleware/inspector");

const utilVisitor = require("../utils/visitor");
const utilTurnstile = require("../utils/turnstile");

const shortid = require("shortid");

const Room = require("../models/room");
const Submission = require("../models/submission");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.json());

router.post("/",
    middlewareValidator.body("roomCode").isString(),
    middlewareValidator.body("captcha").isString(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get request data
        const roomCode = req.body.roomCode;
        const captcha = req.body.captcha;

        const turnstileSecretKey = getMust("TURNSTILE_SECRET_KEY");
        const ipAddress = utilVisitor.getIPAddress(req);

        // Check room exists
        const room = await Room.findOne({code: roomCode}).exec();
        if (!room) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Check room is not abused
        if (room.isAbused) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    message: "Room is abused",
                });
            return;
        }

        // Check captcha
        if (!utilTurnstile.validResponse(
            captcha, turnstileSecretKey, ipAddress,
        )) {
            res.
                status(StatusCodes.BAD_REQUEST).
                send({
                    message: "Invalid captcha",
                });
            return;
        }

        // Generate code
        const code = shortid.generate();

        // Extract page URL
        const pageUrl = room.pageUrl;

        // Create submission
        const submission = new Submission({
            roomCode,
            code,
        });

        // Save submission
        await submission.save();

        // Return response
        res.
            status(StatusCodes.CREATED).
            send({code, pageUrl});
    }),
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/submissions", router);
};
